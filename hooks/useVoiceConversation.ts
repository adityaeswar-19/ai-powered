// FIX: Import React to provide the React namespace for types like React.Dispatch.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { ChatMessage } from '../types';

// FIX: Add global declaration for webkitAudioContext to fix TypeScript errors and ensure cross-browser compatibility.
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// FIX: Initialize the GoogleGenAI client with the API key from environment variables as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Define LiveSession type helper since it's not exported directly in the current SDK version.
type LiveSession = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>>;

// Helper function to resample an audio buffer to a target sample rate.
const resampleBuffer = (inputBuffer: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array => {
    if (fromSampleRate === toSampleRate) {
        return inputBuffer;
    }

    const inputLength = inputBuffer.length;
    const outputLength = Math.round(inputLength * toSampleRate / fromSampleRate);
    const outputBuffer = new Float32Array(outputLength);

    if (inputLength === 0 || outputLength === 0) {
        return outputBuffer;
    }
    
    if (outputLength === 1) {
        let sum = 0;
        for (let i = 0; i < inputLength; i++) {
            sum += inputBuffer[i];
        }
        outputBuffer[0] = sum / inputLength;
        return outputBuffer;
    }

    const ratio = (inputLength - 1) / (outputLength - 1);
    
    for (let i = 0; i < outputLength; i++) {
        const index = i * ratio;
        const low = Math.floor(index);
        const high = Math.ceil(index);
        
        if (low === high) {
            outputBuffer[i] = inputBuffer[low];
        } else {
            const weight = index - low;
            outputBuffer[i] = inputBuffer[low] * (1 - weight) + inputBuffer[high] * weight;
        }
    }
    return outputBuffer;
};


// Base64 and Audio Decoding/Encoding Helpers
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

interface UseVoiceConversationProps {
  systemInstruction: string;
  onUpdateHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  initialHistory: ChatMessage[];
  voice: string;
}

export const useVoiceConversation = ({ systemInstruction, onUpdateHistory, voice }: UseVoiceConversationProps) => {
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isStoppingRef = useRef(false);

  const cleanup = useCallback(async () => {
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    const closePromises = [];
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        closePromises.push(inputAudioContextRef.current.close());
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        closePromises.push(outputAudioContextRef.current.close());
    }
    
    if(closePromises.length > 0) {
        await Promise.all(closePromises.map(p => p.catch(console.error)));
    }

    setConversationState('idle');
  }, []);
  
  const stopConversation = useCallback(async () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      sessionPromiseRef.current = null;
    }
    await cleanup();
    isStoppingRef.current = false;
  }, [cleanup]);


  const startConversation = useCallback(async () => {
    if (conversationState !== 'idle') return;

    setError(null);
    setConversationState('listening');

    try {
        inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

        let currentInputTranscription = '';
        let currentOutputTranscription = '';

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                systemInstruction,
                outputAudioTranscription: {},
                inputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    mediaStreamSourceRef.current = source;
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(1024, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputBuffer = audioProcessingEvent.inputBuffer;
                        const rawPcmData = inputBuffer.getChannelData(0);
                        const resampledData = resampleBuffer(rawPcmData, inputBuffer.sampleRate, 16000);
                        const pcmBlob = createBlob(resampledData);

                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then((session) => {
                             session.sendRealtimeInput({ media: pcmBlob });
                           });
                        }
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscription += message.serverContent.inputTranscription.text;
                        onUpdateHistory(prevHistory => {
                            const newHistory = [...prevHistory];
                            const lastMsg = newHistory[newHistory.length - 1];
                            if (lastMsg?.role === 'user' && lastMsg.isPartial) {
                                lastMsg.text = currentInputTranscription;
                            } else {
                                newHistory.push({ role: 'user', text: currentInputTranscription, isPartial: true });
                            }
                            return newHistory;
                        });
                    }
                    if (message.serverContent?.outputTranscription) {
                        setConversationState('speaking');
                        currentOutputTranscription += message.serverContent.outputTranscription.text;
                        onUpdateHistory(prevHistory => {
                            const newHistory = [...prevHistory];
                            const lastMsg = newHistory[newHistory.length - 1];
                            if (lastMsg?.role === 'model' && lastMsg.isPartial) {
                                lastMsg.text = currentOutputTranscription;
                            } else {
                                newHistory.push({ role: 'model', text: currentOutputTranscription, isPartial: true });
                            }
                            return newHistory;
                        });
                    }
                    if (message.serverContent?.turnComplete) {
                        onUpdateHistory(prevHistory => {
                            const newHistory = [...prevHistory];
                            const finalUserMsg = newHistory.find(m => m.role === 'user' && m.isPartial);
                            if (finalUserMsg) finalUserMsg.isPartial = false;
                            
                            const finalModelMsg = newHistory.find(m => m.role === 'model' && m.isPartial);
                            if (finalModelMsg) finalModelMsg.isPartial = false;
    
                            return newHistory;
                        });

                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        setConversationState('listening');
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContextRef.current.destination);
                        
                        source.addEventListener('ended', () => {
                            audioSourcesRef.current.delete(source);
                        });
                        
                        const currentTime = outputAudioContextRef.current.currentTime;
                        const startTime = Math.max(currentTime, nextStartTimeRef.current);
                        source.start(startTime);
                        nextStartTimeRef.current = startTime + audioBuffer.duration;
                        audioSourcesRef.current.add(source);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error("Session error:", e);
                    setError('A connection error occurred.');
                    stopConversation();
                },
                onclose: (e: CloseEvent) => {
                    stopConversation();
                },
            },
        });
        await sessionPromiseRef.current;
    } catch (e) {
        console.error("Failed to start conversation:", e);
        setError('Could not access microphone. Please check permissions.');
        cleanup();
    }
  }, [conversationState, systemInstruction, onUpdateHistory, cleanup, stopConversation, voice]);
  
  useEffect(() => {
      return () => {
          stopConversation();
      }
  }, [stopConversation]);

  return { conversationState, error, startConversation, stopConversation };
};