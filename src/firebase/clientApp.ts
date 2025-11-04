// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// MODIFICACIÓN: Se importa 'initializeFirestore' y las funciones de caché necesarias
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getMessaging, type Messaging } from "firebase/messaging";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration (prefer environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCs73uDqTGuoy2u0fnZgngTqRWhuyIU5l8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "disbattery-trade.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "disbattery-trade",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "disbattery-trade.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "614937382806",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:614937382806:web:5df489972e5eb4365117b7",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-ZJ2LRH0HDT",
};

// Initialize Firebase app instance (safe for SSR)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Auth, Storage and Messaging are browser-only; initialize lazily to avoid SSR errors
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;
if (typeof window !== "undefined") {
  auth = getAuth(app);
  storage = getStorage(app);
  // Initialize messaging with VAPID key from environment
  if (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BDCJ8sVw_IJmvCoEFGup7PHFvQKH3i8qzCsepnHWRguS-Wpb9ZsdOx9xCFSyjLM5tXv5YS1YVwB5sac1QAKRUeQ") {
    messaging = getMessaging(app);
  }
}

// Firestore: only enable persistent local cache in the browser environment.
// On the server we export `null` for db to avoid using browser-only APIs.
let db: Firestore | null = null;
if (typeof window !== "undefined") {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
}

// Analytics (client-only)
let analytics: Analytics | null = null;
export const initializeAnalytics = async () => {
  if (typeof window === "undefined") return null;
  if (!analytics) {
    const supported = await isSupported();
    if (supported) analytics = getAnalytics(app);
  }
  return analytics;
};

// Getter helpers (preferred) to avoid accidental use on server-side and to
// centralize initialization logic. Existing named exports remain for
// backward compatibility but may be null on the server.
export function getAuthClient(): Auth {
  if (!auth) {
    if (typeof window === "undefined") {
      throw new Error("Firebase Auth is only available in the browser.");
    }
    auth = getAuth(app);
  }
  return auth;
}

export function getStorageClient(): FirebaseStorage {
  if (!storage) {
    if (typeof window === "undefined") {
      throw new Error("Firebase Storage is only available in the browser.");
    }
    storage = getStorage(app);
  }
  return storage;
}

export function getFirestoreClient(): Firestore {
  if (!db) {
    if (typeof window === "undefined") {
      throw new Error("Firestore client is only available in the browser.");
    }
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  }
  return db;
}

export function getAnalyticsClient() {
  return analytics;
}

export function getMessagingClient(): Messaging {
  if (!messaging) {
    if (typeof window === "undefined") {
      throw new Error("Firebase Messaging is only available in the browser.");
    }
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BDCJ8sVw_IJmvCoEFGup7PHFvQKH3i8qzCsepnHWRguS-Wpb9ZsdOx9xCFSyjLM5tXv5YS1YVwB5sac1QAKRUeQ") {
      throw new Error("VAPID key is required for Firebase Messaging. Set NEXT_PUBLIC_FIREBASE_VAPID_KEY in your environment.");
    }
    messaging = getMessaging(app);
  }
  return messaging;
}

// Export VAPID key for use in messaging setup
export const getVapidKey = () => process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BDCJ8sVw_IJmvCoEFGup7PHFvQKH3i8qzCsepnHWRguS-Wpb9ZsdOx9xCFSyjLM5tXv5YS1YVwB5sac1QAKRUeQ";
