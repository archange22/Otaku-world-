import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNxE8ucIaSavCgP8IZgdmNGFn8mQQit-c",
  authDomain: "site-otaku-f9a94.firebaseapp.com",
  databaseURL: "https://site-otaku-f9a94-default-rtdb.firebaseio.com",
  projectId: "site-otaku-f9a94",
  storageBucket: "site-otaku-f9a94.firebasestorage.app",
  messagingSenderId: "441349263421",
  appId: "1:441349263421:web:58a60671644939807c9a54",
  measurementId: "G-8MQ1XL0LHP"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
