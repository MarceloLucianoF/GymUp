import { LIMITS, MEMBER_STATUS, ROLES, SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, enumParam, intParam, readBody } from '../http.js';
import { auditStmt, changed, getMember, guarded } from '../db.js';
import { canChangeMember, requireAccess } from '../authz.js';
import { likeEscape } from './common.js';

// Lista de membros: owner/admin veem todos; recepção só alunos (operacional); coach não lista (vê só os próprios alunos aceitos).
export async function list(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'reception']);
  const url = ctx.url;
  const role = enumParam(url, 'role', ROLES);
  const status = enumParam(url, 'status', MEMBER_STATUS);
  const coach = url.searchParams.get('coach') || '';
  if (coach && coach !== 'none' && !/^[A-Za-z0-9_-]{1,128}$/.test(coach)) throw new ApiError('invalid_request');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const pageSize = intParam(url, 'pageSize', 25, 1, LIMITS.pageSizeMax);
  const page = intParam(url, 'page', 1, 1, 1000);
  if (membership.role === 'reception' && role && role !== 'student') throw new ApiError('forbidden_role');

  const where = ['m.academy_id = ?'];
  const params = [academyId];
  if (membership.role === 'reception') where.push("m.role = 'student'");
  if (role) { where.push('m.role = ?'); params.push(role); }
  if (status) { where.push('m.status = ?'); params.push(status); }
  if (q) { where.push("lower(m.display_name) LIKE ? ESCAPE '\\'"); params.push(`%${likeEscape(q.toLowerCase())}%`); }
  if (coach === 'none') where.push("m.role = 'student' AND NOT EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active')");
  else if (coach) { where.push("EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active' AND c.coach_uid = ?)"); params.push(coach); }
  const W = where.join(' AND ');
  const total = await guarded(async () => (await ctx.db.prepare(`SELECT count(*) AS n FROM academy_members m WHERE ${W}`).bind(...params).first()).n);
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT m.user_id, m.role, m.status, m.display_name, m.created_at, m.can_create_trainings,
            (SELECT c.coach_uid FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active') AS coach_uid,
            (SELECT c.id FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active') AS coach_assignment_id,
            (SELECT p.display_name FROM coach_assignments c JOIN academy_members p ON p.academy_id = c.academy_id AND p.user_id = c.coach_uid
               WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status = 'active') AS coach_name,
            (SELECT c.status FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status IN ('proposed', 'pending_student')) AS open_assignment,
            (SELECT c.id FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.status IN ('proposed', 'pending_student')) AS open_assignment_id
       FROM academy_members m WHERE ${W} ORDER BY m.display_name COLLATE NOCASE, m.user_id LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, (page - 1) * pageSize).all());
  return {
    academyId, page, pageSize, total,
    members: results.map((r) => ({
      userId: r.user_id, role: r.role, status: r.status, displayName: r.display_name, joinedAt: r.created_at,
      ...(r.role === 'coach' && membership.role !== 'reception' ? { canCreateTrainings: r.can_create_trainings === 1 } : {}),
      coach: r.coach_uid ? { userId: r.coach_uid, displayName: r.coach_name || '', assignmentId: r.coach_assignment_id } : null,
      openAssignment: r.open_assignment ? { status: r.open_assignment, assignmentId: r.open_assignment_id } : null
    }))
  };
}

// Alterações de membro: sempre condicionais ao papel e status lidos E ao ator ainda ativo no mesmo papel (nada concorrente é sobrescrito).
async function mutate(ctx, { roles, verdictFor, set, expectStatus, audit, label }) {
  const { academyId, uid } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, roles);
  await readBody(ctx.request, { role: SCHEMAS.changeRole, permissions: SCHEMAS.setPermissions }[label] || SCHEMAS.empty).then((b) => { ctx.body = b; });
  const target = await getMember(ctx.db, academyId, uid);
  if (!target) throw new ApiError('not_found');
  const change = verdictFor(ctx.body);
  const actor = { userId: ctx.user.uid, role: membership.role };
  if (target.role === 'owner' || change.role === 'owner') throw new ApiError('forbidden_role');   // propriedade só pelo endpoint de transferência
  const verdict = canChangeMember(actor, target, change);
  if (verdict !== true) throw new ApiError('forbidden_role');
  if (!expectStatus(target)) throw new ApiError('conflict');
  const { sql, args, detail } = set(target, ctx.body);
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare(`${sql} AND EXISTS (SELECT 1 FROM academy_members a WHERE a.academy_id = ? AND a.user_id = ? AND a.status = 'active' AND a.role = ?)`)
      .bind(...args, academyId, ctx.user.uid, membership.role),
    auditStmt(ctx.db, ctx, { academyId, action: audit, targetType: 'member', targetId: uid, detail }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');   // o alvo ou o ator mudou entre a leitura e a escrita
  return target;
}

export async function changeRole(ctx) {
  const { academyId, uid } = ctx.params;
  await mutate(ctx, {
    roles: ['owner', 'admin'], label: 'role', audit: 'member.role_changed',
    verdictFor: (b) => ({ role: b.role }),
    expectStatus: (t) => ['active', 'suspended', 'pending'].includes(t.status) && t.role !== ctx.body.role,   // trocar pelo mesmo papel é conflito, não sucesso
    set: (t, b) => ({ sql: 'UPDATE academy_members SET role = ?, can_create_trainings = 0, updated_at = ? WHERE academy_id = ? AND user_id = ? AND role = ? AND status = ?', args: [b.role, ctx.nowIso, academyId, uid, t.role, t.status], detail: `${t.role}>${b.role}` })
  });
  return { userId: uid, role: ctx.body.role };
}

// Permissão de criar fichas: só para professor (dono e admin concedem ou retiram). Vale na hora e é auditada.
export async function setPermissions(ctx) {
  const { academyId, uid } = ctx.params;
  await mutate(ctx, {
    roles: ['owner', 'admin'], label: 'permissions', audit: 'member.permission_changed',
    verdictFor: () => ({}),
    expectStatus: (t) => t.role === 'coach' && ['active', 'suspended'].includes(t.status) && (t.can_create_trainings === 1) !== ctx.body.canCreateTrainings,   // repetir o mesmo valor é conflito
    set: (t, b) => ({ sql: "UPDATE academy_members SET can_create_trainings = ?, updated_at = ? WHERE academy_id = ? AND user_id = ? AND role = 'coach' AND status = ?", args: [b.canCreateTrainings ? 1 : 0, ctx.nowIso, academyId, uid, t.status], detail: b.canCreateTrainings ? 'criar fichas: sim' : 'criar fichas: não' })
  });
  return { userId: uid, canCreateTrainings: ctx.body.canCreateTrainings };
}

export async function suspend(ctx) {
  const { academyId, uid } = ctx.params;
  await mutate(ctx, {
    roles: ['owner', 'admin'], audit: 'member.suspended', verdictFor: () => ({ status: 'suspended' }),
    expectStatus: (t) => t.status === 'active',
    set: (t) => ({ sql: "UPDATE academy_members SET status = 'suspended', suspended_at = ?, updated_at = ? WHERE academy_id = ? AND user_id = ? AND status = 'active' AND role = ?", args: [ctx.nowIso, ctx.nowIso, academyId, uid, t.role], detail: t.role })
  });
  return { userId: uid, status: 'suspended' };
}

export async function reactivate(ctx) {
  const { academyId, uid } = ctx.params;
  await mutate(ctx, {
    roles: ['owner', 'admin'], audit: 'member.reactivated', verdictFor: () => ({ status: 'active' }),
    expectStatus: (t) => ['suspended', 'removed'].includes(t.status),
    set: (t) => ({ sql: "UPDATE academy_members SET status = 'active', suspended_at = NULL, removed_at = NULL, removed_by = NULL, updated_at = ? WHERE academy_id = ? AND user_id = ? AND status = ? AND role = ?", args: [ctx.nowIso, academyId, uid, t.status, t.role], detail: t.role })
  });
  return { userId: uid, status: 'active' };
}

export async function remove(ctx) {
  const { academyId, uid } = ctx.params;
  await mutate(ctx, {
    roles: ['owner', 'admin'], audit: 'member.removed', verdictFor: () => ({ status: 'removed' }),
    expectStatus: (t) => ['active', 'suspended', 'pending'].includes(t.status),
    set: (t) => ({ sql: "UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = ?, updated_at = ? WHERE academy_id = ? AND user_id = ? AND status = ? AND role = ?", args: [ctx.nowIso, ctx.user.uid, ctx.nowIso, academyId, uid, t.status, t.role], detail: t.role })
  });
  return { userId: uid, status: 'removed' };
}

// Sair: só quem está ativo (suspenso não escapa da suspensão). Removed_by = o próprio uid marca saída voluntária (pode voltar por convite).
export async function leave(ctx) {
  const { academyId } = ctx.params;
  await readBody(ctx.request, SCHEMAS.empty);
  const me = await getMember(ctx.db, academyId, ctx.user.uid);
  if (!me || me.status === 'removed') throw new ApiError('no_membership');
  if (me.status !== 'active') throw new ApiError('membership_inactive');
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = ?, updated_at = ? WHERE academy_id = ? AND user_id = ? AND status = 'active'")
      .bind(ctx.nowIso, ctx.user.uid, ctx.nowIso, academyId, ctx.user.uid),   // último dono: o gatilho do banco recusa
    auditStmt(ctx.db, ctx, { academyId, action: 'member.left', targetType: 'member', targetId: ctx.user.uid, detail: me.role }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { academyId, status: 'removed' };
}

// O coach vê SÓ os alunos com vínculo ativo (aceito pelo aluno), com os dois lados ainda ativos. Nunca dados de saúde.
export async function coachStudents(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, ['coach']);
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT s.user_id, s.display_name, c.accepted_at
       FROM coach_assignments c
       JOIN academy_members s ON s.academy_id = c.academy_id AND s.user_id = c.student_uid AND s.status = 'active' AND s.role = 'student'
      WHERE c.academy_id = ? AND c.coach_uid = ? AND c.status = 'active' ORDER BY s.display_name COLLATE NOCASE LIMIT 200`
  ).bind(academyId, ctx.user.uid).all());
  return { academyId, students: results.map((r) => ({ userId: r.user_id, displayName: r.display_name, since: r.accepted_at })) };
}

// Para o coach propor vínculo: só alunos ativos SEM professor e SEM proposta em aberto, e apenas o nome público.
// É a exposição mínima necessária para propor; alunos com professor ou proposta nunca aparecem.
export async function unassignedStudents(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, ['coach']);
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT s.user_id, s.display_name FROM academy_members s
      WHERE s.academy_id = ? AND s.role = 'student' AND s.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM coach_assignments c WHERE c.academy_id = s.academy_id AND c.student_uid = s.user_id AND c.status IN ('proposed', 'pending_student', 'active'))
      ORDER BY s.display_name COLLATE NOCASE LIMIT 100`
  ).bind(academyId).all());
  return { academyId, students: results.map((r) => ({ userId: r.user_id, displayName: r.display_name })) };
}

/**
 * Sair de TODAS as academias (exclusão de conta no app). Cada saída tem a sua auditoria. Onde a pessoa é o único proprietário ativo a saída é
 * recusada (a academia nunca fica sem dono) e a academia volta em `blocked`; o app avisa para transferir a propriedade antes.
 * No máximo 25 vínculos por chamada (um batch só); `more` avisa se sobrou e a chamada pode ser repetida.
 */
export async function leaveAll(ctx) {
  await readBody(ctx.request, SCHEMAS.empty);
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT m.academy_id, m.role,
            (SELECT count(*) FROM academy_members o WHERE o.academy_id = m.academy_id AND o.role = 'owner' AND o.status = 'active' AND o.user_id <> m.user_id) AS other_owners
       FROM academy_members m WHERE m.user_id = ? AND m.status IN ('active','suspended','pending') ORDER BY m.academy_id LIMIT 26`
  ).bind(ctx.user.uid).all());
  const mine = results.slice(0, 25);
  const blocked = mine.filter((m) => m.role === 'owner' && m.other_owners === 0).map((m) => m.academy_id);
  // Tudo ou nada: se algum vínculo bloqueia (único dono), nada sai, para a exclusão de conta não deixar o usuário pela metade.
  const leaving = blocked.length ? [] : mine;
  const stmts = leaving.flatMap((m) => [
    ctx.db.prepare("UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = ?, updated_at = ? WHERE academy_id = ? AND user_id = ? AND status IN ('active','suspended','pending')")
      .bind(ctx.nowIso, ctx.user.uid, ctx.nowIso, m.academy_id, ctx.user.uid),
    auditStmt(ctx.db, ctx, { academyId: m.academy_id, action: 'member.left', targetType: 'member', targetId: ctx.user.uid, detail: m.role }, true)
  ]);
  if (stmts.length) await guarded(() => ctx.db.batch(stmts));
  return { left: leaving.length, blocked, more: results.length > 25 };
}
