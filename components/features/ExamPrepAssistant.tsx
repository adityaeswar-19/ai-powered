import React, { useState, useEffect } from 'react';
import { NoraSession } from '../../types';
import NoraListScreen from './exam-prep/NoraListScreen';
import NoraChatScreen from './exam-prep/NoraChatScreen';

const LOCAL_STORAGE_KEY = 'ai-edu-suite-nora-sessions';

const ExamPrepAssistant: React.FC = () => {
    const [sessions, setSessions] = useState<NoraSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedSessions) {
                setSessions(JSON.parse(savedSessions));
            }
        } catch (error) {
            console.error("Failed to load sessions from local storage:", error);
        }
    }, []);

    const saveSessions = (newSessions: NoraSession[]) => {
        setSessions(newSessions);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSessions));
    };

    const addSession = (name: string, notes: string) => {
        const newSession: NoraSession = {
            id: new Date().toISOString(),
            name,
            notes,
            history: [],
        };
        const updatedSessions = [...sessions, newSession];
        saveSessions(updatedSessions);
        setActiveSessionId(newSession.id);
    };

    const deleteSession = (sessionId: string) => {
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        saveSessions(updatedSessions);
        if (activeSessionId === sessionId) {
            setActiveSessionId(null);
        }
    };
    
    const updateSessionHistory = (sessionId: string, newHistory: NoraSession['history']) => {
        const updatedSessions = sessions.map(s => 
            s.id === sessionId ? { ...s, history: newHistory } : s
        );
        saveSessions(updatedSessions);
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);

    if (activeSession) {
        return (
            <NoraChatScreen 
                session={activeSession}
                onUpdateHistory={updateSessionHistory}
                onGoBack={() => setActiveSessionId(null)}
            />
        );
    }

    return (
        <NoraListScreen 
            sessions={sessions}
            onAddSession={addSession}
            onDeleteSession={deleteSession}
            onSelectSession={(id) => setActiveSessionId(id)}
        />
    );
};

export default ExamPrepAssistant;