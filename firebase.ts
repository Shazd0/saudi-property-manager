import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs",
  authDomain: "saudi-property-manager.firebaseapp.com",
  projectId: "saudi-property-manager",
  storageBucket: "saudi-property-manager.firebasestorage.app",
  messagingSenderId: "854165833434",
  appId: "1:854165833434:web:bc550b5c79266bd1fb07e3",
};

/** Reuse existing app on Vite HMR / duplicate imports — avoid "app already exists". */
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch {
    // Firestore already initialized (HMR or second import) — return existing instance.
    return getFirestore(app);
  }
}

// Explicit IndexedDB cache + ignoreUndefinedProperties (recommended modular setup).
export const db = initFirestore();

/** Always use this after HMR — avoids stale `db` breaking collection(). */
export function getDb() {
  return getFirestore(app);
}

export const auth = getAuth(app);
export const storage = getStorage(app);
