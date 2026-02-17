export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];
  isPartial?: boolean;
  sources?: { title: string; uri: string }[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface Flashcard {
  term: string;
  definition: string;
}

export interface CodeExplanation {
  lineNumber: number;
  code: string;
  explanation: string;
}

export interface NoraSession {
    id: string;
    name: string;
    notes: string;
    history: ChatMessage[];
}