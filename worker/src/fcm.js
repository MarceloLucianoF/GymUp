// Envio de avisos ao app Android pelo FCM (HTTP v1). A conta de serviço (só com permissão de FCM) fica no segredo FCM_SERVICE_ACCOUNT_JSON.
import { b64u } from './webPush.js';

const enc = new TextEncoder();
let cached = { token: null, exp: 0, email: null };

const pemToDer = (pem) => b64u.decode(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_'));

export function serviceAccountOf(env) {
  try {
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON || '');
    return sa && sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch { return null; }
}

/** Token OAuth de curta duração para a API do FCM (reaproveitado até perto de expirar). */
export async function accessToken(sa, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (cached.token && cached.email === sa.client_email && now < cached.exp - 60000) return cached.token;
  const iat = Math.floor(now / 1000);
  const head = b64u.encode(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64u.encode(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claims}`));
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64u.encode(sig)}` })
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('oauth');
  cached = { token: j.access_token, exp: now + (j.expires_in || 3600) * 1000, email: sa.client_email };
  return cached.token;
}

/** Envia ao aparelho. Devolve 404 quando o token do aparelho não vale mais (app desinstalado). */
export async function sendFcm(token, data, { sa, ttl = 60, fetchImpl = fetch, now = Date.now() }) {
  const auth = await accessToken(sa, { fetchImpl, now });
  const message = {
    token,
    notification: { title: data.title || 'BohTreinar', body: data.body || '' },
    data: { url: String(data.url || '/'), kind: String(data.kind || '') },
    android: { priority: 'HIGH', ttl: `${ttl}s`, notification: { channel_id: 'bohtreinar', tag: data.tag || 'bt-push', default_vibrate_timings: true, notification_priority: data.kind === 'rest' ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT' } }
  };
  const res = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message })
  });
  if (res.status === 404) return 404;
  if (res.status === 400) {
    // Só "UNREGISTERED" quer dizer aparelho morto; INVALID_ARGUMENT pode ser erro nosso de formato e conta como falha comum.
    const err = await res.json().catch(() => ({}));
    if (/UNREGISTERED/.test(JSON.stringify(err))) return 404;
  }
  return res.status;
}
