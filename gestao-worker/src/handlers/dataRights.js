import { SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, readBody } from '../http.js';
import { auditStmt, getIdempotent, guarded, sha256Hex } from '../db.js';
import { requireAccess } from '../authz.js';
import { likeEscape, runIdempotent } from './common.js';

const CAP = 5000;
const take = (rows) => ({ rows: rows.slice(0, CAP), truncated: rows.length > CAP });

// Exportação dos dados da academia (só o dono). Sem código de convite (só existe o hash), sem e-mail de contato, sem dado de saúde.
// Cada lista tem teto de 5000 linhas e avisa quando foi cortada. A exportação fica na auditoria.
export async function exportAcademy(ctx) {
  const { academyId } = ctx.params;
  const { membership, academy } = await requireAccess(ctx, academyId, ['owner']);
  await readBody(ctx.request, SCHEMAS.empty);
  await guarded(() => ctx.db.batch([auditStmt(ctx.db, ctx, { academyId, action: 'academy.exported', targetType: 'academy', targetId: academyId })]));   // antes de ler: a exportação aparece na própria exportação
  const all = (sql, ...args) => guarded(async () => (await ctx.db.prepare(sql).bind(...args).all()).results);
  const [members, invites, coaching, templates, versions, assignments, consents, audit] = await Promise.all([
    all('SELECT user_id, role, status, display_name, can_create_trainings, removed_by, created_at, removed_at, suspended_at FROM academy_members WHERE academy_id = ? ORDER BY created_at, user_id LIMIT ?', academyId, CAP + 1),
    all('SELECT id, role, max_uses, uses, expires_at, revoked, created_by, created_at FROM academy_invites WHERE academy_id = ? ORDER BY created_at LIMIT ?', academyId, CAP + 1),
    all('SELECT id, student_uid, coach_uid, status, proposed_by, approved_by, accepted_at, revoked_at, created_at FROM coach_assignments WHERE academy_id = ? ORDER BY created_at LIMIT ?', academyId, CAP + 1),
    all('SELECT id, name, description, status, current_version, draft_json, created_by, created_at, updated_at FROM training_templates WHERE academy_id = ? ORDER BY created_at LIMIT ?', academyId, CAP + 1),
    all('SELECT template_id, version, name, description, exercises_json, content_hash, created_by, created_at FROM training_versions WHERE academy_id = ? ORDER BY template_id, version LIMIT ?', academyId, CAP + 1),
    all('SELECT assignment_id, student_uid, template_id, version, assigned_by, updated_at FROM training_assignments WHERE academy_id = ? ORDER BY updated_at LIMIT ?', academyId, CAP + 1),
    all('SELECT student_uid, share_adherence, status, granted_at, revoked_at FROM academy_consents WHERE academy_id = ? ORDER BY student_uid LIMIT ?', academyId, CAP + 1),
    all('SELECT id, actor_uid, action, target_type, target_id, detail, created_at FROM academy_audit_log WHERE academy_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?', academyId, CAP + 1)
  ]);
  const parts = { members: take(members), invites: take(invites), coachAssignments: take(coaching), trainings: take(templates), trainingVersions: take(versions), trainingAssignments: take(assignments), consents: take(consents), audit: take(audit) };
  parts.audit.rows.reverse();   // mais antigo primeiro; se houve corte, o que sai são os registros mais velhos
  const json = (v) => { try { return JSON.parse(v); } catch { return null; } };
  return {
    format: 'bohtreinar-gestao-export-v1', exportedAt: ctx.nowIso, exportedBy: ctx.user.uid, role: membership.role,
    academy: { id: academy.id, name: academy.name, description: academy.description, status: academy.status, createdAt: academy.created_at },
    truncated: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.truncated])),
    members: parts.members.rows, invites: parts.invites.rows, coachAssignments: parts.coachAssignments.rows,
    trainings: parts.trainings.rows.map((t) => ({ ...t, draft_json: undefined, draft: json(t.draft_json) })),
    trainingVersions: parts.trainingVersions.rows.map((v) => ({ ...v, exercises_json: undefined, exercises: json(v.exercises_json) })),
    trainingAssignments: parts.trainingAssignments.rows, consents: parts.consents.rows, audit: parts.audit.rows
  };
}

// Encerrar a academia (só o dono, com o nome digitado e Idempotency-Key). Tudo no mesmo batch, condicionado a o encerramento ter acontecido:
// a academia fica travada para sempre; todas as pessoas saem, inclusive donos (vínculos, consentimentos e fichas atribuídas caem por gatilho),
// nomes, descrição e contato são apagados, convites revogados, modelos arquivados e chaves de idempotência da academia apagadas.
// Permanecem: o nome da academia, a auditoria (só identificadores), as versões de ficha e os identificadores de quem criou cada coisa.
export async function closeAcademy(ctx) {
  const { academyId } = ctx.params;
  // Repetição de um pedido que já deu certo (a rede caiu depois da resposta): devolve o resultado salvo, mesmo com a academia já encerrada.
  const sentKey = ctx.request.headers.get('Idempotency-Key') || '';
  if (sentKey) {
    const saved = await getIdempotent(ctx.db, `${academyId}|${ctx.user.uid}`, sentKey, ctx.now).catch(() => null);
    if (saved && saved.request_hash === await sha256Hex(JSON.stringify({ confirm: true }))) return JSON.parse(saved.response_json);
  }
  const { academy } = await requireAccess(ctx, academyId, ['owner']);
  const body = await readBody(ctx.request, SCHEMAS.closeAcademy);
  if (body.confirmName !== academy.name) throw new ApiError('invalid_request');
  return runIdempotent(ctx, `${academyId}|${ctx.user.uid}`, { confirm: true }, async () => {
    const { db, nowIso, user } = ctx;
    const closed = 'EXISTS (SELECT 1 FROM academies WHERE id = ? AND closed_at = ?)';
    return {
      stmts: [
        db.prepare("UPDATE academies SET status = 'suspended', closed_at = ?, description = '', contact_email = '', updated_at = ? WHERE id = ? AND closed_at IS NULL AND name = ?").bind(nowIso, nowIso, academyId, academy.name),
        db.prepare(`UPDATE academy_members SET status = 'removed', removed_at = ?, removed_by = ?, updated_at = ? WHERE academy_id = ? AND status <> 'removed' AND ${closed}`).bind(nowIso, user.uid, nowIso, academyId, academyId, nowIso),
        db.prepare(`UPDATE academy_members SET display_name = '', updated_at = ? WHERE academy_id = ? AND ${closed}`).bind(nowIso, academyId, academyId, nowIso),
        db.prepare(`UPDATE academy_invites SET revoked = 1, updated_at = ? WHERE academy_id = ? AND revoked = 0 AND ${closed}`).bind(nowIso, academyId, academyId, nowIso),
        db.prepare(`UPDATE training_templates SET status = 'archived', updated_at = ? WHERE academy_id = ? AND status = 'active' AND ${closed}`).bind(nowIso, academyId, academyId, nowIso),
        db.prepare(`DELETE FROM idempotency_keys WHERE academy_id LIKE ? ESCAPE '\\' AND ${closed}`).bind(`${likeEscape(academyId)}|%`, academyId, nowIso),
        db.prepare(`INSERT INTO academy_audit_log (id, academy_id, actor_uid, action, target_type, target_id, detail, created_at, request_id) SELECT ?, ?, ?, 'academy.closed', 'academy', ?, '', ?, ? WHERE ${closed}`)
          .bind(ctx.newId(24), academyId, user.uid, academyId, nowIso, ctx.requestId, academyId, nowIso)
      ],
      response: { academyId, status: 'closed', closedAt: nowIso }
    };
  });
}

// Os dados do próprio titular nas academias (portabilidade). Só o que diz respeito a quem pede: sem identificadores de outras pessoas.
const LIMIT_ME = { memberships: 100, consents: 100, links: 200, assignments: 100, activity: 500 };
export async function exportMine(ctx) {
  const uid = ctx.user.uid;
  const all = (sql, ...args) => guarded(async () => (await ctx.db.prepare(sql).bind(...args).all()).results);
  const [member, consents, asStudent, asCoach, assignments, activity] = await Promise.all([
    all(`SELECT m.academy_id, a.name AS academy_name, a.closed_at AS academy_closed_at, m.role, m.status, m.display_name, m.created_at, m.removed_at,
                CASE WHEN m.removed_by = ? THEN 'voce' WHEN m.removed_by IS NULL THEN NULL ELSE 'outra pessoa' END AS removed_by
           FROM academy_members m JOIN academies a ON a.id = m.academy_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT ?`, uid, uid, LIMIT_ME.memberships + 1),
    all('SELECT academy_id, share_adherence, status, granted_at, revoked_at FROM academy_consents WHERE student_uid = ? LIMIT ?', uid, LIMIT_ME.consents + 1),
    all(`SELECT c.id, c.academy_id, c.status, c.accepted_at, c.revoked_at, c.created_at, p.display_name AS coach_name
           FROM coach_assignments c LEFT JOIN academy_members p ON p.academy_id = c.academy_id AND p.user_id = c.coach_uid WHERE c.student_uid = ? ORDER BY c.created_at LIMIT ?`, uid, LIMIT_ME.links + 1),
    all('SELECT id, academy_id, status, accepted_at, revoked_at, created_at FROM coach_assignments WHERE coach_uid = ? ORDER BY created_at LIMIT ?', uid, LIMIT_ME.links + 1),
    all(`SELECT a.academy_id, a.assignment_id, a.template_id, a.version, a.updated_at, v.name, v.description, v.exercises_json
           FROM training_assignments a JOIN training_versions v ON v.template_id = a.template_id AND v.academy_id = a.academy_id AND v.version = a.version WHERE a.student_uid = ? LIMIT ?`, uid, LIMIT_ME.assignments + 1),
    all(`SELECT academy_id, action, target_type, created_at, CASE WHEN target_id = ? THEN 1 ELSE 0 END AS about_you
           FROM academy_audit_log WHERE actor_uid = ? OR target_id = ? ORDER BY created_at DESC LIMIT ?`, uid, uid, uid, LIMIT_ME.activity + 1)
  ]);
  const cut = (rows, max) => rows.length > max;
  const parse = (v) => { try { return JSON.parse(v); } catch { return null; } };
  return {
    format: 'bohtreinar-gestao-me-export-v1', exportedAt: ctx.nowIso, userId: uid,
    truncated: { memberships: cut(member, LIMIT_ME.memberships), consents: cut(consents, LIMIT_ME.consents), coachLinksAsStudent: cut(asStudent, LIMIT_ME.links), coachLinksAsCoach: cut(asCoach, LIMIT_ME.links), trainingAssignments: cut(assignments, LIMIT_ME.assignments), activity: cut(activity, LIMIT_ME.activity) },
    memberships: member.slice(0, LIMIT_ME.memberships), consents: consents.slice(0, LIMIT_ME.consents),
    coachLinksAsStudent: asStudent.slice(0, LIMIT_ME.links), coachLinksAsCoach: asCoach.slice(0, LIMIT_ME.links),
    trainingAssignments: assignments.slice(0, LIMIT_ME.assignments).map((a) => ({ ...a, exercises_json: undefined, exercises: parse(a.exercises_json) })),
    activity: activity.slice(0, LIMIT_ME.activity)
  };
}
