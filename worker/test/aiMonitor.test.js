// Monitor da IA: verificação, decisão de alerta (cai, continua, volta) e rota de histórico só para administradores.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeAi, recordHealth, ackHealth, monitorAi, handleAiHealth, REMIND_MS, SLOW_MS } from '../src/aiMonitor.js';

const memStorage = () => { const m = new Map(); return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, m }; };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const clock = (...times) => { let i = 0; return () => times[Math.min(i++, times.length - 1)]; };

test('verificação: ok rápido, lenta e sem resposta', async () => {
  const ok = await probeAi({}, { handle: async () => reply(200, { model: 'm1', choices: [{ message: { content: '{"ok":true}' } }] }), now: clock(0, 4000) });
  assert.deepEqual([ok.ok, ok.slow, ok.model, ok.ms], [true, false, 'm1', 4000]);
  const slow = await probeAi({}, { handle: async () => reply(200, { model: 'm1', choices: [{ message: { content: 'ok' } }] }), now: clock(0, SLOW_MS + 1) });
  assert.deepEqual([slow.ok, slow.slow], [false, true]);
  const down = await probeAi({}, { handle: async () => reply(502, { error: 'x', upstreamStatus: 404 }), now: clock(0, 300) });
  assert.deepEqual([down.ok, down.slow, down.status, down.upstream], [false, false, 502, 404]);
  const thrown = await probeAi({}, { handle: async () => { throw new Error('rede'); }, now: clock(0, 10) });
  assert.equal(thrown.status, 0);
});

test('alerta: 2 falhas seguidas para avisar, lembra só depois de 1 dia, avisa quando volta; aviso não entregue tenta de novo', async () => {
  const st = memStorage();
  const bad = { ok: false }; const good = { ok: true };
  const step = async (result, now, ack = true) => { const r = await recordHealth(st, { result, now }); if (r.alert && ack) await ackHealth(st, { alert: r.alert, now }); return r.alert; };
  assert.equal(await step(good, 0), null);
  assert.equal(await step(bad, 1), null);                    // uma oscilação: não avisa
  assert.equal(await step(good, 2), null);
  assert.equal(await step(bad, 3), null);
  assert.equal(await step(bad, 4, false), 'down');           // 2ª falha seguida: avisa (mas não chegou a nenhum aparelho)
  assert.equal(await step(bad, 5), 'down');                  // tenta de novo e agora chega
  assert.equal(await step(bad, 6), null);                    // continua ruim: não repete no mesmo dia
  assert.equal(await step(bad, 5 + REMIND_MS), 'down');      // lembra depois de 1 dia
  assert.equal(await step(good, 2 * REMIND_MS), 'up');
  assert.equal(await step(good, 3 * REMIND_MS), null);
  assert.equal(st.m.get('history').length, 10);
});

function fakeEnv() {
  const boxes = new Map(); const sent = [];
  const env = {
    ALERT_UIDS: 'admin1, x:invalido',
    PUSH_BOX: {
      idFromName: (n) => n,
      get: (id) => ({
        fetch: async (url, init) => {
          const op = new URL(url).pathname.slice(1); const data = JSON.parse(init.body || '{}');
          if (!boxes.has(id)) boxes.set(id, memStorage());
          if (op === 'health') return reply(200, await recordHealth(boxes.get(id), data));
          if (op === 'health-ack') return reply(200, await ackHealth(boxes.get(id), data));
          if (op === 'health-read') return reply(200, { history: (await boxes.get(id).get('history')) || [] });
          if (op === 'test') { sent.push({ id, payload: data.payload }); return reply(200, { sent: 1 }); }
          return reply(404, {});
        }
      })
    }
  };
  return { env, sent };
}

test('monitor: IA fora (2 verificações) manda push só para os administradores válidos; ao voltar, avisa de novo', async () => {
  const { env, sent } = fakeEnv();
  const down = { handle: async () => reply(504, { error: 'tempo' }) };
  await monitorAi(env, down);
  assert.equal(sent.length, 0);
  await monitorAi(env, down);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, 'admin1');
  assert.match(sent[0].payload.title, /IA com problema/);
  await monitorAi(env, down);
  assert.equal(sent.length, 1);                                                          // não repete no mesmo dia
  await monitorAi(env, { handle: async () => reply(200, { model: 'm1', choices: [{ message: { content: 'OK' } }] }) });
  assert.equal(sent.length, 2);
  assert.match(sent[1].payload.title, /normalizada/);
});

test('histórico: só administradores de ALERT_UIDS leem', async () => {
  const { env } = fakeEnv();
  const req = (tok) => new Request('https://x/api/ai-health', { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
  const verify = async (t) => { if (t === 'adm') return { sub: 'admin1' }; if (t === 'aluno') return { sub: 'stu' }; throw new Error('x'); };
  assert.equal((await handleAiHealth(req(), env, { verify })).status, 401);
  assert.equal((await handleAiHealth(req('lixo'), env, { verify })).status, 401);
  assert.equal((await handleAiHealth(req('aluno'), env, { verify })).status, 403);
  const ok = await handleAiHealth(req('adm'), env, { verify });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).history, []);
});
