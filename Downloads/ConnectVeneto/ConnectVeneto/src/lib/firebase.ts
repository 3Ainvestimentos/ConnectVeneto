
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton pattern to get the initialized Firebase app
function getFirebaseApp(): FirebaseApp {
    if (getApps().length === 0) {
        return initializeApp(firebaseConfig);
    } else {
        return getApp();
    }
}

const app = getFirebaseApp();
const googleProvider = new GoogleAuthProvider();

let firestoreInstance: Firestore | null = null;

/**
 * Single Firestore instance with safer transport defaults for local/dev stability.
 * Falls back to getFirestore when already initialized by another module.
 */
function getClientFirestore(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  const firebaseApp = getFirebaseApp();
  try {
    firestoreInstance = initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true,
    });
  } catch {
    firestoreInstance = getFirestore(firebaseApp);
  }

  return firestoreInstance;
}

export { app, getFirebaseApp, getClientFirestore, googleProvider };
