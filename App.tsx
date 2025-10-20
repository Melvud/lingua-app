import React, { useState, useCallback, useEffect } from 'react';
import Header from './src/components/Header';
import Sidebar from './src/components/Sidebar';
import Workspace from './src/components/Workspace';
import { USERS } from './src/utils/constants';
import type { Message, Task, Annotation, Tool, TextbookFile } from './src/types';
import { generatePdfReport } from './src/services/pdfReportGenerator';

type SidebarTab = 'video' | 'chat';

// This is necessary for pdf.js to work when loaded from a CDN
declare const window: any;

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
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('video');

  // Textbook State
  const [textbooks, setTextbooks] = useState<TextbookFile[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookFile | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.5);
  
  // Annotation State
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

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        text: '¡Muy bien! Continuemos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        user: USERS.ANNA,
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  }, []);

  const handleGenerateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
  };
  
  const handleAnswerChange = (taskId: string, itemIndex: number, answer: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          const newItems = [...task.items];
          const newItem = { ...newItems[itemIndex], userAnswer: answer };
          newItems[itemIndex] = newItem;
          return { ...task, items: newItems };
        }
        return task;
      })
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
    if (allTasksCompleted) {
      generatePdfReport(tasks);
    }
  };

  const handleAddTextbook = (file: File) => {
      const newTextbook = { file, url: URL.createObjectURL(file) };
      setTextbooks(prev => [...prev, newTextbook]);
      if (!selectedTextbook) {
          setSelectedTextbook(newTextbook);
      }
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
          onGenerateTasks={handleGenerateTasks}
          onAnswerChange={handleAnswerChange}
          onCompleteTask={handleCompleteTask}
          // Textbook props
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
          // Annotation props
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