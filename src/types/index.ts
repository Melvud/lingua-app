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

export interface VocabularyItem {
    id: string;
    word: string;
    translation: string;
    context: string;
}

export interface TaskItemPart {
  text: string;
  isAnswer: boolean;
}

export interface TaskItem {
  type: 'fill-in-the-blank' | 'translate' | 'plain-text';
  textParts: TaskItemPart[];
  userAnswer?: string; // Для translate
  userAnswers?: string[]; // Для fill-in-the-blank (массив ответов для каждого пропуска)
}

export interface Task {
  id: string;
  instruction: string;
  type: 'written' | 'oral';
  items: TaskItem[];
  status: 'incomplete' | 'completed';
  pageNumber?: string;
  exerciseNumber?: string;
}

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
    url: string; 
}

export interface Lesson {
  id: string;
  pairId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tasks: Task[];
  completedTasksCount: number;
  totalTasksCount: number;
}