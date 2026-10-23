import test from 'node:test';
import assert from 'node:assert/strict';
import { b64u, encryptPayload, validEndpoint, vapidAuth, vapidPublicKey } from '../src/webPush.js';
import { handlePushRequest, PushBox } from '../src/push.js';

const enc = new TextEncoder();
const hkdf = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; p.forEach((x) => { o.set(x, i); i += x.length; }); return o; };

async function subscriber() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  // Decriptação do lado do navegador (RFC 8291), para conferir a ida e volta.
  const decrypt = async (body) => {
    const salt = body.slice(0, 16); const idlen = body[20]; const asPub = body.slice(21, 21 + idlen); const cipher = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, keys.privateKey, 256));
    const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), pub, asPub), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
    assert.equal(plain[plain.length - 1], 2);   // delimitador do último registro
    return new TextDecoder().decode(plain.slice(0, -1));
  };
  return { sub: { p256dh: b64u.encode(pub), auth: b64u.encode(auth) }, decrypt };
}

async function vapidJwk() {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { jwk: await crypto.subtle.exportKey('jwk', k.privateKey), verifyKey: k.publicKey };
}

test('criptografia aes128gcm: o aparelho decifra a mensagem', async () => {
  const { sub, decrypt } = await subscriber();
  const body = await encryptPayload('{"title":"Descanso acabou"}', sub);
  assert.equal(await decrypt(body), '{"title":"Descanso acabou"}');
  assert.deepEqual([...body.slice(16, 20)], [0, 0, 16, 0]);
});

test('VAPID: JWT ES256 válido para a origem do endpoint, com a chave pública certa', async () => {
  const { jwk, verifyKey } = await vapidJwk();
  const auth = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', jwk, 'https://exemplo.dev', Date.parse('2026-10-22T12:00:00Z'));
  const [, t, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, vapidPublicKey(jwk));
  const [h, c, s] = t.split('.');
  assert.equal(JSON.parse(new TextDecoder().decode(b64u.decode(c))).aud, 'https://fcm.googleapis.com');
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, b64u.decode(s), enc.encode(`${h}.${c}`)));
});

test('só aceita endpoints de serviços de push conhecidos', () => {
  assert.ok(validEndpoint('https://fcm.googleapis.com/fcm/send/x'));
  assert.ok(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(validEndpoint('https://web.push.apple.com/x'));
  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'nada']) assert.equal(validEndpoint(bad), false, bad);
});

// Durable Object falso em memória (mesma classe, armazenamento simulado).
function fakeEnv(jwk) {
  const boxes = new Map();
  const storage = () => { const m = new Map(); let alarm = null; return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, deleteAll: async () => m.clear(), setAlarm: async (t) => { alarm = t; }, deleteAlarm: async () => { alarm = null; }, get alarm() { return alarm; }, m }; };
  const env = { FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://app.dev', VAPID_PRIVATE_JWK: JSON.stringify(jwk) };
  env.PUSH_BOX = { idFromName: (n) => n, get: (id) => { if (!boxes.has(id)) { const st = storage(); boxes.set(id, { st, obj: new PushBox({ storage: st }, env) }); } const b = boxes.get(id); return { fetch: (u, init) => b.obj.fetch(new Request(u, init)) }; } };
  return { env, boxes };
}
const req = (path, method, body, token = 'tok-a') => new Request(`https://app.dev/api/push/${path}`, { method, headers: { Origin: 'https://app.dev', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const verify = async (t) => { if (t === 'tok-a') return { sub: 'ana' }; if (t === 'tok-b') return { sub: 'bia' }; throw new Error('x'); };

test('rotas: chave, inscrição (validada), descanso agendado/cancelado e remoção de tudo', async () => {
  const { jwk } = await vapidJwk();
  const { env, boxes } = fakeEnv(jwk);
  const { sub } = await subscriber();
  const keys = { p256dh: sub.p256dh, auth: sub.auth };
  const key = await (await handlePushRequest(new Request('https://app.dev/api/push/key'), env, { verify })).json();
  assert.equal(key.publicKey, vapidPublicKey(jwk));
  assert.equal((await handlePushRequest(req('subscribe', 'POST', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys } }, 'ruim'), env, { verify })).status, 401);
  assert.equal((await handlePushRequest(req('subscribe', 'POST', { subscription: { endpoint: 'https://evil.com/x', keys } }), env, { verify })).status, 400);
  const ok = await (await handlePushRequest(req('subscribe', 'POST', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys } }), env, { verify })).json();
  assert.equal(ok.devices, 1);
  const now = Date.now();
  assert.equal((await handlePushRequest(req('rest', 'POST', { endsAt: now + 3600 * 1000 }), env, { verify, now })).status, 400);   // longe demais
  await handlePushRequest(req('rest', 'POST', { endsAt: now + 60000, title: 'Supino', body: 'Série 2 de 3' }), env, { verify, now });
  assert.equal(boxes.get('ana').st.alarm, now + 60000);
  assert.equal(boxes.get('ana').st.m.get('rest').title, 'Supino');
  await handlePushRequest(req('rest', 'POST', { endsAt: null }), env, { verify, now });
  assert.equal(boxes.get('ana').st.alarm, null);
  await handlePushRequest(req('subscribe', 'DELETE', { all: true }), env, { verify });
  assert.equal(boxes.get('ana').st.m.size, 0);
  assert.equal((await handlePushRequest(new Request('https://app.dev/api/push/key', { headers: { Origin: 'https://evil.com' } }), env, { verify })).status, 403);
});

test('curtida: só avisa se o Firestore confirma a curtida de quem chama, nunca o próprio autor, uma vez por pessoa e post', async () => {
  const { jwk } = await vapidJwk();
  const { env, boxes } = fakeEnv(jwk);
  const docs = { 'socialPosts/p1/likes/bia': { at: { stringValue: 'x' } }, 'socialPosts/p1': { authorId: { stringValue: 'ana' }, title: { stringValue: 'Treino A' } }, 'publicProfiles/bia': { displayName: { stringValue: 'Bia' } } };
  const pushed = [];
  const fetchImpl = async (u, init) => {
    if (String(u).startsWith('https://firestore.googleapis.com/')) {
      const path = decodeURIComponent(String(u).split('/documents/')[1]);
      assert.equal(init.headers.Authorization, 'Bearer tok-b');   // lê com o token de quem curtiu
      return docs[path] ? new Response(JSON.stringify({ fields: docs[path] })) : new Response('{}', { status: 403 });
    }
    pushed.push(String(u)); return new Response('', { status: 201 });
  };
  globalThis.__realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;   // o envio do push no Durable Object usa o fetch global
  try {
    const { sub } = await subscriber();
    await boxes.size;   // ana assina
    await handlePushRequest(req('subscribe', 'POST', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/ana', keys: { p256dh: sub.p256dh, auth: sub.auth } } }), env, { verify });
    let r = await (await handlePushRequest(req('like', 'POST', { postId: 'p1' }, 'tok-b'), env, { verify, fetchImpl })).json();
    assert.equal(r.sent, 1);
    assert.deepEqual(pushed, ['https://fcm.googleapis.com/fcm/send/ana']);
    r = await (await handlePushRequest(req('like', 'POST', { postId: 'p1' }, 'tok-b'), env, { verify, fetchImpl })).json();
    assert.equal(r.reason, 'repetida');
    r = await (await handlePushRequest(req('like', 'POST', { postId: 'p2' }, 'tok-b'), env, { verify, fetchImpl })).json();
    assert.equal(r.reason, 'sem-curtida');   // sem curtida no Firestore, sem aviso
    assert.equal((await handlePushRequest(req('like', 'POST', { postId: '../x' }, 'tok-b'), env, { verify, fetchImpl })).status, 400);
  } finally { globalThis.fetch = globalThis.__realFetch; }
});

test('revisão: desligar exige o aparelho (ou all), chaves validadas, um aparelho por conta, limite de avisos de curtida', async () => {
  const { jwk } = await vapidJwk();
  const { env, boxes } = fakeEnv(jwk);
  const { sub } = await subscriber();
  const s1 = { endpoint: 'https://fcm.googleapis.com/fcm/send/1', keys: { p256dh: sub.p256dh, auth: sub.auth } };
  const s2 = { endpoint: 'https://fcm.googleapis.com/fcm/send/2', keys: { p256dh: sub.p256dh, auth: sub.auth } };
  assert.equal((await handlePushRequest(req('subscribe', 'POST', { subscription: { ...s1, keys: { p256dh: 'a', auth: 'b' } } }), env, { verify })).status, 400);   // chave inválida
  await handlePushRequest(req('subscribe', 'POST', { subscription: s1 }), env, { verify });
  await handlePushRequest(req('subscribe', 'POST', { subscription: s2 }), env, { verify });
  assert.equal((await handlePushRequest(req('subscribe', 'DELETE', {}), env, { verify })).status, 400);                         // sem aparelho nem all: não apaga tudo
  assert.equal(boxes.get('ana').st.m.get('subs').length, 2);
  await handlePushRequest(req('subscribe', 'DELETE', { endpoint: s1.endpoint }), env, { verify });
  assert.deepEqual(boxes.get('ana').st.m.get('subs').map((x) => x.endpoint), [s2.endpoint]);
  // o mesmo celular passa para a Bia: a Ana perde esse aparelho
  await handlePushRequest(req('subscribe', 'POST', { subscription: s2 }, 'tok-b'), env, { verify });
  assert.equal(boxes.get('ana').st.m.get('subs').length, 0);
  assert.equal(boxes.get('bia').st.m.get('subs').length, 1);
  // limite de curtidas para quem recebe: a segunda em menos de 30 s não vira aviso
  globalThis.__f = globalThis.fetch; globalThis.fetch = async () => new Response('', { status: 201 });
  try {
    const box = env.PUSH_BOX.get('bia');
    const a = await (await box.fetch('https://push-box/like', { method: 'POST', body: JSON.stringify({ key: 'x:1', payload: { title: 't' } }) })).json();
    const b = await (await box.fetch('https://push-box/like', { method: 'POST', body: JSON.stringify({ key: 'y:2', payload: { title: 't' } }) })).json();
    assert.deepEqual([a.sent, b.reason], [1, 'limite']);
  } finally { globalThis.fetch = globalThis.__f; }
});

test('comentário: só avisa se o comentário é de quem chama, e nunca o próprio autor do post', async () => {
  const { jwk } = await vapidJwk();
  const { env } = fakeEnv(jwk);
  const docs = { 'socialPosts/p1/comments/k1': { authorId: { stringValue: 'bia' }, text: { stringValue: 'Mandou bem' } }, 'socialPosts/p1/comments/k2': { authorId: { stringValue: 'ana' }, text: { stringValue: 'oi' } }, 'socialPosts/p1': { authorId: { stringValue: 'ana' }, title: { stringValue: 'Treino A' } }, 'publicProfiles/bia': { displayName: { stringValue: 'Bia' } } };
  const fetchImpl = async (u) => { const path = decodeURIComponent(String(u).split('/documents/')[1] || ''); return docs[path] ? new Response(JSON.stringify({ fields: docs[path] })) : new Response('{}', { status: 404 }); };
  const r1 = await (await handlePushRequest(req('comment', 'POST', { postId: 'p1', commentId: 'k1' }, 'tok-b'), env, { verify, fetchImpl })).json();
  assert.equal(r1.sent, 0);                 // ana sem aparelho: chega ao envio, 0 entregues
  assert.equal(r1.reason, undefined);
  const r2 = await (await handlePushRequest(req('comment', 'POST', { postId: 'p1', commentId: 'k2' }, 'tok-b'), env, { verify, fetchImpl })).json();
  assert.equal(r2.reason, 'sem-comentario'); // comentário de outra pessoa
  const r3 = await (await handlePushRequest(req('comment', 'POST', { postId: 'p1', commentId: 'k2' }, 'tok-a'), env, { verify, fetchImpl })).json();
  assert.equal(r3.reason, 'sem-autor');      // a autora comentando o próprio post
  assert.equal((await handlePushRequest(req('comment', 'POST', { postId: 'p1', commentId: '../x' }, 'tok-b'), env, { verify, fetchImpl })).status, 400);
});
