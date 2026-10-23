// Ponte com o app Android (Capacitor). No site, tudo aqui devolve "não é app" e nada nativo é carregado.
import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, browserPopupRedirectResolver, signInWithCredential, signInWithPopup } from 'firebase/auth';

export const isNativeApp = () => { try { return Capacitor.isNativePlatform(); } catch (_) { return false; } };

/**
 * Login com Google. No site usa o popup; no app usa a conta Google do celular (o Google bloqueia o popup dentro do app)
 * e entrega a credencial ao Firebase da web, para o resto do app continuar igual.
 */
export async function signInWithGoogle(auth) {
  if (!isNativeApp()) return signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver);
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result?.credential?.idToken;
  if (!idToken) throw Object.assign(new Error('Login cancelado.'), { code: 'auth/popup-closed-by-user' });
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

/** Credencial Google pela conta do celular (app), para confirmar a identidade antes de ações sensíveis. */
export async function nativeGoogleCredential() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result?.credential?.idToken;
  if (!idToken) throw Object.assign(new Error('Confirmação cancelada.'), { code: 'auth/popup-closed-by-user' });
  return GoogleAuthProvider.credential(idToken);
}

/** Sai também da conta Google do app (senão o próximo login entra direto na mesma conta). */
export async function nativeSignOut() {
  if (!isNativeApp()) return;
  try { const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication'); await FirebaseAuthentication.signOut(); } catch (_) { /* sem sessão nativa */ }
}
