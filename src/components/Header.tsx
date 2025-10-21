// src/components/Header.tsx
import React from 'react';

interface HeaderProps {
    onGenerateReport: () => void;
    isReportReady: boolean;
    onBackToMain?: () => void;
    lessonName?: string;
}

const Header: React.FC<HeaderProps> = ({ onGenerateReport, isReportReady, onBackToMain, lessonName }) => {
    const handleClick = () => {
        console.log('🖱️ Report button clicked');
        console.log('Is ready?', isReportReady);
        onGenerateReport();
    };

    return (
        <header className="bg-white dark:bg-gray-800 shadow-md flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-4">
                {onBackToMain && (
                    <button
                        onClick={onBackToMain}
                        className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2"
                        aria-label="Вернуться на главную"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="font-medium">Назад</span>
                    </button>
                )}
                <div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white">Co-Study Hub</h1>
                    {lessonName && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            📚 {lessonName}
                        </p>
                    )}
                </div>
            </div>
            <button
                onClick={handleClick}
                disabled={!isReportReady}
                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Сгенерировать итоговый PDF отчет"
            >
                Отчет PDF
            </button>
        </header>
    );
};

export default Header;