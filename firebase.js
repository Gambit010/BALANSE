import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';


const firebaseConfig = {
  apiKey: "AIzaSyABwO9ihBBavWp5syuSyN5dUW5H4cDLtSs",
  authDomain: "balanseapp-b9103.firebaseapp.com",
  projectId: "balanseapp-b9103",
  storageBucket: "balanseapp-b9103.firebasestorage.app",
  messagingSenderId: "434339829705",
  appId: "1:434339829705:web:2012a7c39a6475cd433a18",
  measurementId: "G-58SJF17H8V"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);