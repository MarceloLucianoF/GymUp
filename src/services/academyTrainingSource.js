// Fonte da ficha atribuída ao aluno. Com a API da academia ativa, vem do Worker (e vira snapshot local para uso offline);
// sem ela, continua o caminho antigo (Firestore). A tela de execução só conhece o formato { assignment, version }.
import { ACADEMY_API_ENABLED, academyApi } from './academyApi';
import { clearSnapshot, loadSnapshot, saveSnapshot, toSnapshot } from './academySnapshot';
import { getMyAssignedTraining as getFromFirestore } from './academyTrainingService';

const fromSnapshot = (s, source) => ({ assignment: { assignmentId: s.assignmentId, versionId: s.trainingVersionId, versionHash: s.versionHash, academyId: s.academyId }, version: { name: s.name, description: s.description, version: s.version, exercises: s.exercises }, source });

/**
 * Busca no servidor; offline usa o snapshot. Sem ficha (ou sem vínculo) apaga o snapshot: o servidor é a autoridade.
 * Só erro de REDE cai no snapshot; erro de permissão nunca devolve ficha antiga.
 */
export async function loadAssignedTraining(academyId, uid, { api = academyApi, enabled = ACADEMY_API_ENABLED } = {}) {
  if (!enabled) return getFromFirestore(academyId, uid);
  try {
    const { training } = await api.training(academyId);
    if (!training) { clearSnapshot(uid, academyId); return null; }
    const snap = toSnapshot(training);
    saveSnapshot(uid, snap);
    return fromSnapshot(snap, 'api');
  } catch (error) {
    if (error.code === 'network') { const s = loadSnapshot(uid, academyId); return s ? fromSnapshot(s, 'snapshot') : null; }
    if (['no_membership', 'membership_inactive', 'academy_unavailable'].includes(error.code)) clearSnapshot(uid, academyId);
    throw error;
  }
}
export { fromSnapshot };
