// Conta e segurança no Perfil: trocar ou criar senha, conectar e desconectar o Google, link de redefinição por e-mail.
// No app Android o Google vem da conta do celular (o popup é bloqueado dentro do app), como no login.
import {
  EmailAuthProvider, GoogleAuthProvider, browserPopupRedirectResolver, linkWithCredential, linkWithPopup,
  reauthenticateWithCredential, reauthenticateWithPopup, sendPasswordResetEmail, unlink, updatePassword, verifyBeforeUpdateEmail
} from 'firebase/auth';
import { isNativeApp, nativeGoogleCredential } from './nativeApp';

export const MIN_PASSWORD = 8;

export const loginMethods = (user) => {
  const ids = (user?.providerData || []).map((p) => p.providerId);
  return { password: ids.includes('password'), google: ids.includes('google.com') };
};

const fail = (code, message) => Object.assign(new Error(message), { code });

/** Senha nova: pelo menos 8 caracteres, com letra e número. Devolve a mensagem de erro ou ''. */
export function passwordProblem(next, confirmation) {
  if (String(next || '').length < MIN_PASSWORD) return `Use pelo menos ${MIN_PASSWORD} caracteres.`;
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return 'Misture letras e números.';
  if (confirmation !== undefined && next !== confirmation) return 'As senhas não conferem.';
  return '';
}

const googleCredentialOrPopup = (user) => (isNativeApp()
  ? nativeGoogleCredential().then((cred) => reauthenticateWithCredential(user, cred))
  : reauthenticateWithPopup(user, new GoogleAuthProvider(), browserPopupRedirectResolver));

/** Quem entra com senha: confirma a senha atual e troca. */
export async function changePassword(user, current, next) {
  const problem = passwordProblem(next);
  if (problem) throw fail('app/weak-password', problem);
  if (!current) throw fail('app/missing-password', 'Informe a senha atual.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  await updatePassword(user, next);
}

/** Quem só entra com Google: confirma com o Google e cria uma senha para entrar também por e-mail. */
export async function createPassword(user, next) {
  const problem = passwordProblem(next);
  if (problem) throw fail('app/weak-password', problem);
  if (!user?.email) throw fail('app/no-email', 'Sua conta não tem e-mail para usar com senha.');
  await googleCredentialOrPopup(user);
  await linkWithCredential(user, EmailAuthProvider.credential(user.email, next));
}

/** Conecta uma conta Google ao login atual. */
export async function connectGoogle(user) {
  if (isNativeApp()) return linkWithCredential(user, await nativeGoogleCredential());
  return linkWithPopup(user, new GoogleAuthProvider(), browserPopupRedirectResolver);
}

/** Desconecta o Google; só com senha criada (senão a pessoa ficaria sem como entrar). */
export async function disconnectGoogle(user) {
  if (!loginMethods(user).password) throw fail('app/last-method', 'Crie uma senha antes de desconectar o Google.');
  return unlink(user, 'google.com');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Troca de e-mail: confirma quem é (senha atual ou Google) e manda um link ao NOVO e-mail. A troca só acontece quando a pessoa
 * abre o link (página /auth/action); até lá continua entrando com o e-mail atual. Depois, o perfil copia o novo no próximo login.
 */
export async function changeEmail(user, newEmail, { password } = {}) {
  const next = String(newEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(next)) throw fail('app/invalid-email', 'Digite um e-mail válido.');
  if (next === String(user?.email || '').toLowerCase()) throw fail('app/same-email', 'Esse já é o seu e-mail.');
  if (loginMethods(user).password) {
    if (!password) throw fail('app/missing-password', 'Informe a senha atual.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await googleCredentialOrPopup(user);
  }
  await verifyBeforeUpdateEmail(user, next, { url: `${window.location.origin}/login` });
  return next;
}

export const sendResetLink = (auth, email) => sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/login` });

export function friendlySecurityError(error) {
  const code = error?.code || '';
  if (code.startsWith('app/')) return error.message;
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Senha atual incorreta.';
  if (code === 'auth/weak-password') return 'Senha fraca: use pelo menos 8 caracteres com letras e números.';
  if (code === 'auth/email-already-in-use') return 'Esse e-mail já é usado por outra conta.';
  if (code === 'auth/invalid-email' || code === 'auth/invalid-new-email') return 'Digite um e-mail válido.';
  if (code === 'auth/credential-already-in-use') return 'Essa conta Google já está ligada a outro usuário do BohTreinar.';
  if (code === 'auth/provider-already-linked') return 'O Google já está conectado.';
  if (code === 'auth/user-mismatch') return 'Escolha a mesma conta Google que você usa para entrar.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Operação cancelada.';
  if (code === 'auth/popup-blocked') return 'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code === 'auth/requires-recent-login') return 'Por segurança, saia, entre de novo e repita.';
  if (code === 'auth/network-request-failed') return 'Sem conexão. Tente de novo.';
  return 'Não foi possível concluir. Tente de novo.';
}
