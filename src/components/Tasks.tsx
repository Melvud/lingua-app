import React, { useState, useCallback } from 'react';
import type { Task, TaskItem } from '../types';
import { generateTasksFromText } from '../services/AIGenerator';
import { extractTextFromFile, convertImageToBase64 } from '../services/fileProcessor';
import { UploadIcon, TrashIcon, CheckCircleIcon } from './Icons';

interface TasksProps {
    tasks: Task[];
    onGenerateTasks: (tasks: Task[]) => void;
    onAnswerChange: (taskId: string, itemIndex: number, answer: string) => void;
    onCompleteTask: (taskId: string) => void;
}

const TaskGenerator: React.FC<{ onGenerateTasks: (tasks: Task[]) => void; }> = ({ onGenerateTasks }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [instruction, setInstruction] = useState('Проанализируй текст и создай 3 интерактивных задания на испанском. Задания должны быть разнообразными: вставить пропущенное слово, перевести, выбрать правильный вариант.');
    const [contextText, setContextText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileDrop = useCallback((acceptedFiles: File[]) => {
        const imageFile = acceptedFiles.find(f => f.type.startsWith('image/'));
        if (imageFile) {
            setFiles([imageFile]); // Allow only one image for now
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(imageFile);
        } else {
            setFiles(prev => [...prev, ...acceptedFiles]);
        }
    }, []);

    const removeFile = (fileToRemove: File) => {
        setFiles(files.filter(file => file !== fileToRemove));
        if (fileToRemove.type.startsWith('image/')) {
            setImagePreview(null);
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError('');
        try {
            let combinedText = contextText;
            let imageBase64: string | undefined = undefined;

            for (const file of files) {
                 if (file.type.startsWith('image/')) {
                    imageBase64 = await convertImageToBase64(file);
                } else {
                    combinedText += `\n\n--- Текст из файла: ${file.name} ---\n` + await extractTextFromFile(file);
                }
            }
            
            if (!combinedText.trim() && !imageBase64) {
                 setError('Пожалуйста, добавьте текст, файл или изображение для анализа.');
                 setIsLoading(false);
                 return;
            }

            const { tasks } = await generateTasksFromText(instruction, combinedText, imageBase64);
            onGenerateTasks(tasks);
        } catch (err) {
            console.error(err);
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
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Перетащите файлы или скриншоты сюда, или нажмите для выбора</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">DOCX, PDF, PNG, JPG</p>
                    <input id="file-upload-tasks" type="file" className="hidden" multiple onChange={(e) => handleFileDrop(Array.from(e.target.files || []))} />
                </div>
            </div>

            {(files.length > 0 || imagePreview) && (
                <div className="space-y-2">
                    {imagePreview && (
                        <div className="relative group">
                             <img src={imagePreview} alt="Preview" className="w-full rounded-md max-h-48 object-contain" />
                             <button onClick={() => removeFile(files[0])} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {files.filter(f => !f.type.startsWith('image/')).map((file, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-200 dark:bg-gray-700 p-2 rounded-md">
                            <span className="text-sm truncate">{file.name}</span>
                            <button onClick={() => removeFile(file)}><TrashIcon className="w-4 h-4 text-gray-500 hover:text-red-500" /></button>
                        </div>
                    ))}
                </div>
            )}

            <textarea
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Или вставьте текст для анализа сюда..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
            />

            <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Инструкция для ИИ..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
            />

            <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-500 transition-all duration-200"
            >
                {isLoading ? 'Генерация...' : 'Сгенерировать задания'}
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};

const TaskCard: React.FC<{ task: Task; onAnswerChange: (taskId: string, itemIndex: number, answer: string) => void; onCompleteTask: (taskId: string) => void; }> = ({ task, onAnswerChange, onCompleteTask }) => {
    const isCompleted = task.status === 'completed';

    const renderTaskItem = (item: TaskItem, index: number) => {
        switch (item.type) {
            case 'fill-in-the-blank':
                return (
                    <div className="flex flex-wrap items-baseline text-base">
                        {item.textParts?.map((part, partIndex) =>
                            part.isAnswer ? (
                                <input
                                    key={partIndex}
                                    type="text"
                                    value={item.userAnswer || ''}
                                    onChange={(e) => onAnswerChange(task.id, index, e.target.value)}
                                    disabled={isCompleted}
                                    className="inline-block w-32 mx-2 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-500 focus:border-blue-500 outline-none transition-colors disabled:bg-transparent disabled:border-gray-400"
                                />
                            ) : (
                                <span key={partIndex}>{part.text}</span>
                            )
                        )}
                    </div>
                );
            case 'translate':
                 return (
                    <div className="flex flex-col">
                        <p className="italic text-gray-600 dark:text-gray-400">"{item.textParts?.[0].text}"</p>
                        <input
                            type="text"
                            value={item.userAnswer || ''}
                            onChange={(e) => onAnswerChange(task.id, index, e.target.value)}
                            disabled={isCompleted}
                            placeholder="Ваш перевод..."
                            className="w-full mt-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                );
            case 'oral':
                return <p className="text-sm italic text-blue-500">Перейдите во вкладку "Учебник" для выполнения устного задания.</p>;
            default:
                return <p>{item.textParts?.map(p => p.text).join('')}</p>;
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${isCompleted ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'} shadow-md`}>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-3">{task.instruction}</p>
            <div className="space-y-4">
                {task.items.map((item, index) => (
                    <div key={index} className="pl-3 border-l-2 border-gray-200 dark:border-gray-600">
                        {renderTaskItem(item, index)}
                    </div>
                ))}
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

const Tasks: React.FC<TasksProps> = ({ tasks, onGenerateTasks, onAnswerChange, onCompleteTask }) => {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
                 <TaskGenerator onGenerateTasks={onGenerateTasks} />
            </div>
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                {tasks.length > 0 && (
                    <div className="text-right text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {completedCount} / {tasks.length} заданий выполнено
                    </div>
                )}
                {tasks.map(task => (
                    <TaskCard key={task.id} task={task} onAnswerChange={onAnswerChange} onCompleteTask={onCompleteTask} />
                ))}
                {tasks.length === 0 && (
                     <p className="text-center text-gray-500 dark:text-gray-400 pt-10">Задания появятся здесь после генерации.</p>
                )}
            </div>
        </div>
    );
};

export default Tasks;