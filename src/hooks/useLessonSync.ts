// src/hooks/useLessonSync.ts
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, addDoc, collection, query, where, orderBy, getDocs, setDoc } from 'firebase/firestore';
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

// Вспомогательная функция для глубокой очистки данных перед отправкой в Firestore
const sanitizeForFirestore = (obj: any, depth = 0): any => {
  // Защита от бесконечной рекурсии
  if (depth > 10) {
    console.warn('⚠️ Max recursion depth reached');
    return null;
  }

  // Обработка null и undefined
  if (obj === null || obj === undefined) {
    return null;
  }

  // Обработка массивов
  if (Array.isArray(obj)) {
    const cleaned = obj
      .filter(item => item !== null && item !== undefined && item !== '')
      .map(item => sanitizeForFirestore(item, depth + 1))
      .filter(item => item !== null);
    
    return cleaned.length > 0 ? cleaned : null;
  }

  // Обработка объектов
  if (typeof obj === 'object' && obj !== null) {
    // Проверка на Date объекты (разрешены в Firestore)
    if (obj instanceof Date) {
      return obj;
    }

    const result: any = {};
    let hasContent = false;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const cleanedValue = sanitizeForFirestore(obj[key], depth + 1);
        
        if (cleanedValue !== null && cleanedValue !== undefined) {
          result[key] = cleanedValue;
          hasContent = true;
        }
      }
    }

    return hasContent ? result : null;
  }

  // Обработка строк
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  // Обработка чисел и булевых значений
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  // Все остальное отбрасываем
  console.warn('⚠️ Unknown type encountered:', typeof obj);
  return null;
};

export const useLessonSync = (lessonId?: string, pairId?: string) => {
  const [lessonData, setLessonData] = useState<Lesson | null>(null);
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswersStore>({});
  
  const userId = auth.currentUser?.uid;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Загрузка данных урока
  useEffect(() => {
    if (!lessonId) return;
    
    console.log('📖 Setting up lesson listener for:', lessonId);
    const unsubscribe = onSnapshot(doc(db, 'lessons', lessonId), (doc) => {
      if (doc.exists()) {
        console.log('📖 Lesson data loaded');
        setLessonData({ id: doc.id, ...doc.data() } as Lesson);
      }
    });
    
    return () => unsubscribe();
  }, [lessonId]);

  // Загрузка общих данных пары
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

  // Загрузка сообщений чата
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
        const data = doc.data(); 
        
        msgs.push({
          id: doc.id,
          text: data.text,
          timestamp: new Date(data.timestamp.toDate()).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          user: {
            id: data.userId,
            name: data.userName,
            avatar: `https://i.pravatar.cc/150?u=${data.userId}`
          }
        });
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [lessonId]);

  // Загрузка ответов пользователя
  useEffect(() => {
    if (!lessonId || !userId) {
      setUserAnswers({}); 
      return;
    }
    
    const docId = `${lessonId}_${userId}`;
    const docRef = doc(db, 'lessonUserAnswers', docId);

    console.log('📥 Setting up user answers listener for:', docId);

    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data().answers || {};
        console.log('📥 Loaded user answers from Firestore:', data);
        setUserAnswers(data);
      } else {
        console.log('📭 No user answers found in Firestore');
        setUserAnswers({});
      }
    }, (error) => {
      console.error('❌ Error loading user answers:', error);
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

  // Обновление заданий урока
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

  // ГЛАВНАЯ ФУНКЦИЯ: Обновление ответов пользователя
  const updateUserAnswers = (newAnswers: UserAnswersStore) => {
    if (!lessonId || !userId) {
      console.warn('⚠️ Cannot save: missing lessonId or userId');
      return;
    }
    
    console.log('💾 updateUserAnswers called');
    console.log('📊 Raw data:', JSON.stringify(newAnswers, null, 2));
    
    // Немедленно обновляем UI
    setUserAnswers(newAnswers);
    
    // Отменяем предыдущее сохранение
    if (saveTimeoutRef.current) {
      console.log('⏱️ Cancelling previous save timer');
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Запускаем новый таймер
    saveTimeoutRef.current = setTimeout(async () => {
      // Проверка, не идет ли уже сохранение
      if (isSavingRef.current) {
        console.log('⏳ Save already in progress, skipping');
        return;
      }

      isSavingRef.current = true;
      const docId = `${lessonId}_${userId}`;
      const docRef = doc(db, 'lessonUserAnswers', docId);
      
      try {
        console.log('🔄 Starting save process...');
        console.log('📝 Document ID:', docId);
        
        // Очищаем данные для Firestore
        const sanitized = sanitizeForFirestore(newAnswers);
        
        console.log('🧹 Sanitized data:', JSON.stringify(sanitized, null, 2));
        
        // Проверяем, что есть что сохранять
        if (!sanitized || Object.keys(sanitized).length === 0) {
          console.log('⚠️ No valid data to save, skipping');
          isSavingRef.current = false;
          return;
        }
        
        // Сохраняем в Firestore
        await setDoc(docRef, { 
          answers: sanitized,
          updatedAt: new Date()
        });
        
        console.log('✅ Successfully saved to Firestore!');
        
      } catch (error: any) {
        console.error('❌ Failed to save user answers');
        console.error('Error object:', error);
        console.error('Error code:', error?.code);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
      } finally {
        isSavingRef.current = false;
      }
    }, 1000); // 1 секунда задержки
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
