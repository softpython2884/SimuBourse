import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsl_3iwowf_cZKoRm6SNXXk3Kn7-aAzCM",
  authDomain: "simubourse.firebaseapp.com",
  projectId: "simubourse",
  storageBucket: "simubourse.firebasestorage.app",
  messagingSenderId: "943658338198",
  appId: "1:943658338198:web:8d7b126e4ddec0e1557fb7"
};

let app;
let auth;
let db;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("L'initialisation de Firebase a échoué :", error);
  throw error;
}


export { app, auth, db };
