// Avisos com o app fechado (Web Push pelo Worker do app). Opcional: só funciona no app publicado (mesmo Worker do proxy de IA),
// com permissão de notificação e service worker. Nada aqui atrapalha o app se falhar: cada chamada devolve false/null.
import { auth } from '../firebase/config';
import { isNativeApp } from './nativeApp';

const ENABLED = process.env.REACT_APP_NVIDIA_PROXY === 'true';
const KEY = 'bt_push_on';

export const pushSupported = () => isNativeApp() || (ENABLED && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
export const pushEnabled = () => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
const setFlag = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* sem storage */ } };

const toKey = (b64) => {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function api(path, method, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('sem sessão');
  const res = await fetch(`/api/push/${path}`, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`push ${res.status}`);
  return res.json();
}

// ---- app Android: avisos pelo FCM (o app não tem Web Push) ----
const TOKEN_KEY = 'bt_push_fcm';
let nativeToken = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; } })();   // sobrevive a reiniciar o app (logout)
let tapListener = null;
const safePath = (url) => (typeof url === 'string' && /^\/(?![/\\])/.test(url) ? url : null);   // só caminhos do próprio app
const ERR_KEY = 'bt_push_err';
const saveErr = (msg) => { try { if (msg) localStorage.setItem(ERR_KEY, `${new Date().toLocaleString('pt-BR')} · ${msg}`.slice(0, 300)); else localStorage.removeItem(ERR_KEY); } catch (_) { /* sem storage */ } };
export const lastPushError = () => { try { return localStorage.getItem(ERR_KEY) || ''; } catch (_) { return ''; } };
export const nativeFcmToken = () => nativeToken;

/** Pede a permissão de notificação do Android (13+). Devolve 'granted', 'denied' ou 'prompt'. */
export async function nativeNotificationPermission({ ask = true } = {}) {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let perm = await PushNotifications.checkPermissions();
  if (ask && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) perm = await PushNotifications.requestPermissions();
  return perm.receive;
}

/** Cadastra o aparelho no FCM e no Worker (curtidas, comentários). Guarda o motivo se falhar, para o diagnóstico. */
async function registerFcm() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.createChannel({ id: 'bohtreinar', name: 'Treino e amigos', description: 'Curtidas e comentários', importance: 4, vibration: true, visibility: 1 }).catch(() => {});
  const handles = [];
  let timer;
  const token = await new Promise((resolve, reject) => {
    Promise.all([
      PushNotifications.addListener('registration', (t) => resolve(t.value)),
      PushNotifications.addListener('registrationError', (e) => reject(new Error(`FCM: ${e?.error || 'erro no registro'}`)))
    ]).then((h) => { handles.push(...h); PushNotifications.register(); });
    timer = setTimeout(() => reject(new Error('FCM: sem resposta em 20 s')), 20000);
  }).finally(() => { clearTimeout(timer); handles.forEach((h) => h.remove()); });
  // Tocar no aviso abre a tela certa do app (um ouvinte só, mesmo ligando várias vezes).
  if (!tapListener) {
    tapListener = await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const url = safePath(a?.notification?.data?.url);
      if (url) window.location.assign(url);
    });
  }
  nativeToken = token;
  try { localStorage.setItem(TOKEN_KEY, token); } catch (_) { /* sem storage */ }
  try { await api('subscribe', 'POST', { fcm: token }); } catch (e) { throw new Error(`servidor: ${e.message}`); }
}

/** App: liga com a permissão; o cadastro no FCM roda em seguida e não segura a notificação do treino. */
async function enableNativePush() {
  const perm = await nativeNotificationPermission();
  if (perm !== 'granted') { saveErr(`permissão de notificação: ${perm}`); return false; }
  setFlag(true);
  registerFcm().then(() => saveErr('')).catch((e) => saveErr(e?.message || String(e)));
  return true;
}

/** Diagnóstico: refaz o cadastro no FCM e devolve o erro (ou ''). */
export async function retryNativeFcm() {
  try { await registerFcm(); saveErr(''); return ''; } catch (e) { const m = e?.message || String(e); saveErr(m); return m; }
}

/** Diagnóstico: pede ao servidor um aviso de teste para os aparelhos desta conta. */
export const sendTestPush = () => api('test', 'POST', {});

/** Liga os avisos neste aparelho: pede permissão (se precisar), inscreve no serviço de push e registra no Worker. */
export async function enablePush() {
  if (isNativeApp()) return enableNativePush();
  if (!pushSupported()) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch('/api/push/key')).json();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
  await api('subscribe', 'POST', { subscription: sub.toJSON() });
  setFlag(true);
  return true;
}

const withTimeout = (promise, ms = 4000) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

/** Desliga neste aparelho; com all=true (excluir conta) apaga as inscrições de todos os aparelhos no servidor. Nunca trava. */
export async function disablePush({ all = false } = {}) {
  setFlag(false);
  if (isNativeApp()) {
    try {
      if (all) await withTimeout(api('subscribe', 'DELETE', { all: true }));
      else if (nativeToken) await withTimeout(api('subscribe', 'DELETE', { endpoint: `fcm:${nativeToken}` }));
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await withTimeout(PushNotifications.unregister());
      nativeToken = null;
      try { localStorage.removeItem(TOKEN_KEY); } catch (_) { /* sem storage */ }
      return true;
    } catch (_) { return false; }
  }
  if (!ENABLED || typeof navigator === 'undefined') return true;
  try {
    if (all) await withTimeout(api('subscribe', 'DELETE', { all: true }));
    const reg = 'serviceWorker' in navigator ? await withTimeout(navigator.serviceWorker.getRegistration()) : null;
    const sub = reg?.pushManager ? await withTimeout(reg.pushManager.getSubscription()) : null;
    if (sub) {
      if (!all) await withTimeout(api('subscribe', 'DELETE', { endpoint: sub.endpoint }));
      await withTimeout(sub.unsubscribe());
    }
    return true;
  } catch (_) { return false; /* sem rede: a inscrição morta é limpa no próximo envio */ }
}

/** Agenda o aviso de fim do descanso no servidor (endsAt em ms) ou cancela (null). */
export function scheduleRestPush(endsAt, { title, body } = {}) {
  if (!pushSupported() || !pushEnabled()) return;   // no app Android o aviso chega pelo FCM
  api('rest', 'POST', { endsAt: endsAt || null, title, body }).catch(() => { /* o aviso local continua valendo */ });
}

/** Pede ao Worker para avisar o autor de um post curtido (ele confere a curtida no Firestore). */
export function notifyLike(postId) {
  if (!ENABLED) return;
  api('like', 'POST', { postId }).catch(() => { /* sem aviso: a curtida já está salva */ });
}

/** Pede ao Worker para avisar o autor do post de um comentário novo (ele confere o comentário no Firestore). */
export function notifyComment(postId, commentId) {
  if (!ENABLED) return;
  api('comment', 'POST', { postId, commentId }).catch(() => { /* sem aviso: o comentário já está salvo */ });
}
