import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// O que o aluno mostra ao treinador vinculado (coachShares/{uid}): treinos próprios e peso/medidas/fotos.
// Os treinos concluídos (check-ins) o treinador sempre vê: são a base do acompanhamento. Contrato em firestore.rules.
export const SHARE_ITEMS = {
  workouts: ['Meus treinos', 'Os treinos que você montou ou importou (com as fotos dos exercícios) e a ordem da sua ficha.'],
  measurements: ['Peso, medidas e fotos', 'O que você registra em Evolução › Peso e medidas, incluindo as fotos de progresso.']
};

/** Autorização atual ou null (para o treinador, "sem permissão" também quer dizer "não compartilhou"). */
export async function getCoachShare(uid) {
  try {
    const snap = await getDoc(doc(db, 'coachShares', uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    if (error?.code === 'permission-denied') return null;
    throw error;
  }
}

/** O aluno liga/desliga itens para o treinador atual. Tudo desligado apaga o documento. */
export async function saveCoachShare(uid, coachId, { workouts = false, measurements = false }) {
  if (!coachId) throw new Error('Você ainda não tem treinador vinculado.');
  if (!workouts && !measurements) { await deleteDoc(doc(db, 'coachShares', uid)); return null; }
  const data = { coachId, workouts: !!workouts, measurements: !!measurements, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, 'coachShares', uid), data);
  return data;
}

/** O item está liberado para este treinador? */
export const shareCovers = (share, coachId, key) => !!share && !!coachId && share.coachId === coachId && share[key] === true;
