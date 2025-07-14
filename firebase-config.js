// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";

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
const analytics = getAnalytics(app);

export { app, firebaseConfig };
