import React, { useState, useCallback } from 'react';
import type { Task, TaskItem, TaskItemPart, VocabularyItem } from '../types';
import { generateTasksFromText } from '../services/AIGenerator';
import { extractTextUpToPage, extractTextFromFile } from '../services/fileProcessor';
import { UploadIcon, TrashIcon, CheckCircleIcon, PenIcon } from './Icons';

interface TasksProps {
    tasks: Task[];
    onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void;
    onAnswerChange: (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => void;
    onCompleteTask: (taskId: string) => void;
    onTaskItemTextChange: (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => void;
    onNavigateToPage: (page: number) => void;
}

const TaskGenerator: React.FC<{ 
    onGenerateTasks: (tasks: Task[], vocabulary: VocabularyItem[]) => void; 
    onTasksGenerated: () => void;
}> = ({ onGenerateTasks, onTasksGenerated }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [instruction, setInstruction] = useState('создай 3 упражнения по тексту на стр 35-36');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileDrop = useCallback((acceptedFiles: File[]) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
        setError('');
    }, []);

    const removeFile = (fileToRemove: File) => {
        setFiles(files.filter(file => file !== fileToRemove));
    };
    
    const getPageNumberFromInstruction = (text: string): number | null => {
        const matches = text.match(/стр(?:аница|\.)?\s*(\d+)/gi);
        if (!matches) return null;
        const lastMatch = matches[matches.length - 1];
        const pageNum = lastMatch.match(/\d+/);
        return pageNum ? parseInt(pageNum[0], 10) : null;
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError('');
        
        try {
            let contextText = '';
            const lastPageMentioned = getPageNumberFromInstruction(instruction);
            const pdfFile = files.find(f => f.type === 'application/pdf');
            
            if (!pdfFile && !instruction) {
                setError('Пожалуйста, загрузите файл и введите инструкцию.');
                setIsLoading(false);
                return;
            }

            if (pdfFile) {
                if (lastPageMentioned) {
                    const readUpToPage = lastPageMentioned + 1;
                    console.log(`📚 Reading PDF up to page ${readUpToPage}...`);
                    contextText = await extractTextUpToPage(pdfFile, readUpToPage);

                    if (!contextText.trim()) {
                       setError(`Не удалось извлечь текст из PDF до страницы ${readUpToPage}. Возможно, документ пуст.`);
                       setIsLoading(false);
                       return;
                    }
                } else {
                    setError('Для PDF файла необходимо указать номер страницы в инструкции, чтобы ограничить контекст.');
                    setIsLoading(false);
                    return;
                }
            }
            
            for (const file of files.filter(f => f.type !== 'application/pdf')) {
                contextText += await extractTextFromFile(file) + '\n';
            }

            if (!contextText.trim()) {
                 contextText = 'Контекст из файла отсутствует. Создай задания только на основе запроса пользователя.';
            }

            const { tasks, vocabulary } = await generateTasksFromText(instruction, contextText);
            
            if (tasks.length === 0 && vocabulary.length === 0) {
                 setError('ИИ не смог сгенерировать задания или слова. Попробуйте уточнить запрос или проверьте страницы в файле.');
            } else {
                onGenerateTasks(tasks, vocabulary);
                onTasksGenerated();
                setFiles([]);
                setInstruction('');
            }
            
        } catch (err: any) {
            setError(err.message || 'Произошла неизвестная ошибка.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4 mb-6">
            <div
                className="flex justify-center items-center w-full px-6 py-10 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => document.getElementById('file-upload-tasks')?.click()}
            >
                <div className="text-center">
                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Перетащите PDF или DOCX сюда или нажмите для выбора
                    </p>
                    <input 
                        id="file-upload-tasks" 
                        type="file" 
                        className="hidden" 
                        multiple 
                        accept=".pdf,.docx"
                        onChange={(e) => handleFileDrop(Array.from(e.target.files || []))} 
                    />
                </div>
            </div>
            
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-200 dark:bg-gray-700 p-2 rounded-md">
                            <span className="text-sm truncate">{file.name}</span>
                            <button onClick={() => removeFile(file)} className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded">
                                <TrashIcon className="w-4 h-4 text-gray-500 hover:text-red-500" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Инструкция для ИИ (например, 'создай упражнение по тексту на стр 35')"
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
            />
            
            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                    {isLoading ? ( <> <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg> Генерация... </> ) : ( 'Сгенерировать задания' )}
                </button>
            </div>
            
            {error && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                    <p className="text-sm font-medium">Ошибка:</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}
        </div>
    );
};

const TaskCard: React.FC<{ 
    task: Task; 
    onAnswerChange: (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => void; 
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

    // Устные задания - только текст и кнопка
    if (task.type === 'oral') {
        return (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
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

    // Редактирование текста задания
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
                className="flex-grow bg-gray-100 dark:bg-gray-900 border-b-2 border-blue-500 outline-none px-2 py-1"
            />
        )
    }

    // Задание с переводом - показываем ТОЛЬКО первый textPart (русский текст)
    if (item.type === 'translate') {
        const russianText = item.textParts[0]?.text || '';
        return (
            <div className="space-y-2">
                <p className="text-gray-800 dark:text-gray-200 font-medium">
                    {russianText}
                </p>
                <textarea
                    value={item.userAnswer || ''}
                    onChange={(e) => onAnswerChange(task.id, index, e.target.value)}
                    disabled={isCompleted}
                    placeholder="Ваш перевод на испанском..."
                    className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    rows={3}
                />
            </div>
        );
    }

    // Задание с пропусками - отдельное поле для каждого пропуска
    if (item.type === 'fill-in-the-blank') {
        let answerIndex = 0;
        return (
            <div className="flex-grow flex flex-wrap items-baseline">
                {item.textParts.map((part, partIndex) => {
                    if (part.isAnswer) {
                        const currentAnswerIndex = answerIndex++;
                        return (
                            <input
                                key={partIndex}
                                type="text"
                                value={item.userAnswers?.[currentAnswerIndex] || ''}
                                onChange={(e) => onAnswerChange(task.id, index, e.target.value, currentAnswerIndex)}
                                disabled={isCompleted}
                                placeholder="..."
                                className="inline-block w-32 mx-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-500 focus:border-blue-500 outline-none px-2 py-1 disabled:opacity-50"
                            />
                        );
                    }
                    return <span key={partIndex}>{part.text}</span>;
                })}
            </div>
        );
    }

    // Plain text (для информационных заданий, не устных)
    return (
        <p className="text-gray-800 dark:text-gray-200">{item.textParts.map(p => p.text).join('')}</p>
    );
};
    return (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${isCompleted ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'} shadow-md`}>
            <div className="flex justify-between items-start mb-3">
                 <h3 className="font-semibold text-gray-800 dark:text-gray-200">{task.instruction}</h3>
                 {(task.pageNumber || task.exerciseNumber) && (
                    <span className="text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                        Стр. {task.pageNumber || '–'}, Упр. {task.exerciseNumber || '–'}
                    </span>
                 )}
            </div>

            <div className="space-y-4">
                {task.items.map((item, index) => {
                    const currentItemId = `${task.id}-${index}`;
                    const isEditing = editingItemId === currentItemId;
                    
                    // Для устных заданий - специальный рендер
                    if (task.type === 'oral') {
                        return <div key={index}>{renderTaskItem(item, index)}</div>;
                    }
                    
                    // Для письменных заданий
                    return (
                         <div key={currentItemId} className="pl-3 border-l-2 border-gray-200 dark:border-gray-600">
                             <div className="flex items-center group text-base">
                                <span className="mr-2 text-gray-500 font-medium">{index + 1}.</span>
                                {renderTaskItem(item, index)}
                                {!isCompleted && item.type !== 'translate' && (
                                     <button 
                                        onClick={() => setEditingItemId(isEditing ? null : currentItemId)} 
                                        className="ml-2 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Редактировать"
                                    >
                                       <PenIcon className="w-4 h-4" />
                                    </button>
                                )}
                             </div>
                         </div>
                    );
                })}
            </div>
            
            {task.type !== 'oral' && (
                <div className="mt-4 text-right">
                    <button
                        onClick={() => onCompleteTask(task.id)}
                        disabled={isCompleted}
                        className="bg-green-500 text-white font-semibold py-2 px-4 rounded-md text-sm hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ml-auto"
                    >
                        {isCompleted ? (
                            <>
                                <CheckCircleIcon className="w-5 h-5"/>
                                Завершено
                            </>
                        ) : (
                            'Завершить задание'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

const Tasks: React.FC<TasksProps> = ({ tasks, onGenerateTasks, onAnswerChange, onCompleteTask, onTaskItemTextChange, onNavigateToPage }) => {
    const [isGeneratorVisible, setIsGeneratorVisible] = useState(true);
    const writtenTasks = tasks.filter(t => t.type === 'written');
    const completedCount = writtenTasks.filter(t => t.status === 'completed').length;
    
    const handleTasksGenerated = () => {
        setIsGeneratorVisible(false);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                {isGeneratorVisible ? (
                     <TaskGenerator 
                        onGenerateTasks={onGenerateTasks} 
                        onTasksGenerated={handleTasksGenerated} 
                    />
                ) : (
                    <button 
                        onClick={() => setIsGeneratorVisible(true)}
                        className="w-full text-center py-3 px-4 mb-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 font-semibold shadow-md"
                    >
                        + Создать еще задания
                    </button>
                )}
            </div>
             <div className="flex-grow overflow-y-auto space-y-4 pr-2 -mr-2">
                {tasks.length > 0 && writtenTasks.length > 0 && (
                    <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 py-2 z-10 mb-2">
                         <div className="text-right text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 pr-2">
                            Выполнено письменных: {completedCount} из {writtenTasks.length}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div 
                                className="bg-green-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${writtenTasks.length > 0 ? (completedCount / writtenTasks.length) * 100 : 0}%` }}
                            ></div>
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
                {tasks.length === 0 && !isGeneratorVisible && (
                     <p className="text-center text-gray-500 dark:text-gray-400 pt-10">
                        Задания появятся здесь после генерации.
                     </p>
                )}
            </div>
        </div>
    );
};

export default Tasks;