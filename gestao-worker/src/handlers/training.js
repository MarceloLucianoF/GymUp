import { SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, readBody } from '../http.js';
import { auditStmt, changed, getMember, guarded, sha256Hex } from '../db.js';
import { requireAccess } from '../authz.js';

// Quem cria e publica fichas: dono, admin e coach com permissão concedida. Quem atribui: dono, admin e o coach com vínculo ativo com o aluno.
async function author(ctx, academyId) {
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
  if (membership.role === 'coach' && membership.can_create_trainings !== 1) throw new ApiError('forbidden_role');
  return membership;
}
const canonical = (name, description, exercises) => JSON.stringify({ name, description, exercises });

export async function create(ctx) {
  const { academyId } = ctx.params;
  await author(ctx, academyId);
  const body = await readBody(ctx.request, SCHEMAS.createTraining);
  const id = ctx.newId(24);
  const description = body.description || '';
  const draft = JSON.stringify({ exercises: body.exercises });
  await guarded(() => ctx.db.batch([
    ctx.db.prepare("INSERT INTO training_templates (id, academy_id, name, description, status, current_version, draft_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?, ?)")
      .bind(id, academyId, body.name, description, draft, ctx.user.uid, ctx.nowIso, ctx.nowIso),
    auditStmt(ctx.db, ctx, { academyId, action: 'training.created', targetType: 'training', targetId: id })
  ]));
  return { templateId: id, name: body.name, currentVersion: 0 };
}

export async function list(ctx) {
  const { academyId } = ctx.params;
  await author(ctx, academyId);
  const { results } = await guarded(() => ctx.db.prepare(
    'SELECT id, name, status, current_version, updated_at FROM training_templates WHERE academy_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT 100'
  ).bind(academyId).all());
  return { academyId, templates: results.map((t) => ({ templateId: t.id, name: t.name, status: t.status, currentVersion: t.current_version, updatedAt: t.updated_at })) };
}

// Publicar: a versão nova é exatamente o rascunho, com hash do conteúdo. Imutável depois (gatilho do banco).
export async function publish(ctx) {
  const { academyId, id } = ctx.params;
  await author(ctx, academyId);
  await readBody(ctx.request, SCHEMAS.empty);
  const t = await guarded(() => ctx.db.prepare('SELECT id, name, description, status, current_version, draft_json FROM training_templates WHERE academy_id = ? AND id = ?').bind(academyId, id).first());
  if (!t) throw new ApiError('not_found');
  if (t.status !== 'active') throw new ApiError('conflict');
  const exercises = JSON.parse(t.draft_json).exercises;
  if (!exercises.length) throw new ApiError('conflict');
  const version = t.current_version + 1;
  const hash = await sha256Hex(canonical(t.name, t.description, exercises));
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare("UPDATE training_templates SET current_version = ?, updated_at = ? WHERE id = ? AND academy_id = ? AND current_version = ? AND status = 'active'").bind(version, ctx.nowIso, id, academyId, t.current_version),
    ctx.db.prepare('INSERT INTO training_versions (template_id, academy_id, version, name, description, exercises_json, content_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, academyId, version, t.name, t.description, JSON.stringify(exercises), hash, ctx.user.uid, ctx.nowIso),
    auditStmt(ctx.db, ctx, { academyId, action: 'training.published', targetType: 'training', targetId: id, detail: `v${version}` }, true)
  ]));
  if (!changed(results, 1)) throw new ApiError('conflict');
  return { templateId: id, version, versionHash: hash };
}

export async function assign(ctx) {
  const { academyId, id } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
  const body = await readBody(ctx.request, SCHEMAS.assignTraining);
  if (membership.role === 'coach') {
    const mine = await guarded(() => ctx.db.prepare("SELECT 1 AS ok FROM coach_assignments WHERE academy_id = ? AND coach_uid = ? AND student_uid = ? AND status = 'active'").bind(academyId, ctx.user.uid, body.studentUid).first());
    if (!mine) throw new ApiError('forbidden_role');   // coach só atribui a aluno com vínculo ativo e aceito
  }
  const t = await guarded(() => ctx.db.prepare('SELECT id, current_version, status FROM training_templates WHERE academy_id = ? AND id = ?').bind(academyId, id).first());
  if (!t) throw new ApiError('not_found');
  const version = body.version ?? t.current_version;
  if (version < 1 || version > t.current_version) throw new ApiError('conflict');
  const student = await getMember(ctx.db, academyId, body.studentUid);
  if (!student) throw new ApiError('not_found');
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare(
      `INSERT INTO training_assignments (assignment_id, academy_id, student_uid, template_id, version, assigned_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (academy_id, student_uid) DO UPDATE SET assignment_id = excluded.assignment_id, template_id = excluded.template_id, version = excluded.version,
         assigned_by = excluded.assigned_by, updated_at = excluded.updated_at
       WHERE ? = 1 OR training_assignments.assigned_by = excluded.assigned_by`   // coach só troca a ficha que ele mesmo atribuiu; dono e admin trocam qualquer uma
    ).bind(ctx.newId(24), academyId, body.studentUid, id, version, ctx.user.uid, ctx.nowIso, membership.role === 'coach' ? 0 : 1),
    auditStmt(ctx.db, ctx, { academyId, action: 'training.assigned', targetType: 'member', targetId: body.studentUid, detail: `v${version}` }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { templateId: id, version, studentUid: body.studentUid };
}

// A ficha do próprio aluno: a versão EXATA atribuída (nunca a mais nova), com o hash para o snapshot offline. null quando não há.
export async function mine(ctx) {
  const { academyId } = ctx.params;
  await requireAccess(ctx, academyId, ['student']);
  const r = await guarded(() => ctx.db.prepare(
    `SELECT a.assignment_id, a.template_id, a.version, a.updated_at, v.name, v.description, v.exercises_json, v.content_hash
       FROM training_assignments a
       JOIN training_versions v ON v.template_id = a.template_id AND v.academy_id = a.academy_id AND v.version = a.version
      WHERE a.academy_id = ? AND a.student_uid = ?`
  ).bind(academyId, ctx.user.uid).first());
  if (!r) return { training: null };
  return {
    training: {
      assignmentId: r.assignment_id, academyId, trainingVersionId: `${r.template_id}_${r.version}`, version: r.version, versionHash: r.content_hash,
      name: r.name, description: r.description, exercises: JSON.parse(r.exercises_json), assignedAt: r.updated_at
    }
  };
}
