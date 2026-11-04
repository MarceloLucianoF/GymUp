// Monitor da IA: a cada 6 h (cron do Worker) faz um pedido de teste pelo mesmo caminho do app (modo auto, chave do Worker),
// guarda o histórico num Durable Object e avisa por push os administradores de ALERT_UIDS quando a IA cai ou fica lenta,
// e de novo quando volta. GET /api/ai-health (só para ALERT_UIDS) devolve o histórico.
import { handleNvidiaRequest } from './nvidiaProxy.js';
import { verifyFirebaseIdToken } from '../../shared/firebaseAuth.js';

export const SLOW_MS = 20_000;                 // pedido curto acima disso já é problema para o app
export const REMIND_MS = 24 * 3600 * 1000;     // ainda com problema: lembra no máximo 1 vez por dia
export const HISTORY_MAX = 60;                 // ~15 dias de verificações a cada 6 h
const HEALTH_BOX = 'sys:ai-health';            // ':' não é aceito em uid de usuário: sem colisão com os DOs de push

const alertUids = (env) => String(env.ALERT_UIDS || '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,128}$/.test(s));
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Um pedido de teste pelo proxy, sem token de usuário (identidade interna "sys:ai-monitor": ':' não existe em uid real). */
export async function probeAi(env, { handle = handleNvidiaRequest, now = Date.now, fetchImpl } = {}) {
  const request = new Request('https://monitor.internal/api/nvidia', {
    method: 'POST',
    headers: { Authorization: 'Bearer monitor', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'Responda só com o JSON {"ok":true}' }], temperature: 0.1, max_tokens: 300 })
  });
  const startedAt = now();
  let status = 0; let model = null; let upstream = null; let content = '';
  try {
    const res = await handle(request, env, { verify: async () => ({ sub: 'sys:ai-monitor' }), ...(fetchImpl ? { fetchImpl } : {}) });
    status = res.status;
    const data = await res.json().catch(() => ({}));
    model = data.model || null; upstream = data.upstreamStatus ?? null;
    content = String(data.choices?.[0]?.message?.content || '');
  } catch (_) { status = 0; }
  const ms = now() - startedAt;
  const answered = status === 200 && /ok/i.test(content);
  return { at: new Date(startedAt).toISOString(), status, upstream, model, ms, ok: answered && ms <= SLOW_MS, slow: answered && ms > SLOW_MS };
}

export const describe = (r) => (r.ok ? `ok em ${(r.ms / 1000).toFixed(1)} s (${r.model})`
  : r.slow ? `lenta: ${(r.ms / 1000).toFixed(1)} s (${r.model})`
    : `sem resposta: HTTP ${r.status}${r.upstream ? ` (NVIDIA ${r.upstream})` : ''} em ${(r.ms / 1000).toFixed(1)} s`);

/** Roda a verificação, grava e avisa se o estado mudou (ou se continua ruim há 1 dia). */
export async function monitorAi(env, deps = {}) {
  const result = await probeAi(env, deps);
  console.log(JSON.stringify({ event: 'ai_monitor', ...result }));
  const box = env.PUSH_BOX.get(env.PUSH_BOX.idFromName(HEALTH_BOX));
  const res = await box.fetch('https://push-box/health', { method: 'POST', body: JSON.stringify({ result, now: Date.now() }) });
  const { alert } = await res.json();
  if (alert) {
    const payload = alert === 'down'
      ? { kind: 'alert', title: 'BohTreinar: IA com problema', body: `Verificação automática: ${describe(result)}. Os alunos podem estar vendo tempo esgotado.`, url: '/admin', tag: 'bt-ai-health' }
      : { kind: 'alert', title: 'BohTreinar: IA normalizada', body: `A IA voltou: ${describe(result)}.`, url: '/admin', tag: 'bt-ai-health' };
    let delivered = 0;
    for (const uid of alertUids(env)) {
      try {
        const r = await env.PUSH_BOX.get(env.PUSH_BOX.idFromName(uid)).fetch('https://push-box/test', { method: 'POST', body: JSON.stringify({ payload }) });
        delivered += Number((await r.json()).sent) || 0;
      } catch (e) { console.warn('Alerta da IA não entregue:', e?.message || e); }
    }
    if (delivered > 0) await box.fetch('https://push-box/health-ack', { method: 'POST', body: JSON.stringify({ alert, now: Date.now() }) });
    else console.warn('Alerta da IA sem aparelho para receber: ative as notificações na conta de administrador.');
  }
  return { result, alert: alert || null };
}

/**
 * Estado guardado no DO (op 'health'): decide se avisa. Só considera "fora" com 2 falhas seguidas (uma oscilação não alerta).
 * O aviso só conta como dado depois de entregue (op 'health-ack'): se não chegou a nenhum aparelho, tenta de novo na próxima.
 */
export async function recordHealth(storage, { result, now }) {
  const history = [result, ...((await storage.get('history')) || [])].slice(0, HISTORY_MAX);
  await storage.put('history', history);
  const fails = result.ok ? 0 : ((await storage.get('fails')) || 0) + 1;
  await storage.put('fails', fails);
  const prev = (await storage.get('state')) || 'ok';
  const state = fails >= 2 ? 'down' : result.ok ? 'ok' : prev;
  await storage.put('state', state);
  const notified = (await storage.get('notified')) || 'ok';
  const lastAlertAt = (await storage.get('lastAlertAt')) || 0;
  let alert = null;
  if (state === 'down' && (notified !== 'down' || now - lastAlertAt >= REMIND_MS)) alert = 'down';
  if (state === 'ok' && notified === 'down') alert = 'up';
  return { state, alert, fails, history };
}

/** op 'health-ack': o aviso chegou a pelo menos um aparelho. */
export async function ackHealth(storage, { alert, now }) {
  await storage.put('notified', alert === 'down' ? 'down' : 'ok');
  await storage.put('lastAlertAt', now);
  return { ok: true };
}

/** GET /api/ai-health: histórico para os administradores (painel, Claude ou MCP). */
export async function handleAiHealth(request, env, { verify = verifyFirebaseIdToken, fetchImpl = fetch } = {}) {
  if (request.method !== 'GET') return json(405, { error: 'Método não permitido.' });
  const match = /^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '');
  if (!match) return json(401, { error: 'Sem sessão.' });
  let claims;
  try { claims = await verify(match[1], { projectId: env.FIREBASE_PROJECT_ID, fetchImpl }); } catch { return json(401, { error: 'Sessão inválida.' }); }
  if (!alertUids(env).includes(claims.sub)) return json(403, { error: 'Apenas administradores.' });
  const res = await env.PUSH_BOX.get(env.PUSH_BOX.idFromName(HEALTH_BOX)).fetch('https://push-box/health-read', { method: 'POST', body: '{}' });
  return json(200, await res.json());
}
