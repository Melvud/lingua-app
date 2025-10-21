// src/hooks/usePairSync.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, addDoc, collection, query, where, orderBy, onSnapshot as onSnapshotQuery } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { VocabularyItem, Message } from '../types';

interface SharedData {
  textbooks: Array<{ name: string; url: string }>;
  vocabulary: VocabularyItem[];
  currentPage: number;
  files: Array<{ name: string; url: string }>;
  instruction: string;
}

export const usePairSync = (pairId?: string) => {
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Синхронизация общих данных пары
  useEffect(() => {
    if (!pairId) return;

    const q = query(collection(db, 'pairs'), where('pairId', '==', pairId));
    
    const unsubscribe = onSnapshotQuery(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setSharedData(data.sharedData || {
          textbooks: [],
          vocabulary: [],
          currentPage: 1,
          files: [],
          instruction: ''
        });
      }
    });

    return () => unsubscribe();
  }, [pairId]);

  // Синхронизация сообщений чата
  useEffect(() => {
    if (!pairId) return;

    const q = query(
      collection(db, 'messages'),
      where('pairId', '==', pairId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshotQuery(q, (snapshot) => {
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
  }, [pairId]);

  const updatePairData = async (updates: Partial<SharedData>) => {
    if (!pairId) return;

    const q = query(collection(db, 'pairs'), where('pairId', '==', pairId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = doc(db, 'pairs', snapshot.docs[0].id);
      await updateDoc(docRef, {
        'sharedData': { ...sharedData, ...updates }
      });
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

  const sendMessage = async (text: string, userName: string) => {
    if (!pairId) return;

    await addDoc(collection(db, 'messages'), {
      pairId,
      userId: auth.currentUser?.uid,
      userName,
      text,
      timestamp: new Date()
    });
  };

  return {
    sharedData,
    messages,
    updateSharedFiles,
    updateSharedInstruction,
    updateSharedVocabulary,
    updateSharedTextbooks,
    updateSharedCurrentPage,
    sendMessage
  };
};

// Добавьте импорт в начале файла
import { getDocs } from 'firebase/firestore';
import { auth } from '../config/firebase';