import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsl_3iwowf_cZKoRm6SNXXk3Kn7-aAzCM",
  authDomain: "simubourse.firebaseapp.com",
  projectId: "simubourse",
  storageBucket: "simubourse.appspot.com",
  messagingSenderId: "943658338198",
  appId: "1:943658338198:web:8d7b126e4ddec0e1557fb7"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
