import { collection, doc, getDoc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

// Vínculo aluno-treinador. Quem pede é o aluno; quem aceita é o treinador. As regras do Firestore garantem que
// users.coachId só vira o treinador quando o aceite acontece no mesmo lote (ver firestore.rules > coachLinks).

export const LINK_STATUS = { pending: 'pending', active: 'active', rejected: 'rejected', revoked: 'revoked' };
const now = () => new Date().toISOString();

export const normalizeCode = (value) => String(value || '').trim().replace(/^.*\/convite\//i, '').replace(/[?#].*$/, '').trim();

/** Estado exibido ao aluno a partir do perfil e do documento do vínculo. */
export function linkState(profile, link) {
  if (profile?.coachId) return 'active'; // inclui vínculos antigos, sem documento em coachLinks
  if (link?.status === LINK_STATUS.pending) return 'pending';
  if (link?.status === LINK_STATUS.rejected) return 'rejected';
  if (link?.status === LINK_STATUS.revoked) return 'revoked';
  return 'none';
}

export async function getMyLink(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'coachLinks', uid));
  return snap.exists() ? snap.data() : null;
}

/** Lista curta de treinadores com perfil público (nome, foto e bio), para o aluno escolher. */
export async function listPublicCoaches(max = 60) {
  const snap = await getDocs(query(collection(db, 'publicCoachProfiles'), limit(max)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((c) => c.role === 'coach');
}

export const filterCoaches = (coaches, term) => {
  const q = String(term || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return coaches.filter((c) => !q || `${c.displayName} ${c.bio || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
};

/** O aluno pede o vínculo. Falha com mensagem clara se o código não for de um treinador. */
export async function requestCoach(student, rawCode) {
  const coachId = normalizeCode(rawCode);
  if (!coachId) throw new Error('Informe o código do treinador.');
  if (coachId === student.uid) throw new Error('Esse código é o seu.');
  const coachSnap = await getDoc(doc(db, 'publicCoachProfiles', coachId));
  if (!coachSnap.exists()) throw new Error('Treinador não encontrado. Confira o código.');
  const existing = await getMyLink(student.uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'coachLinks', student.uid), {
    studentId: student.uid,
    studentName: String(student.displayName || 'Aluno').slice(0, 100),
    coachId,
    status: LINK_STATUS.pending,
    requestedBy: 'student',
    createdAt: existing?.createdAt || now(),
    updatedAt: now()
  });
  await batch.commit();
  return { coachId, coachName: coachSnap.data().displayName || 'Treinador' };
}

/** O aluno cancela o pedido ou encerra o vínculo ativo: coachId volta a null e o acesso do treinador acaba. */
export async function endMyLink(uid) {
  const link = await getMyLink(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { coachId: null, updatedAt: now() });
  if (link) batch.update(doc(db, 'coachLinks', uid), { status: LINK_STATUS.revoked, updatedAt: now() });
  await batch.commit();
}

/** Cancelar só o pedido pendente (o aluno ainda não tem treinador: não mexe no perfil). */
export async function cancelRequest(uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'coachLinks', uid), { status: LINK_STATUS.revoked, updatedAt: now() });
  await batch.commit();
}

export async function listPendingForCoach(coachId) {
  const snap = await getDocs(query(collection(db, 'coachLinks'), where('coachId', '==', coachId), where('status', '==', LINK_STATUS.pending)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** O treinador aceita: o vínculo vira active e o aluno passa a ter coachId, no mesmo lote. */
export async function acceptLink(coachId, studentId) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'coachLinks', studentId), { status: LINK_STATUS.active, updatedAt: now() });
  batch.update(doc(db, 'users', studentId), { coachId, updatedAt: now() });
  await batch.commit();
}

export async function rejectLink(studentId) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'coachLinks', studentId), { status: LINK_STATUS.rejected, updatedAt: now() });
  await batch.commit();
}

/** O treinador encerra o vínculo de um aluno dele. */
export async function endStudentLink(studentId) {
  const link = await getMyLink(studentId).catch(() => null);
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', studentId), { coachId: null, updatedAt: now() });
  if (link) batch.update(doc(db, 'coachLinks', studentId), { status: LINK_STATUS.revoked, updatedAt: now() });
  await batch.commit();
}
