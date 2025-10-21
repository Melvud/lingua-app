// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAY1GQHWlmitXVaph0AHxpJDNU-9AMmUnk",
  authDomain: "lingua-website.firebaseapp.com",
  projectId: "lingua-website",
  storageBucket: "lingua-website.firebasestorage.app",
  messagingSenderId: "594125774691",
  appId: "1:594125774691:web:cca559d4edc3d03e257d56",
  measurementId: "G-3NCSRRZMSE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);