// src/components/Sidebar.tsx
import React from 'react';
import JitsiMeet from './JitsiMeet';
import ChatComponent from './Chat';
import { VideoIcon, ChatIcon } from './Icons';
import type { Message } from '../types';

type SidebarTab = 'video' | 'chat';

interface SidebarProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ messages, onSendMessage, activeTab, setActiveTab }) => {
  const SIDEBAR_TABS: { id: SidebarTab, label: string, icon: React.ReactNode }[] = [
    { id: 'video', label: 'Звонок', icon: <VideoIcon className="w-5 h-5"/> },
    { id: 'chat', label: 'Чат', icon: <ChatIcon className="w-5 h-5"/> },
  ];

  return (
    <aside className="w-[380px] bg-gray-50 dark:bg-gray-800 p-2 flex flex-col flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-2" aria-label="Sidebar Tabs">
          {SIDEBAR_TABS.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`flex items-center gap-2 ${activeTab === tab.id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'} px-3 py-2 font-medium text-sm rounded-md transition-colors`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-grow min-h-0 pt-2 relative">
        {/* Видео всегда рендерится, но скрывается через CSS */}
        <div className={`absolute inset-0 ${activeTab === 'video' ? 'block' : 'hidden'}`}>
          <JitsiMeet />
        </div>
        {/* Чат всегда рендерится, но скрывается через CSS */}
        <div className={`absolute inset-0 ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
          <ChatComponent messages={messages} onSendMessage={onSendMessage} />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;