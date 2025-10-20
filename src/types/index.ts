export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Message {
  id: string;
  text: string;
  timestamp: string;
  user: User;
}

// Fix: Add VocabularyItem type for the Dictionary component.
export interface VocabularyItem {
    word: string;
    translation: string;
}

// For structured, interactive tasks
export interface TaskItemPart {
  text: string;
  isAnswer: boolean;
}

export interface TaskItem {
  // Fix: Add 'oral' to the list of possible task item types to match its use in Tasks.tsx.
  type: 'fill-in-the-blank' | 'translate' | 'plain-text' | 'oral';
  textParts: TaskItemPart[];
  userAnswer?: string;
}

export interface Task {
  id: string;
  instruction: string;
  type: 'written' | 'oral';
  items: TaskItem[];
  status: 'incomplete' | 'completed';
}


// For PDF Viewer and Editor
export type Tool = 'pen' | 'highlighter' | 'eraser';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface Annotation {
  tool: Tool;
  color: string;
  points: AnnotationPoint[];
}

export interface TextbookFile {
    file: File;
    url: string; // Object URL for rendering
}