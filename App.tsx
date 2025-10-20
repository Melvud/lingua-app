import React, { useState, useCallback, useEffect } from 'react';
import Header from './src/components/Header';
import Sidebar from './src/components/Sidebar';
import Workspace from './src/components/Workspace';
import { USERS } from './src/utils/constants';
import type { Message, Task, Annotation, Tool, TextbookFile, TaskItemPart, VocabularyItem } from './src/types';
import { generatePdfReport } from './src/services/pdfReportGenerator';

declare const window: any;

type SidebarTab = 'video' | 'chat';
type WorkspaceTab = 'tasks' | 'textbook' | 'whiteboard' | 'dictionary';

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

  const allTasksCompleted = tasks.length > 0 && tasks.every(t => t.status === 'completed');

  useEffect(() => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
    }
  }, []);
  
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
    setTasks(newTasks);
    if (newVocabulary.length > 0) {
        setVocabulary(prev => [...prev, ...newVocabulary]);
        setActiveWorkspaceTab('dictionary');
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
  };

  const handleGenerateFinalReport = () => {
    if (!allTasksCompleted) return;

    const checkAndGenerate = (tries = 0) => {
        if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.autoTable !== 'undefined') {
            generatePdfReport(tasks);
        } else if (tries < 10) {
            setTimeout(() => checkAndGenerate(tries + 1), 100);
        } else {
            console.error("jsPDF or jsPDF-autoTable not loaded after 1 second.");
            alert("Ошибка при генерации PDF: не удалось загрузить модули. Пожалуйста, обновите страницу.");
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
  };

  const handleNavigateToPage = (page: number) => {
    if(textbooks.length === 0) {
        alert("Пожалуйста, сначала загрузите учебник во вкладке 'Учебник'.");
        return;
    }
    setActiveWorkspaceTab('textbook');
    setCurrentPage(page);
  };

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header onGenerateReport={handleGenerateFinalReport} isReportReady={allTasksCompleted} />
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