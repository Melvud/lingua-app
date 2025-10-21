// src/hooks/useLessonSync.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, addDoc, collection, query, where, orderBy, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import type { VocabularyItem, Message, Task, Lesson, UserAnswersStore, AnnotationStore } from '../types';

interface SharedData {
  textbooks: Array<{ name: string; url: string }>;
  vocabulary: VocabularyItem[];
  currentPage: number;
  files: Array<{ name: string; url: string }>;
  instruction: string;
  selectedTextbookName?: string | null; 
  annotations?: AnnotationStore; 
}

export const useLessonSync = (lessonId?: string, pairId?: string) => {
  const [lessonData, setLessonData] = useState<Lesson | null>(null);
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswersStore>({});
  
  const userId = auth.currentUser?.uid;

  // Загружаем данные урока
  useEffect(() => {
    if (!lessonId) return;
    const unsubscribe = onSnapshot(doc(db, 'lessons', lessonId), (doc) => {
      if (doc.exists()) {
        setLessonData({ id: doc.id, ...doc.data() } as Lesson);
      }
    });
    return () => unsubscribe();
  }, [lessonId]);


  // Синхронизация общих данных пары
  useEffect(() => {
    if (!pairId) return;

    const q = query(collection(db, 'pairs'), where('pairId', '==', pairId));
    
    getDocs(q).then((snapshot) => {
      if (!snapshot.empty) {
        const unsubscribe = onSnapshot(doc(db, 'pairs', snapshot.docs[0].id), (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setSharedData(data.sharedData || {
              textbooks: [],
              vocabulary: [],
              currentPage: 1,
              files: [],
              instruction: '',
              selectedTextbookName: null,
              annotations: {} 
            });
          }
        });

        return () => unsubscribe();
      }
    });
  }, [pairId]);

  // Синхронизация сообщений чата для урока
  useEffect(() => {
    if (!lessonId) return;

    const q = query(
      collection(db, 'messages'),
      where('lessonId', '==', lessonId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        
        // ИСПРАВЛЕНО: Вот здесь была ошибка.
        // Переменная 'data' не была определена.
        const data = doc.data(); 
        
         msgs.push({
          id: doc.id,
          text: data.text, // Теперь 'data' определена
          timestamp: new Date(data.timestamp.toDate()).toLocaleTimeString([], { // Теперь 'data' определена
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          user: {
            id: data.userId, // Теперь 'data' определена
            name: data.userName, // Теперь 'data' определена
            avatar: `https://i.pravatar.cc/150?u=${data.userId}` // Теперь 'data' определена
          }
        });
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [lessonId]);


  // Синхронизация ответов ТЕКУЩЕГО пользователя
  useEffect(() => {
    if (!lessonId || !userId) {
      setUserAnswers({}); 
      return;
    }
    const docId = `${lessonId}_${userId}`;
    const docRef = doc(db, 'lessonUserAnswers', docId);

    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setUserAnswers(doc.data().answers || {});
      } else {
        setUserAnswers({});
      }
    });

    return () => unsubscribe();
  }, [lessonId, userId]);

  // Обновление общих данных пары
  const updatePairData = async (updates: Partial<SharedData>) => {
    if (!pairId || !sharedData) return; 

    const q = query(collection(db, 'pairs'), where('pairId', '==', pairId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = doc(db, 'pairs', snapshot.docs[0].id);
      await setDoc(docRef, {
        'sharedData': { ...sharedData, ...updates }
      }, { merge: true });
    }
  };

  const updateLessonTasks = async (tasks: Task[]) => {
    if (!lessonId) return;

    const completedCount = tasks.filter(t => t.status === 'completed').length;
    
    await updateDoc(doc(db, 'lessons', lessonId), {
      tasks,
      totalTasksCount: tasks.length,
      completedTasksCount: completedCount,
      updatedAt: new Date()
    });
  };

  const updateUserAnswers = async (newAnswers: UserAnswersStore) => {
    if (!lessonId || !userId) return;
    
    const docId = `${lessonId}_${userId}`;
    const docRef = doc(db, 'lessonUserAnswers', docId);
    
    try {
      await setDoc(docRef, { answers: newAnswers }, { merge: true });
    } catch (error) {
      console.error("Failed to save user answers:", error);
    }
  };

  const updateSharedFiles = (files: Array<{ name: string; url: string }>) => {
    updatePairData({ files });
  };

  const updateSharedInstruction = (instruction: string) => {
    updatePairData({ instruction });
  };

  const updateSharedVocabulary = (vocabulary: VocabularyItem[]) => {
    updatePairData({ vocabulary });
  };

  const updateSharedTextbooks = (textbooks: Array<{ name: string; url: string }>) => {
    updatePairData({ textbooks });
  };

  const updateSharedCurrentPage = (currentPage: number) => {
    updatePairData({ currentPage });
  };

  const updateSharedSelectedTextbook = (name: string | null) => {
    updatePairData({ selectedTextbookName: name });
  };
  
  const updateSharedAnnotations = (annotations: AnnotationStore) => {
    updatePairData({ annotations });
  };

  const sendMessage = async (text: string, userName: string) => {
    if (!lessonId) return;

    await addDoc(collection(db, 'messages'), {
      lessonId,
      userId: auth.currentUser?.uid,
      userName,
      text,
      timestamp: new Date()
    });
  };

  return {
    lessonData,
    sharedData,
    messages,
    userAnswers, 
    updateSharedFiles,
    updateSharedInstruction,
    updateSharedVocabulary,
    updateSharedTextbooks,
    updateSharedCurrentPage,
    updateSharedSelectedTextbook, 
    updateLessonTasks,
    updateUserAnswers,
    updateSharedAnnotations, 
    sendMessage
  };
};