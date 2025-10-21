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
// ИСПРАВЛЕНО: Добавлены UserAnswersStore и AnnotationStore
import type { Message, Task, Annotation, Tool, TextbookFile, TaskItemPart, VocabularyItem, UserAnswersStore, AnnotationStore } from './src/types';
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
  
  // ИСПРАВЛЕНО: 'tasks' теперь хранит ТОЛЬКО структуру заданий
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#FF0000');
  
  // ИСПРАВЛЕНО: Локальное состояние 'annotations' удалено. Оно будет приходить из useLessonSync
  // const [annotations, setAnnotations] = useState<{ [key: number]: Annotation[] }>({});
  
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Используем хук для синхронизации данных урока
  const {
    lessonData,
    sharedData,
    // ИСПРАВЛЕНО: Получаем новые данные и функции
    userAnswers,
    updateUserAnswers,
    updateSharedAnnotations,
    // ...
    updateSharedFiles,
    updateSharedInstruction,
    updateSharedVocabulary,
    updateSharedTextbooks,
    updateSharedCurrentPage,
    updateLessonTasks,
    messages,
    sendMessage
  } = useLessonSync(lessonId, userProfile?.pairId);

  // ИСПРАВЛЕНО: Этот эффект теперь просто синхронизирует СТРУКТУРУ заданий
  useEffect(() => {
    if (lessonData?.tasks) {
      // Сравниваем, чтобы избежать бесконечного цикла
      // (Это простая, но не идеальная проверка)
      if (JSON.stringify(lessonData.tasks) !== JSON.stringify(tasks)) {
         setTasks(lessonData.tasks);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonData?.tasks]); 

  // ИСПРАВЛЕНО: Этот статус теперь определяется по tasks из Firebase
  const writtenTasks = lessonData?.tasks.filter(t => t.type === 'written') || [];
  const allTasksCompleted = writtenTasks.length > 0 && writtenTasks.every(t => t.status === 'completed');

  // Эффект для настройки библиотек PDF (без изменений)
  useEffect(() => {
    console.log('🚀 Workspace component mounted');
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
    
    // ИСПРАВЛЕНО: Не добавляем userAnswers/userAnswer в объект Task
    // Они хранятся отдельно
    const updatedTasks = [...tasks, ...newTasks];
    
    setTasks(updatedTasks);
    updateLessonTasks(updatedTasks); // Сохраняем СТРУКТУРУ в БД
    
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

  // ИСПРАВЛЕНО: Полностью новая логика для сохранения ответов
  const handleAnswerChange = (taskId: string, itemIndex: number, answer: string, answerIndex?: number) => {
    // Создаем глубокую копию текущих ответов, чтобы избежать мутаций
    const newAnswersStore: UserAnswersStore = JSON.parse(JSON.stringify(userAnswers || {}));

    // Инициализируем объекты, если их нет
    if (!newAnswersStore[taskId]) {
      newAnswersStore[taskId] = {};
    }
    if (!newAnswersStore[taskId][itemIndex]) {
      newAnswersStore[taskId][itemIndex] = {};
    }

    const itemAnswers = newAnswersStore[taskId][itemIndex];

    if (answerIndex !== undefined) {
      // Это 'fill-in-the-blank'
      if (!itemAnswers.userAnswers) {
        itemAnswers.userAnswers = [];
      }
      itemAnswers.userAnswers[answerIndex] = answer;
    } else {
      // Это 'translate'
      itemAnswers.userAnswer = answer;
    }
    
    // Вызываем функцию из хука для сохранения в Firestore
    updateUserAnswers(newAnswersStore);
  };

  // ИСПРАВЛЕНО: Сохраняем изменения текста задания в БД
  const handleTaskItemTextChange = (taskId: string, itemIndex: number, newTextParts: TaskItemPart[]) => {
    const newTasks = tasks.map(task => 
      task.id === taskId 
        ? { ...task, items: task.items.map((item, i) => i === itemIndex ? { ...item, textParts: newTextParts } : item) } 
        : task
    );
    
    setTasks(newTasks);
    updateLessonTasks(newTasks); // Сохраняем СТРУКТУРУ в БД
  };

  // ИСПРАВЛЕНО: Сохраняем статус в БД
  const handleCompleteTask = (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, status: 'completed' as const } : task
    );
    setTasks(updatedTasks);
    updateLessonTasks(updatedTasks); // Сохраняем СТАТУС в БД
    
    showNotification('Задание выполнено!', 'success');
  };

  // Удаление (Логика была верной)
  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    updateLessonTasks(updatedTasks); 
    showNotification('Задание удалено', 'info');
  };

  // (Функции Словаря ... без изменений)
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


  // ИСПРАВЛЕНО: Генерация отчета теперь требует `userAnswers`
  const handleGenerateFinalReport = () => {
    if (!userProfile) {
      showNotification('Ваш профиль еще не загрузился', 'warning');
      return;
    }
    // Используем 'tasks' из локального состояния (или 'lessonData.tasks', они должны быть синхр.)
    const written = tasks.filter(t => t.type === 'written');
    
    // Проверяем статус в 'tasks'
    const allDone = written.length > 0 && written.every(t => t.status === 'completed');
    
    if (!allDone) {
      showNotification('Сначала завершите все письменные задания!', 'warning');
      return;
    }
    if (!pdfLibraryLoaded) {
      showNotification('PDF библиотека еще загружается. Попробуйте через секунду.', 'warning');
      return;
    }

    try {
      // ИСПРАВЛЕНО: Передаем `tasks` и `userAnswers` (для этого пользователя)
      generatePdfReport(written, userAnswers, userProfile.nickname);
      showNotification('PDF отчет успешно создан и скачан!', 'success');
    } catch (error) {
      showNotification(`Ошибка при генерации PDF: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 'error');
    }
  };

  // (handleAddTextbook ... без изменений)
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

  // (handleNavigateToPage ... без изменений)
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
        onGenerateReport={handleGenerateFinalReport} 
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
          tasks={tasks} // Передаем 'tasks' (только структура)
          userAnswers={userAnswers} // ИСПРАВЛЕНО: Передаем 'userAnswers'
          vocabulary={sharedData?.vocabulary || []}
          onGenerateTasks={handleGenerateTasks}
          onAnswerChange={handleAnswerChange} // ИСПРАВЛЕНО: Передаем новый обработчик
          onCompleteTask={handleCompleteTask}
          onTaskItemTextChange={handleTaskItemTextChange}
          onDeleteTask={handleDeleteTask}
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
          // ИСПРАВЛЕНО: Передаем функцию выбора учебника
          onSelectTextbook={(name) => updateSharedCurrentPage(1) /* Сброс страницы при смене */ }
          currentPage={sharedData?.currentPage || 1}
          onPageChange={handlePageChange}
          // ИСПРАВЛЕНО: Передаем обработчик аннотаций
          onUpdateSharedAnnotations={updateSharedAnnotations}
        />
      </div>
    </div>
  );
};

// (AppContent ... без изменений)
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

// (App ... без изменений)
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

// (MainScreenWrapper ... без изменений)
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