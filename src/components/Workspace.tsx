import React from 'react';
import Tasks from './Tasks';
import Textbook from './Textbook';
import Dictionary from './Dictionary';
import Whiteboard from './Whiteboard';
import type { Task, Annotation, Tool, TextbookFile, TaskItemPart, VocabularyItem } from '../types';

type WorkspaceTab = 'tasks' | 'textbook' | 'whiteboard' | 'dictionary';

interface WorkspaceProps {
    tasks: Task[];
    vocabulary: VocabularyItem[];
    onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void;
    onAnswerChange: (taskId: string, itemIndex: number, answer: string) => void;
    onCompleteTask: (taskId: string) => void;
    onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
    onNavigateToPage: (page: number) => void;
    activeTab: WorkspaceTab;
    setActiveTab: (tab: WorkspaceTab) => void;
    
    textbooks: TextbookFile[];
    selectedTextbook: TextbookFile | null;
    setSelectedTextbook: (book: TextbookFile | null) => void;
    onAddTextbook: (file: File) => void;
    numPages: number;
    setNumPages: (count: number) => void;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    
    tool: Tool;
    setTool: (tool: Tool) => void;
    color: string;
    setColor: (color: string) => void;
    annotations: { [key: number]: Annotation[] };
    setAnnotations: React.Dispatch<React.SetStateAction<{ [key: number]: Annotation[] }>>;
}

const Workspace: React.FC<WorkspaceProps> = (props) => {
    const TABS: { id: WorkspaceTab; label: string }[] = [
        { id: 'tasks', label: 'Задания' },
        { id: 'textbook', label: 'Учебник' },
        { id: 'whiteboard', label: 'Доска' },
        { id: 'dictionary', label: 'Словарь' },
    ];

    const { 
        tasks, vocabulary, onGenerateTasks, onAnswerChange, onCompleteTask, onTaskItemTextChange, onNavigateToPage,
        activeTab, setActiveTab, ...textbookProps 
    } = props;

    return (
        <main className="flex-grow p-4 bg-gray-100 dark:bg-gray-900 flex flex-col min-h-0">
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="flex-grow pt-4 min-h-0">
                {activeTab === 'tasks' && <Tasks tasks={tasks} onGenerateTasks={onGenerateTasks} onAnswerChange={onAnswerChange} onCompleteTask={onCompleteTask} onTaskItemTextChange={onTaskItemTextChange} onNavigateToPage={onNavigateToPage} />}
                {activeTab === 'textbook' && <Textbook {...textbookProps} />}
                {activeTab === 'whiteboard' && <Whiteboard />}
                {activeTab === 'dictionary' && <Dictionary vocabulary={vocabulary} />}
            </div>
        </main>
    );
};

export default Workspace;