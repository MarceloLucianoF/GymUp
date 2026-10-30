// Treinos pessoais do aluno: users/{uid}/myWorkouts. Ficam privados (a loja de fichas, `trainings`, é aberta a todos os logados).
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
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
export function buildMyWorkout({ name, exercises, source = 'manual', description = '', category = 'Pessoal', photo = null, createdAt = null, warmupStretch }) {
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
  if (typeof warmupStretch === 'boolean') out.warmupStretch = warmupStretch;
  return out;
}

// `warmupStretch` é campo novo: enquanto as regras publicadas não o aceitam, grava sem ele em vez de perder o treino.
const withoutWarmup = ({ warmupStretch, ...rest }) => rest;
async function writeTolerant(write, data) {
  try { return await write(data); } catch (error) {
    if (error?.code === 'permission-denied' && 'warmupStretch' in data) return write(withoutWarmup(data));
    throw error;
  }
}

export async function listMyWorkouts(uid) {
  const snap = await getDocs(query(col(uid), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: toMyTrainingId(d.id), docId: d.id, isMine: true, ...d.data() }));
}

export async function saveMyWorkout(uid, payload) {
  const ref = await writeTolerant((data) => addDoc(col(uid), data), { ...buildMyWorkout(payload), updatedAt: serverTimestamp() });
  return toMyTrainingId(ref.id);
}

/** Edição do próprio treino: substitui o documento mantendo a data de criação e a origem. */
export async function updateMyWorkout(uid, docId, payload) {
  await writeTolerant((data) => setDoc(doc(db, 'users', uid, 'myWorkouts', docId), data), { ...buildMyWorkout(payload), updatedAt: serverTimestamp() });
}

export const deleteMyWorkout = (uid, docId) => deleteDoc(doc(db, 'users', uid, 'myWorkouts', docId));

/** Troca um exercício dentro do treino salvo, mantendo a prescrição, o plano de séries e o superset da posição. */
export async function replaceExerciseInMyWorkout(uid, docId, originalName, swapped) {
  const ref = doc(db, 'users', uid, 'myWorkouts', docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Treino não encontrado.');
  const data = snap.data();
  const idx = (data.exercises || []).findIndex((e) => e.name === originalName);
  if (idx < 0) throw new Error('Exercício não encontrado no treino.');
  const old = data.exercises[idx];
  const next = [...data.exercises];
  next[idx] = {
    ...old, firestoreId: swapped.firestoreId, name: swapped.name, muscleGroup: swapped.muscleGroup, machineImage: swapped.machineImage,
    videoUrl: swapped.videoUrl, description: swapped.description, ...(swapped.kind ? { kind: swapped.kind } : {})
  };
  await updateMyWorkout(uid, docId, { name: data.name, exercises: next, source: data.source, description: data.description, category: data.category, photo: data.photo, createdAt: data.createdAt });
}
