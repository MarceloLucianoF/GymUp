// Lembrete de volta ao treino: agendamento pelo aluno (inatividade) e lembrete do treinador (nudge).
import test from 'node:test';
import assert from 'node:assert/strict';
import { b64u } from '../src/webPush.js';
import { handlePushRequest, PushBox, safeName, inactivityPayload } from '../src/push.js';

const DAY = 24 * 3600 * 1000;

async function vapidJwk() {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return crypto.subtle.exportKey('jwk', k.privateKey);
}
async function subKeys() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { p256dh: b64u.encode(new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey))), auth: b64u.encode(crypto.getRandomValues(new Uint8Array(16))) };
}
function fakeEnv(jwk) {
  const boxes = new Map();
  const storage = () => { const m = new Map(); let alarm = null; return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, deleteAll: async () => m.clear(), setAlarm: async (t) => { alarm = t; }, deleteAlarm: async () => { alarm = null; }, getAlarm: async () => alarm, get alarm() { return alarm; }, m }; };
  const env = { FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://app.dev', VAPID_PRIVATE_JWK: JSON.stringify(jwk) };
  env.PUSH_BOX = { idFromName: (n) => n, get: (id) => { if (!boxes.has(id)) { const st = storage(); boxes.set(id, { st, obj: new PushBox({ storage: st }, env) }); } const b = boxes.get(id); return { fetch: (u, init) => b.obj.fetch(new Request(u, init)) }; } };
  return { env, boxes, box: (id) => { env.PUSH_BOX.get(id); return boxes.get(id); } };
}
const TOKENS = { 'tok-ana': 'ana', 'tok-coach': 'coach1', 'tok-other': 'coach2' };
const verify = async (t) => { if (TOKENS[t]) return { sub: TOKENS[t] }; throw new Error('x'); };
const req = (path, body, token = 'tok-ana') => new Request(`https://app.dev/api/push/${path}`, { method: 'POST', headers: { Origin: 'https://app.dev', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Envio de push: o Durable Object usa o fetch global; só contamos os envios.
async function withPushFetch(fn) {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => { sent.push(String(u)); return new Response('', { status: 201 }); };
  try { return await fn(sent); } finally { globalThis.fetch = real; }
}
async function withClock(t, fn) {
  const real = Date.now;
  Date.now = () => t;
  try { return await fn(); } finally { Date.now = real; }
}
async function subscribe(env, token = 'tok-ana', n = '1') {
  const r = await handlePushRequest(req('subscribe', { subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: await subKeys() } }, token), env, { verify });
  assert.equal(r.status, 200);
}

test('nome do treinador: até 40 caracteres e sem links', () => {
  assert.equal(safeName('Carla Souza'), 'Carla Souza');
  assert.equal(safeName('Prof. Ana'), 'Prof. Ana');
  assert.equal(safeName('x'.repeat(60)).length, 40);
  for (const bad of ['https://golpe.dev', 'www.golpe', 'veja golpe.com', 'Ana <b>', 'a@b']) assert.equal(safeName(bad), '', bad);
  const p = inactivityPayload({ lastWorkoutAt: 0, coachName: 'Carla' }, 7 * DAY);
  assert.deepEqual([p.title, p.body, p.url], ['Bora voltar?', 'Faz 7 dias do seu último treino. Seu treinador Carla está esperando você.', '/home']);
  assert.equal(inactivityPayload({ lastWorkoutAt: 0, coachName: '' }, 14 * DAY).body, 'Faz 14 dias do seu último treino.');
});

test('inatividade: agenda +7 e +14 dias, reagenda ao treinar de novo, nada retroativo e cancela', async () => {
  const { env, box } = fakeEnv(await vapidJwk());
  const now = Date.parse('2026-10-30T12:00:00Z');
  const call = (body) => handlePushRequest(req('inactivity', body), env, { verify, now });
  // validação
  assert.equal((await call({ lastWorkoutAt: 'ontem' })).status, 400);
  assert.equal((await call({ lastWorkoutAt: new Date(now + DAY).toISOString() })).status, 400);   // no futuro
  assert.equal((await call({ lastWorkoutAt: new Date(now).toISOString(), coachName: 12 })).status, 400);
  assert.equal((await handlePushRequest(req('inactivity', { lastWorkoutAt: new Date(now).toISOString() }, 'ruim'), env, { verify, now })).status, 401);

  const last = now - 2 * DAY;
  let r = await (await call({ lastWorkoutAt: new Date(last).toISOString(), coachName: 'Carla' })).json();
  assert.equal(r.scheduled, true);
  const st = box('ana').st;
  assert.deepEqual(st.m.get('inactivity').times, [last + 7 * DAY, last + 14 * DAY]);
  assert.equal(st.m.get('inactivity').coachName, 'Carla');
  assert.equal(st.alarm, last + 7 * DAY);
  // treinou de novo: substitui
  r = await (await call({ lastWorkoutAt: new Date(now).toISOString() })).json();
  assert.deepEqual(st.m.get('inactivity').times, [now + 7 * DAY, now + 14 * DAY]);
  assert.equal(st.m.get('inactivity').coachName, '');
  assert.equal(st.alarm, now + 7 * DAY);
  // último treino há 10 dias: o de 7 já passou, fica só o de 14
  await call({ lastWorkoutAt: new Date(now - 10 * DAY).toISOString() });
  assert.deepEqual(st.m.get('inactivity').times, [now + 4 * DAY]);
  // há 20 dias: nada a agendar, sem aviso retroativo
  r = await (await call({ lastWorkoutAt: new Date(now - 20 * DAY).toISOString() })).json();
  assert.equal(r.scheduled, false);
  assert.equal(st.m.has('inactivity'), false);
  assert.equal(st.alarm, null);
  // cancelar
  await call({ lastWorkoutAt: new Date(now).toISOString() });
  r = await (await call({ cancel: true })).json();
  assert.equal(r.scheduled, false);
  assert.equal(st.m.has('inactivity'), false);
  assert.equal(st.alarm, null);
  // link no nome: o lembrete sai sem o nome
  await call({ lastWorkoutAt: new Date(now).toISOString(), coachName: 'acesse golpe.com' });
  assert.equal(st.m.get('inactivity').coachName, '');
});

test('inatividade: o alarme dispara o aviso de 7 dias e reaponta para o de 14; sem inscrição, não envia', async () => {
  const { env, box } = fakeEnv(await vapidJwk());
  const now = Date.now();
  await subscribe(env);
  await handlePushRequest(req('inactivity', { lastWorkoutAt: new Date(now - DAY).toISOString(), coachName: 'Carla' }), env, { verify, now });
  const b = box('ana');
  const t7 = now + 6 * DAY; const t14 = now + 13 * DAY;
  assert.equal(b.st.alarm, t7);
  await withPushFetch(async (sent) => {
    await withClock(t7, () => b.obj.alarm());
    assert.deepEqual(sent, ['https://fcm.googleapis.com/fcm/send/1']);
    assert.deepEqual(b.st.m.get('inactivity').times, [t14]);
    assert.equal(b.st.alarm, t14);
    await withClock(t14 + 5000, () => b.obj.alarm());
    assert.equal(sent.length, 2);
    assert.equal(b.st.m.has('inactivity'), false);
    assert.equal(b.st.alarm, null);
  });
  // aluno sem aparelho inscrito: o alarme roda e não envia nada
  const other = fakeEnv(await vapidJwk());
  await handlePushRequest(req('inactivity', { lastWorkoutAt: new Date(now - DAY).toISOString() }), other.env, { verify, now });
  await withPushFetch(async (sent) => {
    await withClock(t7, () => other.box('ana').obj.alarm());
    assert.equal(sent.length, 0);
  });
});

test('inatividade convive com o descanso: um alarme só, sempre o mais próximo, sem perder nenhum', async () => {
  const { env, box } = fakeEnv(await vapidJwk());
  const now = Date.now();
  await subscribe(env);
  await handlePushRequest(req('inactivity', { lastWorkoutAt: new Date(now).toISOString() }), env, { verify, now });
  const b = box('ana');
  assert.equal(b.st.alarm, now + 7 * DAY);
  // descanso de 60 s: o alarme passa a ser o do descanso
  await handlePushRequest(req('rest', { endsAt: now + 60000, title: 'Supino' }), env, { verify, now });
  assert.equal(b.st.alarm, now + 60000);
  // cancelar o descanso volta para o lembrete (antes apagava o alarme todo)
  await handlePushRequest(req('rest', { endsAt: null }), env, { verify, now });
  assert.equal(b.st.alarm, now + 7 * DAY);
  assert.equal(b.st.m.has('inactivity'), true);
  // descanso de novo e reagendar a inatividade: o descanso continua sendo o próximo
  await handlePushRequest(req('rest', { endsAt: now + 90000, title: 'Remada' }), env, { verify, now });
  await handlePushRequest(req('inactivity', { lastWorkoutAt: new Date(now).toISOString() }), env, { verify, now });
  assert.equal(b.st.alarm, now + 90000);
  await withPushFetch(async (sent) => {
    await withClock(now + 90000, () => b.obj.alarm());
    assert.equal(sent.length, 1);                       // só o descanso
    assert.equal(b.st.m.has('rest'), false);
    assert.equal(b.st.alarm, now + 7 * DAY);            // reapontou para o lembrete
    assert.equal(b.st.m.get('inactivity').times.length, 2);
  });
  // cancelar a inatividade com descanso pendente mantém o descanso
  await handlePushRequest(req('rest', { endsAt: now + 30000 }), env, { verify, now });
  await handlePushRequest(req('inactivity', { cancel: true }), env, { verify, now });
  assert.equal(b.st.alarm, now + 30000);
  // descanso gravado pela versão anterior (sem restAt) ainda é entregue
  b.st.m.delete('restAt');
  await withPushFetch(async (sent) => {
    await withClock(now + 30000, () => b.obj.alarm());
    assert.equal(sent.length, 1);
    assert.equal(b.st.alarm, null);
  });
});

// Firestore REST falso: só devolve o aluno ao treinador vinculado (como a regra linkedStudent).
function firestoreMock(docs, seen = []) {
  return async (u, init) => {
    assert.ok(String(u).startsWith('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/'));
    const path = String(u).split('/documents/')[1];
    const token = init.headers.Authorization.replace('Bearer ', '');
    seen.push([path, token]);
    const caller = TOKENS[token];
    const d = docs[path];
    if (!d) return new Response('{}', { status: 404 });
    const own = path === `users/${caller}`;
    if (!own && !(d.coachId === caller && docs[`users/${caller}`]?.role === 'coach')) return new Response('{}', { status: 403 });
    return new Response(JSON.stringify({ fields: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { stringValue: v }])) }));
  };
}
const DOCS = {
  'users/ana': { role: 'user', coachId: 'coach1', displayName: 'Ana' },
  'users/bia': { role: 'user', coachId: 'coach2', displayName: 'Bia' },
  'users/coach1': { role: 'coach', displayName: 'Carla Souza' },
  'users/coach2': { role: 'coach', displayName: 'Davi' }
};

test('nudge: treinador vinculado envia; sem vínculo 403; limite de 24 h; sem inscrição', async () => {
  const { env, box } = fakeEnv(await vapidJwk());
  const seen = [];
  const fetchImpl = firestoreMock(DOCS, seen);
  const now = Date.now();
  const nudge = (body, token = 'tok-coach', at = now) => handlePushRequest(req('nudge', body, token), env, { verify, now: at, fetchImpl });

  // validação de entrada
  assert.equal((await nudge({ studentId: '../x', days: 7 })).status, 400);
  assert.equal((await nudge({ studentId: 'ana', days: 0 })).status, 400);
  assert.equal((await nudge({ studentId: 'ana', days: 'sete' })).status, 400);
  assert.equal((await nudge({ studentId: 'coach1', days: 7 })).status, 400);   // a si mesmo
  // sem inscrição do aluno
  let r = await (await nudge({ studentId: 'ana', days: 7 })).json();
  assert.deepEqual(r, { sent: false, reason: 'no-subscription' });
  assert.deepEqual(seen[0], ['users/ana', 'tok-coach']);   // lido com o token do próprio treinador
  // treinador de outro aluno: a regra nega a leitura -> 403
  assert.equal((await nudge({ studentId: 'ana', days: 7 }, 'tok-other')).status, 403);
  // aluno tentando lembrar outro aluno: 403
  assert.equal((await nudge({ studentId: 'bia', days: 7 }, 'tok-ana')).status, 403);

  await subscribe(env, 'tok-ana');
  await withPushFetch(async (sent) => {
    r = await (await nudge({ studentId: 'ana', days: 8 })).json();
    assert.deepEqual(r, { sent: true });
    assert.equal(sent.length, 1);
    r = await (await nudge({ studentId: 'ana', days: 8 }, 'tok-coach', now + 23 * 3600 * 1000)).json();
    assert.deepEqual(r, { sent: false, reason: 'rate-limited' });
    assert.equal(sent.length, 1);
    r = await (await nudge({ studentId: 'ana', days: 9 }, 'tok-coach', now + 24 * 3600 * 1000 + 1)).json();
    assert.deepEqual(r, { sent: true });
    assert.equal(sent.length, 2);
  });
  assert.equal(box('ana').st.m.get('nudgeAt'), now + 24 * 3600 * 1000 + 1);
});

test('nudge: coachId de outro treinador é 403 mesmo com leitura permitida; falha do Firestore é 502', async () => {
  const { env } = fakeEnv(await vapidJwk());
  const docs = { 'users/ana': { role: 'user', coachId: 'coach2' }, 'users/coach1': { role: 'coach', displayName: 'Carla' } };
  const lenient = async (u) => { const path = String(u).split('/documents/')[1]; const d = docs[path]; return d ? new Response(JSON.stringify({ fields: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { stringValue: v }])) })) : new Response('{}', { status: 404 }); };
  assert.equal((await handlePushRequest(req('nudge', { studentId: 'ana', days: 7 }, 'tok-coach'), env, { verify, fetchImpl: lenient })).status, 403);
  const broken = async () => new Response('erro', { status: 500 });
  assert.equal((await handlePushRequest(req('nudge', { studentId: 'ana', days: 7 }, 'tok-coach'), env, { verify, fetchImpl: broken })).status, 502);
});

test('nudge: entrega que falha não consome o limite de 24 h', async () => {
  const { env, box } = fakeEnv(await vapidJwk());
  await subscribe(env, 'tok-ana');
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 500 });
  try {
    const r = await (await handlePushRequest(req('nudge', { studentId: 'ana', days: 7 }, 'tok-coach'), env, { verify, fetchImpl: firestoreMock(DOCS) })).json();
    assert.deepEqual(r, { sent: false, reason: 'no-subscription' });
    assert.equal(box('ana').st.m.has('nudgeAt'), false);
  } finally { globalThis.fetch = real; }
});
