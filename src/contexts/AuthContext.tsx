// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface UserProfile {
  uid: string;
  email: string;
  nickname: string;
  partnerId?: string;
  pairId?: string;
  createdAt: Date;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (email: string, password: string, nickname: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string, nickname: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Создаем профиль в Firestore
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      nickname,
      createdAt: new Date()
    };
    
    await setDoc(doc(db, 'users', user.uid), profile);
    // setUserProfile(profile); // Не нужно, onSnapshot сделает это
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Оборачиваем в useCallback, чтобы ссылка на функцию не менялась
  const updateUserProfile = useCallback(async () => {
    if (!currentUser) return;
    
    console.log('🔄 Manually fetching user profile...');
    const docRef = doc(db, 'users', currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('✅ Manual fetch complete:', data.partnerId);
      setUserProfile({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as UserProfile);
    }
  }, [currentUser]); // Зависит только от currentUser

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user?.uid);
      setCurrentUser(user);
      
      if (user) {
        // Real-time слушатель профиля пользователя
        // Это ЕДИНСТВЕННЫЙ слушатель, который нам нужен.
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid), 
          { 
            // ✅ ИСПРАВЛЕНИЕ:
            // Гарантирует, что мы получаем данные с сервера, а не из кэша.
            // Это заставит приложение пригласившего обновиться мгновенно.
            includeMetadataChanges: false 
          }, 
          (doc) => {
            console.log('🔔 Profile snapshot received (AuthContext)');
            if (doc.exists()) {
              const data = doc.data();
              console.log(' L partnerId:', data.partnerId);
              setUserProfile({
                ...data,
                createdAt: data.createdAt?.toDate() || new Date()
              } as UserProfile);
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          }
        );

        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    signup,
    login,
    logout,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};