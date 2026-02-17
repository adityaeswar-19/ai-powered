
import React, { useState } from 'react';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { generateNotesFromTranscription } from '../../services/geminiService';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import Card from '../ui/Card';

const VoiceToNotesConverter: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isListening, transcript, error, startListening, stopListening, hasRecognitionSupport } = useSpeechToText();

  const handleGenerateNotes = async () => {
    if (!transcript.trim() || isLoading) return;
    setIsLoading(true);
    setNotes('');
    try {
      const generatedNotes = await generateNotesFromTranscription(transcript);
      setNotes(generatedNotes);
    } catch (err) {
      console.error('Failed to generate notes:', err);
      setNotes('Sorry, I was unable to generate notes from the transcription.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-200 mb-4">Voice-to-Notes Converter</h2>
      
      {!hasRecognitionSupport ? (
        <p className="text-red-400">Speech recognition is not supported in your browser. Please try Chrome or Edge.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4">
            <Button onClick={isListening ? stopListening : startListening} disabled={isLoading}>
              {isListening ? 'Stop Recording' : 'Start Recording'}
            </Button>
            {isListening && <div className="flex items-center gap-2 text-purple-400"><Loader size="sm" /> <span>Listening...</span></div>}
          </div>
          {error && <p className="text-red-400 mt-2">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold mb-2">Live Transcription</h3>
              <p className="text-gray-300 min-h-[150px] whitespace-pre-wrap">{transcript || 'Your transcribed lecture will appear here...'}</p>
            </Card>
            <Card>
              <h3 className="font-semibold mb-2">Structured Notes</h3>
              {isLoading ? (
                  <div className="flex justify-center items-center h-[150px]"><Loader /></div>
              ) : (
                  <div className="text-gray-300 min-h-[150px] whitespace-pre-wrap">{notes || 'Generated notes will appear here...'}</div>
              )}
            </Card>
          </div>

          <div className="mt-6">
            <Button onClick={handleGenerateNotes} disabled={isLoading || !transcript.trim() || isListening}>
              {isLoading ? 'Generating...' : 'Generate Structured Notes'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceToNotesConverter;
