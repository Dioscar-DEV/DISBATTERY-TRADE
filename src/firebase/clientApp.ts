// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// MODIFICACIÓN: Se importa 'initializeFirestore' y las funciones de caché necesarias
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
  authDomain: "disbattery-trade.firebaseapp.com",
  projectId: "disbattery-trade",
  storageBucket: "disbattery-trade.firebasestorage.app",
  messagingSenderId: "614937382806",
  appId: "1:614937382806:web:5df489972e5eb4365117b7",
  measurementId: "G-ZJ2LRH0HDT" // Analytics measurement ID
};

// Initialize Firebase - Esta lógica se mantiene igual
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

// CAMBIO PRINCIPAL: Se inicializa Firestore con la persistencia offline y
// la gestión de múltiples pestañas activadas desde el principio.
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ELIMINACIÓN: El bloque 'enableIndexedDbPersistence' que tenías antes ya no es necesario.

// Initialize Analytics (only in browser environment) - Esta lógica se mantiene igual
let analytics: Analytics | null = null;

// Function to initialize analytics
export const initializeAnalytics = async () => {
  if (typeof window!== 'undefined' &&!analytics) {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
    }
  }
  return analytics;
};

export { app, auth, db, storage, analytics };