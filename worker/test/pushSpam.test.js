// Anti-spam dos avisos sociais: rajada de curtidas e comentários num post viral chega em poucos avisos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PushBox, SOCIAL_LIMITS } from '../src/push.js';

const memStorage = () => { const m = new Map(); return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, setAlarm: async () => {}, deleteAlarm: async () => {}, getAlarm: async () => null, m }; };
// blockConcurrencyWhile do Durable Object: aqui, uma trava simples (uma função por vez).
const gate = () => { let chain = Promise.resolve(); return (fn) => { const run = chain.then(fn); chain = run.catch(() => {}); return run; }; };
function box() {
  const st = memStorage();
  const obj = new PushBox({ storage: st, blockConcurrencyWhile: gate() }, {});
  const delivered = [];
  obj.subs = async () => [{ endpoint: 'x' }];
  obj.deliver = async (payload) => { delivered.push(payload); return 1; };
  const send = (key, bucket) => obj.fetch(new Request('https://push-box/like', { method: 'POST', body: JSON.stringify({ key, payload: { tag: 'bt-likes' }, ...(bucket ? { bucket } : {}) }) })).then((r) => r.json());
  return { send, delivered };
}
async function at(t, fn) { const real = Date.now; Date.now = () => t; try { return await fn(); } finally { Date.now = real; } }

test('post viral: 40 curtidas e 15 comentários em 1 hora viram poucos avisos', async () => {
  const { send, delivered } = box();
  const t0 = Date.parse('2026-11-04T18:00:00Z');
  for (let i = 0; i < 40; i += 1) await at(t0 + i * 90 * 1000, () => send(`liker${i}:post1`));            // uma curtida a cada 1,5 min
  const likes = delivered.length;
  assert.ok(likes <= SOCIAL_LIMITS.like.perHour, `curtidas: ${likes}`);
  for (let i = 0; i < 15; i += 1) await at(t0 + i * 20 * 1000, () => send(`c${i}:post1`, 'comment'));     // um comentário a cada 20 s
  const comments = delivered.length - likes;
  assert.ok(comments <= 5, `comentários: ${comments}`);                                                       // 1 por minuto em 5 min
  assert.ok(comments >= 1);
});

test('a mesma pessoa curtindo de novo o mesmo post não avisa duas vezes', async () => {
  const { send, delivered } = box();
  const t0 = Date.parse('2026-11-04T18:00:00Z');
  await at(t0, () => send('ana:post1'));
  await at(t0 + 3600 * 1000, () => send('ana:post1'));
  assert.equal(delivered.length, 1);
});

test('curtidas não calam comentários (cotas separadas)', async () => {
  const { send, delivered } = box();
  const t0 = Date.parse('2026-11-04T18:00:00Z');
  await at(t0, () => send('a:p'));
  await at(t0 + 1000, () => send('b:p'));                   // curtida dentro do intervalo: segurada
  await at(t0 + 2000, () => send('c:p', 'comment'));        // comentário: passa
  assert.equal(delivered.length, 2);
});

test('duas curtidas ao mesmo tempo não furam o intervalo (a vaga é reservada antes do envio)', async () => {
  const st = memStorage();
  const obj = new PushBox({ storage: st, blockConcurrencyWhile: gate() }, {});
  obj.subs = async () => [{ endpoint: 'x' }];
  let delivered = 0;
  obj.deliver = async () => { await new Promise((r) => setTimeout(r, 20)); delivered += 1; return 1; };   // envio lento: abre espaço para a concorrente
  const send = (key) => obj.fetch(new Request('https://push-box/like', { method: 'POST', body: JSON.stringify({ key, payload: {} }) })).then((r) => r.json());
  const results = await Promise.all([send('a:p'), send('b:p')]);
  assert.equal(delivered, 1);
  assert.deepEqual(results.map((r) => r.sent).sort(), [0, 1]);
});

test('envio que não chega a nenhum aparelho devolve a vaga', async () => {
  const st = memStorage();
  const obj = new PushBox({ storage: st }, {});
  obj.subs = async () => [{ endpoint: 'x' }];
  let n = 0;
  obj.deliver = async () => { n += 1; return n === 1 ? 0 : 1; };
  const send = (key) => obj.fetch(new Request('https://push-box/like', { method: 'POST', body: JSON.stringify({ key, payload: {} }) })).then((r) => r.json());
  assert.equal((await send('a:p')).sent, 0);
  assert.equal((await send('a:p')).sent, 1);   // a mesma curtida pode avisar quando o aparelho voltar
});
