import React from 'react';

interface HeaderProps {
    onGenerateReport: () => void;
    isReportReady: boolean;
}

const Header: React.FC<HeaderProps> = ({ onGenerateReport, isReportReady }) => {
    return (
        <header className="bg-white dark:bg-gray-800 shadow-md flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">Co-Study Hub</h1>
            <button
                onClick={onGenerateReport}
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