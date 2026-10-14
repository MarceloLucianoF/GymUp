import { ApiError, STAFF_ROLES, errorResponse, okResponse } from './contracts.js';
import { authenticate, requireAccess } from './guard.js';
import { MAX_OWNED_ACADEMIES, acceptInvite, countOwned, createAcademy, createInvite, getIdempotent, getInvite, getInviteByHash, getMember, leaveAcademy, listAudit, listInvites, listMembers, listMemberships, newId, nowIso, revokeInvite, sha256Hex, updateMember } from './db.js';
import { INVITE_ACTORS, INVITE_ROLES, ROLE_VALUES, canChangeMember } from './policy.js';

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
  try { body = raw.trim() === '' ? {} : JSON.parse(raw); } catch { throw new ApiError('invalid_request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !allowed.includes(k))) throw new ApiError('invalid_request');
  return body;
}

const INVITE_VIEW = (i) => ({ inviteId: i.id, role: i.role, maxUses: i.max_uses, uses: i.uses, expiresAt: i.expires_at, revoked: i.revoked === 1, createdBy: i.created_by, createdAt: i.created_at });
const CODE_RE = /^[a-z0-9]{32}$/;
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
    // Kill switch: toda escrita, exceto sair da academia (reduz acesso a dados; um incidente não pode prender o usuário).
    const exempt = /^\/v1\/me\/academies\/[A-Za-z0-9_]{1,40}\/leave$/.test(path);
    if (!isRead && !exempt && env.ADMIN_OPS_ENABLED !== 'true') return fail('ops_disabled');

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

    // ---------- escopo do aluno / usuário: convites e saída ----------
    // O código vai no CORPO (POST), não na URL: URLs aparecem em logs de proxy e da Cloudflare.
    if (path === '/v1/invites/preview' || path === '/v1/invites/accept') {
      if (request.method !== 'POST') return fail('method_not_allowed');
      const { code } = await readBody(request, ['code']);
      if (typeof code !== 'string' || !CODE_RE.test(code)) return fail('invite_invalid');   // qualquer formato errado: o mesmo erro
      const invite = await getInviteByHash(db, await sha256Hex(code));
      const nowStr = nowIso(now);
      const usable = invite && invite.revoked === 0 && invite.uses < invite.max_uses && invite.expires_at > nowStr && invite.academy_status === 'active';
      if (!usable) return fail('invite_invalid');   // mesmo erro para inexistente, revogado, expirado e esgotado: não revela qual
      if (path === '/v1/invites/preview') return okResponse({ academyName: invite.academy_name, role: invite.role, expiresAt: invite.expires_at }, requestId, cors);
      const current = await getMember(db, invite.academy_id, ctx.uid);
      if (current && current.status !== 'left') return fail(current.status === 'active' ? 'already_member' : 'conflict');   // suspenso ou removido não volta por convite
      const accepted = await acceptInvite(db, {
        inviteId: invite.id, uid: ctx.uid, displayName: (ctx.name || '').slice(0, 80),
        email: ctx.emailVerified ? (ctx.email || '').slice(0, 200) : '', auditId: newIdFn(24), now: nowStr
      });
      if (!accepted) return fail('invite_invalid');   // perdeu a corrida pelo último uso
      return okResponse({ academyId: invite.academy_id, academyName: invite.academy_name, role: invite.role }, requestId, cors);
    }

    const leave = path.match(/^\/v1\/me\/academies\/([A-Za-z0-9_]{1,40})\/leave$/);
    if (leave) {
      if (request.method !== 'POST') return fail('method_not_allowed');
      await readBody(request, []);
      const me = await getMember(db, leave[1], ctx.uid);
      if (!me || me.status === 'left' || me.status === 'removed') return fail('no_membership');
      if (me.status !== 'active') return fail('membership_inactive');   // suspenso não sai: não escapa da suspensão
      const left = await leaveAcademy(db, { academyId: leave[1], uid: ctx.uid, auditId: newIdFn(24), now: nowIso(now) });   // último dono: o banco recusa (conflict)
      if (!left) return fail('conflict');
      return okResponse({ academyId: leave[1], status: 'left' }, requestId, cors);
    }

    // ---------- escopo da gestão: convites, papéis, auditoria ----------
    const gest = path.match(/^\/v1\/academies\/([A-Za-z0-9_]{1,40})\/(invites|audit)(?:\/([A-Za-z0-9_]{1,64})\/(revoke))?$/);
    if (gest) {
      const academyId = gest[1];
      if (gest[2] === 'audit' && gest[3]) return fail('not_found');
      if (gest[2] === 'audit') {
        if (!isRead) return fail('method_not_allowed');
        await requireAccess(db, ctx, academyId, STAFF_ROLES);
        return okResponse({ academyId, entries: (await listAudit(db, academyId)).map((e) => ({ id: e.id, actorId: e.actor_id, action: e.action, targetType: e.target_type, targetId: e.target_id, detail: e.detail, at: e.at })) }, requestId, cors);
      }
      const { membership } = await requireAccess(db, ctx, academyId, INVITE_ACTORS);
      if (gest[4] === 'revoke') {
        if (request.method !== 'POST') return fail('method_not_allowed');
        await readBody(request, []);
        const invite = await getInvite(db, academyId, gest[3]);
        if (!invite) return fail('not_found');
        // recepção só gerencia convites de aluno; admin não mexe em convite de admin
        if (!INVITE_ROLES[membership.role].includes(invite.role)) return fail('forbidden_role');
        if (invite.revoked === 1) return okResponse({ inviteId: invite.id, revoked: true }, requestId, cors);   // já revogado: nada a gravar
        if (!(await revokeInvite(db, { academyId, inviteId: invite.id, auditId: newIdFn(24), uid: ctx.uid, now: nowIso(now) }))) return fail('conflict');
        return okResponse({ inviteId: invite.id, revoked: true }, requestId, cors);
      }
      if (isRead) return okResponse({ academyId, invites: (await listInvites(db, academyId, INVITE_ROLES[membership.role])).map(INVITE_VIEW) }, requestId, cors);
      if (request.method !== 'POST') return fail('method_not_allowed');
      const body = await readBody(request, ['role', 'maxUses', 'expiresInDays']);
      const maxUses = body.maxUses === undefined ? 1 : body.maxUses;
      const days = body.expiresInDays === undefined ? 7 : body.expiresInDays;
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500 || !Number.isInteger(days) || days < 1 || days > 30) return fail('invalid_request');
      if (typeof body.role !== 'string' || !ROLE_VALUES.includes(body.role)) return fail('invalid_request');
      if (!INVITE_ROLES[membership.role].includes(body.role)) return fail('forbidden_role');
      const code = newIdFn(32);
      const id = newIdFn(24);
      const expiresAt = nowIso(now + days * 86_400_000);
      await createInvite(db, { id, auditId: newIdFn(24), academyId, codeHash: await sha256Hex(code), role: body.role, maxUses, expiresAt, uid: ctx.uid, now: nowIso(now) });
      return okResponse({ inviteId: id, code, role: body.role, maxUses, expiresAt }, requestId, cors);   // o código só aparece agora; depois só o hash existe
    }

    const mrole = path.match(/^\/v1\/academies\/([A-Za-z0-9_]{1,40})\/members\/([A-Za-z0-9_-]{1,128})$/);
    if (mrole) {
      if (request.method !== 'POST') return fail('method_not_allowed');
      const academyId = mrole[1];
      const { membership } = await requireAccess(db, ctx, academyId, STAFF_ROLES);
      const body = await readBody(request, ['role', 'status']);
      if ((body.role !== undefined && !ROLE_VALUES.includes(body.role)) || (body.status !== undefined && typeof body.status !== 'string')) return fail('invalid_request');
      const target = await getMember(db, academyId, mrole[2]);
      if (!target) return fail('not_found');
      const verdict = canChangeMember({ userId: ctx.uid, role: membership.role }, target, body);
      if (verdict === 'empty' || verdict === 'status') return fail('invalid_request');
      if (verdict !== true) return fail('forbidden_role');
      const changed = await updateMember(db, {
        academyId, targetId: target.user_id, role: body.role ?? target.role, status: body.status ?? target.status,
        expectedRole: target.role, expectedStatus: target.status, actorRole: membership.role, auditId: newIdFn(24), uid: ctx.uid, now: nowIso(now)
      });
      if (!changed) return fail('conflict');   // o alvo ou o ator mudou entre a leitura e a escrita
      return okResponse({ userId: target.user_id, role: body.role ?? target.role, status: body.status ?? target.status }, requestId, cors);
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
