import React, { useState, useRef, useEffect } from 'react';
import { NoraSession } from '../../../types';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Modal from '../../ui/Modal';
import TextArea from '../../ui/TextArea';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { useSpeechToText } from '../../../hooks/useSpeechToText';
import { MicrophoneIcon } from '../../icons/MicrophoneIcon';
import { DocumentArrowUpIcon } from '../../icons/DocumentArrowUpIcon';

interface NoraListScreenProps {
  sessions: NoraSession[];
  onAddSession: (name: string, notes: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
}

const NoraListScreen: React.FC<NoraListScreenProps> = ({
  sessions,
  onAddSession,
  onDeleteSession,
  onSelectSession,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, transcript, startListening, stopListening, hasRecognitionSupport } = useSpeechToText();

  useEffect(() => {
    if (isListening) {
      setNewNotes(transcript);
    }
  }, [transcript, isListening]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain') {
        alert('Unsupported file type. Please upload a .txt file.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
            setNewNotes(text);
        } else {
            alert('Could not read file content.');
        }
    };
    reader.onerror = () => {
        alert('Failed to read the file.');
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handleAdd = () => {
    if (newName.trim() && newNotes.trim()) {
      onAddSession(newName, newNotes);
      setIsModalOpen(false);
      setNewName('');
      setNewNotes('');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-200">Your Study Sessions (NORAs)</h2>
        <Button onClick={() => setIsModalOpen(true)}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Create New NORA
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No study sessions found.</p>
          <p className="text-gray-500 mt-1">Click "Create New NORA" to get started!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div key={session.id} className="relative group">
                <Card
                    className="h-full flex flex-col justify-between cursor-pointer hover:bg-gray-700/80 hover:border-purple-500 transition-all"
                    onClick={() => onSelectSession(session.id)}
                >
                    <div>
                        <h3 className="text-lg font-bold text-purple-300 truncate">{session.name}</h3>
                        <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                            {session.notes}
                        </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">{session.history.length} messages</p>
                </Card>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete "${session.name}"?`)) {
                            onDeleteSession(session.id);
                        }
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-800 text-gray-400 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete session"
                >
                    <TrashIcon className="h-4 w-4" />
                </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create a New NORA">
        <div className="space-y-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Session Name (e.g., Biology Chapter 5)"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="relative">
            <TextArea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Paste notes here, upload a .txt file, or use the microphone to dictate..."
              rows={10}
            />
            {hasRecognitionSupport && (
                <button
                    onClick={isListening ? stopListening : startListening}
                    className={`absolute right-3 top-3 text-gray-400 hover:text-white transition-colors ${isListening ? 'text-purple-400 animate-pulse' : ''}`}
                    aria-label={isListening ? 'Stop listening' : 'Start listening for notes'}
                >
                    <MicrophoneIcon className="h-5 w-5" />
                </button>
            )}
          </div>
           <div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".txt"
            />
            <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-700 hover:bg-gray-600 text-sm py-2 px-3 w-full flex items-center justify-center gap-2"
                type="button"
            >
                <DocumentArrowUpIcon className="h-5 w-5" />
                Upload Notes (.txt file)
            </Button>
        </div>
          <div className="flex justify-end gap-2 mt-2">
             <Button
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || !newNotes.trim()}>
              Create Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NoraListScreen;