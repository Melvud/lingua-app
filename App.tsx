// App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import Login from './src/components/Auth/Login';
import Register from './src/components/Auth/Register';
import MainScreen from './src/components/MainScreen';
import Header from './src/components/Header';
import Sidebar from './src/components/Sidebar';
import Workspace from './src/components/Workspace';
import Notification from './src/components/Notification';
import { USERS } from './src/utils/constants';
import type { Message, Task, Annotation, Tool, TextbookFile, TaskItemPart, VocabularyItem } from './src/types';
import { generatePdfReport } from './src/services/pdfReportGenerator';

declare const window: any;

type SidebarTab = 'video' | 'chat';
type WorkspaceTab = 'tasks' | 'textbook' | 'dictionary';

interface NotificationState {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  id: number;
}

const initialMessages: Message[] = [
  {
    id: `msg-${Date.now()}`,
    text: '¡Hola! ¿Listo para empezar la lección de hoy?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    user: USERS.ANNA,
  }
];

const AppContent: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [inWorkspace, setInWorkspace] = useState(false);

  // Workspace state
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
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);

  const writtenTasks = tasks.filter(t => t.type === 'written');
  const allTasksCompleted = writtenTasks.length > 0 && writtenTasks.every(t => t.status === 'completed');

  useEffect(() => {
    console.log('🚀 App component mounted');
    
    // Проверяем загрузку PDF.js
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
      console.log('✅ PDF.js loaded');
    }
    
    // Проверяем загрузку jsPDF
    const checkPdfLibrary = () => {
      console.log('🔍 Checking jsPDF availability...');
      console.log('window.jspdf:', window.jspdf);
      console.log('window.jsPDF:', window.jsPDF);
      
      if (window.jspdf || window.jsPDF) {
        console.log('✅ jsPDF library loaded successfully');
        setPdfLibraryLoaded(true);
        
        // Проверяем autoTable
        if (window.jspdf) {
          const { jsPDF } = window.jspdf;
          const testDoc = new jsPDF();
          if (typeof testDoc.autoTable === 'function') {
            console.log('✅ autoTable plugin loaded successfully');
          } else {
            console.error('❌ autoTable plugin NOT loaded');
          }
        }
      } else {
        console.error('❌ jsPDF library NOT loaded');
        // Пробуем еще раз через 500ms
        setTimeout(checkPdfLibrary, 500);
      }
    };
    
    checkPdfLibrary();
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
    
    const processedTasks = newTasks.map(task => ({
      ...task,
      items: task.items.map(item => {
        if (item.type === 'fill-in-the-blank') {
          const answerCount = item.textParts.filter(p => p.isAnswer).length;
          return {
            ...item,
            userAnswer: undefined,
            userAnswers: new Array(answerCount).fill('')
          };
        }
        if (item.type === 'translate') {
          return {
            ...item,
            userAnswer: '',
            userAnswers: undefined
          };
        }
        return {
          ...item,
          userAnswer: undefined,
          userAnswers: undefined
        };
      })
    }));
    
    setTasks(prev => {
      const updated = [...prev, ...processedTasks];
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
  
  const handleAnswerChange = (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => {
    setTasks(prevTasks =>
      prevTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              items: task.items.map((item, i) => {
                if (i !== itemIndex) return item;
                
                if (item.type === 'fill-in-the-blank' && answerIndex !== undefined) {
                  const newAnswers = [...(item.userAnswers || [])];
                  newAnswers[answerIndex] = answer;
                  return { ...item, userAnswers: newAnswers };
                }
                
                if (item.type === 'translate') {
                  return { ...item, userAnswer: answer };
                }
                
                return item;
              })
            } 
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
    console.log('🎯 ========== GENERATE REPORT BUTTON CLICKED ==========');
    console.log('📊 All tasks completed?', allTasksCompleted);
    console.log('📝 Written tasks count:', writtenTasks.length);
    console.log('📝 Written tasks:', writtenTasks);
    console.log('📚 PDF Library loaded?', pdfLibraryLoaded);
    
    if (!allTasksCompleted) {
      console.warn('⚠️ Not all tasks completed');
      showNotification('Сначала завершите все письменные задания!', 'warning');
      return;
    }

    if (!pdfLibraryLoaded) {
      console.warn('⚠️ PDF library not loaded yet');
      showNotification('PDF библиотека еще загружается. Попробуйте через секунду.', 'warning');
      return;
    }

    try {
      console.log('✅ Starting PDF generation with', writtenTasks.length, 'tasks');
      generatePdfReport(writtenTasks);
      console.log('✅ PDF generation completed successfully');
      showNotification('PDF отчет успешно создан и скачан!', 'success');
    } catch (error) {
      console.error('❌ Error in handleGenerateFinalReport:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      showNotification(`Ошибка при генерации PDF: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 'error');
    }
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

  const handleBackToMain = () => {
    setInWorkspace(false);
  };

  // Показываем экран входа/регистрации, если пользователь не авторизован
  if (!currentUser) {
    return authMode === 'login' ? (
      <Login onSwitchToRegister={() => setAuthMode('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthMode('login')} />
    );
  }

  // Показываем главный экран, если нет партнера или не в рабочей области
  if (!userProfile?.partnerId || !inWorkspace) {
    return <MainScreen onEnterWorkspace={() => setInWorkspace(true)} />;
  }

  // Рабочая область
  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header 
        onGenerateReport={handleGenerateFinalReport} 
        isReportReady={allTasksCompleted}
        onBackToMain={handleBackToMain}
      />
      
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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;