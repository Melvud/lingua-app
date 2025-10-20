import React, { useState, useCallback, useEffect } from 'react';
import Header from './src/components/Header';
import Sidebar from './src/components/Sidebar';
import Workspace from './src/components/Workspace';
import Notification from './src/components/Notification';
import { USERS } from './src/utils/constants';
import type { Message, Task, Annotation, Tool, TextbookFile, TaskItemPart, VocabularyItem } from './src/types';
import { generatePdfReport } from './src/services/pdfReportGenerator';

declare const window: any;

type SidebarTab = 'video' | 'chat';
type WorkspaceTab = 'tasks' | 'textbook' | 'whiteboard' | 'dictionary';

interface NotificationState {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  id: number;
}

const initialMessages: Message[] = [
  {
    id: `msg-${Date.now()}`,
    text: '¡Hola Rafael! ¿Listo para empezar la lección de hoy?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    user: USERS.ANNA,
  }
];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('video');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('tasks');
  const [textbooks, setTextbooks] = useState<TextbookFile[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookFile | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.5);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#FF0000');
  const [annotations, setAnnotations] = useState<{ [key: number]: Annotation[] }>({});
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  const allTasksCompleted = tasks.length > 0 && tasks.every(t => t.status === 'completed');

  useEffect(() => {
    console.log('🚀 App component mounted');
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
    }
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    console.log(`📢 Notification: [${type}] ${message}`);
    const id = Date.now();
    setNotifications(prev => [...prev, { message, type, id }]);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const handleSendMessage = useCallback((text: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      user: USERS.RAFAEL,
    };
    setMessages(prev => [...prev, userMessage]);
  }, []);

  const handleGenerateTasks = (newTasks: Task[], newVocabulary: VocabularyItem[]) => {
    console.log('📥 handleGenerateTasks called');
    console.log('📋 New tasks received:', newTasks);
    console.log('📚 New vocabulary received:', newVocabulary);
    
    setTasks(prev => {
      const updated = [...prev, ...newTasks];
      console.log('📋 Updated tasks state:', updated);
      return updated;
    });
    
    if (newVocabulary.length > 0) {
      setVocabulary(prev => {
        const updated = [...prev, ...newVocabulary];
        console.log('📚 Updated vocabulary state:', updated);
        return updated;
      });
      showNotification(
        `Добавлено ${newVocabulary.length} ${newVocabulary.length === 1 ? 'слово' : newVocabulary.length < 5 ? 'слова' : 'слов'} в словарь!`,
        'success'
      );
    }

    if (newTasks.length > 0) {
      showNotification(
        `Создано ${newTasks.length} ${newTasks.length === 1 ? 'задание' : newTasks.length < 5 ? 'задания' : 'заданий'}!`,
        'success'
      );
    }
    
    if (newTasks.length === 0 && newVocabulary.length === 0) {
      showNotification('ИИ не создал заданий или слов. Попробуйте изменить запрос.', 'warning');
    }
  };
  
  const handleAnswerChange = (taskId: string, itemIndex: number, answer: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, items: task.items.map((item, i) => i === itemIndex ? { ...item, userAnswer: answer } : item) } 
          : task
      )
    );
  };
  
  const handleTaskItemTextChange = (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => {
     setTasks(prevTasks =>
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, items: task.items.map((item, i) => i === itemIndex ? { ...item, textParts: newTextParts } : item) } 
          : task
      )
    );
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: 'completed' } : task
      )
    );
    showNotification('Задание выполнено!', 'success');
  };

  const handleAddVocabularyItem = (item: Omit<VocabularyItem, 'id'>) => {
    const newItem: VocabularyItem = {
      ...item,
      id: `vocab-${Date.now()}-${Math.random()}`
    };
    setVocabulary(prev => [...prev, newItem]);
    showNotification('Слово добавлено в словарь!', 'success');
  };

  const handleUpdateVocabularyItem = (id: string, updates: Partial<VocabularyItem>) => {
    setVocabulary(prev =>
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
    showNotification('Слово обновлено!', 'success');
  };

  const handleDeleteVocabularyItem = (id: string) => {
    setVocabulary(prev => prev.filter(item => item.id !== id));
    showNotification('Слово удалено из словаря', 'info');
  };

  const handleGenerateFinalReport = () => {
    if (!allTasksCompleted) return;

    const checkAndGenerate = (tries = 0) => {
        if (typeof window.jspdf !== 'undefined') {
            try {
                generatePdfReport(tasks);
                showNotification('PDF отчет успешно сгенерирован!', 'success');
            } catch (error) {
                console.error('Error generating PDF:', error);
                showNotification('Ошибка при генерации PDF', 'error');
            }
        } else if (tries < 10) {
            setTimeout(() => checkAndGenerate(tries + 1), 100);
        } else {
            console.error("jsPDF not loaded after 1 second.");
            showNotification('Ошибка: библиотека PDF не загружена', 'error');
        }
    };

    checkAndGenerate();
  };

  const handleAddTextbook = (file: File) => {
      const newTextbook = { file, url: URL.createObjectURL(file) };
      setTextbooks(prev => [...prev, newTextbook]);
      if (!selectedTextbook) {
          setSelectedTextbook(newTextbook);
      }
      showNotification(`Учебник "${file.name}" загружен!`, 'success');
  };

  const handleNavigateToPage = (page: number) => {
    if(textbooks.length === 0) {
        showNotification('Пожалуйста, сначала загрузите учебник', 'warning');
        return;
    }
    setActiveWorkspaceTab('textbook');
    setCurrentPage(page);
  };

  console.log('🔄 App render - tasks count:', tasks.length);
  console.log('🔄 App render - vocabulary count:', vocabulary.length);

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header onGenerateReport={handleGenerateFinalReport} isReportReady={allTasksCompleted} />
      
      {/* Notifications */}
      <div className="fixed top-0 right-0 z-50 p-4 space-y-2">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>

      <div className="flex-grow flex min-h-0">
        <Sidebar 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
        />
        <Workspace
          tasks={tasks}
          vocabulary={vocabulary}
          onGenerateTasks={handleGenerateTasks}
          onAnswerChange={handleAnswerChange}
          onCompleteTask={handleCompleteTask}
          onTaskItemTextChange={handleTaskItemTextChange}
          onNavigateToPage={handleNavigateToPage}
          onAddVocabularyItem={handleAddVocabularyItem}
          onUpdateVocabularyItem={handleUpdateVocabularyItem}
          onDeleteVocabularyItem={handleDeleteVocabularyItem}
          activeTab={activeWorkspaceTab}
          setActiveTab={setActiveWorkspaceTab}
          textbooks={textbooks}
          selectedTextbook={selectedTextbook}
          setSelectedTextbook={setSelectedTextbook}
          onAddTextbook={handleAddTextbook}
          numPages={numPages}
          setNumPages={setNumPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          zoom={zoom}
          setZoom={setZoom}
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          annotations={annotations}
          setAnnotations={setAnnotations}
        />
      </div>
    </div>
  );
};

export default App;