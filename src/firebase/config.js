// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { withTokenTimeout } from './appCheckProvider';

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

// App Check (reCAPTCHA Enterprise, hoje "Fraud Defense"): só ativa quando a chave PÚBLICA do site está definida no build.
// Em desenvolvimento, use o token de debug (console do Firebase > App Check > Gerenciar tokens de debug).
// O script do reCAPTCHA pesa ~350 KB e custa ~2 s de CPU em celular lento. Ele NÃO é iniciado no carregamento: o Auth
// confere a sessão logo ao abrir e, se o App Check já estivesse de pé, esse pedido esperaria o token (~2 s) e o app inteiro
// ficaria em branco. Quem inicia o App Check é o AuthContext, assim que a sessão é conhecida e antes de qualquer leitura do
// Firestore (que sempre espera o token), além de entrar/cadastrar e das telas públicas (1,5 s depois do carregamento).
// Consequência aceita: a conferência de sessão do Auth (um pedido por abertura) sai sem token; o enforce não deve cobrir o Auth.
const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
let appCheckStarted = false;
export const ensureAppCheck = () => {
  if (appCheckStarted || !recaptchaSiteKey || typeof window === 'undefined') return;
  appCheckStarted = true;
  if (process.env.NODE_ENV !== 'production') window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, {
    provider: withTokenTimeout(new ReCaptchaEnterpriseProvider(recaptchaSiteKey)),
    isTokenAutoRefreshEnabled: true
  });
};
// Em telas privadas o script do reCAPTCHA começa a baixar já, em paralelo (a corrente de pedidos até o token leva ~2 s e o
// Firestore espera por ela), mas o App Check só é iniciado depois da sessão: o Auth não espera por ele.
if (recaptchaSiteKey && typeof window !== 'undefined') {
  const publicPage = ['/', '/termos', '/privacidade', '/login', '/register', '/forgot-password', '/auth/action'].includes(window.location.pathname);
  if (publicPage) {
    const later = () => setTimeout(ensureAppCheck, 1500);
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
  } else {
    const warm = document.createElement('script');
    warm.async = true;
    warm.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(recaptchaSiteKey)}`;
    document.head.appendChild(warm);
  }
}
const db = getFirestore(app);
// Sem resolver de popup no início: o iframe de login do Firebase (~90 KB) só é carregado ao entrar com o Google.
const authService = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
// E-mails do Firebase (recuperar senha etc.) e a página de ação saem em português.
authService.languageCode = 'pt-BR';

export { app, db, authService };
export const auth = authService;