// src/components/JitsiMeet.tsx
import React, { useState, useEffect } from 'react';

const JitsiMeet: React.FC = () => {
    // Восстанавливаем состояние из localStorage
    const [roomName, setRoomName] = useState(() => {
        const saved = localStorage.getItem('jitsi_room_name');
        return saved || 'co-study-hub-spanish-' + Math.random().toString(36).substring(7);
    });
    
    const [connected, setConnected] = useState(() => {
        const saved = localStorage.getItem('jitsi_connected');
        return saved === 'true';
    });
    
    const [error, setError] = useState<string>('');

    // Сохраняем состояние в localStorage при изменении
    useEffect(() => {
        localStorage.setItem('jitsi_room_name', roomName);
    }, [roomName]);

    useEffect(() => {
        localStorage.setItem('jitsi_connected', connected.toString());
    }, [connected]);

    const startConference = () => {
        if (!roomName.trim()) {
            setError('Введите название комнаты');
            return;
        }
        setError('');
        setConnected(true);
    };

    const handleConnect = (e: React.FormEvent) => {
        e.preventDefault();
        startConference();
    };

    const handleDisconnect = () => {
        setConnected(false);
        localStorage.removeItem('jitsi_connected');
        localStorage.removeItem('jitsi_room_name');
    };

    // URL для Jitsi iframe
    const jitsiUrl = `https://sil-video.ru/${encodeURIComponent(roomName)}?config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.SHOW_BRAND_WATERMARK=false&interfaceConfig.MOBILE_APP_PROMO=false#userInfo.displayName="Студент"`;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            {!connected ? (
                <div className="flex flex-col items-center justify-center h-full p-6">
                    <div className="w-full max-w-md">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                                Видеозвонок
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Введите название комнаты для начала
                            </p>
                        </div>

                        <form onSubmit={handleConnect} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Название комнаты
                                </label>
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="co-study-hub-spanish"
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-200 transition-all"
                                />
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Другие участники с таким же названием присоединятся к звонку
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!roomName.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Подключиться</span>
                            </button>
                        </form>

                        <div className="mt-6 space-y-3">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                                    💡 Совет
                                </h3>
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    Для совместного обучения используйте одно название комнаты с партнером
                                </p>
                            </div>

                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                                    ⚠️ Разрешения
                                </h3>
                                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                    Браузер запросит доступ к камере и микрофону. Нажмите "Разрешить" для видеосвязи
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative h-full w-full">
                    <iframe
                        src={jitsiUrl}
                        allow="camera; microphone; fullscreen; display-capture; autoplay"
                        className="w-full h-full border-0"
                        title="Jitsi Meet"
                    />
                    <button
                        onClick={handleDisconnect}
                        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 z-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Завершить
                    </button>
                </div>
            )}
        </div>
    );
};

export default JitsiMeet;