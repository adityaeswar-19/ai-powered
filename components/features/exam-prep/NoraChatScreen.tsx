import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NoraSession, ChatMessage, QuizQuestion, Flashcard } from '../../../types';
import { generateNoraTextStream, generateNoraJson, generateImage } from '../../../services/geminiService';
import { Type } from '@google/genai';
import Button from '../../ui/Button';
import Loader from '../../ui/Loader';
import Modal from '../../ui/Modal';
import { useSpeechToText } from '../../../hooks/useSpeechToText';
import { MicrophoneIcon } from '../../icons/MicrophoneIcon';
import { ImageIcon } from '../../icons/ImageIcon';
import { XCircleIcon } from '../../icons/XCircleIcon';
import { useVoiceConversation, ConversationState } from '../../../hooks/useVoiceConversation';
import { StopCircleIcon } from '../../icons/StopCircleIcon';
import Select from '../../ui/Select';
import { AI_VOICES } from '../../../constants';

interface NoraChatScreenProps {
  session: NoraSession;
  onUpdateHistory: (sessionId: string, newHistory: ChatMessage[]) => void;
  onGoBack: () => void;
}

const NORA_SYSTEM_INSTRUCTION = (notes: string) => `You are an expert study assistant called NORA (Note-Oriented Reference Assistant). Your knowledge is strictly based on the following notes. Do not use outside information. When asked to generate a quiz or flashcards, respond only with the requested JSON. When asked a question, answer it based on the notes. Your text responses should be clean and should not contain markdown formatting. NOTES:\n\n---\n${notes}\n---`;

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const NoraChatScreen: React.FC<NoraChatScreenProps> = ({ session, onUpdateHistory, onGoBack }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>(session.history);
  const [voice, setVoice] = useState(AI_VOICES[0].value);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    onUpdateHistory(session.id, history);
  }, [history, onUpdateHistory, session.id]);


  const { isListening: isImageListening, transcript: imageTranscript, startListening: startImageListening, stopListening: stopImageListening, hasRecognitionSupport } = useSpeechToText();

  useEffect(() => {
    if (isImageListening) {
      setImagePrompt(imageTranscript);
    }
  }, [imageTranscript, isImageListening]);
  
  // FIX: Truncate long notes for the voice conversation's system instruction
  // to prevent "Internal error" from the API on session start.
  const systemInstructionForVoice = useMemo(() => {
    const MAX_NOTES_LENGTH = 4000; // Limit notes to a safe length for the system instruction
    const truncatedNotes = session.notes.length > MAX_NOTES_LENGTH
        ? session.notes.substring(0, MAX_NOTES_LENGTH) + "\n... (notes truncated for this voice session)"
        : session.notes;
    return NORA_SYSTEM_INSTRUCTION(truncatedNotes);
  }, [session.notes]);

  const { conversationState, startConversation, stopConversation } = useVoiceConversation({
      systemInstruction: systemInstructionForVoice,
      onUpdateHistory: setHistory,
      initialHistory: history,
      voice,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [history]);
  
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      event.target.value = '';
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const addMessage = (message: ChatMessage) => {
    setHistory(prev => [...prev, message]);
  };

  const updateLastMessage = (updateFn: (lastMessage: ChatMessage) => void) => {
    setHistory(prev => {
        const newHistory = [...prev];
        const lastMessage = newHistory[newHistory.length - 1];
        if (lastMessage) {
            updateFn(lastMessage);
        }
        return newHistory;
    });
  }

  const handleSend = async (prompt: string, type: 'text' | 'quiz' | 'flashcards' | 'image-prompt' = 'text') => {
    if ((!prompt.trim() && !imageFile && type === 'text') || (!prompt.trim() && type !== 'text') || isLoading) return;
    
    setIsLoading(true);
    let imageData: { mimeType: string; data: string; } | undefined = undefined;
    
    const currentSessionState: NoraSession = { ...session, history: history };

    try {
        if (imageFile && type === 'text') {
            const base64Data = await fileToBase64(imageFile);
            imageData = { mimeType: imageFile.type, data: base64Data };
        }

        addMessage({ role: 'user', text: prompt, imageUrl: imagePreview });
        const modelMessage: ChatMessage = { role: 'model', text: '' };
        addMessage(modelMessage);

        if(type === 'quiz' || type === 'flashcards') {
            const schema = type === 'quiz' ? {
                type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.STRING } }, required: ['question', 'options', 'correctAnswer'] }
            } : {
                type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, definition: { type: Type.STRING } }, required: ['term', 'definition'] }
            };
            const result = await generateNoraJson(currentSessionState, prompt, schema, imageData);
            updateLastMessage(msg => Object.assign(msg, type === 'quiz' ? { quiz: result } : { flashcards: result }, { text: undefined }));
        } else if (type === 'image-prompt') {
            const imageUrl = await generateImage(prompt);
            updateLastMessage(msg => Object.assign(msg, { imageUrl, text: undefined }));
        }
        else {
            const stream = await generateNoraTextStream(currentSessionState, prompt, imageData);
            for await (const chunk of stream) {
                updateLastMessage(msg => {
                    if (msg.text !== undefined) {
                        msg.text += chunk
                    }
                });
            }
        }
    } catch (error) {
      console.error(error);
      updateLastMessage(msg => msg.text = "Sorry, I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
      setInput('');
      setImagePrompt('');
      removeImage();
      setIsImageModalOpen(false);
    }
  };

  const ChatContent: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
    if (msg.imageUrl && !msg.text && !msg.quiz && !msg.flashcards) return null; // Image is handled outside
    if (msg.quiz) return <QuizDisplay quiz={msg.quiz} />;
    if (msg.flashcards) return <FlashcardDisplay flashcards={msg.flashcards} />;
    return <p className="whitespace-pre-wrap">{msg.text}</p>;
  };
  
  const isVoiceMode = conversationState !== 'idle';
  
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the history for this session? This cannot be undone.')) {
        setHistory([]);
    }
  };
  
  return (
    <div className="flex flex-col h-[65vh]">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <Button onClick={onGoBack} className="mr-4 bg-gray-600 hover:bg-gray-700">Back</Button>
          <h2 className="text-xl font-semibold text-gray-200 truncate">{session.name}</h2>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={handleClearHistory} className="bg-gray-700 hover:bg-gray-600 text-sm py-1.5 px-3">Clear History</Button>
            <Select value={voice} onChange={(e) => setVoice(e.target.value)} options={AI_VOICES} />
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {history.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              {msg.imageUrl && <img src={msg.imageUrl} alt={msg.role === 'user' ? "User upload" : "Generated content"} className="rounded-lg max-w-sm mb-2" />}
              {msg.role === 'user' && msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
              {msg.role === 'model' && <ChatContent msg={msg} />}
              {msg.role === 'model' && isLoading && index === history.length - 1 && !isVoiceMode && <Loader size="sm" />}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex flex-col">
        {imagePreview && !isVoiceMode && (
            <div className="relative w-32 mb-2">
                <img src={imagePreview} alt="Selected preview" className="rounded-lg h-32 w-32 object-cover" />
                <button onClick={removeImage} className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-white hover:bg-red-500 transition-colors" aria-label="Remove image">
                    <XCircleIcon className="h-6 w-6" />
                </button>
            </div>
        )}
        {isVoiceMode ? (
            <div className="flex items-center justify-center gap-4 bg-gray-700/50 p-4 rounded-lg">
                <span className="text-gray-300 capitalize">{conversationState}...</span>
                <button
                    onClick={stopConversation}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full bg-red-900/50"
                    aria-label="Stop conversation"
                >
                    <StopCircleIcon className="h-8 w-8" />
                </button>
            </div>
        ) : (
            <>
                <div className="flex flex-wrap gap-2 mb-2">
                    <Button onClick={() => handleSend('Summarize the key points from the notes.', 'text')} disabled={isLoading}>Summarize</Button>
                    <Button onClick={() => handleSend('Generate a 5-question multiple choice quiz.', 'quiz')} disabled={isLoading}>Create Quiz</Button>
                    <Button onClick={() => handleSend('Generate 10 flashcards for the main terms.', 'flashcards')} disabled={isLoading}>Make Flashcards</Button>
                    <Button onClick={() => setIsImageModalOpen(true)} disabled={isLoading}>Generate Image</Button>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={startConversation} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Start voice conversation" disabled={isLoading}>
                      <MicrophoneIcon className="h-5 w-5" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label="Attach image" disabled={isLoading}>
                      <ImageIcon className="h-5 w-5" />
                  </button>
                  <div className="flex-grow">
                    <input
                      type="text" value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
                      placeholder="Ask a question or describe the image..."
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isLoading}
                    />
                  </div>
                    <Button onClick={() => handleSend(input)} disabled={isLoading || (!input.trim() && !imageFile)}>Send</Button>
                </div>
            </>
        )}
      </div>
      
      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Generate an Image">
          <p className="text-gray-400 mb-4">Describe the image, diagram, or flowchart you want to create based on your notes.</p>
          <div className="relative">
            <input
              type="text" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="e.g., A flowchart of photosynthesis"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
            />
            {hasRecognitionSupport && (
              <button
                  onClick={isImageListening ? stopImageListening : startImageListening}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors ${isImageListening ? 'text-purple-400 animate-pulse' : ''}`}
                  aria-label={isImageListening ? 'Stop listening' : 'Start listening'}
              >
                  <MicrophoneIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setIsImageModalOpen(false)} className="bg-gray-600 hover:bg-gray-700">Cancel</Button>
            <Button onClick={() => handleSend(imagePrompt, 'image-prompt')} disabled={isLoading || !imagePrompt.trim()}>Generate</Button>
          </div>
      </Modal>

    </div>
  );
};

const QuizDisplay: React.FC<{ quiz: QuizQuestion[] }> = ({ quiz }) => {
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const answeredCount = Object.keys(answers).length;
    const progress = (answeredCount / quiz.length) * 100;

    const handleAnswer = (questionIndex: number, answer: string) => {
        if (answers[questionIndex]) return; // Already answered
        setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
    };

    return (
        <div className="space-y-4">
            <div>
                <div className="flex justify-between items-center mb-1 text-xs text-gray-400">
                    <span>Progress</span>
                    <span>{answeredCount} / {quiz.length}</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            {quiz.map((q, index) => {
                const userAnswer = answers[index];
                const isAnswered = userAnswer !== undefined;
                return (
                    <div key={index} className="text-sm">
                        <p className="font-medium text-gray-200 mb-2">{index + 1}. {q.question}</p>
                        {q.options.map((option, i) => {
                            let optionClass = "p-1.5 rounded text-xs cursor-pointer hover:bg-gray-600 transition-colors";
                            if (isAnswered) {
                                optionClass = "p-1.5 rounded text-xs transition-colors"; // remove cursor pointer
                                if (option === q.correctAnswer) {
                                    optionClass += ' bg-green-800/50 text-green-300';
                                } else if (option === userAnswer) {
                                    optionClass += ' bg-red-800/50 text-red-300';
                                }
                            }
                            return <p key={i} onClick={() => handleAnswer(index, option)} className={optionClass}>{option}</p>
                        })}
                    </div>
                )
            })}
        </div>
    );
};

const FlashcardDisplay: React.FC<{ flashcards: Flashcard[] }> = ({ flashcards }) => {
    const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

    const handleFlip = (index: number) => {
        setFlippedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 perspective-[1000px]">
            {flashcards.map((card, index) => (
                <div key={index} className={`flashcard ${flippedCards.has(index) ? 'flipped' : ''}`} onClick={() => handleFlip(index)}>
                    <div className="flashcard-inner relative w-full h-32 text-center">
                        <div className="flashcard-front absolute w-full h-full bg-purple-800/80 rounded-lg flex items-center justify-center p-4">
                            <p className="font-bold text-purple-200">{card.term}</p>
                        </div>
                        <div className="flashcard-back absolute w-full h-full bg-indigo-800/80 rounded-lg flex items-center justify-center p-4">
                            <p className="text-sm">{card.definition}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NoraChatScreen;