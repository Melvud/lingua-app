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

// УЛУЧШЕННАЯ функция очистки с детальным логированием
const sanitizeForFirestore = (obj: any, depth = 0, path = 'root'): any => {
  if (depth > 15) {
    console.warn(`⚠️ Max depth at: ${path}`);
    return null;
  }

  if (obj === null || obj === undefined) {
    return null;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    return trimmed.length > 0 ? trimmed : '';  // Возвращаем пустую строку вместо null
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  // МАССИВЫ - КРИТИЧНО
  if (Array.isArray(obj)) {
    const cleaned = obj.map((item, idx) => {
      if (item === undefined || item === null) {
        console.log(`⚠️ Found undefined/null in array at ${path}[${idx}], replacing with empty string`);
        return '';
      }
      return sanitizeForFirestore(item, depth + 1, `${path}[${idx}]`);
    });
    
    console.log(`✅ Sanitized array at ${path}:`, cleaned);
    return cleaned;
  }

  // ОБЪЕКТЫ
  if (typeof obj === 'object') {
    const result: any = {};
    let hasContent = false;

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      
      const stringKey = String(key);
      const value = obj[key];
      
      console.log(`🔍 Processing key "${stringKey}" at ${path}:`, typeof value, value);
      
      const cleanedValue = sanitizeForFirestore(value, depth + 1, `${path}.${stringKey}`);
      
      // Включаем даже пустые строки и пустые массивы
      if (cleanedValue !== null && cleanedValue !== undefined) {
        result[stringKey] = cleanedValue;
        hasContent = true;
      }
    }

    if (!hasContent) {
      console.log(`⚠️ Empty object at ${path}, returning null`);
      return null;
    }

    console.log(`✅ Sanitized object at ${path}:`, result);
    return result;
  }

  console.warn(`⚠️ Unknown type at ${path}:`, typeof obj, obj);
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

  // КРИТИЧНО ВАЖНАЯ функция сохранения
  const updateUserAnswers = (newAnswers: UserAnswersStore) => {
    if (!lessonId || !userId) {
      console.error('❌ Cannot save: missing lessonId or userId', { lessonId, userId });
      alert('Ошибка: не удалось определить урок или пользователя');
      return;
    }
    
    console.log('💾 ========== UPDATE USER ANSWERS ==========');
    console.log('📊 Raw input data:', JSON.stringify(newAnswers, null, 2));
    
    // Немедленно обновляем UI
    setUserAnswers(newAnswers);
    
    // Отменяем предыдущее сохранение
    if (saveTimeoutRef.current) {
      console.log('⏱️ Cancelling previous save timer');
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Запускаем новый таймер
    saveTimeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) {
        console.log('⏳ Save already in progress, skipping');
        return;
      }

      isSavingRef.current = true;
      const docId = `${lessonId}_${userId}`;
      const docRef = doc(db, 'lessonUserAnswers', docId);
      
      try {
        console.log('🔄 ========== SAVE PROCESS STARTED ==========');
        console.log('📝 Document ID:', docId);
        console.log('👤 User ID:', userId);
        console.log('📚 Lesson ID:', lessonId);
        
        // ЭТАП 1: Очистка данных
        console.log('🧹 Starting sanitization...');
        const sanitized = sanitizeForFirestore(newAnswers, 0, 'answers');
        
        console.log('🧹 Sanitization complete!');
        console.log('📦 Sanitized data:', JSON.stringify(sanitized, null, 2));
        
        // ЭТАП 2: Валидация
        if (!sanitized || Object.keys(sanitized).length === 0) {
          console.warn('⚠️ No valid data after sanitization');
          alert('Предупреждение: нет данных для сохранения');
          isSavingRef.current = false;
          return;
        }
        
        // ЭТАП 3: Подготовка финального документа
        const finalDoc = {
          answers: sanitized,
          updatedAt: new Date(),
          userId: userId,
          lessonId: lessonId
        };
        
        console.log('📄 Final document to save:', JSON.stringify(finalDoc, null, 2));
        
        // ЭТАП 4: Сохранение в Firestore
        console.log('💾 Saving to Firestore...');
        await setDoc(docRef, finalDoc, { merge: false }); // merge: false для полной перезаписи
        
        console.log('✅ ========== SAVE SUCCESSFUL ==========');
        
      } catch (error: any) {
        console.error('❌ ========== SAVE FAILED ==========');
        console.error('Error object:', error);
        console.error('Error code:', error?.code);
        console.error('Error message:', error?.message);
        
        // Детальная информация об ошибке
        if (error?.code === 'permission-denied') {
          alert('❌ Ошибка прав доступа!\n\nУ вас нет прав для сохранения ответов.\nПроверьте правила Firestore или обратитесь к администратору.');
        } else if (error?.code === 'invalid-argument') {
          alert('❌ Ошибка формата данных!\n\nДанные содержат недопустимые значения.\nСм. консоль для деталей.');
          console.error('Invalid data that was attempted to save:', JSON.stringify(newAnswers, null, 2));
        } else if (error?.message?.includes('permissions')) {
          alert('❌ Ошибка прав доступа!\n\n' + error.message + '\n\nПроверьте правила Firestore.');
        } else {
          alert(`❌ Ошибка сохранения!\n\n${error?.message || 'Неизвестная ошибка'}\n\nСм. консоль для деталей.`);
        }
        
      } finally {
        isSavingRef.current = false;
      }
    }, 1000);
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