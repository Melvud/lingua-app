import React, { useState, useCallback } from 'react';
import type { Task, TaskItem, TaskItemPart, VocabularyItem } from '../types';
import { generateTasksFromText } from '../services/AIGenerator';
import { extractTextFromPdfPage, extractTextFromFile } from '../services/fileProcessor';
import { UploadIcon, TrashIcon, CheckCircleIcon, PenIcon } from './Icons';

interface TasksProps {
    tasks: Task[];
    onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void;
    onAnswerChange: (taskId: string, itemIndex: number, answer: string) => void;
    onCompleteTask: (taskId: string) => void;
    onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
    onNavigateToPage: (page: number) => void;
}

const TaskGenerator: React.FC<{ onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void; onTasksGenerated: () => void }> = ({ onGenerateTasks, onTasksGenerated }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [instruction, setInstruction] = useState('учим слова стр 27 упр 5');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileDrop = useCallback((acceptedFiles: File[]) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const removeFile = (fileToRemove: File) => {
        setFiles(files.filter(file => file !== fileToRemove));
    };
    
    const getPageNumberFromInstruction = (text: string): number | null => {
        const match = text.match(/стр(?:аница|\.)?\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError('');
        try {
            let contextText = '';
            const pageNumber = getPageNumberFromInstruction(instruction);
            const pdfFile = files.find(f => f.type === 'application/pdf');
            
            if (pdfFile && pageNumber) {
                contextText = await extractTextFromPdfPage(pdfFile, pageNumber);
            } else {
                for (const file of files.filter(f => f.type !== 'application/pdf')) {
                    contextText += await extractTextFromFile(file);
                }
            }
            
            if (!contextText.trim() && !pdfFile) {
                 setError('Пожалуйста, добавьте файл для анализа.');
                 setIsLoading(false);
                 return;
            }
             if(pdfFile && !pageNumber) {
                setError('Для PDF файла необходимо указать номер страницы в запросе (например, "стр 27").');
                setIsLoading(false);
                return;
            }

            const { tasks, vocabulary } = await generateTasksFromText(instruction, contextText);
            onGenerateTasks(tasks, vocabulary);

            if (tasks.length > 0 || vocabulary.length > 0) {
              onTasksGenerated();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4 mb-6">
             <div
                className="flex justify-center items-center w-full px-6 py-10 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => document.getElementById('file-upload-tasks')?.click()}
            >
                <div className="text-center">
                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Перетащите PDF или DOCX сюда</p>
                    <input id="file-upload-tasks" type="file" className="hidden" multiple onChange={(e) => handleFileDrop(Array.from(e.target.files || []))} />
                </div>
            </div>
            
            {files.length > 0 && (
                 <div className="space-y-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-200 dark:bg-gray-700 p-2 rounded-md">
                            <span className="text-sm truncate">{file.name}</span>
                            <button onClick={() => removeFile(file)}><TrashIcon className="w-4 h-4 text-gray-500 hover:text-red-500" /></button>
                        </div>
                    ))}
                </div>
            )}

            <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Инструкция для ИИ (например, 'стр 27 упр 5')"
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
            />
            <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-500"
            >
                {isLoading ? 'Генерация...' : 'Сгенерировать'}
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    )
};


const TaskCard: React.FC<{ 
    task: Task; 
    onAnswerChange: (taskId: string, itemIndex: number, answer: string) => void; 
    onCompleteTask: (taskId: string) => void;
    onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
    onNavigateToPage: (page: number) => void;
}> = ({ task, onAnswerChange, onCompleteTask, onTaskItemTextChange, onNavigateToPage }) => {
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const isCompleted = task.status === 'completed';

    const handleTextSave = (itemIndex: number, newText: string) => {
        const placeholder = '[ответ]';
        const parts = newText.split(placeholder);
        const newTextParts: TaskItemPart[] = [];
        parts.forEach((part, index) => {
            newTextParts.push({ text: part, isAnswer: false });
            if (index < parts.length - 1) {
                newTextParts.push({ text: '', isAnswer: true });
            }
        });
        onTaskItemTextChange(task.id, itemIndex, newTextParts);
    };

    const renderTaskItem = (item: TaskItem, index: number) => {
        const currentItemId = `${task.id}-${index}`;
        const isEditing = editingItemId === currentItemId;

        if (isEditing) {
            return (
                 <input
                    type="text"
                    defaultValue={item.textParts.map(p => p.isAnswer ? '[ответ]' : p.text).join('')}
                    onBlur={(e) => {
                        handleTextSave(index, e.target.value);
                        setEditingItemId(null);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    autoFocus
                    className="flex-grow bg-gray-100 dark:bg-gray-900 border-b-2 border-blue-500 outline-none"
                />
            )
        }

        return (
            <div className="flex-grow flex flex-wrap items-baseline">
                {item.textParts.map((part, partIndex) =>
                    part.isAnswer ? (
                        <input
                            key={partIndex}
                            type="text"
                            value={item.userAnswer || ''}
                            onChange={(e) => onAnswerChange(task.id, index, e.target.value)}
                            disabled={isCompleted}
                            className="inline-block w-32 mx-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-500 focus:border-blue-500 outline-none"
                        />
                    ) : (
                        <span key={partIndex}>{part.text}</span>
                    )
                )}
            </div>
        );
    };

    return (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${isCompleted ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'} shadow-md`}>
            <div className="flex justify-between items-start mb-3">
                 <h3 className="font-semibold text-gray-800 dark:text-gray-200">{task.instruction}</h3>
                 {(task.pageNumber || task.exerciseNumber) && (
                    <span className="text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full flex-shrink-0">
                        Стр. {task.pageNumber || '–'}, Упр. {task.exerciseNumber || '–'}
                    </span>
                 )}
            </div>

            <div className="space-y-4">
                {task.items.map((item, index) => {
                    const currentItemId = `${task.id}-${index}`;
                    const isEditing = editingItemId === currentItemId;
                    if (task.type === 'oral') {
                        return (
                           <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="text-gray-800 dark:text-gray-200">{item.textParts.map(p => p.text).join('')}</p>
                                {task.pageNumber && (
                                    <button 
                                        onClick={() => onNavigateToPage(parseInt(task.pageNumber || '1', 10))}
                                        className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm flex-shrink-0"
                                    >
                                        К учебнику
                                    </button>
                                )}
                           </div>
                        );
                    }
                    
                    return (
                         <div key={currentItemId} className="pl-3 border-l-2 border-gray-200 dark:border-gray-600">
                             <div className="flex items-center group text-base">
                                <span className="mr-2 text-gray-500">{index + 1}.</span>
                                {renderTaskItem(item, index)}
                                {!isCompleted && (
                                     <button 
                                        onClick={() => setEditingItemId(isEditing ? null : currentItemId)} 
                                        className="ml-2 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100"
                                    >
                                       <PenIcon className="w-4 h-4" />
                                    </button>
                                )}
                             </div>
                              {item.type === 'translate' && !isEditing && (
                                <textarea
                                    value={item.userAnswer || ''}
                                    onChange={(e) => onAnswerChange(task.id, index, e.target.value)}
                                    disabled={isCompleted}
                                    placeholder="Ваш перевод..."
                                    className="w-full mt-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={2}
                                />
                            )}
                         </div>
                    );
                })}
            </div>
            
            <div className="mt-4 text-right">
                <button
                    onClick={() => onCompleteTask(task.id)}
                    disabled={isCompleted}
                    className="bg-green-500 text-white font-semibold py-2 px-4 rounded-md text-sm hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ml-auto"
                >
                    {isCompleted ? <><CheckCircleIcon className="w-5 h-5"/>Завершено</> : 'Завершить задание'}
                </button>
            </div>
        </div>
    );
};

const Tasks: React.FC<TasksProps> = ({ tasks, onGenerateTasks, onAnswerChange, onCompleteTask, onTaskItemTextChange, onNavigateToPage }) => {
    const [isGeneratorVisible, setIsGeneratorVisible] = useState(true);
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const handleTasksGenerated = () => setIsGeneratorVisible(false);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                {isGeneratorVisible ? (
                     <TaskGenerator onGenerateTasks={onGenerateTasks} onTasksGenerated={handleTasksGenerated} />
                ) : (
                    <button 
                        onClick={() => setIsGeneratorVisible(true)}
                        className="w-full text-center py-2 px-4 mb-4 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        Создать еще задания
                    </button>
                )}
            </div>
             <div className="flex-grow overflow-y-auto space-y-4 pr-2 -mr-2">
                {tasks.length > 0 && (
                    <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 py-2 z-10">
                         <div className="text-right text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 pr-2">
                            {completedCount} / {tasks.length} заданий выполнено
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}></div>
                        </div>
                    </div>
                )}
                {tasks.map(task => (
                    <TaskCard 
                        key={task.id} 
                        task={task} 
                        onAnswerChange={onAnswerChange} 
                        onCompleteTask={onCompleteTask} 
                        onTaskItemTextChange={onTaskItemTextChange}
                        onNavigateToPage={onNavigateToPage}
                    />
                ))}
                {tasks.length === 0 && (
                     <p className="text-center text-gray-500 dark:text-gray-400 pt-10">Задания появятся здесь после генерации.</p>
                )}
            </div>
        </div>
    );
};

export default Tasks;