import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '../../types';
import { generateTutorResponseStream, generateTutorVoice } from '../../services/geminiService';
import { TUTOR_LANGUAGES, AI_VOICES } from '../../constants';
import Select from '../ui/Select';
import Loader from '../ui/Loader';
import { MicrophoneIcon } from '../icons/MicrophoneIcon';
import { ImageIcon } from '../icons/ImageIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { useVoiceConversation } from '../../hooks/useVoiceConversation';
import { StopCircleIcon } from '../icons/StopCircleIcon';
import { SpeakerWaveIcon } from '../icons/SpeakerWaveIcon';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

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

const PersonalTutor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  // Default language to Telugu
  const [language, setLanguage] = useState('Telugu');
  // Default voice to Zephyr (M)
  const [voice, setVoice] = useState('Zephyr');
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const systemInstruction = useMemo(() => 
    `You are a friendly and encouraging personal tutor. Your goal is to explain complex subjects in a simple, easy-to-understand way. All your responses must be in ${language}. Use relevant examples and analogies. Do not use markdown formatting like asterisks, underscores, or backticks for emphasis or code.`
  , [language]);

  const { conversationState, startConversation, stopConversation } = useVoiceConversation({
      systemInstruction,
      onUpdateHistory: setMessages,
      initialHistory: messages,
      voice,
  });


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      event.target.value = ''; // Reset file input
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    if ((input.trim() === '' && !imageFile) || isLoading) return;

    setIsLoading(true);
    let imageData: { mimeType: string; data: string; } | undefined = undefined;

    try {
      if (imageFile) {
        const base64Data = await fileToBase64(imageFile);
        imageData = { mimeType: imageFile.type, data: base64Data };
      }
      
      const userMessage: ChatMessage = { role: 'user', text: input, imageUrl: imagePreview };
      setMessages(prev => [...prev, userMessage, { role: 'model', text: '', sources: [] }]);
      
      const history = [...messages];
      const stream = await generateTutorResponseStream(input, language, history, imageData);
      
      for await (const chunk of stream) {
          setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'model') {
                  if (chunk.text) lastMessage.text += chunk.text;
                  if (chunk.sources && chunk.sources.length > 0) {
                      // Only add unique sources
                      const existingUris = new Set(lastMessage.sources?.map(s => s.uri));
                      const newSources = chunk.sources.filter(s => !existingUris.has(s.uri));
                      lastMessage.sources = [...(lastMessage.sources || []), ...newSources];
                  }
              }
              return newMessages;
          });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'model') {
              lastMessage.text = "Sorry, I encountered an error while researching. Please try again.";
          }
          return newMessages;
      });
    } finally {
      setInput('');
      removeImage();
      setIsLoading(false);
    }
  };

  const handlePlayVoice = async (text: string, index: number) => {
      if (playingMessageIndex !== null) return;
      setPlayingMessageIndex(index);

      try {
          const base64Audio = await generateTutorVoice(text, voice);
          if (!base64Audio) {
              setPlayingMessageIndex(null);
              return;
          }

          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }

          const ctx = audioContextRef.current;
          const audioData = decodeBase64(base64Audio);
          const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
          
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => setPlayingMessageIndex(null);
          source.start();
      } catch (err) {
          console.error("TTS generation error:", err);
          setPlayingMessageIndex(null);
      }
  };

  const isVoiceMode = conversationState !== 'idle';
  
  return (
    <div className="flex flex-col h-[65vh]">
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-gray-200">AI Personal Tutor</h2>
            <p className="text-[10px] text-purple-400 font-bold tracking-widest uppercase">Live Web Research Enabled</p>
        </div>
        <div className="flex items-center gap-2">
            <Select value={language} onChange={e => setLanguage(e.target.value)} options={TUTOR_LANGUAGES} />
            <Select value={voice} onChange={e => setVoice(e.target.value)} options={AI_VOICES} />
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`group relative p-4 rounded-2xl max-w-lg shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-700 text-gray-200 rounded-tl-none border border-gray-600'}`}>
                {msg.imageUrl && <img src={msg.imageUrl} alt="User upload" className="rounded-lg max-w-xs mb-3 shadow-md" />}
                
                {msg.role === 'model' && msg.text && (
                    <button 
                        onClick={() => handlePlayVoice(msg.text!, index)}
                        className={`absolute -right-10 top-2 p-2 rounded-full transition-all duration-300 ${playingMessageIndex === index ? 'text-purple-400 animate-pulse bg-gray-800 shadow-lg' : 'text-gray-500 hover:text-purple-400 hover:bg-gray-800 opacity-0 group-hover:opacity-100'}`}
                        disabled={playingMessageIndex !== null}
                        title="Voice Over"
                    >
                        {playingMessageIndex === index ? <Loader size="sm" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                    </button>
                )}

                {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                
                {/* Grounding Sources (Scraped Links) */}
                {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-tighter mb-2">Sources Found:</p>
                        <div className="flex flex-wrap gap-2">
                            {msg.sources.map((s, i) => (
                                <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-indigo-950/40 hover:bg-indigo-900/60 text-cyan-400 px-2 py-1 rounded border border-cyan-900/50 transition-colors truncate max-w-[150px]">
                                    🔗 {s.title || 'Source'}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {msg.role === 'model' && isLoading && index === messages.length - 1 && !isVoiceMode && !msg.text && (
                    <div className="flex items-center gap-2 text-indigo-300 py-1">
                        <Loader size="sm" />
                        <span className="text-xs animate-pulse italic">Researching live web...</span>
                    </div>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex flex-col">
        {imagePreview && !isVoiceMode && (
          <div className="relative w-32 mb-2">
            <img src={imagePreview} alt="Selected preview" className="rounded-lg h-32 w-32 object-cover border-2 border-purple-500" />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-white hover:bg-red-500 transition-colors shadow-lg"
              aria-label="Remove image"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
        )}
        {isVoiceMode ? (
            <div className="flex items-center justify-center gap-4 bg-gray-700/50 p-4 rounded-2xl border border-gray-600 shadow-xl">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                    </span>
                    <span className="text-gray-300 capitalize font-medium">{conversationState}...</span>
                </div>
                <button
                    onClick={stopConversation}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full bg-red-900/50 hover:bg-red-900"
                    aria-label="Stop conversation"
                >
                    <StopCircleIcon className="h-8 w-8" />
                </button>
            </div>
        ) : (
          <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-2xl border border-gray-700 shadow-inner">
            <button
              onClick={startConversation}
              className="p-3 text-gray-400 hover:text-purple-400 transition-all hover:bg-gray-700 rounded-xl"
              aria-label="Start voice conversation"
              disabled={isLoading}
            >
              <MicrophoneIcon className="h-6 w-6" />
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
                accept="image/*"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-indigo-400 transition-all hover:bg-gray-700 rounded-xl"
                aria-label="Attach image"
                disabled={isLoading}
            >
                <ImageIcon className="h-6 w-6" />
            </button>
            <div className="flex-grow">
                <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your tutor... (e.g., 'What are the current prices of Tesla stock?')"
                className="w-full bg-transparent border-none rounded-lg px-4 py-3 focus:outline-none text-gray-100 placeholder-gray-500"
                disabled={isLoading}
                />
            </div>
            <button
                onClick={handleSend}
                disabled={isLoading || (input.trim() === '' && !imageFile)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
            >
                {isLoading ? 'Thinking...' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalTutor;