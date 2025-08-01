// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSrqPhvb7bY1Po4rmiBW7_wXokC-VKXgA",
  authDomain: "zairap.netlify.app",
  databaseURL: "https://ai-dazz-default-rtdb.firebaseio.com",
  projectId: "ai-dazz",
  storageBucket: "ai-dazz.firebasestorage.app",
  messagingSenderId: "976260640131",
  appId: "1:976260640131:web:ce5c5e113656a0a2f59ab6",
  measurementId: "G-T45W4BJ4Z0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { 
  db, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push,
  auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, 
  googleProvider, onAuthStateChanged, signOut 
}; 