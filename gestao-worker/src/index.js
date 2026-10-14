import { ApiError, STAFF_ROLES, errorResponse, okResponse } from './contracts.js';
import { authenticate, requireAccess } from './guard.js';
import { MAX_OWNED_ACADEMIES, countOwned, createAcademy, getIdempotent, listMembers, listMemberships, newId, nowIso, sha256Hex } from './db.js';

const RATE = { windowMs: 60_000, ip: 60, user: 60, academy: 300, maxEntries: 5000 };
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

const PUBLIC_MEMBER = (m) => ({ userId: m.user_id, role: m.role, status: m.status, displayName: m.display_name || '' });
const MAX_BODY_BYTES = 8 * 1024;

// Corpo JSON com esquema fechado: campo desconhecido (inclusive role, userId, academyId, createdBy) é erro, nunca autoridade.
async function readBody(request, allowed) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new ApiError('payload_too_large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new ApiError('payload_too_large');
  let body;
  try { body = JSON.parse(raw); } catch { throw new ApiError('invalid_request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !allowed.includes(k))) throw new ApiError('invalid_request');
  return body;
}

const membershipView = (r) => ({ academyId: r.academy_id, role: r.role, status: r.status, academy: { name: r.academy_name, status: r.academy_status } });

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
    if (!isRead && env.ADMIN_OPS_ENABLED !== 'true') return fail('ops_disabled');   // kill switch: toda escrita

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
    if (await limited(env.GESTAO_USER_LIMIT, `uid:${ctx.uid}`, RATE.user, now)) return fail('rate_limited');
    const db = env.DB;
    const newIdFn = deps.newId || newId;

    if (path === '/v1/me') {
      if (!isRead) return fail('method_not_allowed');
      const { rows, truncated } = await listMemberships(db, ctx.uid);
      return okResponse({ uid: ctx.uid, email: ctx.email || null, memberships: rows.map(membershipView), truncated }, requestId, cors);
    }

    if (path === '/v1/academies') {
      if (isRead) {
        const { rows, truncated } = await listMemberships(db, ctx.uid);
        return okResponse({ academies: rows.map((r) => ({ academyId: r.academy_id, name: r.academy_name, status: r.academy_status, myRole: r.role, myStatus: r.status })), truncated }, requestId, cors);
      }
      if (request.method !== 'POST') return fail('method_not_allowed');
      const key = request.headers.get('Idempotency-Key') || '';
      if (key.length < 8 || key.length > 64 || !/^[A-Za-z0-9_.:-]+$/.test(key)) return fail('idempotency_required');
      const body = await readBody(request, ['name']);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length < 2 || name.length > 80) return fail('invalid_request');
      const scope = `user_${ctx.uid}`;
      const requestHash = await sha256Hex(JSON.stringify({ name }));
      const saved = await getIdempotent(db, scope, key);
      if (saved) {
        if (saved.request_hash !== requestHash) return fail('conflict');
        return okResponse(JSON.parse(saved.response_json), requestId, cors);   // repetição: mesmo resultado, nada novo é gravado
      }
      if (await countOwned(db, ctx.uid) >= MAX_OWNED_ACADEMIES) return fail('limit_reached');
      const id = newIdFn(24);
      const response = { academyId: id, name, status: 'active', myRole: 'owner' };
      try {
        await createAcademy(db, {
          id, auditId: newIdFn(24), name, uid: ctx.uid, displayName: (ctx.name || '').slice(0, 80), email: ctx.emailVerified ? (ctx.email || '').slice(0, 200) : '',
          scope, key, requestHash, response, now: nowIso(now)
        });
      } catch (error) {
        // Mesma chave em paralelo: a outra requisição ganhou a corrida. Devolve o resultado salvo se for o mesmo pedido.
        const winner = await getIdempotent(db, scope, key).catch(() => null);
        if (winner && winner.request_hash === requestHash) return okResponse(JSON.parse(winner.response_json), requestId, cors);
        throw error;
      }
      return okResponse(response, requestId, cors);
    }

    const m = path.match(/^\/v1\/academies\/([A-Za-z0-9_]{1,40})(\/members)?$/);
    if (m) {
      if (!isRead) return fail('method_not_allowed');
      const academyId = m[1];
      const { membership, academy } = await requireAccess(db, ctx, academyId, m[2] ? STAFF_ROLES : null);
      // Só quem tem vínculo consome o limite da academia (um estranho não esgota o limite de outra).
      if (await limited(env.GESTAO_ACADEMY_LIMIT, `ac:${academyId}`, RATE.academy, now)) return fail('rate_limited');
      if (!m[2]) return okResponse({ academyId, name: academy.name, status: academy.status, myRole: membership.role }, requestId, cors);
      return okResponse({ academyId, members: (await listMembers(db, academyId)).map(PUBLIC_MEMBER) }, requestId, cors);
    }
    return fail('not_found');
  } catch (error) {
    if (error instanceof ApiError) return fail(error.code);
    console.error('Falha inesperada:', error?.name, requestId);
    return fail('upstream_error');
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };
