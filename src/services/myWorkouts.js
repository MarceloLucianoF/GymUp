// Treinos pessoais do aluno: users/{uid}/myWorkouts. Ficam privados (a loja de fichas, `trainings`, é aberta a todos os logados).
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IMAGE_LIMITS, isSafePhoto } from '../utils/imageAttach';

export const MY_PREFIX = 'my_';
export const isMyTrainingId = (id) => typeof id === 'string' && id.startsWith(MY_PREFIX);
export const toMyTrainingId = (docId) => `${MY_PREFIX}${docId}`;
export const fromMyTrainingId = (id) => id.slice(MY_PREFIX.length);

const col = (uid) => collection(db, 'users', uid, 'myWorkouts');

// Imagem do exercício: só o caminho da biblioteca do app ou a foto que o próprio aluno anexou (JPEG pequeno gerado aqui). Link externo nunca entra.
const safeExerciseImage = (src) => (typeof src === 'string' && (/^\/exercises\/[a-z0-9-]+\.gif$/.test(src) || isSafePhoto(src, IMAGE_LIMITS.exercise.maxChars)) ? src : null);

/** Ficha pronta para gravar: só os campos aceitos pelas regras, com limites. */
export function buildMyWorkout({ name, exercises, source = 'manual', description = '', category = 'Pessoal', photo = null, createdAt = null }) {
  const list = (exercises || []).slice(0, 30).map((e) => ({ ...e, machineImage: safeExerciseImage(e.machineImage) }));
  const out = {
    name: String(name || '').trim().slice(0, 80) || 'Meu treino',
    category,
    description: String(description || '').slice(0, 300),
    estimatedTime: `${Math.max(15, Math.min(120, list.length * 6))} min`,
    exercises: list,
    source,
    createdAt: createdAt || new Date().toISOString()
  };
  if (isSafePhoto(photo, IMAGE_LIMITS.workout.maxChars)) out.photo = photo;
  return out;
}

export async function listMyWorkouts(uid) {
  const snap = await getDocs(query(col(uid), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: toMyTrainingId(d.id), docId: d.id, isMine: true, ...d.data() }));
}

export async function saveMyWorkout(uid, payload) {
  const ref = await addDoc(col(uid), { ...buildMyWorkout(payload), updatedAt: serverTimestamp() });
  return toMyTrainingId(ref.id);
}

/** Edição do próprio treino: substitui o documento mantendo a data de criação e a origem. */
export async function updateMyWorkout(uid, docId, payload) {
  await setDoc(doc(db, 'users', uid, 'myWorkouts', docId), { ...buildMyWorkout(payload), updatedAt: serverTimestamp() });
}

export const deleteMyWorkout = (uid, docId) => deleteDoc(doc(db, 'users', uid, 'myWorkouts', docId));
