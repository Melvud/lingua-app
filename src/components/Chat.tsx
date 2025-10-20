import React, { useState, useEffect, useRef, memo } from 'react';
import { USERS } from '../utils/constants';
import type { Message } from '../types';

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

const ChatComponent: React.FC<ChatProps> = memo(({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 h-full flex flex-col p-2">
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end gap-2 ${msg.user.id === USERS.RAFAEL.id ? 'justify-end' : 'justify-start'}`}>
            {msg.user.id === USERS.ANNA.id && <img src={msg.user.avatar} alt={msg.user.name} className="w-8 h-8 rounded-full" />}
            <div className={`max-w-xs rounded-lg px-3 py-2 ${msg.user.id === USERS.RAFAEL.id ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
              <p className="text-sm">{msg.text}</p>
              <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp}</p>
            </div>
             {msg.user.id === USERS.RAFAEL.id && <img src={msg.user.avatar} alt={msg.user.name} className="w-8 h-8 rounded-full" />}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-2 flex gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Сообщение..."
          className="flex-grow bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
        />
        <button type="submit" className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition-colors duration-200 flex-shrink-0">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.105 3.106a.75.75 0 01.884-.043l14 8a.75.75 0 010 1.342l-14 8A.75.75 0 013 20.25V3.75a.75.75 0 01.105-.344z"/></svg>
        </button>
      </form>
    </div>
  );
});

export default ChatComponent;
