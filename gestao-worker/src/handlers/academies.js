import { ERRORS, INVITE_ROLES, LIMITS, MANAGEMENT_ROLES, SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, readBody } from '../http.js';
import { auditStmt, changed, getMember, guarded, listMemberships } from '../db.js';
import { requireAccess } from '../authz.js';
import { runIdempotent } from './common.js';

const view = (r) => ({ academyId: r.academy_id, name: r.academy_name, status: r.academy_status, myRole: r.role, myStatus: r.status });

export async function me(ctx) {
  const { rows, truncated } = await listMemberships(ctx.db, ctx.user.uid);
  return { uid: ctx.user.uid, memberships: rows.map((r) => ({ academyId: r.academy_id, role: r.role, status: r.status, canCreateTrainings: r.role === 'coach' ? r.can_create_trainings === 1 : undefined, academy: { name: r.academy_name, status: r.academy_status } })), truncated };
}

export async function listMine(ctx) {
  const { rows, truncated } = await listMemberships(ctx.db, ctx.user.uid);
  return { academies: rows.map(view), truncated };
}

export async function create(ctx) {
  const body = await readBody(ctx.request, SCHEMAS.createAcademy);
  return runIdempotent(ctx, `user|${ctx.user.uid}`, { name: body.name }, async () => {
    const owned = await guarded(async () => (await ctx.db.prepare("SELECT count(*) AS n FROM academy_members WHERE user_id = ? AND role = 'owner' AND status = 'active'").bind(ctx.user.uid).first()).n);
    if (owned >= LIMITS.maxOwnedAcademies) throw new ApiError('limit_reached');   // o banco também garante (gatilho), isto só dá a resposta amigável
    const id = ctx.newId(24);
    const { db } = ctx;
    return {
      stmts: [
        db.prepare('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, body.name, 'active', ctx.nowIso, ctx.nowIso),
        db.prepare("INSERT INTO academy_members (academy_id, user_id, role, status, display_name, created_at, updated_at) VALUES (?, ?, 'owner', 'active', ?, ?, ?)").bind(id, ctx.user.uid, ctx.user.name, ctx.nowIso, ctx.nowIso),
        auditStmt(db, ctx, { academyId: id, action: 'academy.created', targetType: 'academy', targetId: id })
      ],
      response: { academyId: id, name: body.name, status: 'active', myRole: 'owner' }
    };
  });
}

export async function get(ctx) {
  const { membership, academy } = await requireAccess(ctx, ctx.params.academyId);
  return { academyId: academy.id, name: academy.name, status: academy.status, myRole: membership.role };
}

export async function profile(ctx) {
  const { membership, academy } = await requireAccess(ctx, ctx.params.academyId);
  return { academyId: academy.id, name: academy.name, description: academy.description, contactEmail: academy.contact_email, status: academy.status, createdAt: academy.created_at, myRole: membership.role };
}

export async function update(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin']);
  const body = await readBody(ctx.request, SCHEMAS.updateAcademy);
  if (body.name !== undefined && membership.role !== 'owner') throw new ApiError('forbidden_role');   // só o dono renomeia
  const columns = { name: 'name', description: 'description', contactEmail: 'contact_email' };
  const sets = Object.keys(body).map((k) => `${columns[k]} = ?`);
  const stmts = [
    ctx.db.prepare(`UPDATE academies SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND status = 'active'`).bind(...Object.values(body), ctx.nowIso, academyId),
    auditStmt(ctx.db, ctx, { academyId, action: 'academy.updated', targetType: 'academy', targetId: academyId, detail: Object.keys(body).join(',') }, true)
  ];
  const results = await guarded(() => ctx.db.batch(stmts));
  if (!changed(results)) throw new ApiError('conflict');
  return { academyId, updated: Object.keys(body) };
}

export async function dashboard(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'reception']);
  const one = (sql, ...p) => guarded(async () => (await ctx.db.prepare(sql).bind(...p).first()).n);
  const staff = membership.role !== 'reception';
  const [members, students, coaches, withoutCoach, pendingInvites, pendingAssignments, withoutTraining, outdated, activeTrainings] = await Promise.all([
    one("SELECT count(*) AS n FROM academy_members WHERE academy_id = ? AND status = 'active'", academyId),
    one("SELECT count(*) AS n FROM academy_members WHERE academy_id = ? AND status = 'active' AND role = 'student'", academyId),
    one("SELECT count(*) AS n FROM academy_members WHERE academy_id = ? AND status = 'active' AND role = 'coach'", academyId),
    one(`SELECT count(*) AS n FROM academy_members m WHERE m.academy_id = ? AND m.status = 'active' AND m.role = 'student'
           AND NOT EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active')`, academyId),
    one(`SELECT count(*) AS n FROM academy_invites WHERE academy_id = ? AND revoked = 0 AND uses < max_uses AND expires_at > ? AND role IN (${INVITE_ROLES[membership.role].map(() => '?').join(', ')})`, academyId, ctx.nowIso, ...INVITE_ROLES[membership.role]),
    staff ? one("SELECT count(*) AS n FROM coach_assignments WHERE academy_id = ? AND status IN ('proposed', 'pending_student')", academyId) : Promise.resolve(null),
    staff ? one(`SELECT count(*) AS n FROM academy_members m WHERE m.academy_id = ? AND m.status = 'active' AND m.role = 'student'
           AND NOT EXISTS (SELECT 1 FROM training_assignments a WHERE a.academy_id = m.academy_id AND a.student_uid = m.user_id)`, academyId) : Promise.resolve(null),
    staff ? one(`SELECT count(*) AS n FROM training_assignments a JOIN training_templates t ON t.id = a.template_id AND t.academy_id = a.academy_id
           JOIN academy_members m ON m.academy_id = a.academy_id AND m.user_id = a.student_uid AND m.status = 'active'
          WHERE a.academy_id = ? AND a.version < t.current_version`, academyId) : Promise.resolve(null),
    staff ? one("SELECT count(*) AS n FROM training_templates WHERE academy_id = ? AND status = 'active' AND current_version >= 1", academyId) : Promise.resolve(null)
  ]);
  const recent = staff ? (await guarded(() => ctx.db.prepare(
    `SELECT l.id, l.action, l.target_type, l.created_at, a.display_name AS actor_name
       FROM academy_audit_log l LEFT JOIN academy_members a ON a.academy_id = l.academy_id AND a.user_id = l.actor_uid
      WHERE l.academy_id = ? ORDER BY l.created_at DESC, l.rowid DESC LIMIT 5`).bind(academyId).all())).results : [];
  return {
    academyId, myRole: membership.role,
    counts: { members, students, coaches, studentsWithoutCoach: withoutCoach, pendingInvites, pendingAssignments, studentsWithoutTraining: withoutTraining, studentsOutdated: outdated, activeTrainings },
    recentActivity: recent.map((e) => ({ id: e.id, action: e.action, actorName: e.actor_name || '', at: e.created_at }))
  };
}

// Transferência de propriedade: só o dono, com confirmação explícita e Idempotency-Key. O alvo vira dono e quem transfere vira administrador.
export async function transferOwnership(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner']);
  const body = await readBody(ctx.request, SCHEMAS.transferOwnership);
  if (body.toUid === ctx.user.uid) throw new ApiError('invalid_request');
  return runIdempotent(ctx, `${academyId}|${ctx.user.uid}`, { toUid: body.toUid }, async () => {
    const target = await getMember(ctx.db, academyId, body.toUid);
    if (!target) throw new ApiError('not_found');
    if (target.status !== 'active' || !['admin', 'coach', 'reception'].includes(target.role)) throw new ApiError('conflict');
    const { db } = ctx;
    return {
      stmts: [
        db.prepare(`UPDATE academy_members SET role = 'owner', updated_at = ? WHERE academy_id = ? AND user_id = ? AND status = 'active' AND role = ?
                      AND EXISTS (SELECT 1 FROM academy_members WHERE academy_id = ? AND user_id = ? AND role = 'owner' AND status = 'active')`)
          .bind(ctx.nowIso, academyId, body.toUid, target.role, academyId, ctx.user.uid),
        db.prepare("UPDATE academy_members SET role = 'admin', updated_at = ? WHERE academy_id = ? AND user_id = ? AND role = 'owner' AND status = 'active' AND changes() = 1")
          .bind(ctx.nowIso, academyId, ctx.user.uid),
        auditStmt(db, ctx, { academyId, action: 'ownership.transferred', targetType: 'member', targetId: body.toUid, detail: `${target.role}>owner` }, true)
      ],
      response: { academyId, newOwner: body.toUid, myRole: 'admin' }
    };
  });
}

export const ROLE_SET = new Set(MANAGEMENT_ROLES);
export { ERRORS };
