// Avisos com o app fechado (Web Push pelo Worker do app). Opcional: só funciona no app publicado (mesmo Worker do proxy de IA),
// com permissão de notificação e service worker. Nada aqui atrapalha o app se falhar: cada chamada devolve false/null.
import { auth } from '../firebase/config';

const ENABLED = process.env.REACT_APP_NVIDIA_PROXY === 'true';
const KEY = 'bt_push_on';

export const pushSupported = () => ENABLED && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
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

/** Liga os avisos neste aparelho: pede permissão (se precisar), inscreve no serviço de push e registra no Worker. */
export async function enablePush() {
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
  if (!pushSupported() || !pushEnabled()) return;
  api('rest', 'POST', { endsAt: endsAt || null, title, body }).catch(() => { /* o aviso local continua valendo */ });
}

/** Pede ao Worker para avisar o autor de um post curtido (ele confere a curtida no Firestore). */
export function notifyLike(postId) {
  if (!ENABLED) return;
  api('like', 'POST', { postId }).catch(() => { /* sem aviso: a curtida já está salva */ });
}
