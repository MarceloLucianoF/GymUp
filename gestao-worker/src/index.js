import { ApiError, ROLES, STAFF_ROLES, errorResponse, okResponse } from './contracts.js';
import { authenticate, requireAccess } from './guard.js';
import { firestoreClient, ID_RE } from './firestore.js';

const RATE = { windowMs: 60_000, ip: 60, user: 60, academy: 300, maxEntries: 5000 };
const memory = new Map();

export const resetRateLimit = () => memory.clear();

// Limite durável da Cloudflare (binding) quando existir; sem binding (testes, dev) cai no contador em memória.
async function limited(binding, key, max, now) {
  if (binding && typeof binding.limit === 'function') {
    try { return !(await binding.limit({ key })).success; } catch { /* cai no contador em memória */ }
  }
  if (memory.size > RATE.maxEntries) for (const [k, e] of memory) if (now - e.start >= RATE.windowMs) memory.delete(k);
  const entry = memory.get(key);
  if (!entry || now - entry.start >= RATE.windowMs) { memory.set(key, { start: now, count: 1 }); return false; }
  if (entry.count >= max) return true;
  entry.count += 1;
  return false;
}

const PUBLIC_MEMBER = (m) => ({ userId: m.userId, role: m.role, status: m.status, displayName: m.displayName || '' });

export async function handleRequest(request, env, deps = {}) {
  const requestId = (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2));
  const now = deps.now ?? Date.now();
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = new Set(String(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean));
  if (origin && !allowed.has(origin)) return errorResponse('origin_not_allowed', requestId);
  const cors = origin ? {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key', Vary: 'Origin'
  } : {};
  const fail = (code) => errorResponse(code, requestId, cors);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const isRead = request.method === 'GET';
    if (!isRead && env.ADMIN_OPS_ENABLED !== 'true') return fail('ops_disabled');   // kill switch (nenhuma rota escreve ainda)

    // Rota pública: não toca no banco nem exige token.
    if (path === '/v1/health') {
      if (!isRead) return fail('method_not_allowed');
      return okResponse({ status: 'ok', service: 'bohtreinar-academy-worker' }, requestId, cors);
    }
    if (!path.startsWith('/v1/')) return fail('not_found');

    // Sem o cabeçalho, todos caem na mesma chave (não abre brecha no limite).
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await limited(env.GESTAO_IP_LIMIT, `ip:${ip}`, RATE.ip, now)) return fail('rate_limited');   // antes do token

    const ctx = await authenticate(request, env, deps);
    ctx.projectId = env.FIREBASE_PROJECT_ID;
    if (await limited(env.GESTAO_USER_LIMIT, `uid:${ctx.uid}`, RATE.user, now)) return fail('rate_limited');

    if (path === '/v1/me') {
      if (!isRead) return fail('method_not_allowed');
      const db = firestoreClient({ projectId: ctx.projectId, idToken: ctx.idToken, fetchImpl: deps.fetchImpl });
      const rows = (await db.queryEquals('academyMembers', 'userId', ctx.uid, 50)) || [];
      const memberships = [];
      const mine = rows.filter((r) => r.userId === ctx.uid && ROLES.includes(r.role) && ID_RE.test(String(r.academyId)));
      for (const m of mine) {
        const academy = m.status === 'active' ? await db.getDoc('academies', m.academyId) : null;
        memberships.push({ academyId: m.academyId, role: m.role, status: m.status, academy: academy ? { name: academy.name, status: academy.status } : null });
      }
      return okResponse({ uid: ctx.uid, email: ctx.email, memberships, truncated: rows.length >= 50 }, requestId, cors);
    }

    const m = path.match(/^\/v1\/academies\/([A-Za-z0-9_]{1,40})(\/members)?$/);
    if (m) {
      if (!isRead) return fail('method_not_allowed');
      const academyId = m[1];
      const { membership, academy, db } = await requireAccess(ctx, academyId, m[2] ? STAFF_ROLES : null, deps);
      // Só quem tem vínculo consome o limite da academia (um estranho não esgota o limite de outra).
      if (await limited(env.GESTAO_ACADEMY_LIMIT, `ac:${academyId}`, RATE.academy, now)) return fail('rate_limited');
      if (!m[2]) return okResponse({ academyId, name: academy.name, status: academy.status, myRole: membership.role }, requestId, cors);
      const rows = (await db.queryEquals('academyMembers', 'academyId', academyId, 200)) || [];
      return okResponse({ academyId, members: rows.filter((r) => r.academyId === academyId).map(PUBLIC_MEMBER) }, requestId, cors);
    }
    return fail('not_found');
  } catch (error) {
    if (error instanceof ApiError) return fail(error.code);
    console.error('Falha inesperada:', error?.name, requestId);
    return fail('upstream_error');
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };
