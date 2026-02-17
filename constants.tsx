
import React from 'react';
import { BookOpenIcon } from './components/icons/BookOpenIcon';
import { ClipboardListIcon } from './components/icons/ClipboardListIcon';
import { MicrophoneIcon } from './components/icons/MicrophoneIcon';
import { CodeIcon } from './components/icons/CodeIcon';

export enum FeatureId {
    TUTOR = 'tutor',
    EXAM_PREP = 'exam-prep',
    CODING_MENTOR = 'coding-mentor'
}

export const FEATURES = [
  { id: FeatureId.TUTOR, name: 'Personal Tutor', icon: <BookOpenIcon /> },
  { id: FeatureId.EXAM_PREP, name: 'Exam Prep', icon: <ClipboardListIcon /> },
  { id: FeatureId.CODING_MENTOR, name: 'Coding Mentor', icon: <CodeIcon /> },
];

export const TUTOR_LANGUAGES = [
    { value: 'English', label: 'English' },
    { value: 'Arabic', label: 'Arabic' },
    { value: 'Bengali', label: 'Bengali' },
    { value: 'French', label: 'French' },
    { value: 'German', label: 'German' },
    { value: 'Hindi', label: 'Hindi' },
    { value: 'Japanese', label: 'Japanese' },
    { value: 'Mandarin', label: 'Mandarin' },
    { value: 'Portuguese', label: 'Portuguese' },
    { value: 'Russian', label: 'Russian' },
    { value: 'Spanish', label: 'Spanish' },
    { value: 'Telugu', label: 'Telugu' },
];

export const AI_VOICES = [
    { value: 'Zephyr', label: 'Voice: Zephyr (M)' },
    { value: 'Puck', label: 'Voice: Puck (M)' },
    { value: 'Charon', label: 'Voice: Charon (M)' },
    { value: 'Kore', label: 'Voice: Kore (F)' },
    { value: 'Fenrir', label: 'Voice: Fenrir (F)' },
];

export const CODING_LANGUAGES = [
    { value: 'JavaScript', label: 'JavaScript' },
    { value: 'Python', label: 'Python' },
    { value: 'TypeScript', label: 'TypeScript' },
    { value: 'Java', label: 'Java' },
    { value: 'Go', label: 'Go' },
    { value: 'Rust', label: 'Rust' },
];

export const GEMINI_MODEL = 'gemini-2.5-flash';