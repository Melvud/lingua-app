// src/components/JitsiMeet.tsx
import React, { useState, useEffect } from 'react';

interface JitsiMeetProps {
  roomName: string;
}

const JitsiMeet: React.FC<JitsiMeetProps> = ({ roomName }) => {
  const [connected, setConnected] = useState(() => {
    const saved = localStorage.getItem(`jitsi_connected_${roomName}`);
    return saved === 'true';
  });
  
  const [error, setError] = useState<string>('');

  useEffect(() => {
    localStorage.setItem(`jitsi_connected_${roomName}`, connected.toString());
  }, [connected, roomName]);

  const startConference = () => {
    setError('');
    setConnected(true);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    startConference();
  };

  const handleDisconnect = () => {
    setConnected(false);
    localStorage.removeItem(`jitsi_connected_${roomName}`);
  };

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
                Видеозвонок с партнером
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Нажмите для подключения к общему звонку
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Подключиться</span>
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                ℹ️ Информация
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Вы автоматически подключитесь к общей комнате с вашим партнером по обучению
              </p>
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