// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDBRt3wTLTTYCdci5YSssWfX7EfwsDT67g",
  authDomain: "dacroq-69002.firebaseapp.com",
  projectId: "dacroq-69002",
  storageBucket: "dacroq-69002.firebasestorage.app",
  messagingSenderId: "593421475385",
  appId: "1:593421475385:web:c1c4fc9c0fbe9e5a98b7e8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const signInWithGoogle = () => {
  // Use popup instead of redirect to avoid needing a redirect handler
  return signInWithPopup(auth, provider);
};

export default app;