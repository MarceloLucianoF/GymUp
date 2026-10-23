// Avisos com o app fechado (Web Push). Um Durable Object por usuário guarda as inscrições dos aparelhos dele e o alarme do fim do descanso.
// Rotas (todas exigem o token do Firebase do próprio usuário):
//   GET    /api/push/key           chave pública VAPID
//   POST   /api/push/subscribe     { subscription }       guarda a inscrição deste aparelho (até 5 por pessoa)
//   DELETE /api/push/subscribe     { endpoint? }          remove uma inscrição, ou todas (excluir conta)
//   POST   /api/push/rest          { endsAt, title, body } agenda (ou cancela, com endsAt null) o aviso de fim do descanso
//   POST   /api/push/like          { postId }             avisa o autor do post, se quem chama curtiu mesmo (conferido no Firestore)
//   POST   /api/push/comment       { postId, commentId }  avisa o autor do post de um comentário de quem chama (conferido no Firestore)
import { verifyFirebaseIdToken } from '../../shared/firebaseAuth.js';
import { sendPush, validEndpoint, validKeys, vapidPublicKey } from './webPush.js';

const MAX_SUBS = 5;
const SUBJECT = 'https://bohtreinar.marcelo-labs.workers.dev';
const json = (status, data, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const jwkOf = (env) => {
  try {
    const j = JSON.parse(env.VAPID_PRIVATE_JWK || '');
    return j && j.kty === 'EC' && j.crv === 'P-256' && [j.x, j.y, j.d].every((v) => typeof v === 'string' && v.length > 20) ? j : null;
  } catch { return null; }
};
const sha = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const LIKE_GAP_MS = 30 * 1000;
const LIKES_PER_HOUR = 20;

async function limited(binding, key) {
  if (!binding?.limit) return null;
  try { const { success } = await binding.limit({ key }); return !success; } catch { return null; }
}

/** Lê um documento do Firestore com o token de quem chamou (as regras valem como no app). */
async function firestoreGet(env, token, path, fetchImpl) {
  const res = await fetchImpl(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404 || res.status === 403) return null;   // não existe ou a regra não deixa ver: tratado como "sem curtida"
  if (!res.ok) throw new Error(`firestore ${res.status}`);
  const doc = await res.json();
  const f = doc.fields || {};
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.stringValue ?? v.integerValue ?? v.booleanValue ?? null]));
}

export async function handlePushRequest(request, env, deps = {}) {
  const { fetchImpl = fetch, now = Date.now(), verify = verifyFirebaseIdToken } = deps;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const sameOrigin = origin && origin === url.origin;
  const allowed = new Set(String(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean));
  if (origin && !sameOrigin && !allowed.has(origin)) return json(403, { error: 'Origem não autorizada.' });
  const cors = origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' } : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const jwk = jwkOf(env);
  if (!jwk || !env.PUSH_BOX) return json(503, { error: 'Avisos indisponíveis.' }, cors);
  const route = url.pathname.replace(/^\/api\/push\/?/, '');
  if (route === 'key' && request.method === 'GET') return json(200, { publicKey: vapidPublicKey(jwk) }, cors);

  const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: 'Autenticação obrigatória.' }, cors);
  if (Number(request.headers.get('Content-Length') || 0) > 4000) return json(413, { error: 'Corpo grande demais.' }, cors);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (ip && (await limited(env.PUSH_IP_LIMIT, `ip:${ip}`)) === true) return json(429, { error: 'Muitas solicitações.' }, { ...cors, 'Retry-After': '60' });
  let claims;
  try { claims = await verify(match[1], { projectId: env.FIREBASE_PROJECT_ID, fetchImpl, now }); } catch { return json(401, { error: 'Sessão inválida ou expirada.' }, cors); }
  const uid = claims.sub;
  if ((await limited(env.PUSH_USER_LIMIT, `uid:${uid}`)) === true) return json(429, { error: 'Muitas solicitações.' }, { ...cors, 'Retry-After': '60' });

  const raw = await request.text();
  if (raw.length > 4000) return json(413, { error: 'Corpo grande demais.' }, cors);
  let body = {};
  if (raw) { try { body = JSON.parse(raw); } catch { return json(400, { error: 'Corpo inválido.' }, cors); } }
  const box = (id) => env.PUSH_BOX.get(env.PUSH_BOX.idFromName(id));
  const call = (id, op, data) => box(id).fetch('https://push-box/' + op, { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json());

  if (route === 'subscribe' && request.method === 'POST') {
    const s = body.subscription || {};
    const keys = s.keys || {};
    if (!validEndpoint(s.endpoint) || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 120 || keys.auth.length > 40 || !validKeys(keys)) return json(400, { error: 'Inscrição inválida.' }, cors);
    // Um aparelho pertence a uma conta só: se outra conta já usava este endereço (troca de login no mesmo celular), ela o perde.
    const owner = await call(`ep:${await sha(s.endpoint)}`, 'claim', { uid });
    if (owner.previous && owner.previous !== uid) await call(owner.previous, 'unsubscribe', { endpoint: s.endpoint });
    return json(200, await call(uid, 'subscribe', { endpoint: s.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, at: now }), cors);
  }
  if (route === 'subscribe' && request.method === 'DELETE') {
    if (body.all === true) return json(200, await call(uid, 'unsubscribe', { all: true }), cors);
    if (typeof body.endpoint !== 'string' || !body.endpoint) return json(400, { error: 'Informe o aparelho.' }, cors);
    return json(200, await call(uid, 'unsubscribe', { endpoint: body.endpoint }), cors);
  }
  if (route === 'rest' && request.method === 'POST') {
    const endsAt = body.endsAt === null ? null : Number(body.endsAt);
    if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt < now - 5000 || endsAt > now + 15 * 60 * 1000)) return json(400, { error: 'Horário inválido.' }, cors);
    const payload = { kind: 'rest', title: clip(body.title, 80) || 'Descanso acabou', body: clip(body.body, 160) || 'Bora para a próxima série!', url: '/', tag: 'bt-rest' };
    return json(200, await call(uid, 'rest', { endsAt, payload }), cors);
  }
  if (route === 'like' && request.method === 'POST') {
    const postId = clip(body.postId, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(postId)) return json(400, { error: 'Post inválido.' }, cors);
    let like; let post; let me;
    try {
      like = await firestoreGet(env, match[1], `socialPosts/${postId}/likes/${uid}`, fetchImpl);
      if (!like) return json(200, { sent: 0, reason: 'sem-curtida' }, cors);
      post = await firestoreGet(env, match[1], `socialPosts/${postId}`, fetchImpl);
      if (!post?.authorId || post.authorId === uid) return json(200, { sent: 0, reason: 'sem-autor' }, cors);
      me = await firestoreGet(env, match[1], `publicProfiles/${uid}`, fetchImpl);
    } catch { return json(502, { error: 'Não foi possível conferir a curtida.' }, cors); }
    const who = clip(me?.displayName, 40) || 'Um amigo';
    const payload = { kind: 'like', title: 'Curtidas no BohTreinar', body: `${who} curtiu seu treino "${clip(post.title, 60)}".`, url: '/amigos?aba=atividade', tag: 'bt-likes' };
    return json(200, await call(post.authorId, 'like', { key: `${uid}:${postId}`, payload }), cors);
  }
  if (route === 'comment' && request.method === 'POST') {
    const postId = clip(body.postId, 64);
    const commentId = clip(body.commentId, 64);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(postId) || !/^[A-Za-z0-9_-]{1,64}$/.test(commentId)) return json(400, { error: 'Comentário inválido.' }, cors);
    let comment; let post; let me;
    try {
      comment = await firestoreGet(env, match[1], `socialPosts/${postId}/comments/${commentId}`, fetchImpl);
      if (!comment || comment.authorId !== uid) return json(200, { sent: 0, reason: 'sem-comentario' }, cors);
      post = await firestoreGet(env, match[1], `socialPosts/${postId}`, fetchImpl);
      if (!post?.authorId || post.authorId === uid) return json(200, { sent: 0, reason: 'sem-autor' }, cors);
      me = await firestoreGet(env, match[1], `publicProfiles/${uid}`, fetchImpl);
    } catch { return json(502, { error: 'Não foi possível conferir o comentário.' }, cors); }
    const who = clip(me?.displayName, 40) || 'Um amigo';
    const text = clip(comment.text, 80);
    const payload = { kind: 'comment', title: `${who} comentou no seu treino`, body: `"${clip(post.title, 40)}": ${text}`, url: '/amigos?aba=atividade', tag: 'bt-likes' };
    return json(200, await call(post.authorId, 'like', { key: `${uid}:${postId}`, payload, bucket: 'comment' }), cors);
  }
  return json(404, { error: 'Rota desconhecida.' }, cors);
}

// ---------- Durable Object: inscrições e alarme de um usuário ----------
export class PushBox {
  constructor(state, env) { this.state = state; this.env = env; }

  async subs() { return (await this.state.storage.get('subs')) || []; }

  async deliver(payload, ttl, urgency = 'high') {
    const jwk = jwkOf(this.env);
    const subs = await this.subs();
    if (!jwk || !subs.length) return 0;
    let sent = 0;
    const alive = [];
    for (const s of subs) {
      let status = 0;
      try { status = await sendPush(s, payload, { jwk, subject: SUBJECT, ttl, urgency }); } catch { status = 0; }
      if (status === 404 || status === 410) continue;   // inscrição morta: sai
      if (status >= 200 && status < 300) { sent += 1; alive.push({ ...s, fails: 0 }); continue; }
      const fails = (s.fails || 0) + 1;
      if (fails < 3) alive.push({ ...s, fails });   // 3 falhas seguidas: sai (não ocupa vaga para sempre)
    }
    await this.state.storage.put('subs', alive);
    return sent;
  }

  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    const data = await request.json();
    if (op === 'subscribe') {
      const subs = (await this.subs()).filter((s) => s.endpoint !== data.endpoint);
      subs.push({ endpoint: data.endpoint, keys: data.keys, at: data.at });
      await this.state.storage.put('subs', subs.slice(-MAX_SUBS));
      return json(200, { ok: true, devices: Math.min(subs.length, MAX_SUBS) });
    }
    if (op === 'claim') {
      const previous = (await this.state.storage.get('owner')) || null;
      await this.state.storage.put('owner', data.uid);
      return json(200, { previous });
    }
    if (op === 'unsubscribe') {
      if (data.all === true) { await this.state.storage.deleteAll(); await this.state.storage.deleteAlarm(); return json(200, { ok: true, devices: 0 }); }
      const subs = (await this.subs()).filter((s) => s.endpoint !== data.endpoint);
      await this.state.storage.put('subs', subs);
      return json(200, { ok: true, devices: subs.length });
    }
    if (op === 'rest') {
      if (data.endsAt === null) { await this.state.storage.delete('rest'); await this.state.storage.deleteAlarm(); return json(200, { ok: true, scheduled: false }); }
      await this.state.storage.put('rest', data.payload);
      await this.state.storage.setAlarm(data.endsAt);
      return json(200, { ok: true, scheduled: true });
    }
    if (op === 'like') {
      // Uma vez por pessoa e post, no máximo 1 aviso a cada 30 s e 20 por hora para quem recebe (o resto aparece na aba Atividade).
      // Curtidas e comentários têm cotas separadas (bucket), para uma rajada de um não calar o outro.
      const b = data.bucket === 'comment' ? 'comment' : 'like';
      const seenKey = b === 'like' ? 'likesSeen' : 'commentsSeen';
      const timesKey = b === 'like' ? 'likeTimes' : 'commentTimes';
      const seen = (await this.state.storage.get(seenKey)) || [];
      if (seen.includes(data.key)) return json(200, { sent: 0, reason: 'repetida' });
      const now = Date.now();
      const recent = ((await this.state.storage.get(timesKey)) || []).filter((t) => now - t < 3600 * 1000);
      if (recent.length >= LIKES_PER_HOUR || (recent.length && now - recent[recent.length - 1] < LIKE_GAP_MS)) return json(200, { sent: 0, reason: 'limite' });
      const sent = await this.deliver(data.payload, 24 * 3600, 'low');
      if (sent > 0) {
        await this.state.storage.put(seenKey, [...seen, data.key].slice(-300));
        await this.state.storage.put(timesKey, [...recent, now]);
      }
      return json(200, { sent });
    }
    return json(404, { error: 'op' });
  }

  async alarm() {
    const payload = await this.state.storage.get('rest');
    if (!payload) return;
    await this.state.storage.delete('rest');
    await this.deliver(payload, 60);
  }
}
