import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { exercises as defaultExercises } from '../data/exercises';

// Fichas versionadas da academia (V2.0, primeiro corte). Regras (firestore.rules > trainingSeries/trainingVersions/academyAssigned):
// a ficha nasce RASCUNHO; editar muda só o rascunho; publicar cria a versão IMUTÁVEL idêntica ao rascunho; a atribuição guarda a
// versão exata (versionId) e não muda quando uma versão nova é publicada. Toda ação grava a auditoria no mesmo lote.

const now = () => new Date().toISOString();
// Contrato único com as regras (firestore.rules > validExercises): o teste academyTrainingService.test.js confere os dois lados.
export const MAX_EXERCISES = 20;

export const versionIdOf = (seriesId, version) => `${seriesId}_${version}`;

/** Exercício como fica na ficha (cópia: a versão publicada não depende da biblioteca mudar depois). */
export const toDraftExercise = (lib, prev = {}) => ({
  name: String(lib.name || prev.name || '').slice(0, 120),
  muscleGroup: String(lib.muscleGroup || prev.muscleGroup || '').slice(0, 40),
  sets: String(prev.sets ?? lib.sets ?? '3').slice(0, 10),
  reps: String(prev.reps ?? lib.reps ?? '8-12').slice(0, 20),
  rest: Math.min(300, Math.max(0, Math.round(Number(prev.rest ?? lib.rest ?? 60) || 0))),
  machineImage: String(lib.machineImage || prev.machineImage || '').slice(0, 300)
});

const stable = (value) => JSON.stringify(value, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));

/** O rascunho tem alterações em relação à última versão publicada? (sem versão: tem, se houver exercícios) */
export function draftChanged(series, latestVersion) {
  const draft = series?.draft;
  if (!draft) return false;
  if (!latestVersion) return (draft.exercises || []).length > 0;
  return stable({ name: draft.name, description: draft.description || '', exercises: draft.exercises }) !== stable({ name: latestVersion.name, description: latestVersion.description || '', exercises: latestVersion.exercises });
}

/** Quantos alunos usam cada versão: { 'fichaId_1': 3, ... }. */
export function countByVersion(assignedList) {
  const out = {};
  (assignedList || []).forEach((a) => { if (a?.versionId) out[a.versionId] = (out[a.versionId] || 0) + 1; });
  return out;
}

/** Pode criar/editar/publicar/excluir ficha: dono e admin sempre; professor só com permissão concedida pela academia. */
export const canAuthorTrainings = (membership) => !!membership && membership.status === 'active'
  && (['owner', 'admin'].includes(membership.role) || (membership.role === 'teacher' && membership.perms?.createTrainings === true));

function audit(batch, user, academyId, id, action, targetId, detail = '') {
  batch.set(doc(db, 'academyAuditLog', id), { academyId, actorId: user.uid, action, targetType: 'training', targetId, at: serverTimestamp(), ...(detail ? { detail: String(detail).slice(0, 200) } : {}) });
}
const newAuditId = () => doc(collection(db, 'academyAuditLog')).id;

export async function loadExerciseLibrary() {
  const snap = await getDocs(collection(db, 'exercises'));
  const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // exercícios padrão do app entram quando não existem na biblioteca (mesmo critério da tela de execução)
  const names = new Set(fromDb.map((e) => String(e.name || '').toLowerCase()));
  const extra = defaultExercises.filter((e) => !names.has(String(e.name || '').toLowerCase()));
  return [...fromDb, ...extra].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

/** Modelos oficiais globais (criados pela conta admin). A academia copia; nunca altera o original. */
export async function listOfficialTemplates() {
  const snap = await getDocs(query(collection(db, 'trainingTemplates'), where('scope', '==', 'official')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** Copia o modelo oficial para um rascunho próprio da academia (ficha versionada independente). */
export async function copyTemplateToAcademy(user, academyId, template) {
  const exercises = (template.exercises || []).slice(0, MAX_EXERCISES).map((e) => toDraftExercise(e, e));
  return createDraft(user, academyId, template.name, exercises, template.id, { description: template.description });
}

/** Duplica a ficha como rascunho NOVO (nunca atribui ninguém nem toca na original). A origem fica registrada em sourceSeriesId. */
export async function duplicateSeries(user, series) {
  const base = String(series.draft?.name || series.name || 'Ficha');
  const suffix = ' (cópia)';
  const name = `${base.slice(0, 80 - suffix.length)}${suffix}`;
  return createDraft(user, series.academyId, name, series.draft?.exercises || [], '', { description: series.draft?.description, sourceSeriesId: series.id });
}

/** Arquiva (ou restaura) a ficha. Não toca em versões nem atribuições: quem já usa continua treinando com a versão que tem. */
export async function setArchived(user, series, archived) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'trainingSeries', series.id), { status: archived ? 'archived' : 'active', updatedAt: now(), auditId });
  audit(batch, user, series.academyId, auditId, archived ? 'training.archived' : 'training.restored', series.id);
  await batch.commit();
}

export async function listSeries(academyId) {
  const snap = await getDocs(query(collection(db, 'trainingSeries'), where('academyId', '==', academyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function listVersions(academyId) {
  const snap = await getDocs(query(collection(db, 'trainingVersions'), where('academyId', '==', academyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Equipe lê todas as atribuições da academia; professor só as dos próprios alunos (as regras exigem o filtro por teacherId). */
export async function listAssignedForAcademy(academyId, { isStaff, userId }) {
  const constraints = isStaff ? [where('academyId', '==', academyId)] : [where('academyId', '==', academyId), where('teacherId', '==', userId)];
  const snap = await getDocs(query(collection(db, 'academyAssigned'), ...constraints));
  return snap.docs.map((d) => d.data());
}

const cleanDescription = (d) => String(d || '').trim().slice(0, 300);
const draftOf = (name, exercises, description) => ({ name, exercises: exercises.slice(0, MAX_EXERCISES), ...(cleanDescription(description) ? { description: cleanDescription(description) } : {}) });

export async function createDraft(user, academyId, name, exercises = [], sourceTemplateId = '', { description = '', sourceSeriesId = '' } = {}) {
  const ref = doc(collection(db, 'trainingSeries'));
  const auditId = newAuditId();
  const batch = writeBatch(db);
  const clean = String(name).trim();
  batch.set(ref, {
    academyId, name: clean, currentVersion: 0, status: 'active', draft: draftOf(clean, exercises, description),
    ...(sourceTemplateId ? { sourceTemplateId } : {}),
    ...(sourceSeriesId ? { sourceSeriesId } : {}),
    createdBy: user.uid, createdAt: now(), updatedAt: now(), auditId
  });
  audit(batch, user, academyId, auditId, 'training.created', ref.id);
  await batch.commit();
  return ref.id;
}

export async function saveDraft(user, series, { name, exercises, description = '' }) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  const clean = String(name).trim();
  batch.update(doc(db, 'trainingSeries', series.id), { draft: draftOf(clean, exercises, description), name: clean, updatedAt: now(), auditId });
  audit(batch, user, series.academyId, auditId, 'training.updated', series.id);
  await batch.commit();
}

/** Publica o rascunho como a próxima versão. Relê a ficha antes, para publicar exatamente o que está gravado. */
export async function publishDraft(user, series) {
  const fresh = await getDoc(doc(db, 'trainingSeries', series.id));
  if (!fresh.exists()) throw new Error('Ficha não encontrada.');
  const cur = fresh.data();
  const version = (cur.currentVersion || 0) + 1;
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(fresh.ref, { currentVersion: version, updatedAt: now(), auditId });
  batch.set(doc(db, 'trainingVersions', versionIdOf(series.id, version)), {
    academyId: cur.academyId, seriesId: series.id, version, name: cur.draft.name, ...(cur.draft.description ? { description: cur.draft.description } : {}), exercises: cur.draft.exercises, createdBy: user.uid, createdAt: now()
  });
  audit(batch, user, cur.academyId, auditId, 'training.published', series.id);
  await batch.commit();
  return version;
}

/** Só rascunho nunca publicado. A auditoria usa o ID fixo del_<fichaId> (a regra confere). */
export async function deleteDraft(user, series) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'trainingSeries', series.id));
  audit(batch, user, series.academyId, `del_${series.id}`, 'training.deleted', series.id);
  await batch.commit();
}

/** Atribui uma versão publicada ao aluno. `teacherId` é o professor responsável ativo do aluno, ou '' se não houver. */
export async function assignVersion(user, { academyId, studentId, seriesId, version, teacherId = '', detail = '' }) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'academyAssigned', `${academyId}_${studentId}`), {
    academyId, studentId, seriesId, version, versionId: versionIdOf(seriesId, version), teacherId, assignedBy: user.uid, auditId, updatedAt: now()
  });
  audit(batch, user, academyId, auditId, 'training.assigned', studentId, detail);
  await batch.commit();
}

/** A ficha do próprio aluno: a atribuição e a versão exata (nunca a mais nova). */
export async function getMyAssignedTraining(academyId, userId) {
  const a = await getDoc(doc(db, 'academyAssigned', `${academyId}_${userId}`));
  if (!a.exists()) return null;
  const v = await getDoc(doc(db, 'trainingVersions', a.data().versionId));
  return v.exists() ? { assignment: a.data(), version: v.data() } : null;
}

export async function removeAssignment(academyId, studentId) {
  await deleteDoc(doc(db, 'academyAssigned', `${academyId}_${studentId}`));
}

/**
 * Aplica uma versão a vários alunos. Um lote do Firestore por aluno (atribuição + auditoria): assim uma falha não derruba os demais e
 * cada aluno recebe seu resultado. Antes de gravar, relê as atribuições: se a do aluno mudou depois da prévia, ele é pulado como conflito.
 * Não toca em check-ins nem em execuções: só troca a versão que o aluno vai abrir da próxima vez.
 */
export async function applyBatch(user, { academyId, seriesId, version, rows, isStaff, onProgress }) {
  const fresh = new Map((await listAssignedForAcademy(academyId, { isStaff, userId: user.uid })).map((a) => [a.studentId, a]));
  const todo = rows.filter((r) => r.included);
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const row = todo[next]; next += 1;
      const now_ = fresh.get(row.studentId) || null;
      const expected = row.current?.versionId || null;
      let result;
      if ((now_?.versionId || null) !== expected) {
        result = { studentId: row.studentId, name: row.name, status: 'conflict', reason: 'A ficha do aluno mudou depois da prévia. Nada foi alterado.' };
      } else {
        try {
          await assignVersion(user, { academyId, studentId: row.studentId, seriesId, version, teacherId: row.teacherId, detail: `lote ${versionIdOf(seriesId, version)}` });
          result = { studentId: row.studentId, name: row.name, status: 'ok' };
        } catch (e) {
          result = { studentId: row.studentId, name: row.name, status: 'failed', reason: e?.code === 'permission-denied' ? 'Sem permissão para este aluno (vínculo ou ficha mudou).' : 'Não foi possível gravar.' };
        }
      }
      results.push(result);
      onProgress?.(results.length, todo.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, todo.length) }, worker));
  return results;
}
