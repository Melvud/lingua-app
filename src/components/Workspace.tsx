// src/components/Workspace.tsx
import React, { useState } from 'react';
import TaskGenerator from './TaskGenerator';
import Tasks from './Tasks';
import Textbook from './Textbook';
import Dictionary from './Dictionary';
import type { Task, VocabularyItem, Annotation, Tool, TaskItemPart, TextbookFile } from '../types';

type WorkspaceTab = 'tasks' | 'textbook' | 'dictionary';

interface SharedData {
  textbooks: Array<{ name: string; url: string }>;
  vocabulary: VocabularyItem[];
  currentPage: number;
  files: Array<{ name: string; url: string }>;
  instruction: string;
}

interface WorkspaceProps {
  tasks: Task[];
  vocabulary: VocabularyItem[];
  onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void;
  onAnswerChange: (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => void;
  onCompleteTask: (taskId: string) => void;
  onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
  onDeleteTask: (taskId: string) => void; // ИСПРАВЛЕНО: Добавлено
  onNavigateToPage: (page: number) => void;
  onAddVocabularyItem: (item: Omit<VocabularyItem, 'id'>) => void;
  onUpdateVocabularyItem: (id: string, updates: Partial<VocabularyItem>) => void;
  onDeleteVocabularyItem: (id: string) => void;
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  sharedData: SharedData | null;
  onUpdateSharedFiles: (files: File[]) => void;
  onUpdateSharedInstruction: (instruction: string) => void;
  onAddTextbook: (file: File) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  tool: Tool;
  setTool: (tool: Tool) => void;
  color: string;
  setColor: (color: string) => void;
  annotations: { [key: number]: Annotation[] };
  setAnnotations: (annotations: { [key: number]: Annotation[] }) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({
  tasks,
  vocabulary,
  onGenerateTasks,
  onAnswerChange,
  onCompleteTask,
  onTaskItemTextChange,
  onDeleteTask, // ИСПРАВЛЕНО: Получаем
  onNavigateToPage,
  onAddVocabularyItem,
  onUpdateVocabularyItem,
  onDeleteVocabularyItem,
  activeTab,
  setActiveTab,
  sharedData,
  onUpdateSharedFiles,
  onUpdateSharedInstruction,
  onAddTextbook,
  currentPage,
  onPageChange,
  tool,
  setTool,
  color,
  setColor,
  annotations,
  setAnnotations,
}) => {
  const WORKSPACE_TABS: { id: WorkspaceTab; label: string; icon: string }[] = [
    { id: 'tasks', label: 'Задания', icon: '📝' },
    { id: 'textbook', label: 'Учебник', icon: '📖' },
    { id: 'dictionary', label: 'Словарь', icon: '📚' },
  ];
  
  // Локальное состояние для учебника
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookFile | null>(null);
  const [numPages, setNumPages] = useState(0);

  return (
    <main className="flex-grow flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Табы */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <nav className="flex space-x-1 p-2" aria-label="Workspace Tabs">
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
              {tab.id === 'tasks' && tasks.length > 0 && (
                <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">{tasks.length}</span>
              )}
              {tab.id === 'dictionary' && vocabulary.length > 0 && (
                <span className="ml-1 bg-purple-500 text-white text-xs rounded-full px-2 py-0.5">{vocabulary.length}</span>
              )}
              {tab.id === 'textbook' && sharedData?.textbooks && sharedData.textbooks.length > 0 && (
                <span className="ml-1 bg-green-500 text-white text-xs rounded-full px-2 py-0.5">
                  {sharedData.textbooks.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Контент вкладок (с фиксом скролла) */}
      <div className="flex-grow overflow-y-auto">
        {activeTab === 'tasks' && (
          <div>
            {/* Генератор заданий */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
              <TaskGenerator
                onGenerateTasks={onGenerateTasks}
                onNavigateToPage={onNavigateToPage}
                sharedFiles={sharedData?.files || []}
                sharedInstruction={sharedData?.instruction || ''}
                onUpdateSharedFiles={onUpdateSharedFiles}
                onUpdateSharedInstruction={onUpdateSharedInstruction}
              />
            </div>

            {/* Список заданий */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <Tasks
                tasks={tasks}
                onAnswerChange={onAnswerChange}
                onCompleteTask={onCompleteTask}
                onTaskItemTextChange={onTaskItemTextChange}
                onDeleteTask={onDeleteTask} // ИСПРАВЛЕНО: Передаем
              />
            </div>
          </div>
        )}

        {activeTab === 'textbook' && (
          <Textbook
            textbooks={sharedData?.textbooks as TextbookFile[] || []}
            selectedTextbook={selectedTextbook}
            setSelectedTextbook={setSelectedTextbook}
            onAddTextbook={onAddTextbook}
            numPages={numPages}
            setNumPages={setNumPages}
            currentPage={currentPage}
            setCurrentPage={onPageChange}
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            annotations={annotations}
            setAnnotations={setAnnotations}
          />
        )}

        {activeTab === 'dictionary' && (
          <Dictionary
            vocabulary={vocabulary}
            onAddVocabularyItem={onAddVocabularyItem}
            onUpdateVocabularyItem={onUpdateVocabularyItem}
            onDeleteVocabularyItem={onDeleteVocabularyItem}
          />
        )}
      </div>
    </main>
  );
};

export default Workspace;