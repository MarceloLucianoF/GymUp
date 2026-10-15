import { SCHEMAS } from '../../../shared/academy-contracts/index.js';
import { ApiError, readBody } from '../http.js';
import { auditStmt, changed, getMember, guarded, sha256Hex } from '../db.js';
import { requireAccess } from '../authz.js';
import { runIdempotent } from './common.js';

// Quem cria e publica fichas: dono, admin e coach com permissão concedida. Quem atribui: dono, admin e o coach com vínculo ativo com o aluno.
async function author(ctx, academyId) {
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
  if (membership.role === 'coach' && membership.can_create_trainings !== 1) throw new ApiError('forbidden_role');
  return membership;
}
const canonical = (name, description, exercises) => JSON.stringify({ name, description, exercises });
// Ler fichas (lista, detalhe, versões): dono, admin e qualquer professor (precisa escolher a ficha para atribuir).
const reader = (ctx, academyId) => requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
// Professor só mexe nas fichas que ele mesmo criou; dono e admin em qualquer uma.
const ownsOrManages = (membership, template, uid) => membership.role !== 'coach' || template.created_by === uid;
const TEMPLATE_COLS = 'id, name, description, status, current_version, draft_json, created_by, created_at, updated_at';
async function loadTemplate(ctx, academyId, id) {
  const t = await guarded(() => ctx.db.prepare(`SELECT ${TEMPLATE_COLS} FROM training_templates WHERE academy_id = ? AND id = ?`).bind(academyId, id).first());
  if (!t) throw new ApiError('not_found');
  return t;
}
const nameOf = async (ctx, academyId, uids) => {
  const unique = [...new Set(uids)].slice(0, 50);
  if (!unique.length) return new Map();
  const { results } = await guarded(() => ctx.db.prepare(`SELECT user_id, display_name FROM academy_members WHERE academy_id = ? AND user_id IN (${unique.map(() => '?').join(',')})`).bind(academyId, ...unique).all());
  return new Map(results.map((r) => [r.user_id, r.display_name]));
};

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
  const { membership } = await reader(ctx, academyId);
  const status = ctx.url.searchParams.get('status');
  if (status && !['active', 'archived'].includes(status)) throw new ApiError('invalid_request');
  const { results } = await guarded(() => ctx.db.prepare(
    `SELECT t.id, t.name, t.description, t.status, t.current_version, t.created_by, t.updated_at,
            (SELECT count(*) FROM training_assignments a WHERE a.academy_id = t.academy_id AND a.template_id = t.id) AS assigned
       FROM training_templates t WHERE t.academy_id = ? AND (? = '' OR t.status = ?) ORDER BY t.updated_at DESC, t.rowid DESC LIMIT 100`
  ).bind(academyId, status || '', status || '').all());
  return {
    academyId,
    templates: results.map((t) => ({
      templateId: t.id, name: t.name, description: t.description, status: t.status, currentVersion: t.current_version, updatedAt: t.updated_at,
      assignedCount: membership.role === 'coach' ? undefined : t.assigned, mine: t.created_by === ctx.user.uid
    }))
  };
}

// Detalhe: rascunho atual, se há mudança não publicada e a linha do tempo de versões (imutáveis).
export async function detail(ctx) {
  const { academyId, id } = ctx.params;
  const { membership } = await reader(ctx, academyId);
  const t = await loadTemplate(ctx, academyId, id);
  const { results: versions } = await guarded(() => ctx.db.prepare(
    `SELECT v.version, v.name, v.content_hash, v.created_by, v.created_at,
            (SELECT count(*) FROM training_assignments a WHERE a.academy_id = v.academy_id AND a.template_id = v.template_id AND a.version = v.version) AS assigned
       FROM training_versions v WHERE v.academy_id = ? AND v.template_id = ? ORDER BY v.version DESC LIMIT 100`
  ).bind(academyId, id).all());
  const names = await nameOf(ctx, academyId, [t.created_by, ...versions.map((v) => v.created_by)]);
  const draft = JSON.parse(t.draft_json).exercises;
  const latest = versions[0];
  const draftHash = await sha256Hex(canonical(t.name, t.description, draft));
  return {
    template: {
      templateId: t.id, name: t.name, description: t.description, status: t.status, currentVersion: t.current_version, exercises: draft,
      createdByName: names.get(t.created_by) || '', createdAt: t.created_at, updatedAt: t.updated_at,
      unpublishedChanges: !latest || latest.content_hash !== draftHash, canEdit: ownsOrManages(membership, t, ctx.user.uid)
    },
    versions: versions.map((v) => ({ version: v.version, name: v.name, versionHash: v.content_hash, createdAt: v.created_at, createdByName: names.get(v.created_by) || '', assignedCount: membership.role === 'coach' ? undefined : v.assigned }))
  };
}

export async function version(ctx) {
  const { academyId, id, version: n } = ctx.params;
  await reader(ctx, academyId);
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1) throw new ApiError('invalid_request');
  const v = await guarded(() => ctx.db.prepare('SELECT version, name, description, exercises_json, content_hash, created_at FROM training_versions WHERE academy_id = ? AND template_id = ? AND version = ?').bind(academyId, id, num).first());
  if (!v) throw new ApiError('not_found');
  return { templateId: id, version: v.version, name: v.name, description: v.description, exercises: JSON.parse(v.exercises_json), versionHash: v.content_hash, createdAt: v.created_at };
}

// Comparação entre duas versões (ou a versão e o rascunho): exercício a exercício, pelo nome.
const norm = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const FIELDS = ['muscleGroup', 'sets', 'reps', 'rest'];
export function diffExercises(before, after) {
  const key = (e) => norm(e.name);
  const a = new Map(before.map((e, i) => [key(e), { e, i }]));
  const b = new Map(after.map((e, i) => [key(e), { e, i }]));
  const rows = [];
  for (const [k, { e, i }] of b) {
    const old = a.get(k);
    if (!old) { rows.push({ status: 'added', name: e.name, after: pick(e), position: i + 1 }); continue; }
    const changes = FIELDS.filter((f) => String(old.e[f] ?? '') !== String(e[f] ?? ''));
    rows.push({ status: changes.length ? 'changed' : old.i !== i ? 'moved' : 'same', name: e.name, before: pick(old.e), after: pick(e), changes, position: i + 1 });
  }
  for (const [k, { e, i }] of a) if (!b.has(k)) rows.push({ status: 'removed', name: e.name, before: pick(e), position: i + 1 });
  return rows;
}
const pick = (e) => ({ muscleGroup: e.muscleGroup || '', sets: String(e.sets ?? ''), reps: String(e.reps ?? ''), rest: Number(e.rest) || 0 });

export async function compare(ctx) {
  const { academyId, id } = ctx.params;
  await reader(ctx, academyId);
  const t = await loadTemplate(ctx, academyId, id);
  const side = async (raw) => {
    if (raw === 'draft') return { label: 'rascunho', name: t.name, description: t.description, exercises: JSON.parse(t.draft_json).exercises };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new ApiError('invalid_request');
    const v = await guarded(() => ctx.db.prepare('SELECT name, description, exercises_json FROM training_versions WHERE academy_id = ? AND template_id = ? AND version = ?').bind(academyId, id, n).first());
    if (!v) throw new ApiError('not_found');
    return { label: `v${n}`, name: v.name, description: v.description, exercises: JSON.parse(v.exercises_json) };
  };
  const from = await side(ctx.url.searchParams.get('from') || '');
  const to = await side(ctx.url.searchParams.get('to') || 'draft');
  const rows = diffExercises(from.exercises, to.exercises);
  return {
    templateId: id, from: from.label, to: to.label,
    nameChanged: from.name !== to.name, descriptionChanged: from.description !== to.description,
    summary: Object.fromEntries(['added', 'removed', 'changed', 'moved', 'same'].map((k) => [k, rows.filter((r) => r.status === k).length])),
    rows
  };
}

// Editar o rascunho (nunca uma versão publicada). Escrita condicionada à data lida: edição concorrente vira conflito, não sobrescrita silenciosa.
export async function update(ctx) {
  const { academyId, id } = ctx.params;
  const membership = await author(ctx, academyId);
  const body = await readBody(ctx.request, SCHEMAS.updateTraining);
  const t = await loadTemplate(ctx, academyId, id);
  if (!ownsOrManages(membership, t, ctx.user.uid)) throw new ApiError('forbidden_role');
  if (t.status !== 'active') throw new ApiError('conflict');
  const name = body.name ?? t.name;
  const description = body.description ?? t.description;
  const draft = JSON.stringify({ exercises: body.exercises ?? JSON.parse(t.draft_json).exercises });
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare("UPDATE training_templates SET name = ?, description = ?, draft_json = ?, updated_at = ? WHERE id = ? AND academy_id = ? AND status = 'active' AND updated_at = ?")
      .bind(name, description, draft, ctx.nowIso, id, academyId, t.updated_at),
    auditStmt(ctx.db, ctx, { academyId, action: 'training.updated', targetType: 'training', targetId: id }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { templateId: id, name, updatedAt: ctx.nowIso };
}

export async function duplicate(ctx) {
  const { academyId, id } = ctx.params;
  await author(ctx, academyId);
  const body = await readBody(ctx.request, SCHEMAS.duplicateTraining);
  const t = await loadTemplate(ctx, academyId, id);
  const name = body.name || `${t.name} (cópia)`.slice(0, 80);
  const copyId = ctx.newId(24);
  await guarded(() => ctx.db.batch([
    ctx.db.prepare("INSERT INTO training_templates (id, academy_id, name, description, status, current_version, draft_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?, ?)")
      .bind(copyId, academyId, name, t.description, t.draft_json, ctx.user.uid, ctx.nowIso, ctx.nowIso),
    auditStmt(ctx.db, ctx, { academyId, action: 'training.duplicated', targetType: 'training', targetId: copyId, detail: `de ${id}` })
  ]));
  return { templateId: copyId, name, currentVersion: 0 };
}

// Arquivar impede novas atribuições; quem já tem a ficha continua com ela. Restaurar volta a permitir.
async function setStatus(ctx, { from, to, action }) {
  const { academyId, id } = ctx.params;
  const membership = await author(ctx, academyId);
  await readBody(ctx.request, SCHEMAS.empty);
  const t = await loadTemplate(ctx, academyId, id);
  if (!ownsOrManages(membership, t, ctx.user.uid)) throw new ApiError('forbidden_role');
  if (t.status !== from) throw new ApiError('conflict');
  const results = await guarded(() => ctx.db.batch([
    ctx.db.prepare('UPDATE training_templates SET status = ?, updated_at = ? WHERE id = ? AND academy_id = ? AND status = ?').bind(to, ctx.nowIso, id, academyId, from),
    auditStmt(ctx.db, ctx, { academyId, action, targetType: 'training', targetId: id }, true)
  ]));
  if (!changed(results)) throw new ApiError('conflict');
  return { templateId: id, status: to };
}
export const archive = (ctx) => setStatus(ctx, { from: 'active', to: 'archived', action: 'training.archived' });
export const restore = (ctx) => setStatus(ctx, { from: 'archived', to: 'active', action: 'training.restored' });

// Publicar: a versão nova é exatamente o rascunho, com hash do conteúdo. Imutável depois (gatilho do banco).
export async function publish(ctx) {
  const { academyId, id } = ctx.params;
  const membership = await author(ctx, academyId);
  await readBody(ctx.request, SCHEMAS.empty);
  const t = await loadTemplate(ctx, academyId, id);
  if (!ownsOrManages(membership, t, ctx.user.uid)) throw new ApiError('forbidden_role');
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

// Atribuição em lote. dryRun devolve só a prévia (nada é gravado). Aplicar exige Idempotency-Key.
// Quem já tem OUTRA ficha só é trocado com replace = true; o professor só atribui a aluno com vínculo ativo e não troca ficha de outra pessoa.
// Todas as escritas vão num único batch (atômico): se algo mudar no meio, nada é aplicado e a pessoa repete a prévia.
async function planBatch(ctx, { academyId, membership, templateId, version, studentUids, replace }) {
  const t = await loadTemplate(ctx, academyId, templateId);
  if (t.status !== 'active') throw new ApiError('conflict');
  const v = version ?? t.current_version;
  if (v < 1 || v > t.current_version) throw new ApiError('conflict');
  const uids = [...new Set(studentUids)];
  const marks = uids.map(() => '?').join(',');
  const { results: members } = await guarded(() => ctx.db.prepare(
    `SELECT m.user_id, m.display_name, m.role, m.status,
            (SELECT 1 FROM coach_assignments c WHERE c.academy_id = m.academy_id AND c.student_uid = m.user_id AND c.coach_uid = ? AND c.status = 'active') AS mine,
            a.template_id AS cur_template, a.version AS cur_version, a.assigned_by AS cur_by,
            (SELECT name FROM training_versions tv WHERE tv.template_id = a.template_id AND tv.academy_id = a.academy_id AND tv.version = a.version) AS cur_name
       FROM academy_members m LEFT JOIN training_assignments a ON a.academy_id = m.academy_id AND a.student_uid = m.user_id
      WHERE m.academy_id = ? AND m.user_id IN (${marks})`
  ).bind(ctx.user.uid, academyId, ...uids).all());
  const byUid = new Map(members.map((m) => [m.user_id, m]));
  const rows = uids.map((uid) => {
    const m = byUid.get(uid);
    if (!m) return { studentUid: uid, displayName: '', outcome: 'skip', reason: 'not_found' };
    const base = { studentUid: uid, displayName: m.display_name };
    if (m.role !== 'student' || m.status !== 'active') return { ...base, outcome: 'skip', reason: 'not_active_student' };
    if (membership.role === 'coach' && !m.mine) return { ...base, outcome: 'skip', reason: 'not_your_student' };
    if (!m.cur_template) return { ...base, outcome: 'assign' };
    const current = { templateId: m.cur_template, version: m.cur_version, name: m.cur_name || '' };
    if (m.cur_template === templateId && m.cur_version === v) return { ...base, outcome: 'skip', reason: 'already_assigned', current };
    if (membership.role === 'coach' && m.cur_by !== ctx.user.uid) return { ...base, outcome: 'skip', reason: 'assigned_by_other', current };
    if (!replace) return { ...base, outcome: 'skip', reason: 'has_other', current };
    return { ...base, outcome: 'replace', current };
  });
  return { template: t, version: v, rows };
}
const summarize = (rows) => ({ assign: rows.filter((r) => r.outcome === 'assign').length, replace: rows.filter((r) => r.outcome === 'replace').length, skip: rows.filter((r) => r.outcome === 'skip').length });

export async function assignBatch(ctx) {
  const { academyId, id } = ctx.params;
  const { membership } = await requireAccess(ctx, academyId, ['owner', 'admin', 'coach']);
  const body = await readBody(ctx.request, SCHEMAS.assignBatch);
  const replace = body.replace === true;
  const input = { academyId, membership, templateId: id, version: body.version, studentUids: body.studentUids, replace };
  if (body.dryRun === true) {
    const plan = await planBatch(ctx, input);
    return { dryRun: true, templateId: id, version: plan.version, templateName: plan.template.name, summary: summarize(plan.rows), results: plan.rows };
  }
  return runIdempotent(ctx, `${academyId}|${ctx.user.uid}`, { id, version: body.version ?? null, replace, studentUids: [...new Set(body.studentUids)].sort() }, async () => {
    const plan = await planBatch(ctx, input);
    const todo = plan.rows.filter((r) => r.outcome !== 'skip');
    const response = { dryRun: false, templateId: id, version: plan.version, templateName: plan.template.name, summary: summarize(plan.rows), results: plan.rows };
    if (!todo.length) return { stmts: [], response };
    const stmts = todo.flatMap((r) => [
      r.outcome === 'assign'
        ? ctx.db.prepare('INSERT INTO training_assignments (assignment_id, academy_id, student_uid, template_id, version, assigned_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (academy_id, student_uid) DO NOTHING')
          .bind(ctx.newId(24), academyId, r.studentUid, id, plan.version, ctx.user.uid, ctx.nowIso)
        : ctx.db.prepare('UPDATE training_assignments SET assignment_id = ?, template_id = ?, version = ?, assigned_by = ?, updated_at = ? WHERE academy_id = ? AND student_uid = ? AND template_id = ? AND version = ?')
          .bind(ctx.newId(24), id, plan.version, ctx.user.uid, ctx.nowIso, academyId, r.studentUid, r.current.templateId, r.current.version),
      auditStmt(ctx.db, ctx, { academyId, action: 'training.assigned', targetType: 'member', targetId: r.studentUid, detail: `v${plan.version} lote` }, true)
    ]);
    // O resumo SEMPRE entra: é a última instrução e dá o "1 linha" que a chave de idempotência exige, mesmo se algum aluno mudou no meio.
    stmts.push(auditStmt(ctx.db, ctx, { academyId, action: 'training.batch_assigned', targetType: 'training', targetId: id, detail: `v${plan.version}: ${todo.length} de ${plan.rows.length}` }));
    return { stmts, response };
  });
}
