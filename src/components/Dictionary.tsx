import React, { useState } from 'react';
import type { VocabularyItem } from '../types';
import { PenIcon, TrashIcon, CheckCircleIcon } from './Icons';

interface DictionaryProps {
    vocabulary: VocabularyItem[];
    onAddItem: (item: Omit<VocabularyItem, 'id'>) => void;
    onUpdateItem: (id: string, updates: Partial<VocabularyItem>) => void;
    onDeleteItem: (id: string) => void;
}

const Dictionary: React.FC<DictionaryProps> = ({ vocabulary, onAddItem, onUpdateItem, onDeleteItem }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ word: '', translation: '', context: '' });
    const [isAdding, setIsAdding] = useState(false);
    const [newWord, setNewWord] = useState({ word: '', translation: '', context: '' });

    const startEdit = (item: VocabularyItem) => {
        setEditingId(item.id);
        setEditForm({ word: item.word, translation: item.translation, context: item.context });
    };

    const saveEdit = (id: string) => {
        onUpdateItem(id, editForm);
        setEditingId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ word: '', translation: '', context: '' });
    };

    const handleAddWord = () => {
        if (newWord.word.trim() && newWord.translation.trim()) {
            onAddItem(newWord);
            setNewWord({ word: '', translation: '', context: '' });
            setIsAdding(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Словарь</h3>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Добавить слово
                </button>
            </div>

            {isAdding && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Слово (español)"
                            value={newWord.word}
                            onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="text"
                            placeholder="Перевод (русский)"
                            value={newWord.translation}
                            onChange={(e) => setNewWord({ ...newWord, translation: e.target.value })}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <textarea
                            placeholder="Пример использования (необязательно)"
                            value={newWord.context}
                            onChange={(e) => setNewWord({ ...newWord, context: e.target.value })}
                            rows={2}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddWord}
                                className="flex-1 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                Сохранить
                            </button>
                            <button
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewWord({ word: '', translation: '', context: '' });
                                }}
                                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {vocabulary.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Словарь пуст. Добавьте слова вручную или они будут добавлены автоматически при генерации заданий из текста с инструкцией "учить слова".
                    </p>
                </div>
            ) : (
                <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                    {vocabulary.map(item => (
                        <div
                            key={item.id}
                            className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                        >
                            {editingId === item.id ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={editForm.word}
                                        onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={editForm.translation}
                                        onChange={(e) => setEditForm({ ...editForm, translation: e.target.value })}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <textarea
                                        value={editForm.context}
                                        onChange={(e) => setEditForm({ ...editForm, context: e.target.value })}
                                        rows={2}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => saveEdit(item.id)}
                                            className="flex-1 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircleIcon className="w-4 h-4" />
                                            Сохранить
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                        >
                                            Отмена
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-grow">
                                            <div className="flex items-baseline gap-3 mb-1">
                                                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{item.word}</span>
                                                <span className="text-lg text-gray-700 dark:text-gray-300">{item.translation}</span>
                                            </div>
                                            {item.context && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-2 pl-1">
                                                    "{item.context}"
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => startEdit(item)}
                                                className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                                title="Редактировать"
                                            >
                                                <PenIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteItem(item.id)}
                                                className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                title="Удалить"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dictionary;