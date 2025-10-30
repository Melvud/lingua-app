// src/components/MainScreen.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc,
  getDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Lesson, VocabularyItem } from '../types';

interface MainScreenProps {
  onEnterWorkspace: (lessonId: string) => void;
}

interface PairRequest {
  id: string;
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

type MainTab = 'lessons' | 'vocabulary' | 'textbooks';

const MainScreen: React.FC<MainScreenProps> = ({ onEnterWorkspace }) => {
  const { currentUser, userProfile, logout, updateUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>('lessons');
  const [searchNickname, setSearchNickname] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [incomingRequests, setIncomingRequests] = useState<PairRequest[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Данные уроков
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [showNewLessonModal, setShowNewLessonModal] = useState(false);
  const [newLessonName, setNewLessonName] = useState('');
  const [lessonNameError, setLessonNameError] = useState('');
  const [creatingLesson, setCreatingLesson] = useState(false);
  
  // Общие данные пары
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [textbooks, setTextbooks] = useState<Array<{ name: string; url: string }>>([]);

  // ❌ =========================================
  // ❌ ИСПРАВЛЕНИЕ: ЭТОТ БЛОК УДАЛЕН (строки ~86-97)
  // Он дублировал логику AuthContext и приводил к ошибкам.
  // useEffect(() => {
  //   if (!currentUser) return;
  //   const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
  //     // ...
  //   });
  //   return () => unsubscribe();
  // }, [currentUser?.uid]);
  // ❌ =========================================


  // Загружаем инфо о партнере
  // Этот useEffect теперь будет корректно срабатывать,
  // т.к. userProfile будет обновляться из AuthContext.
  useEffect(() => {
    if (userProfile?.partnerId) {
      console.log('🔄 User profile changed, loading partner info...');
      loadPartnerInfo();
    } else {
      console.log('🔄 User profile changed, clearing partner info.');
      setPartnerInfo(null);
    }
  }, [userProfile?.partnerId]); // Зависимость ПРАВИЛЬНАЯ

  // Real-time слушатель входящих запросов
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'pairRequests'),
      where('toUserId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: PairRequest[] = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as PairRequest);
      });
      setIncomingRequests(requests);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Загружаем уроки пары
  useEffect(() => {
    if (!userProfile?.pairId) {
        setLessons([]); // Очищаем уроки, если нет pairId
        return;
    }

    const q = query(
      collection(db, 'lessons'),
      where('pairId', '==', userProfile.pairId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lessonsData: Lesson[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        lessonsData.push({ 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Lesson);
      });
      setLessons(lessonsData);
    });

    return () => unsubscribe();
  }, [userProfile?.pairId]);

  // Загружаем общие данные пары
  useEffect(() => {
    if (!userProfile?.pairId) {
        setVocabulary([]); // Очищаем данные, если нет pairId
        setTextbooks([]);
        return;
    }

    const q = query(
      collection(db, 'pairs'),
      where('pairId', '==', userProfile.pairId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setVocabulary(data.sharedData?.vocabulary || []);
        setTextbooks(data.sharedData?.textbooks || []);
      } else {
        setVocabulary([]);
        setTextbooks([]);
      }
    });

    return () => unsubscribe();
  }, [userProfile?.pairId]);

  const loadPartnerInfo = async () => {
    if (!userProfile?.partnerId) return;

    try {
      const docRef = doc(db, 'users', userProfile.partnerId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setPartnerInfo(docSnap.data());
      } else {
        console.warn('Partner document not found');
        setPartnerInfo(null); // Если партнер не найден
      }
    } catch (error) {
      console.error('Error loading partner info:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchNickname.trim()) {
      setSearchError('Введите никнейм');
      return;
    }

    setLoading(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const q = query(
        collection(db, 'users'),
        where('nickname', '==', searchNickname.trim())
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setSearchError('Пользователь не найден');
      } else {
        const userData = querySnapshot.docs[0].data();
        if (userData.uid === currentUser?.uid) {
          setSearchError('Это ваш собственный никнейм');
        } else if (userData.partnerId) {
          setSearchError('У этого пользователя уже есть партнер');
        } else {
          setSearchResult({ id: querySnapshot.docs[0].id, ...userData });
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || !currentUser || !userProfile) return;

    try {
      await addDoc(collection(db, 'pairRequests'), {
        fromUserId: currentUser.uid,
        fromNickname: userProfile.nickname,
        toUserId: searchResult.uid,
        status: 'pending',
        createdAt: new Date()
      });

      setSearchResult(null);
      setSearchNickname('');
      alert('Запрос отправлен!');
    } catch (error) {
      console.error('Send request error:', error);
      alert('Ошибка отправки запроса');
    }
  };

  const handleAcceptRequest = async (request: PairRequest) => {
    if (!currentUser) return;

    try {
      // 1. Обновляем запрос
      await updateDoc(doc(db, 'pairRequests', request.id), {
        status: 'accepted'
      });

      // 2. Создаем пару
      const pairId = `pair_${currentUser.uid}_${request.fromUserId}`;
      await addDoc(collection(db, 'pairs'), {
        pairId,
        user1Id: currentUser.uid,
        user2Id: request.fromUserId,
        createdAt: new Date(),
        sharedData: {
          textbooks: [],
          vocabulary: [],
          currentPage: 1,
          files: [],
          instruction: ''
        }
      });

      // 3. Обновляем текущего пользователя (принявшего)
      // Эта операция УСПЕШНА (благодаря)
      await updateDoc(doc(db, 'users', currentUser.uid), {
        partnerId: request.fromUserId,
        pairId
      });

      // 4. Обновляем пригласившего пользователя
      // Эта операция БЫЛА ПРОВАЛЬНОЙ, но с новыми правилами firestore.rules УСПЕШНА
      await updateDoc(doc(db, 'users', request.fromUserId), {
        partnerId: currentUser.uid,
        pairId
      });

      // 5. Ручное обновление не нужно, т.к. onSnapshot в AuthContext
      //    сам поймает изменение (currentUser.uid)
      // await updateUserProfile(); 
      // Вместо этого AuthContext сам обновит userProfile

      alert('Запрос принят! Теперь вы в паре!');
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Ошибка принятия запроса. Проверьте консоль на ошибки "permission-denied".');
    }
  };

  const handleRejectRequest = async (request: PairRequest) => {
    try {
      await updateDoc(doc(db, 'pairRequests', request.id), {
        status: 'rejected'
      });
    } catch (error) {
      console.error('Reject request error:', error);
      alert('Ошибка отклонения запроса');
    }
  };

  const generateInviteLink = async () => {
    if (!currentUser) return;

    const code = Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/invite/${code}`;
    setInviteLink(link);

    await addDoc(collection(db, 'invites'), {
      code,
      userId: currentUser.uid,
      createdAt: new Date(),
      used: false
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('Ссылка скопирована!');
  };

  const handleBreakPair = async () => {
    if (!currentUser || !userProfile?.partnerId) return;

    if (!confirm('Вы уверены, что хотите разорвать пару?')) return;

    const currentPartnerId = userProfile.partnerId; // Сохраняем ID партнера

    try {
      // 1. Обновляем текущего пользователя
      // Эта операция УСПЕШНА (благодаря)
      await updateDoc(doc(db, 'users', currentUser.uid), {
        partnerId: null,
        pairId: null
      });

      // 2. Обновляем бывшего партнера
      // Эта операция БЫЛА ПРОВАЛЬНОЙ, но с новыми правилами firestore.rules УСПЕШНА
      await updateDoc(doc(db, 'users', currentPartnerId), {
        partnerId: null,
        pairId: null
      });

      // 3. setPartnerInfo(null) не нужен,
      //    т.к. onSnapshot в AuthContext поймает изменение
      //    и useEffect [l: 99] сам вызовет setPartnerInfo(null).
      // await updateUserProfile(); // Также не нужно
      // setPartnerInfo(null);

    } catch (error) {
      console.error('Break pair error:', error);
      alert('Ошибка разрыва пары');
    }
  };

  const handleCreateLesson = async () => {
    console.log('🎯 ========== CREATE LESSON STARTED ==========');
    // ... (остальной код создания урока без изменений)
    if (!newLessonName.trim()) {
      setLessonNameError('Введите название урока');
      return;
    }
    if (!userProfile?.pairId || !currentUser) {
      console.error('❌ Missing pairId or currentUser');
      alert('Ошибка: отсутствуют данные пары');
      return;
    }
    const existingLesson = lessons.find(
      l => l.name.toLowerCase() === newLessonName.trim().toLowerCase()
    );
    if (existingLesson) {
      setLessonNameError('Урок с таким названием уже существует');
      return;
    }
    setCreatingLesson(true);
    try {
      console.log('📝 Creating lesson in Firestore...');
      const now = new Date();
      const lessonData = {
        pairId: userProfile.pairId,
        name: newLessonName.trim(),
        createdAt: now,
        updatedAt: now,
        createdBy: currentUser.uid,
        tasks: [],
        completedTasksCount: 0,
        totalTasksCount: 0
      };
      console.log('📦 Lesson data:', JSON.stringify(lessonData, null, 2));
      const docRef = await addDoc(collection(db, 'lessons'), lessonData);
      console.log('✅ Lesson created successfully with ID:', docRef.id);
      setShowNewLessonModal(false);
      setNewLessonName('');
      setLessonNameError('');
      alert('Урок успешно создан!');
      console.log('🎯 ========== CREATE LESSON COMPLETED ==========');
    } catch (error: any) {
      console.error('❌ ========== CREATE LESSON FAILED ==========');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      alert('Ошибка создания урока: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
      setCreatingLesson(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Если нет партнера - показываем форму поиска
  // ИСПРАВЛЕНИЕ: Мы должны проверять userProfile.partnerId, а не partnerInfo
  // т.к. partnerInfo - это асинхронное состояние, которое будет
  // загружено ПОСЛЕ того, как userProfile обновится.
  if (!userProfile?.partnerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <header className="bg-white dark:bg-gray-800 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Co-Study Hub
            </h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {userProfile?.nickname}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userProfile?.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all"
              >
                Выйти
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {incomingRequests.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 animate-pulse">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-3">
                📬 Входящие запросы ({incomingRequests.length})
              </h3>
              <div className="space-y-2">
                {incomingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                  >
                    <span className="text-gray-900 dark:text-white font-medium">
                      {request.fromNickname} хочет создать пару
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request)}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded text-sm"
                      >
                        Принять
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded text-sm"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🔍 Найти партнера
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchNickname}
                onChange={(e) => setSearchNickname(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Введите никнейм партнера"
                className="flex-grow bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold"
              >
                {loading ? 'Поиск...' : 'Найти'}
              </button>
            </div>

            {searchError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {searchError}
              </p>
            )}

            {searchResult && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {searchResult.nickname}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {searchResult.email}
                  </p>
                </div>
                <button
                  onClick={handleSendRequest}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                >
                  Отправить запрос
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🔗 Пригласить по ссылке
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Сгенерируйте уникальную ссылку и отправьте партнеру
            </p>

            {!inviteLink ? (
              <button
                onClick={generateInviteLink}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Сгенерировать ссылку
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-grow bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-4 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    Скопировать
                  </button>
                </div>
                <button
                  onClick={() => setInviteLink('')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Сгенерировать новую
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Главный экран с партнером
  // Показываем "Загрузка..." если partnerId есть, но partnerInfo еще не загрузилось
  if (!partnerInfo) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-700 dark:text-gray-300">
                    Загрузка данных партнера...
                </p>
            </div>
        </div>
    );
  }

  // Главный экран с партнером - продолжение...
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Шапка */}
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Co-Study Hub
            </h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {userProfile?.nickname}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userProfile?.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all text-sm"
              >
                Выйти
              </button>
            </div>
          </div>

          {/* Информация о паре */}
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Ваша пара
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Партнер: <span className="font-medium">{partnerInfo.nickname}</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleBreakPair}
              className="text-red-600 dark:text-red-400 hover:underline text-sm"
            >
              Разорвать пару
            </button>
          </div>
        </div>
      </header>

      {/* Навигация по разделам */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'lessons'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            📚 Уроки
          </button>
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'vocabulary'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            📖 Словарь ({vocabulary.length})
          </button>
          <button
            onClick={() => setActiveTab('textbooks')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'textbooks'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            📕 Учебники ({textbooks.length})
          </button>
        </nav>
      </div>

      {/* Контент */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {activeTab === 'lessons' && (
          <div className="space-y-6">
            {/* Кнопка создания нового урока */}
            <div className="flex justify-center py-8">
              <button
                onClick={() => setShowNewLessonModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 rounded-2xl font-bold text-xl shadow-2xl transition-all transform hover:scale-105 flex items-center gap-4"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Новый урок
              </button>
            </div>

            {/* Список уроков */}
            {lessons.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Нет уроков
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Создайте первый урок, чтобы начать обучение
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    onClick={() => onEnterWorkspace(lesson.id)}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer p-6 border-2 border-transparent hover:border-blue-500"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                        {lesson.name}
                      </h3>
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Заданий:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {lesson.totalTasksCount || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Выполнено:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {lesson.completedTasksCount || 0}
                        </span>
                      </div>
                    </div>

                    {lesson.totalTasksCount > 0 && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${(lesson.completedTasksCount / lesson.totalTasksCount) * 100}%`
                          }}
                        />
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Обновлен: {formatDate(lesson.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'vocabulary' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Общий словарь пары
            </h2>
            {vocabulary.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Словарь пуст. Слова будут добавляться во время уроков.
              </p>
            ) : (
              <div className="grid gap-3">
                {vocabulary.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {item.word}
                      </span>
                      <span className="text-base text-gray-700 dark:text-gray-300">
                        {item.translation}
                      </span>
                    </div>
                    {item.context && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-2 pl-1">
                        "{item.context}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'textbooks' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Загруженные учебники
            </h2>
            {textbooks.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Учебники не загружены. Добавьте учебники во время урока.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {textbooks.map((textbook, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-700 dark:to-gray-750 p-6 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-100 dark:bg-orange-900 rounded-lg p-3">
                        <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white line-clamp-2">
                          {textbook.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно создания урока */}
      {showNewLessonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Создать новый урок
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Урок будет доступен вам и вашему партнеру
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Название урока *
              </label>
              <input
                type="text"
                value={newLessonName}
                onChange={(e) => {
                  setNewLessonName(e.target.value);
                  setLessonNameError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateLesson();
                  }
                }}
                placeholder="Например: Урок 1 - Приветствия"
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                autoFocus
              />
              {lessonNameError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {lessonNameError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateLesson}
                disabled={creatingLesson}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
              >
                {creatingLesson ? 'Создание...' : 'Создать'}
              </button>
              <button
                onClick={() => {
                  setShowNewLessonModal(false);
                  setNewLessonName('');
                  setLessonNameError('');
                }}
                disabled={creatingLesson}
                className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainScreen;