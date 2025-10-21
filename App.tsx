// App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Login from './src/components/Auth/Login';
import Register from './src/components/Auth/Register';
import MainScreen from './src/components/MainScreen';
import InviteHandler from './src/components/InviteHandler';
import Header from './src/components/Header';
import Sidebar from './src/components/Sidebar';
import Workspace from './src/components/Workspace';
import Notification from './src/components/Notification';
import { useLessonSync } from './src/hooks/useLessonSync';
import { USERS } from './src/utils/constants';
import type { Message, Task, Annotation, Tool, TextbookFile, TaskItemPart, VocabularyItem } from './src/types';
import { generatePdfReport } from './src/services/pdfReportGenerator';

// Импорты для Firebase Storage
import { storage } from './src/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';


declare const window: any;

type SidebarTab = 'video' | 'chat';
type WorkspaceTab = 'tasks' | 'textbook' | 'dictionary';

interface NotificationState {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  id: number;
}

const InviteRoute: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  return <InviteHandler inviteCode={code || ''} />;
};

const WorkspaceContent: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('video');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#FF0000');
  const [annotations, setAnnotations] = useState<{ [key: number]: Annotation[] }>({});
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);

  // Используем хук для синхронизации данных урока
  const {
    lessonData,
    sharedData,
    updateSharedFiles,
    updateSharedInstruction,
    updateSharedVocabulary,
    updateSharedTextbooks,
    updateSharedCurrentPage,
    updateLessonTasks,
    messages,
    sendMessage
  } = useLessonSync(lessonId, userProfile?.pairId);

  // ИСПРАВЛЕНО: Загружаем задания из урока и ОЧИЩАЕМ ответы
  useEffect(() => {
    if (lessonData?.tasks) {
      // При загрузке заданий из Firebase, ОЧИЩАЕМ ответы.
      // Ответы каждого пользователя - локальны.
      const tasksWithCleanedAnswers = lessonData.tasks.map(task => ({
        ...task,
        status: 'pending', // Сбрасываем статус для всех
        items: task.items.map(item => {
          const cleanItem = { ...item };
          if (item.type === 'fill-in-the-blank') {
            const answerCount = item.textParts.filter(p => p.isAnswer).length;
            cleanItem.userAnswers = new Array(answerCount).fill('');
          } else if (item.type === 'translate') {
            cleanItem.userAnswer = '';
          }
          return cleanItem;
        })
      }));

      // Сравниваем, чтобы избежать бесконечного цикла, если кто-то удаляет/добавляет задания
      const localTaskStructure = JSON.stringify(tasks.map(t => t.id + t.instruction));
      const remoteTaskStructure = JSON.stringify(tasksWithCleanedAnswers.map(t => t.id + t.instruction));

      if (localTaskStructure !== remoteTaskStructure) {
        setTasks(tasksWithCleanedAnswers);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonData?.tasks]); // Зависимость 'tasks' убрана намеренно!

  const writtenTasks = tasks.filter(t => t.type === 'written');
  const allTasksCompleted = writtenTasks.length > 0 && writtenTasks.every(t => t.status === 'completed');

  // Эффект для настройки библиотек PDF
  useEffect(() => {
    console.log('🚀 Workspace component mounted');
    // Глобальная настройка pdf.js удалена, т.к. 'Textbook.tsx' и 
    // 'fileProcessor.ts' настраивают свои воркеры изолированно.

    const checkPdfLibrary = () => {
      if (window.jspdf || window.jsPDF) {
        console.log('✅ jsPDF library loaded successfully');
        setPdfLibraryLoaded(true);
      } else {
        setTimeout(checkPdfLibrary, 500);
      }
    };
    checkPdfLibrary();
    
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { message, type, id }]);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleSendMessage = useCallback((text: string) => {
    if (!currentUser || !userProfile) return;
    sendMessage(text, userProfile.nickname);
  }, [currentUser, userProfile, sendMessage]);

  const handleGenerateTasks = (newTasks: Task[], newVocabulary: VocabularyItem[]) => {
    const processedTasks = newTasks.map(task => ({
      ...task,
      items: task.items.map(item => {
        if (item.type === 'fill-in-the-blank') {
          const answerCount = item.textParts.filter(p => p.isAnswer).length;
          return {
            ...item,
            userAnswer: null,
            userAnswers: new Array(answerCount).fill('')
          };
        }
        if (item.type === 'translate') {
          return {
            ...item,
            userAnswer: '',
            userAnswers: null
          };
        }
        return {
          ...item,
          userAnswer: null,
          userAnswers: null
        };
      })
    }));
    
    const updatedTasks = [...tasks, ...processedTasks];
    setTasks(updatedTasks);
    
    // ИСПРАВЛЕНО: Сохраняем в БД только СТРУКТУРУ заданий
    updateLessonTasks(updatedTasks);
    
    if (newVocabulary.length > 0) {
      updateSharedVocabulary([...(sharedData?.vocabulary || []), ...newVocabulary]);
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
  };

  // ИСПРАВЛЕНО: Сохраняем ответы ТОЛЬКО локально
  const handleAnswerChange = (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => {
    const newTasks = tasks.map(task => 
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
    );
    
    setTasks(newTasks);
    // updateLessonTasks(newTasks); // ИСПРАВЛЕНО: УДАЛЕНО (не сохраняем ответы в БД)
  };

  // ИСПРАВЛЕНО: Сохраняем ТОЛЬКО локально
  const handleTaskItemTextChange = (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => {
    const newTasks = tasks.map(task => 
      task.id === taskId 
        ? { ...task, items: task.items.map((item, i) => i === itemIndex ? { ...item, textParts: newTextParts } : item) } 
        : task
    );
    
    setTasks(newTasks);
    // updateLessonTasks(newTasks); // ИСПРАВЛЕНО: УДАЛЕНО (не сохраняем ответы в БД)
  };

  // ИСПРАВЛЕНО: Сохраняем статус ТОЛЬКО локально
  const handleCompleteTask = (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, status: 'completed' as const } : task
    );
    setTasks(updatedTasks);
    // updateLessonTasks(updatedTasks); // ИСПРАВЛЕНО: УДАЛЕНО (не сохраняем статус в БД)
    
    showNotification('Задание выполнено!', 'success');
  };

  // ИСПРАВЛЕНО: Удаление синхронизируем с БД
  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    updateLessonTasks(updatedTasks); // Сохраняем в БД (структура изменилась)
    showNotification('Задание удалено', 'info');
  };

  const handleAddVocabularyItem = (item: Omit<VocabularyItem, 'id'>) => {
    const newItem: VocabularyItem = {
      ...item,
      id: `vocab-${Date.now()}-${Math.random()}`
    };
    updateSharedVocabulary([...(sharedData?.vocabulary || []), newItem]);
    showNotification('Слово добавлено в словарь!', 'success');
  };

  const handleUpdateVocabularyItem = (id: string, updates: Partial<VocabularyItem>) => {
    const updated = (sharedData?.vocabulary || []).map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    updateSharedVocabulary(updated);
    showNotification('Слово обновлено!', 'success');
  };

  const handleDeleteVocabularyItem = (id: string) => {
    const updated = (sharedData?.vocabulary || []).filter(item => item.id !== id);
    updateSharedVocabulary(updated);
    showNotification('Слово удалено из словаря', 'info');
  };

  // ИСПРАВЛЕНО: Передаем никнейм в генератор
  const handleGenerateFinalReport = () => {
    if (!userProfile) {
      showNotification('Ваш профиль еще не загрузился', 'warning');
      return;
    }
    if (!allTasksCompleted) {
      showNotification('Сначала завершите все письменные задания!', 'warning');
      return;
    }
    if (!pdfLibraryLoaded) {
      showNotification('PDF библиотека еще загружается. Попробуйте через секунду.', 'warning');
      return;
    }

    try {
      // Передаем локальные 'writtenTasks' (только с ответами этого пользователя) и никнейм
      generatePdfReport(writtenTasks, userProfile.nickname);
      showNotification('PDF отчет успешно создан и скачан!', 'success');
    } catch (error) {
      showNotification(`Ошибка при генерации PDF: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 'error');
    }
  };

  const handleAddTextbook = async (file: File) => {
    if (isUploading) return;
    if (!lessonId) {
      showNotification('Ошибка: ID урока не найден', 'error');
      return;
    }
    
    setIsUploading(true);
    showNotification(`Загрузка учебника "${file.name}"...`, 'info');

    try {
      const storageRef = ref(storage, `textbooks/${lessonId}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const newTextbook = { 
        name: file.name, 
        url: downloadURL 
      };
      
      const textbooksData = [
        ...(sharedData?.textbooks || []),
        newTextbook
      ];
      
      updateSharedTextbooks(textbooksData);
      showNotification(`Учебник "${file.name}" загружен!`, 'success');
      
    } catch (error) {
      console.error("Ошибка при загрузке учебника:", error);
      showNotification(`Ошибка при загрузке файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNavigateToPage = (page: number) => {
    if (!sharedData?.textbooks || sharedData.textbooks.length === 0) {
      showNotification('Пожалуйста, сначала загрузите учебник', 'warning');
      return;
    }
    setActiveWorkspaceTab('textbook');
    updateSharedCurrentPage(page);
  };

  const handlePageChange = (page: number) => {
    updateSharedCurrentPage(page);
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  if (!lessonId) {
    return <Navigate to="/" />;
  }

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header 
        onGenerateReport={handleGenerateFinalReport} // Вызывается без аргументов
        isReportReady={allTasksCompleted}
        onBackToMain={handleBackToMain}
        lessonName={lessonData?.name}
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
          pairId={userProfile?.pairId}
        />
        <Workspace
          tasks={tasks} // Передаем локальные 'tasks'
          vocabulary={sharedData?.vocabulary || []}
          onGenerateTasks={handleGenerateTasks}
          onAnswerChange={handleAnswerChange}
          onCompleteTask={handleCompleteTask}
          onTaskItemTextChange={handleTaskItemTextChange}
          onDeleteTask={handleDeleteTask} // Передаем
          onNavigateToPage={handleNavigateToPage}
          onAddVocabularyItem={handleAddVocabularyItem}
          onUpdateVocabularyItem={handleUpdateVocabularyItem}
          onDeleteVocabularyItem={handleDeleteVocabularyItem}
          activeTab={activeWorkspaceTab}
          setActiveTab={setActiveWorkspaceTab}
          sharedData={sharedData}
          onUpdateSharedFiles={updateSharedFiles}
          onUpdateSharedInstruction={updateSharedInstruction}
          onAddTextbook={handleAddTextbook}
          currentPage={sharedData?.currentPage || 1}
          onPageChange={handlePageChange}
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

const AppContent: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (!currentUser) {
    return authMode === 'login' ? (
      <Login onSwitchToRegister={() => setAuthMode('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthMode('login')} />
    );
  }

  return <Navigate to="/" />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MainScreenWrapper />} />
          <Route path="/invite/:code" element={<InviteRoute />} />
          <Route path="/workspace/:lessonId" element={<WorkspaceContent />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

const MainScreenWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <AppContent />;
  }

  const handleEnterWorkspace = (lessonId: string) => {
    navigate(`/workspace/${lessonId}`);
  };

  return <MainScreen onEnterWorkspace={handleEnterWorkspace} />;
};

export default App;