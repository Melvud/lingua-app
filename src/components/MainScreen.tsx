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
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

interface MainScreenProps {
  onEnterWorkspace: () => void;
}

interface PairRequest {
  id: string;
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

const MainScreen: React.FC<MainScreenProps> = ({ onEnterWorkspace }) => {
  const { currentUser, userProfile, logout, updateUserProfile } = useAuth();
  const [searchNickname, setSearchNickname] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [incomingRequests, setIncomingRequests] = useState<PairRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Проверяем наличие партнера
  useEffect(() => {
    if (userProfile?.partnerId) {
      loadPartnerInfo();
    }
  }, [userProfile?.partnerId]);

  // Слушаем входящие запросы
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

  const loadPartnerInfo = async () => {
    if (!userProfile?.partnerId) return;

    const docRef = doc(db, 'users', userProfile.partnerId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      setPartnerInfo(docSnap.data());
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
      alert('Ошибка отправки запроса');
    }
  };

  const handleAcceptRequest = async (request: PairRequest) => {
    if (!currentUser) return;

    try {
      // Обновляем статус запроса
      await updateDoc(doc(db, 'pairRequests', request.id), {
        status: 'accepted'
      });

      // Связываем пользователей
      await updateDoc(doc(db, 'users', currentUser.uid), {
        partnerId: request.fromUserId
      });

      await updateDoc(doc(db, 'users', request.fromUserId), {
        partnerId: currentUser.uid
      });

      // Обновляем профиль
      await updateUserProfile();

      alert('Запрос принят! Теперь вы в паре!');
    } catch (error) {
      alert('Ошибка принятия запроса');
    }
  };

  const handleRejectRequest = async (request: PairRequest) => {
    try {
      await updateDoc(doc(db, 'pairRequests', request.id), {
        status: 'rejected'
      });
    } catch (error) {
      alert('Ошибка отклонения запроса');
    }
  };

  const generateInviteLink = () => {
    const code = Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/invite/${code}`;
    setInviteLink(link);

    // Сохраняем код приглашения в базе
    addDoc(collection(db, 'invites'), {
      code,
      userId: currentUser?.uid,
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

    try {
      // Убираем связь у обоих
      await updateDoc(doc(db, 'users', currentUser.uid), {
        partnerId: null
      });

      await updateDoc(doc(db, 'users', userProfile.partnerId), {
        partnerId: null
      });

      await updateUserProfile();
      setPartnerInfo(null);
    } catch (error) {
      alert('Ошибка разрыва пары');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Шапка */}
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
        {/* Входящие запросы */}
        {incomingRequests.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
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

        {/* Статус пары */}
        {partnerInfo ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🎯 Ваша пара
            </h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg text-gray-900 dark:text-white">
                  Партнер: <span className="font-semibold">{partnerInfo.nickname}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {partnerInfo.email}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onEnterWorkspace}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Перейти к обучению
                </button>
                <button
                  onClick={handleBreakPair}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg"
                >
                  Разорвать пару
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Поиск по никнейму */}
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

            {/* Ссылка-приглашение */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default MainScreen;