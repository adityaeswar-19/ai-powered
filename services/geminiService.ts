import { GoogleGenAI, GenerateContentResponse, Type, Part, Content, FunctionDeclaration, Modality } from "@google/genai";
import { ChatMessage, QuizQuestion, Flashcard, CodeExplanation, NoraSession } from '../types';
import { GEMINI_MODEL } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const buildChatHistory = (history: ChatMessage[]): Content[] => {
    if (!history || history.length === 0) return [];
    const cleanHistory: ChatMessage[] = [];
    for (const msg of history) {
        if (msg.isPartial) continue;
        if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === msg.role) {
            cleanHistory[cleanHistory.length - 1] = msg;
        } else {
            cleanHistory.push(msg);
        }
    }
    return cleanHistory.map((msg): Content | null => {
        let text = msg.text || '';
        if (!msg.text) {
            if (msg.quiz) text = `[System: A quiz was generated.]`;
            else if (msg.flashcards) text = `[System: Flashcards were generated.]`;
            else if (msg.imageUrl) text = msg.role === 'model' ? `[System: Image generated.]` : `[System: Image sent.]`;
        }
        if (!text.trim()) return null;
        return { role: msg.role, parts: [{ text: text }] };
    }).filter((msg): msg is Content => msg !== null);
};

export const generateTutorResponseStream = async (prompt: string, language: string, history: ChatMessage[], image?: { mimeType: string; data: string; }): Promise<AsyncGenerator<{ text?: string; sources?: { title: string; uri: string }[] }>> => {
  const userParts: Part[] = [{ text: prompt }];
  if (image) userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  const contents = [...buildChatHistory(history), { role: 'user', parts: userParts }];
  
  const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents,
      config: { 
          systemInstruction: `You are a friendly personal tutor. Respond in ${language}. No markdown. You have access to the live web for scraping information if needed.`,
          tools: [{ googleSearch: {} }] 
      }
  });

  async function* streamGenerator() {
    for await (const chunk of responseStream) {
        const result: { text?: string; sources?: { title: string; uri: string }[] } = { text: chunk.text };
        
        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            result.sources = groundingChunks
                .filter((c: any) => c.web)
                .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
        }
        yield result;
    }
  }
  return streamGenerator();
};

export const generateNoraTextStream = async (session: NoraSession, prompt: string, image?: { mimeType: string; data: string; }): Promise<AsyncGenerator<string>> => {
    const userParts: Part[] = [{ text: prompt }];
    if (image) userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: [...buildChatHistory(session.history), { role: 'user', parts: userParts }],
        config: { systemInstruction: `You are NORA. Use these notes: ${session.notes}` }
    });
    async function* streamGenerator() { for await (const chunk of responseStream) yield chunk.text; }
    return streamGenerator();
};

export const generateNoraJson = async (session: NoraSession, prompt: string, schema: any, image?: { mimeType: string; data: string; }): Promise<any> => {
    const userParts: Part[] = [{ text: prompt }];
    if (image) userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...buildChatHistory(session.history), { role: 'user', parts: userParts }],
        config: { systemInstruction: `You are NORA. Use these notes: ${session.notes}`, responseMimeType: 'application/json', responseSchema: schema }
    });
    return JSON.parse(response.text);
};

export const generateImage = async(prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return '';
};

export const generateNotesFromTranscription = async (transcription: string): Promise<string> => {
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Summarize this as notes:\n${transcription}` });
    return response.text;
};

export const explainCode = async (code: string, language: string): Promise<CodeExplanation[]> => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Explain ${language} code:\n${code}`,
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { lineNumber: { type: Type.INTEGER }, code: { type: Type.STRING }, explanation: { type: Type.STRING } }, required: ['lineNumber', 'code', 'explanation'] } } }
    });
    return JSON.parse(response.text);
};

// --- SPEECH SERVICES ---

export const generateTutorVoice = async (text: string, voiceName: string): Promise<string | undefined> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                },
            },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

// --- RAM AGENT SERVICE (HUMANIZED V4.1 - SYSTEM FOCUS) ---

const RAM_SYSTEM_INSTRUCTION = `
You are "Ram", a master AI agent focused on system control and internal navigation.
IMPORTANT: Always respond in TELUGU (తెలుగు).

PERSONALITY:
- Witty, funny, and conversational. Use "Mama!", "Orayyo!", "Chudu chudu!".
- You are a friendly, helpful male assistant with a warm and energetic tone.

CORE ABILITIES:
1. YouTube Control: Use 'play_youtube'.
2. System Apps: Use 'open_system_app'.
3. Web Browser: Use 'web_browser_search' (only to open a new tab).
4. App Navigation: Use 'navigate_to_feature'.

Always keep your tone lighthearted and humorous. Respond ONLY in Telugu text.
`;

const playYoutubeTool: FunctionDeclaration = {
    name: "play_youtube",
    description: "Search and play a video or song on YouTube directly.",
    parameters: {
        type: Type.OBJECT,
        properties: { 
            query: { type: Type.STRING, description: "The name of the song, artist, or video." }
        },
        required: ["query"]
    }
};

const openAppTool: FunctionDeclaration = {
    name: "open_system_app",
    description: "Opens system applications.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            app_id: { 
                type: Type.STRING, 
                enum: ['whatsapp', 'maps', 'mail', 'phone', 'calendar', 'calculator', 'settings', 'notes']
            },
            data: { type: Type.STRING }
        },
        required: ["app_id"]
    }
};

const webSearchTool: FunctionDeclaration = {
    name: "web_browser_search",
    description: "Performs a general web search by opening a new browser tab.",
    parameters: {
        type: Type.OBJECT,
        properties: { 
            query: { type: Type.STRING, description: "The search terms." } 
        },
        required: ["query"]
    }
};

const navigateTool: FunctionDeclaration = {
    name: "navigate_to_feature",
    description: "Navigates within the platform.",
    parameters: {
        type: Type.OBJECT,
        properties: { feature_id: { type: Type.STRING, enum: ['tutor', 'exam-prep', 'coding-mentor'] } },
        required: ["feature_id"]
    }
};

export const runRamAgent = async (transcript: string) => {
    return await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: transcript,
        config: {
            systemInstruction: RAM_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: [playYoutubeTool, openAppTool, webSearchTool, navigateTool] }],
        }
    });
};

export const generateRamVoice = async (text: string): Promise<string | undefined> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say this in a friendly male Telugu voice: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
            },
        },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};