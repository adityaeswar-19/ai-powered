
import React, { useState, useEffect, useRef } from 'react';
import { explainCode, generateTutorVoice } from '../../services/geminiService';
import { CodeExplanation } from '../../types';
import { CODING_LANGUAGES } from '../../constants';
import Button from '../ui/Button';
import TextArea from '../ui/TextArea';
import Select from '../ui/Select';
import Loader from '../ui/Loader';
import Card from '../ui/Card';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { MicrophoneIcon } from '../icons/MicrophoneIcon';
import { SpeakerWaveIcon } from '../icons/SpeakerWaveIcon';

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

const CodingMentor: React.FC = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState(CODING_LANGUAGES[0].value);
  const [explanation, setExplanation] = useState<CodeExplanation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const { isListening, transcript, startListening, stopListening, hasRecognitionSupport } = useSpeechToText();
  const initialCodeRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      initialCodeRef.current = code;
      startListening();
    }
  };

  useEffect(() => {
    if (isListening) {
      const separator = initialCodeRef.current.trim() === '' ? '' : ' ';
      setCode(initialCodeRef.current + separator + transcript);
    }
  }, [transcript, isListening]);

  const handleExplain = async () => {
    if (!code.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setExplanation(null);
    try {
      const result = await explainCode(code, language);
      setExplanation(result);
    } catch (err) {
      console.error(err);
      setError('Failed to get explanation. The code might be invalid or the model is unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayVoice = async (text: string, index: number) => {
    if (playingIndex !== null) return;
    setPlayingIndex(index);

    try {
        const base64Audio = await generateTutorVoice(text, 'Zephyr');
        if (!base64Audio) {
            setPlayingIndex(null);
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
        source.onended = () => setPlayingIndex(null);
        source.start();
    } catch (err) {
        console.error("TTS generation error:", err);
        setPlayingIndex(null);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-200 mb-4">Coding Mentor</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Select 
            value={language}
            onChange={e => setLanguage(e.target.value)}
            options={CODING_LANGUAGES}
            className="mb-2"
          />
          <div className="relative">
            <TextArea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`// Paste your ${language} code here...`}
              rows={15}
              className="font-mono text-sm"
              disabled={isLoading}
            />
            {hasRecognitionSupport && (
              <button
                  onClick={handleToggleListening}
                  className={`absolute right-2 top-2 p-1.5 rounded-full text-gray-400 hover:text-white transition-all duration-300
                    ${isListening ? 'text-purple-400 bg-purple-900/50 ring-2 ring-purple-500 animate-pulse' : ''}`
                  }
                  aria-label={isListening ? 'Stop listening' : 'Start listening for code'}
              >
                  <MicrophoneIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <Button onClick={handleExplain} disabled={isLoading || !code.trim()} className="mt-4">
            {isLoading ? 'Explaining...' : 'Explain Code'}
          </Button>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-gray-300">Explanation</h3>
          <Card className="h-[calc(100%-5rem)] overflow-y-auto">
            {isLoading && <div className="flex justify-center items-center h-full"><Loader /></div>}
            {error && <p className="text-red-400">{error}</p>}
            {explanation && (
              <div className="font-mono text-sm space-y-4">
                {explanation.map((item, index) => (
                  <div key={index} className="relative border-b border-gray-700 pb-3 last:border-b-0 group">
                    <pre className="bg-gray-900 p-2 rounded-md text-purple-300 overflow-x-auto"><code>{`Line ${item.lineNumber}: ${item.code}`}</code></pre>
                    <div className="mt-2 pr-10">
                        <p className="text-gray-300">{item.explanation}</p>
                    </div>
                    <button 
                        onClick={() => handlePlayVoice(item.explanation, index)}
                        className={`absolute right-0 top-12 p-2 rounded-full transition-all duration-300 ${playingIndex === index ? 'text-purple-400 animate-pulse bg-gray-900 shadow-lg' : 'text-gray-500 hover:text-purple-400 hover:bg-gray-900 opacity-0 group-hover:opacity-100'}`}
                        disabled={playingIndex !== null}
                        title="Read explanation aloud"
                    >
                        {playingIndex === index ? <Loader size="sm" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && !explanation && !error && (
              <p className="text-center text-gray-400 pt-16">Your code explanation will appear here.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CodingMentor;
