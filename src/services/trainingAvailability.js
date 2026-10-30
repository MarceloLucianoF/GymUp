import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isMyTrainingId, fromMyTrainingId } from './myWorkouts';
import { parseAcademyTrainingId } from '../utils/academyTrainingId';
import { loadAssignedTraining } from './academyTrainingSource';

/**
 * A ficha de um treino do histórico ainda pode ser executada? (para "Repetir treino")
 * Lê só o que a própria execução leria: a ficha do aluno, a ficha pública ou a versão da academia atribuída a ele.
 * Devolve true/false; erro de rede vira false (o botão some em vez de abrir uma execução quebrada).
 */
export async function trainingStillExists(trainingId, uid, deps = {}) {
  if (!trainingId || typeof trainingId !== 'string' || !uid) return false;
  const read = deps.getDoc || getDoc;
  const loadAssigned = deps.loadAssignedTraining || loadAssignedTraining;
  try {
    const academyRef = parseAcademyTrainingId(trainingId);
    if (academyRef) {
      const mine = await loadAssigned(academyRef.academyId, uid);
      return !!mine && mine.assignment?.versionId === academyRef.versionId;
    }
    if (isMyTrainingId(trainingId)) {
      return (await read(doc(db, 'users', uid, 'myWorkouts', fromMyTrainingId(trainingId)))).exists();
    }
    return (await read(doc(db, 'trainings', trainingId))).exists();
  } catch {
    return false;
  }
}
