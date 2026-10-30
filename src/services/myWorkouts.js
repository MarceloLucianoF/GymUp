// Treinos pessoais do aluno: users/{uid}/myWorkouts. Ficam privados (a loja de fichas, `trainings`, é aberta a todos os logados).
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IMAGE_LIMITS, isSafePhoto } from '../utils/imageAttach';
import { normalizeRoutine } from '../utils/routine';

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

// "Minha ficha" (ordem dos treinos e dia da semana) mora num documento de ID fixo nesta mesma coleção, porque as regras atuais
// só deixam o aluno gravar aqui (o perfil users/{uid} aceita uma lista fechada de campos). Para caber no formato aceito, os itens
// vão em `exercises` ({ workoutId, day }) e `category` = 'routine'. Ele nunca aparece como treino: listMyWorkouts o separa.
export const ROUTINE_DOC_ID = 'minha-ficha';
const isRoutineDoc = (d) => d.id === ROUTINE_DOC_ID;

/** Treinos e ficha na mesma leitura. `routine.items`: [{ workoutId (docId), day: 0..6 | null }]. */
export async function listMyWorkoutsAndRoutine(uid) {
  const snap = await getDocs(query(col(uid), orderBy('createdAt', 'desc')));
  const workouts = snap.docs.filter((d) => !isRoutineDoc(d)).map((d) => ({ id: toMyTrainingId(d.id), docId: d.id, isMine: true, ...d.data() }));
  const r = snap.docs.find(isRoutineDoc)?.data();
  return { workouts, routine: { items: normalizeRoutine(r?.exercises, workouts), updatedAt: r?.updatedAt || null } };
}

export async function listMyWorkouts(uid) {
  return (await listMyWorkoutsAndRoutine(uid)).workouts;
}

/** Grava a ficha (ou apaga, se vazia: as regras exigem ao menos um item). */
export async function saveMyRoutine(uid, items) {
  const clean = normalizeRoutine(items);
  const ref = doc(db, 'users', uid, 'myWorkouts', ROUTINE_DOC_ID);
  if (!clean.length) { await deleteDoc(ref); return clean; }
  await setDoc(ref, {
    name: 'Minha ficha', category: 'routine', description: '', estimatedTime: '15 min', source: 'manual',
    exercises: clean, createdAt: new Date().toISOString(), updatedAt: serverTimestamp()
  });
  return clean;
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
