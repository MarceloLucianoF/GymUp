import { LIMITS, SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { INVITE_ROLES } from '../../../shared/academy-contracts/index.js';
import { ApiError, intParam, readBody } from '../http.js';
import { auditStmt, changed, getMember, guarded, nowIso, sha256Hex } from '../db.js';
import { canInviteRole, requireAccess } from '../authz.js';
import { runIdempotent } from './common.js';

const DAY = 86_400_000;
const statusOf = (i, nowStr) => (i.revoked ? 'revoked' : i.expires_at <= nowStr ? 'expired' : i.uses >= i.max_uses ? 'exhausted' : 'active');
const view = (i, nowStr) => ({ inviteId: i.id, role: i.role, maxUses: i.max_uses, uses: i.uses, expiresAt: i.expires_at, status: statusOf(i, nowStr), createdAt: i.created_at, createdByName: i.creator_name || '' });

export async function create(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'reception']);
  const body = await readBody(ctx.request, SCHEMAS.createInvite);
  if (!canInviteRole(membership.role, body.role)) throw new ApiError('forbidden_role');
  const maxUses = body.maxUses ?? 1;
  const days = body.expiresInDays ?? 7;
  const code = ctx.newId(32);
  const id = ctx.newId(24);
  const codeHash = await sha256Hex(code);
  const expiresAt = nowIso(ctx.now + days * DAY);
  return runIdempotent(ctx, `${academyId}|${ctx.user.uid}`, { role: body.role, maxUses, days }, async () => ({
    stmts: [
      ctx.db.prepare('INSERT INTO academy_invites (id, academy_id, code_hash, role, max_uses, uses, expires_at, revoked, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)')
        .bind(id, academyId, codeHash, body.role, maxUses, expiresAt, ctx.user.uid, ctx.nowIso, ctx.nowIso),
      auditStmt(ctx.db, ctx, { academyId, action: 'invite.created', targetType: 'invite', targetId: id, detail: body.role })
    ],
    response: { inviteId: id, code, role: body.role, maxUses, expiresAt },   // o código aparece só agora
    storable: { inviteId: id, code: null, role: body.role, maxUses, expiresAt, replayed: true }   // o código em texto puro nunca fica no banco
  }));
}

export async function list(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'reception']);
  const pageSize = intParam(ctx.url, 'pageSize', 25, 1, LIMITS.pageSizeMax);
  const page = intParam(ctx.url, 'page', 1, 1, 1000);
  const roles = INVITE_ROLES[membership.role];   // lista fixa da política: cada função só vê os papéis que pode convidar
  const marks = roles.map(() => '?').join(', ');
  const total = await guarded(async () => (await ctx.db.prepare(`SELECT count(*) AS n FROM academy_invites WHERE academy_id = ? AND role IN (${marks})`).bind(academyId, ...roles).first()).n);
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT i.id, i.role, i.max_uses, i.uses, i.expires_at, i.revoked, i.created_at, c.display_name AS creator_name
       FROM academy_invites i LEFT JOIN academy_members c ON c.academy_id = i.academy_id AND c.user_id = i.created_by
      WHERE i.academy_id = ? AND i.role IN (${marks}) ORDER BY i.updated_at DESC, i.rowid DESC LIMIT ? OFFSET ?`
  ).bind(academyId, ...roles, pageSize, (page - 1) * pageSize).all());
  return { academyId, page, pageSize, total, invites: results.map((i) => view(i, ctx.nowIso)) };
}

export async function revoke(ctx) {
  const { academyId, id } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'reception']);
  await readBody(ctx.request, SCHEMAS.empty);
  const invite = await guarded(() => ctx.db.prepare('SELECT id, role, revoked FROM academy_invites WHERE academy_id = ? AND id = ?').bind(academyId, id).first());
  if (!invite) throw new ApiError('not_found');                                      // convite de outra academia também cai aqui
  if (!canInviteRole(membership.role, invite.role)) throw new ApiError('forbidden_role');   // admin não mexe em convite de admin; recepção só de aluno
  if (invite.revoked === 1) return { inviteId: id, revoked: true };                  // já revogado: nada a gravar
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare('UPDATE academy_invites SET revoked = 1, updated_at = ? WHERE academy_id = ? AND id = ? AND revoked = 0').bind(ctx.nowIso, academyId, id),
    auditStmt(ctx.db, ctx, { academyId, action: 'invite.revoked', targetType: 'invite', targetId: id, detail: invite.role }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { inviteId: id, revoked: true };
}

const usable = (i, nowStr) => i && i.revoked === 0 && i.uses < i.max_uses && i.expires_at > nowStr && i.academy_status === 'active';
async function findInvite(ctx) {
  const { code } = await readBody(ctx.request, SCHEMAS.inviteCode).catch(() => { throw new ApiError('invite_invalid'); });   // formato errado: o mesmo erro de inexistente
  const invite = await guarded(async () => ctx.db.prepare(
    `SELECT i.id, i.academy_id, i.role, i.max_uses, i.uses, i.expires_at, i.revoked, a.name AS academy_name, a.status AS academy_status
       FROM academy_invites i JOIN academies a ON a.id = i.academy_id
      WHERE i.code_hash = ?
        AND EXISTS (SELECT 1 FROM academy_members cr WHERE cr.academy_id = i.academy_id AND cr.user_id = i.created_by AND cr.status = 'active'
            AND (cr.role = 'owner' OR (cr.role = 'admin' AND i.role <> 'admin') OR (cr.role = 'reception' AND i.role = 'student')))`
  ).bind(await sha256Hex(code)).first());
  if (!usable(invite, ctx.nowIso)) throw new ApiError('invite_invalid');   // inexistente, revogado, expirado, esgotado ou academia suspensa: sempre o mesmo erro
  return invite;
}

// Prévia: mostra academia e papel SEM consumir o uso.
export async function preview(ctx) {
  const invite = await findInvite(ctx);
  return { academyName: invite.academy_name, role: invite.role, expiresAt: invite.expires_at };
}

/**
 * Aceite em UM batch. A primeira instrução é o portão: só soma o uso se o convite está válido (não revogado, não expirado, com vagas,
 * academia ativa, e quem o criou ainda ativo e com permissão para aquele papel) E o usuário não tem vínculo que o impeça (ativo, pendente, suspenso, ou removido por outra pessoa). As demais só gravam
 * se o portão passou (changes() = 1) e tiram academia e papel da LINHA DO CONVITE. Quem volta depois de sair perde permissões antigas.
 */
export async function accept(ctx) {
  const invite = await findInvite(ctx);
  const current = await getMember(ctx.db, invite.academy_id, ctx.user.uid);
  if (current && current.status === 'active') throw new ApiError('already_member');
  if (current && !(current.status === 'removed' && current.removed_by === ctx.user.uid)) throw new ApiError('conflict');   // suspenso, pendente ou removido pela equipe não volta por convite
  const { db } = ctx;
  const results = await guarded(() => db.batch([
    db.prepare(
      `UPDATE academy_invites SET uses = uses + 1, updated_at = ?
        WHERE id = ? AND revoked = 0 AND uses < max_uses AND expires_at > ?
          AND EXISTS (SELECT 1 FROM academies a WHERE a.id = academy_invites.academy_id AND a.status = 'active')
          AND EXISTS (SELECT 1 FROM academy_members cr WHERE cr.academy_id = academy_invites.academy_id AND cr.user_id = academy_invites.created_by AND cr.status = 'active'
            AND (cr.role = 'owner' OR (cr.role = 'admin' AND academy_invites.role <> 'admin') OR (cr.role = 'reception' AND academy_invites.role = 'student')))
          AND NOT EXISTS (SELECT 1 FROM academy_members m WHERE m.academy_id = academy_invites.academy_id AND m.user_id = ? AND NOT (m.status = 'removed' AND m.removed_by = m.user_id))`
    ).bind(ctx.nowIso, invite.id, ctx.nowIso, ctx.user.uid),
    db.prepare(
      `INSERT INTO academy_members (academy_id, user_id, role, status, display_name, created_at, updated_at)
       SELECT i.academy_id, ?, i.role, 'active', ?, ?, ? FROM academy_invites i WHERE i.id = ? AND changes() = 1
       ON CONFLICT (academy_id, user_id) DO UPDATE SET role = excluded.role, status = 'active', display_name = excluded.display_name, can_create_trainings = 0, branch_id = NULL,
         removed_at = NULL, removed_by = NULL, suspended_at = NULL, updated_at = excluded.updated_at`
    ).bind(ctx.user.uid, ctx.user.name, ctx.nowIso, ctx.nowIso, invite.id),
    db.prepare(
      `INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id)
       SELECT ?, i.academy_id, ?, 'member.joined', 'member', ?, i.role, ?, ? FROM academy_invites i WHERE i.id = ? AND changes() = 1`
    ).bind(ctx.newId(24), ctx.user.uid, ctx.user.uid, ctx.nowIso, ctx.requestId, invite.id)
  ]));
  if (!changed(results)) throw new ApiError('invite_invalid');   // perdeu a corrida pelo último uso
  return { academyId: invite.academy_id, academyName: invite.academy_name, role: invite.role };
}
