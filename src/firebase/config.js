// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

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
// O script do reCAPTCHA pesa ~350 KB e custa ~3 s de CPU em celular lento, então não entra na primeira pintura.
const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
let appCheckStarted = false;
export const ensureAppCheck = () => {
  if (appCheckStarted || !recaptchaSiteKey || typeof window === 'undefined') return;
  appCheckStarted = true;
  if (process.env.NODE_ENV !== 'production') window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
};
if (recaptchaSiteKey && typeof window !== 'undefined') {
  // Telas públicas não fazem pedidos ao Firebase ao abrir: o reCAPTCHA entra depois do carregamento, ou antes,
  // se o usuário entrar/cadastrar (ensureAppCheck é chamado) ou já houver sessão (AuthContext).
  const lazy = ['/', '/termos', '/privacidade', '/login', '/register', '/forgot-password', '/auth/action'].includes(window.location.pathname);
  if (!lazy) ensureAppCheck();
  else {
    const later = () => setTimeout(ensureAppCheck, 1500);
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
  }
}
const db = getFirestore(app);
// Sem resolver de popup no início: o iframe de login do Firebase (~90 KB) só é carregado ao entrar com o Google.
const authService = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
// E-mails do Firebase (recuperar senha etc.) e a página de ação saem em português.
authService.languageCode = 'pt-BR';

export { app, db, authService };
export const auth = authService;