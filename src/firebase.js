// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBZb2u2wYqS2furdpLGAIH48kxFCLn_0Eg",
  authDomain: "score-manager-495ba.firebaseapp.com",
  projectId: "score-manager-495ba",
  storageBucket: "score-manager-495ba.appspot.com",
  messagingSenderId: "180357979710",
  appId: "1:180357979710:web:f24b0ce6e64602e213bb6f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export { db };
