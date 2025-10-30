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
    console.log('📝 ========== SIGNUP STARTED ==========');
    console.log('📧 Email:', email);
    console.log('👤 Nickname:', nickname);
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Firebase Auth user created:', user.uid);
    
    // Создаем профиль в Firestore
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      nickname,
      createdAt: new Date()
    };
    
    await setDoc(doc(db, 'users', user.uid), profile);
    console.log('✅ Firestore profile created');
    console.log('🎉 ========== SIGNUP COMPLETED ==========');
  };

  const login = async (email: string, password: string) => {
    console.log('🔐 ========== LOGIN STARTED ==========');
    console.log('📧 Email:', email);
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ ========== LOGIN COMPLETED ==========');
  };

  const logout = async () => {
    console.log('👋 ========== LOGOUT STARTED ==========');
    await signOut(auth);
    console.log('✅ ========== LOGOUT COMPLETED ==========');
  };

  // ✅ Оборачиваем в useCallback для стабильной ссылки
  const updateUserProfile = useCallback(async () => {
    if (!currentUser) {
      console.warn('⚠️ Cannot update profile: no current user');
      return;
    }
    
    console.log('🔄 ========== MANUAL PROFILE REFRESH ==========');
    console.log('👤 User ID:', currentUser.uid);
    
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('✅ Profile data fetched:');
        console.log('  - partnerId:', data.partnerId || 'none');
        console.log('  - pairId:', data.pairId || 'none');
        
        setUserProfile({
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as UserProfile);
        
        console.log('✅ ========== PROFILE REFRESH COMPLETED ==========');
      } else {
        console.warn('⚠️ Profile document not found');
      }
    } catch (error: any) {
      console.error('❌ ========== PROFILE REFRESH FAILED ==========');
      console.error('Error:', error);
      console.error('Code:', error?.code);
      console.error('Message:', error?.message);
    }
  }, [currentUser]);

  useEffect(() => {
    console.log('🔐 ========== AUTH CONTEXT INITIALIZING ==========');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? `User ${user.uid}` : 'No user');
      setCurrentUser(user);
      
      if (user) {
        console.log('📡 Setting up real-time profile listener for:', user.uid);
        
        // ✅ Real-time слушатель профиля с error handler
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid),
          {
            // ✅ Всегда получаем свежие данные с сервера
            includeMetadataChanges: false
          },
          (doc) => {
            const source = doc.metadata.fromCache ? '📦 CACHE' : '🌐 SERVER';
            const hasPendingWrites = doc.metadata.hasPendingWrites ? '✏️ PENDING' : '✅ SYNCED';
            
            console.log('🔔 ========== PROFILE SNAPSHOT RECEIVED ==========');
            console.log(`📍 Source: ${source} | Status: ${hasPendingWrites}`);
            
            if (doc.exists()) {
              const data = doc.data();
              console.log('📊 Profile data:');
              console.log('  - uid:', data.uid);
              console.log('  - nickname:', data.nickname);
              console.log('  - partnerId:', data.partnerId || 'none');
              console.log('  - pairId:', data.pairId || 'none');
              
              setUserProfile({
                ...data,
                createdAt: data.createdAt?.toDate() || new Date()
              } as UserProfile);
              
              console.log('✅ Profile state updated');
            } else {
              console.warn('⚠️ Profile document does not exist');
              setUserProfile(null);
            }
            
            setLoading(false);
            console.log('✅ ========== SNAPSHOT PROCESSING COMPLETED ==========');
          },
          (error) => {
            // ✅ Error handler для onSnapshot
            console.error('❌ ========== PROFILE SNAPSHOT ERROR ==========');
            console.error('Error:', error);
            console.error('Code:', error.code);
            console.error('Message:', error.message);
            
            // Показываем пользователю понятную ошибку
            if (error.code === 'permission-denied') {
              console.error('🚫 Permission denied! Check Firestore rules.');
            } else if (error.code === 'unavailable') {
              console.error('📡 Network unavailable. Check internet connection.');
            }
            
            setLoading(false);
          }
        );

        return () => {
          console.log('🔌 Unsubscribing from profile listener');
          unsubscribeProfile();
        };
      } else {
        console.log('👤 No user, clearing profile');
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('🔌 Unsubscribing from auth listener');
      unsubscribe();
    };
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

  console.log('🎨 Rendering AuthProvider. Loading:', loading);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};