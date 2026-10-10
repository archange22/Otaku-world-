import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase web config is public by design (security comes from Firebase rules / authorized domains).
const firebaseConfig = {
  apiKey: "AIzaSyCNxE8ucIaSavCgP8IZgdmNGFn8mQQit-c",
  authDomain: "site-otaku-f9a94.firebaseapp.com",
  databaseURL: "https://site-otaku-f9a94-default-rtdb.firebaseio.com",
  projectId: "site-otaku-f9a94",
  storageBucket: "site-otaku-f9a94.firebasestorage.app",
  messagingSenderId: "441349263421",
  appId: "1:441349263421:web:58a60671644939807c9a54",
  measurementId: "G-8MQ1XL0LHP",
};

function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let _auth: Auth | null = null;
let _db: Firestore | null = null;

/** Browser-only: call from effects / event handlers, never during SSR. */
export function firebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp());
  return _auth;
}

/** Firestore database for user profiles and app data. */
export function firebaseDb(): Firestore {
  if (!_db) _db = getFirestore(firebaseApp());
  return _db;
}
