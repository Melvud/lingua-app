// src/components/InviteHandler.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';

interface InviteHandlerProps {
  inviteCode: string;
}

const InviteHandler: React.FC<InviteHandlerProps> = ({ inviteCode }) => {
  const { currentUser, userProfile, updateUserProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Ждем пока загрузится авторизация
    if (authLoading) {
      return;
    }

    // Если не авторизован - сохраняем код и редиректим на логин
    if (!currentUser) {
      console.log('User not logged in, saving invite code and redirecting to login');
      localStorage.setItem('pendingInviteCode', inviteCode);
      navigate('/');
      return;
    }

    // Если есть сохраненный код или текущий код
    const codeToProcess = inviteCode || localStorage.getItem('pendingInviteCode');
    
    if (codeToProcess && userProfile) {
      handleInvite(codeToProcess);
    }
  }, [inviteCode, currentUser, userProfile, authLoading]);

  const handleInvite = async (code: string) => {
    if (!currentUser || !userProfile) {
      setError('Войдите в аккаунт для принятия приглашения');
      setLoading(false);
      return;
    }

    if (userProfile.partnerId) {
      setError('У вас уже есть партнер');
      setLoading(false);
      setTimeout(() => navigate('/'), 2000);
      return;
    }

    try {
      console.log('🔍 Looking for invite with code:', code);
      
      // Ищем приглашение
      const q = query(
        collection(db, 'invites'),
        where('code', '==', code),
        where('used', '==', false)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('❌ Invite not found or already used');
        setError('Приглашение недействительно или уже использовано');
        setLoading(false);
        return;
      }

      const inviteDoc = querySnapshot.docs[0];
      const inviteData = inviteDoc.data();
      const inviterId = inviteData.userId;

      console.log('✅ Invite found, inviter:', inviterId);

      if (inviterId === currentUser.uid) {
        setError('Вы не можете принять свое собственное приглашение');
        setLoading(false);
        return;
      }

      console.log('📝 Creating pair...');

      // Создаем пару
      const pairId = `pair_${currentUser.uid}_${inviterId}`;
      await addDoc(collection(db, 'pairs'), {
        pairId,
        user1Id: currentUser.uid,
        user2Id: inviterId,
        createdAt: new Date(),
        sharedData: {
          textbooks: [],
          vocabulary: [],
          currentPage: 1,
          files: [],
          instruction: ''
        }
      });

      console.log('🔗 Linking users...');

      // Связываем пользователей
      await updateDoc(doc(db, 'users', currentUser.uid), {
        partnerId: inviterId,
        pairId
      });

      await updateDoc(doc(db, 'users', inviterId), {
        partnerId: currentUser.uid,
        pairId
      });

      // Помечаем приглашение как использованное
      await updateDoc(doc(db, 'invites', inviteDoc.id), {
        used: true,
        usedBy: currentUser.uid,
        usedAt: new Date()
      });

      console.log('✅ Pair created successfully');

      // Очищаем сохраненный код
      localStorage.removeItem('pendingInviteCode');

      // Обновляем профиль
      await updateUserProfile();

      // Показываем успех
      setError('');
      setLoading(false);

      // Перенаправляем на главную через 1 секунду
      setTimeout(() => {
        navigate('/');
      }, 1000);

    } catch (err) {
      console.error('❌ Error handling invite:', err);
      setError('Ошибка обработки приглашения');
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">
            {authLoading ? 'Проверка авторизации...' : 'Обработка приглашения...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ошибка</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  // Успех
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Готово!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Пара успешно создана. Перенаправление...
        </p>
      </div>
    </div>
  );
};

export default InviteHandler;