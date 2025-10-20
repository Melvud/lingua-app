import React from 'react';
import type { VocabularyItem } from '../types';

interface DictionaryProps {
    vocabulary: VocabularyItem[];
}

const Dictionary: React.FC<DictionaryProps> = ({ vocabulary }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Словарь</h3>
            {vocabulary.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">Словарь пуст. Слова будут добавлены автоматически при генерации заданий из текста с инструкцией "учить слова".</p>
            ) : (
                <ul className="space-y-2">
                   {vocabulary.map(item => (
                        <li key={item.word} className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{item.word}</span>
                            <span className="text-gray-600 dark:text-gray-400">{item.translation}</span>
                        </li>
                   ))}
                </ul>
            )}
        </div>
    );
};

export default Dictionary;
