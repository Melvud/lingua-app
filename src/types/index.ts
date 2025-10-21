// src/types/index.ts
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

// ИСПРАВЛЕНО: Эти типы снова нужны для PDF-аннотаций
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

// ИСПРАВЛЕНО: Добавлен тип для хранения всех аннотаций
// (Ключ - номер страницы, значение - массив аннотаций)
export type AnnotationStore = {
  [pageNumber: number]: Annotation[];
};


export interface TextbookFile {
    name: string; 
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

export type UserAnswersStore = { 
  [taskId: string]: { 
    [itemIndex: number]: { 
      userAnswer?: string; 
      userAnswers?: string[] 
    } 
  } 
};

// Этот тип больше не используется в логике ответов
export interface UserTaskAnswer {
  id: string; // ID задачи (task.id)
  status: 'pending' | 'completed';
  userAnswer: string | null;
  userAnswers: (string | null)[] | null;
}