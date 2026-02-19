import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

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