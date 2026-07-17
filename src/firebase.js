import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB17af1BuIHZVXI9Z7h3Y-55-MSHxvjXWg",
  authDomain: "entradas-3eb00.firebaseapp.com",
  projectId: "entradas-3eb00",
  storageBucket: "entradas-3eb00.firebasestorage.app",
  messagingSenderId: "425898159748",
  appId: "1:425898159748:web:1633d880310aad55a65cd1",
  measurementId: "G-G69VJTD0LX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
