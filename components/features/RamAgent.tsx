import React, { useState, useEffect, useRef } from 'react';
import { runRamAgent, generateRamVoice } from '../../services/geminiService';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { MicrophoneIcon } from '../icons/MicrophoneIcon';
import Loader from '../ui/Loader';
import { SparklesIcon } from '../icons/SparklesIcon';
import { FeatureId } from '../../constants';

interface RamAgentProps {
    onNavigate: (featureId: FeatureId) => void;
}

type Emotion = 'happy' | 'thinking' | 'talking' | 'listening' | 'witty';

const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
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

const RamAgent: React.FC<RamAgentProps> = ({ onNavigate }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [responseText, setResponseText] = useState<string>('');
    const [emotion, setEmotion] = useState<Emotion>('happy');
    
    // Position State for Draggability
    const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const { isListening, transcript, startListening, stopListening, hasRecognitionSupport } = useSpeechToText();
    const audioContextRef = useRef<AudioContext | null>(null);

    const emotionMap: Record<Emotion, string> = {
        happy: '😊',
        thinking: '🤔',
        talking: '🗣️',
        listening: '👂',
        witty: '😎'
    };

    // --- Drag Logic ---
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        // Only allow dragging from the header area
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragOffset.current = {
            x: clientX - pos.x,
            y: clientY - pos.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            let newX = clientX - dragOffset.current.x;
            let newY = clientY - dragOffset.current.y;

            // Boundaries
            const padding = 10;
            newX = Math.max(padding, Math.min(newX, window.innerWidth - 330));
            newY = Math.max(padding, Math.min(newY, window.innerHeight - 200));

            setPos({ x: newX, y: newY });
        };

        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove);
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging]);

    const handleAgentInteraction = async () => {
        if (!transcript.trim()) return;
        setIsProcessing(true);
        setEmotion('thinking');
        setResponseText(''); 

        try {
            const result = await runRamAgent(transcript);
            
            const functionCalls = result.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                setEmotion('witty');
                for (const call of functionCalls) {
                    const args = call.args as any;
                    if (call.name === 'play_youtube') {
                        const query = encodeURIComponent(args.query);
                        window.open(`https://www.youtube.com/results?search_query=${query}&sp=EgIQAQ%253D%253D`, '_blank');
                    } 
                    else if (call.name === 'open_system_app') {
                        const { app_id, data } = args;
                        const encodedData = encodeURIComponent(data || '');
                        switch (app_id) {
                            case 'whatsapp': window.open(`whatsapp://send?text=${encodedData}`, '_blank'); break;
                            case 'maps': window.open(`https://www.google.com/maps/search/${encodedData}`, '_blank'); break;
                            case 'calculator': window.location.href = "calc:"; break;
                            case 'calendar': window.open('https://calendar.google.com', '_blank'); break;
                            case 'settings': window.location.href = "ms-settings:"; break;
                        }
                    } 
                    else if (call.name === 'web_browser_search') {
                        const query = encodeURIComponent(args.query);
                        window.open(`https://www.google.com/search?q=${query}`, '_blank');
                    }
                    else if (call.name === 'navigate_to_feature') {
                        const featureIdMap: Record<string, FeatureId> = {
                            'tutor': FeatureId.TUTOR,
                            'exam-prep': FeatureId.EXAM_PREP,
                            'coding-mentor': FeatureId.CODING_MENTOR
                        };
                        if (featureIdMap[args.feature_id]) onNavigate(featureIdMap[args.feature_id]);
                    }
                }
            }

            if (result.text) {
                setResponseText(result.text);
                setEmotion('talking');
                await speakWithGemini(result.text);
            }
        } catch (error) {
            console.error("Ram Agent Error:", error);
            setEmotion('happy');
            setResponseText("Sare Master-u, emaina mistake ayyundachu. Mallee try cheyyi!");
        } finally {
            setIsProcessing(false);
        }
    };

    const prevListening = useRef(isListening);
    useEffect(() => {
        if (prevListening.current && !isListening && transcript) handleAgentInteraction();
        if (isListening) setEmotion('listening');
        prevListening.current = isListening;
    }, [isListening, transcript]);

    const speakWithGemini = async (text: string) => {
        try {
            const base64Audio = await generateRamVoice(text);
            if (!base64Audio) return;
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const ctx = audioContextRef.current;
            const audioData = decodeBase64(base64Audio);
            const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => setEmotion('happy');
            source.start();
        } catch (err) {
            console.error("TTS error:", err);
            speakFallback(text);
        }
    };

    const speakFallback = (text: string) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'te-IN';
            utterance.onend = () => setEmotion('happy');
            window.speechSynthesis.speak(utterance);
        }
    };

    const toggleListening = () => {
        if (isListening) stopListening();
        else {
            setResponseText("Ram ikkade unnadu! Em help cheyyali mama?");
            startListening();
        }
    };

    if (!hasRecognitionSupport) return null;

    return (
        <div 
            style={{ 
                position: 'fixed', 
                left: `${pos.x}px`, 
                top: `${pos.y}px`,
                cursor: isDragging ? 'grabbing' : 'default'
            }}
            className="w-80 z-[100] transition-shadow duration-300"
        >
            <div className={`bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 backdrop-blur-3xl border border-white/20 p-4 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] w-full ring-2 ring-indigo-500/30 overflow-hidden ${isDragging ? 'scale-105 shadow-2xl opacity-90' : 'scale-100'}`}>
                
                {/* Header (Drag Handle) */}
                <div 
                    onMouseDown={handleMouseDown} 
                    onTouchStart={handleMouseDown}
                    className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing select-none"
                    title="Drag to move Ram anywhere!"
                >
                    <div className="flex items-center gap-3">
                        <div className="relative pointer-events-none">
                            <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl animate-pulse opacity-40"></div>
                            <div className="relative bg-white text-2xl p-2 rounded-2xl shadow-2xl border border-indigo-200">
                                {emotionMap[emotion]}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black tracking-widest text-white text-[10px] uppercase italic">RAM PRO V4.2</span>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></span>
                                <span className="text-[8px] text-indigo-200 font-bold uppercase tracking-wider">
                                    {isListening ? 'Listening...' : 'Movable Agent'}
                                </span>
                            </div>
                        </div>
                    </div>
                    {isProcessing ? <Loader size="sm" className="text-cyan-400" /> : <div className="text-white/20">:::</div>}
                </div>

                {/* Message Bubble */}
                <div className="bg-black/40 rounded-2xl p-4 min-h-[60px] mb-3 border border-white/5 shadow-inner">
                    <p className="text-[12px] leading-relaxed text-indigo-50 font-medium italic">
                        {isListening ? (
                            <span className="text-cyan-300 font-bold">"{transcript || 'Em cheppali mama?'}"</span>
                        ) : (
                            responseText || "Namaskaram! Nenu Mee Ram. Nannu ekkadikaina move cheyyachu mama!"
                        )}
                    </p>
                </div>

                {/* Action Button */}
                <button
                    onClick={toggleListening}
                    className={`relative overflow-hidden p-4 rounded-2xl transition-all duration-500 shadow-2xl flex items-center gap-3 w-full justify-center group/btn
                        ${isListening 
                            ? 'bg-red-600 text-white ring-4 ring-red-500/30' 
                            : 'bg-white text-indigo-950 hover:bg-cyan-50 active:scale-95'
                        }`}
                >
                    <MicrophoneIcon className={`w-6 h-6 transition-all duration-300 ${isListening ? 'scale-125 rotate-12' : 'group-hover/btn:rotate-12'}`} />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                        {isListening ? 'STOP' : 'TALK TO RAM'}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                </button>

                <div className="mt-3 text-center pointer-events-none">
                    <span className="text-[7px] text-white/20 uppercase tracking-[0.4em] font-bold">Grab Header to Move</span>
                </div>
            </div>
        </div>
    );
};

export default RamAgent;
