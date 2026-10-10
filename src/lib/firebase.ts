import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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

let _auth: Auth | null = null;

/** Browser-only: call from effects / event handlers, never during SSR. */
export function firebaseAuth(): Auth {
  if (!_auth) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    _auth = getAuth(app);
    void setPersistence(_auth, browserLocalPersistence).catch(() => {
      // Some privacy-focused browsers block persistent storage. Firebase can still use its in-memory session.
    });
  }
  return _auth;
}

let _db: import("firebase/firestore").Firestore | null = null;
let _storage: FirebaseStorage | null = null;

/** Browser-only Firestore instance. */
export function firebaseDb(): import("firebase/firestore").Firestore {
  if (!_db) {
    firebaseAuth();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _db = getFirestore(getApp());
  }
  return _db;
}


/** Browser-only Firebase Storage instance. */
export function firebaseStorage(): FirebaseStorage {
  if (!_storage) {
    firebaseAuth();
    _storage = getStorage(getApp());
  }
  return _storage;
}
