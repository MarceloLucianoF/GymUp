// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyCb6DbkDHLrvMnyYFaNEKU8VsXrG3A7c80",
  authDomain: "workout-tracker-app-20e43.firebaseapp.com",
  projectId: "workout-tracker-app-20e43",
  storageBucket: "workout-tracker-app-20e43.firebasestorage.app",
  messagingSenderId: "701946803421",
  appId: "1:701946803421:web:faca2d5f6bcee4535f1734",
  measurementId: "G-FJX5V1ZML9"
};

const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3): só ativa quando a chave PÚBLICA do site está definida no build.
// Em desenvolvimento, use o token de debug (console do Firebase > App Check > Gerenciar tokens de debug).
const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey && typeof window !== 'undefined') {
  if (process.env.NODE_ENV !== 'production') window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}
const db = getFirestore(app);
const authService = getAuth(app);

export { app, db, authService };
export const auth = getAuth(app);