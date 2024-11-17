// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration (replace the placeholder values with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyDkt6vNdTE0cfAM33IhsXikdAM7wZYS914",
  authDomain: 'map-matching-app.firebaseapp.com',
  projectId: 'map-matching-app',
  storageBucket: 'map-matching-app.firebasestorage.app',
  messagingSenderId: '848793200780',
  appId: '1:848793200780:web:2a744c2b05addbe49db3a9',
  measurementId: 'G-52J80JPCRY',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db };
