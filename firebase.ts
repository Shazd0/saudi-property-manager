import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs",
  authDomain: "saudi-property-manager.firebaseapp.com",
  projectId: "saudi-property-manager",
  storageBucket: "saudi-property-manager.firebasestorage.app",
  messagingSenderId: "854165833434",
  appId: "1:854165833434:web:bc550b5c79266bd1fb07e3"
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
