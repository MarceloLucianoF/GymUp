import { SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, readBody } from '../http.js';
import { auditStmt, changed, getMember, guarded } from '../db.js';
import { requireAccess } from '../authz.js';
import { runIdempotent } from './common.js';

const OPEN = ['proposed', 'pending_student'];

// Ids aleatórios: quem não tem acesso recebe 404 (não revela se a atribuição existe).
async function load(ctx) {
  const row = await guarded(() => ctx.db.prepare('SELECT id, academy_id, student_uid, coach_uid, status FROM coach_assignments WHERE id = ?').bind(ctx.params.id).first());
  if (!row) throw new ApiError('not_found');
  return row;
}
async function access(ctx, academyId, roles) {
  try { return await requireAccess(ctx, academyId, roles); } catch (e) {
    if (['no_membership', 'membership_inactive', 'academy_unavailable', 'forbidden_role'].includes(e.code)) throw new ApiError('not_found');
    throw e;
  }
}
const run = async (ctx, stmts) => guarded(() => ctx.db.batch(stmts));

// Propor professor. Dono/admin: vai direto para o aluno decidir. Coach: só para si mesmo e precisa de aprovação do dono/admin (não aprova o próprio vínculo).
export async function propose(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
  const body = await readBody(ctx.request, SCHEMAS.proposeCoach);
  const isCoach = membership.role === 'coach';
  if (isCoach && body.coachUid !== undefined && body.coachUid !== ctx.user.uid) throw new ApiError('forbidden_role');
  const coachUid = isCoach ? ctx.user.uid : body.coachUid;
  if (!coachUid) throw new ApiError('invalid_request');
  if (coachUid === body.studentUid) throw new ApiError('invalid_request');
  return runIdempotent(ctx, `${academyId}|${ctx.user.uid}`, { studentUid: body.studentUid, coachUid }, async () => {
    const [student, coach] = await Promise.all([getMember(ctx.db, academyId, body.studentUid), getMember(ctx.db, academyId, coachUid)]);
    if (!student || !coach) throw new ApiError('not_found');
    if (student.role !== 'student' || student.status !== 'active' || coach.role !== 'coach' || coach.status !== 'active') throw new ApiError('conflict');
    const active = await guarded(() => ctx.db.prepare("SELECT coach_uid FROM coach_assignments WHERE academy_id = ? AND student_uid = ? AND status = 'active'").bind(academyId, body.studentUid).first());
    if (active?.coach_uid === coachUid) throw new ApiError('conflict');   // já é o professor
    const id = ctx.newId(24);
    const status = isCoach ? 'proposed' : 'pending_student';
    return {
      stmts: [
        ctx.db.prepare('INSERT INTO coach_assignments (id, academy_id, student_uid, coach_uid, status, proposed_by, approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, academyId, body.studentUid, coachUid, status, ctx.user.uid, isCoach ? null : ctx.user.uid, ctx.nowIso, ctx.nowIso),
        auditStmt(ctx.db, ctx, { academyId, action: 'coach.proposed', targetType: 'assignment', targetId: id, detail: status })
      ],
      response: { assignmentId: id, status, studentUid: body.studentUid, coachUid }
    };
  });
}

export async function listForAcademy(ctx) {
  const { academyId } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
  const mine = membership.role === 'coach';
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT c.id, c.status, c.student_uid, c.coach_uid, c.created_at, c.updated_at, s.display_name AS student_name, p.display_name AS coach_name
       FROM coach_assignments c
       JOIN academy_members s ON s.academy_id = c.academy_id AND s.user_id = c.student_uid
       JOIN academy_members p ON p.academy_id = c.academy_id AND p.user_id = c.coach_uid
      WHERE c.academy_id = ? AND c.status IN ('proposed', 'pending_student', 'active') ${mine ? 'AND c.coach_uid = ? AND (c.status = \'active\' OR c.proposed_by = ?)' : ''}
      ORDER BY c.updated_at DESC, c.rowid DESC LIMIT 100`
  ).bind(...(mine ? [academyId, ctx.user.uid, ctx.user.uid] : [academyId])).all());   // o coach nunca vê aluno antes do aceite, salvo a proposta que ele mesmo fez
  return {
    academyId,
    assignments: results.map((r) => ({ assignmentId: r.id, status: r.status, studentUid: r.student_uid, studentName: r.student_name, coachUid: r.coach_uid, coachName: r.coach_name, updatedAt: r.updated_at }))
  };
}

export async function approve(ctx) {
  const a = await load(ctx);
  await access(ctx, a.academy_id, ['owner', 'admin']);
  await readBody(ctx.request, SCHEMAS.empty);
  const results = await run(ctx, [
    ctx.db.prepare("UPDATE coach_assignments SET status = 'pending_student', approved_by = ?, updated_at = ? WHERE id = ? AND status = 'proposed'").bind(ctx.user.uid, ctx.nowIso, a.id),
    auditStmt(ctx.db, ctx, { academyId: a.academy_id, action: 'coach.approved', targetType: 'assignment', targetId: a.id }, true)
  ]);
  if (!changed(results)) throw new ApiError('conflict');
  return { assignmentId: a.id, status: 'pending_student' };
}

// O aluno aceita. Se já tinha outro professor ativo, ele é encerrado na MESMA transação (transferência): o acesso anterior acaba aqui.
export async function accept(ctx) {
  const a = await load(ctx);
  if (a.student_uid !== ctx.user.uid) throw new ApiError('not_found');
  await access(ctx, a.academy_id, ['student']);
  await readBody(ctx.request, SCHEMAS.empty);
  const { db } = ctx;
  // Se já há um professor ativo, a transferência o encerra na MESMA transação; a auditoria do encerramento aponta para o vínculo ANTIGO.
  const old = await guarded(() => db.prepare("SELECT id FROM coach_assignments WHERE academy_id = ? AND student_uid = ? AND status = 'active' AND id <> ?").bind(a.academy_id, a.student_uid, a.id).first());
  const stmts = [];
  if (old) {
    stmts.push(
      db.prepare(
        `UPDATE coach_assignments SET status = 'revoked', revoked_at = ?, updated_at = ?
          WHERE id = ? AND status = 'active' AND EXISTS (SELECT 1 FROM coach_assignments n WHERE n.id = ? AND n.status = 'pending_student' AND n.student_uid = ?)`
      ).bind(ctx.nowIso, ctx.nowIso, old.id, a.id, ctx.user.uid),
      auditStmt(db, ctx, { academyId: a.academy_id, action: 'coach.revoked', targetType: 'assignment', targetId: old.id, detail: 'transferencia' }, true)
    );
  }
  const activateAt = stmts.length;
  stmts.push(
    db.prepare("UPDATE coach_assignments SET status = 'active', accepted_at = ?, updated_at = ? WHERE id = ? AND status = 'pending_student' AND student_uid = ?").bind(ctx.nowIso, ctx.nowIso, a.id, ctx.user.uid),
    auditStmt(db, ctx, { academyId: a.academy_id, action: 'coach.accepted', targetType: 'assignment', targetId: a.id }, true)
  );
  const results = await run(ctx, stmts);
  if (!changed(results, activateAt)) throw new ApiError('conflict');
  return { assignmentId: a.id, status: 'active' };
}

// Recusar: o aluno recusa o que espera por ele; dono/admin recusam a proposta de um coach (ou retiram a que esperava o aluno).
export async function reject(ctx) {
  const a = await load(ctx);
  const asStudent = a.student_uid === ctx.user.uid;
  if (asStudent) await access(ctx, a.academy_id, ['student']); else await access(ctx, a.academy_id, ['owner', 'admin']);
  await readBody(ctx.request, SCHEMAS.empty);
  const allowed = asStudent ? ['pending_student'] : OPEN;
  const results = await run(ctx, [
    ctx.db.prepare(`UPDATE coach_assignments SET status = 'rejected', revoked_at = ?, updated_at = ? WHERE id = ? AND status IN (${allowed.map(() => '?').join(', ')})`).bind(ctx.nowIso, ctx.nowIso, a.id, ...allowed),
    auditStmt(ctx.db, ctx, { academyId: a.academy_id, action: 'coach.rejected', targetType: 'assignment', targetId: a.id, detail: asStudent ? 'student' : 'staff' }, true)
  ]);
  if (!changed(results)) throw new ApiError('conflict');
  return { assignmentId: a.id, status: 'rejected' };
}

// Encerrar: dono/admin, o próprio aluno ou o próprio professor. Encerrar tira o acesso do professor na hora.
export async function revoke(ctx) {
  const a = await load(ctx);
  const party = a.student_uid === ctx.user.uid ? 'student' : a.coach_uid === ctx.user.uid ? 'coach' : 'staff';
  await access(ctx, a.academy_id, party === 'staff' ? ['owner', 'admin'] : [party]);
  await readBody(ctx.request, SCHEMAS.empty);
  const results = await run(ctx, [
    ctx.db.prepare("UPDATE coach_assignments SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE id = ? AND status IN ('proposed', 'pending_student', 'active')").bind(ctx.nowIso, ctx.nowIso, a.id),
    auditStmt(ctx.db, ctx, { academyId: a.academy_id, action: 'coach.revoked', targetType: 'assignment', targetId: a.id, detail: party }, true)
  ]);
  if (!changed(results)) throw new ApiError('conflict');
  return { assignmentId: a.id, status: 'revoked' };
}

// Do ponto de vista do aluno: só o que espera por ele ou já está ativo (uma proposta ainda não aprovada pela equipe é invisível).
export async function mine(ctx) {
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT c.id, c.academy_id, c.status, c.created_at, c.accepted_at, a.name AS academy_name, p.display_name AS coach_name
       FROM coach_assignments c
       JOIN academies a ON a.id = c.academy_id AND a.status = 'active'
       JOIN academy_members me ON me.academy_id = c.academy_id AND me.user_id = c.student_uid AND me.status = 'active' AND me.role = 'student'
       JOIN academy_members p ON p.academy_id = c.academy_id AND p.user_id = c.coach_uid
      WHERE c.student_uid = ? AND c.status IN ('pending_student', 'active') ORDER BY c.created_at DESC LIMIT 50`
  ).bind(ctx.user.uid).all());
  return { assignments: results.map((r) => ({ assignmentId: r.id, academyId: r.academy_id, academyName: r.academy_name, coachName: r.coach_name, status: r.status, createdAt: r.created_at, acceptedAt: r.accepted_at })) };
}
