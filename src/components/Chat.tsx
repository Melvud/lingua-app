// src/components/Chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { USERS } from '../utils/constants';
import type { Message } from '../types';

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

const ChatComponent: React.FC<ChatProps> = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Фокус на поле ввода при монтировании
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
      
      // Имитация "печатает..." для ответа от Анны
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (timestamp: string) => {
    return timestamp;
  };

  return (
    <div className="bg-white dark:bg-gray-800 h-full flex flex-col rounded-lg overflow-hidden shadow-sm">
      {/* Шапка чата */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 px-4 py-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={USERS.ANNA.avatar} 
              alt={USERS.ANNA.name} 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm" 
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{USERS.ANNA.name}</h3>
            <p className="text-blue-100 text-xs">
              {isTyping ? 'печатает...' : 'в сети'}
            </p>
          </div>
        </div>
      </div>

      {/* Область сообщений */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 mb-4">
              <svg className="w-12 h-12 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Начните общение
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Отправьте первое сообщение, чтобы начать диалог с преподавателем
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isOwnMessage = msg.user.id === USERS.RAFAEL.id;
              return (
                <div 
                  key={msg.id} 
                  className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  {!isOwnMessage && (
                    <img 
                      src={msg.user.avatar} 
                      alt={msg.user.name} 
                      className="w-8 h-8 rounded-full flex-shrink-0" 
                    />
                  )}
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    <div 
                      className={`rounded-2xl px-4 py-2 shadow-sm ${
                        isOwnMessage 
                          ? 'bg-blue-500 text-white rounded-br-none' 
                          : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                    </div>
                    <p className={`text-xs mt-1 px-1 ${
                      isOwnMessage 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                  {isOwnMessage && (
                    <img 
                      src={msg.user.avatar} 
                      alt={msg.user.name} 
                      className="w-8 h-8 rounded-full flex-shrink-0" 
                    />
                  )}
                </div>
              );
            })}
            {isTyping && (
              <div className="flex items-end gap-2 justify-start">
                <img 
                  src={USERS.ANNA.avatar} 
                  alt={USERS.ANNA.name} 
                  className="w-8 h-8 rounded-full" 
                />
                <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Форма ввода */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Напишите сообщение..."
            className="flex-grow bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-200 text-sm placeholder-gray-500 dark:placeholder-gray-400 transition-all"
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full p-3 transition-all duration-200 flex-shrink-0 shadow-md hover:shadow-lg disabled:shadow-none"
            aria-label="Отправить сообщение"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-2">
          Нажмите Enter для отправки
        </p>
      </form>
    </div>
  );
};

export default ChatComponent;