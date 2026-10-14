import { errorResponse, okResponse, ApiError } from './http.js';
import { authenticate } from './authz.js';
import { newId, nowIso } from './db.js';
import { match } from './router.js';

const RATE = { windowMs: 60_000, ip: 60, user: 60, academy: 120, maxEntries: 5000 };
const memory = new Map();
export const resetRateLimit = () => memory.clear();

// Limite durável da Cloudflare (binding) quando existir; sem binding (testes, dev) cai no contador em memória.
async function limited(binding, key, max, now) {
  if (binding && typeof binding.limit === 'function') {
    try { return !(await binding.limit({ key })).success; } catch (error) { console.warn('Rate limit durável indisponível; usando contador em memória:', error?.name); }
  }
  if (memory.size > RATE.maxEntries) for (const [k, e] of memory) if (now - e.start >= RATE.windowMs) memory.delete(k);
  const entry = memory.get(key);
  if (!entry || now - entry.start >= RATE.windowMs) { memory.set(key, { start: now, count: 1 }); return false; }
  if (entry.count >= max) return true;
  entry.count += 1;
  return false;
}

export async function handleRequest(request, env, deps = {}) {
  const requestId = globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2);
  const now = deps.now ?? Date.now();
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = new Set(String(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean));
  if (origin && !allowed.has(origin)) return errorResponse('origin_not_allowed', requestId);
  const cors = origin ? {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key', 'Access-Control-Max-Age': '600', Vary: 'Origin'
  } : {};
  const fail = (code) => errorResponse(code, requestId, cors);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const { route, params, pathMatched } = match(request.method, pathname);
    if (!route) return fail(pathMatched ? 'method_not_allowed' : 'not_found');
    // Kill switch: toda escrita, exceto as rotas isentas.
    if (request.method !== 'GET' && !route.killSwitchExempt && env.ADMIN_OPS_ENABLED !== 'true') return fail('ops_disabled');
    // Rota pública: não toca no banco nem exige token; não revela nada interno.
    if (route.public) return okResponse({ status: 'ok', service: 'bohtreinar-academy-worker' }, requestId, cors);

    // Sem o cabeçalho, todos caem na mesma chave (não abre brecha no limite). O limite por IP vem antes do token.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await limited(env.GESTAO_IP_LIMIT, `ip:${ip}`, RATE.ip, now)) return fail('rate_limited');
    const user = await authenticate(request, env, deps);
    if (await limited(env.GESTAO_USER_LIMIT, `uid:${user.uid}`, RATE.user, now)) return fail('rate_limited');

    const ctx = {
      request, env, db: env.DB, user, params, url, requestId, now, nowIso: nowIso(now), deps,
      newId: deps.newId || newId,
      limited: (kind, key) => limited(env[`GESTAO_${kind.toUpperCase()}_LIMIT`], key, RATE[kind], now)
    };
    return okResponse(await route.handler(ctx), requestId, cors);
  } catch (error) {
    if (error instanceof ApiError) return fail(error.code);
    console.error('Falha inesperada:', error?.name, requestId);   // sem mensagem, token ou dado pessoal
    return fail('upstream_error');
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };
