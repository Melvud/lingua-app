import React, { useState, useRef, useEffect } from 'react';

declare global {
    interface Window {
        JitsiMeetExternalAPI: any;
    }
}

const JitsiMeet: React.FC = () => {
    const [roomName, setRoomName] = useState('co-study-hub-spanish');
    const [connected, setConnected] = useState(false);
    const jitsiContainerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<any>(null);

    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            if (apiRef.current) {
                apiRef.current.dispose();
                apiRef.current = null;
                setConnected(false);
            }
        };
    }, []);

    const startConference = () => {
        if (!roomName.trim() || !jitsiContainerRef.current) return;
        
        try {
            const domain = 'sil-video.ru';
            const options = {
                roomName: roomName,
                width: '100%',
                height: '100%',
                parentNode: jitsiContainerRef.current,
                configOverwrite: { prejoinPageEnabled: false },
                interfaceConfigOverwrite: {
                    TOOLBAR_BUTTONS: [
                        'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                        'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                        'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                        'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                        'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone', 'e2ee'
                    ],
                },
            };

            const api = new window.JitsiMeetExternalAPI(domain, options);
            apiRef.current = api;
            setConnected(true);

        } catch (error) {
            console.error('Failed to load Jitsi API', error);
        }
    };
    
    const handleConnect = (e: React.FormEvent) => {
        e.preventDefault();
        startConference();
    }


    return (
        <div className="h-full flex flex-col p-2 bg-white dark:bg-gray-800">
            {!connected ? (
                 <div className="flex flex-col items-center justify-center h-full p-4">
                     <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Подключиться к звонку</h2>
                     <form onSubmit={handleConnect} className="w-full max-w-sm">
                         <input
                             type="text"
                             value={roomName}
                             onChange={(e) => setRoomName(e.target.value)}
                             placeholder="Название комнаты"
                             className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                         />
                         <button type="submit" className="w-full bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition-colors duration-200 font-semibold">
                             Подключиться
                         </button>
                     </form>
                 </div>
            ) : (
                <div ref={jitsiContainerRef} id="jitsi-container" className="flex-grow w-full h-full rounded-lg overflow-hidden shadow-lg" />
            )}
        </div>
    );
};

export default JitsiMeet;
