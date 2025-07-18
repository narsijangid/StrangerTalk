// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBcjUtfNxD4fHv6uiHXAEkN8wXtQBkVbCA",
  authDomain: "dazzlone.firebaseapp.com",
  databaseURL: "https://dazzlone-default-rtdb.firebaseio.com",
  projectId: "dazzlone",
  storageBucket: "dazzlone.appspot.com",
  messagingSenderId: "382204259427",
  appId: "1:382204259427:web:082bded8ccdd8f03329c56",
  measurementId: "G-CMCHP4WLH8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue, remove, update, get, child, query, orderByChild, equalTo, push }; 