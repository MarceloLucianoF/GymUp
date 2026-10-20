// Exercícios que o aluno criou (users/{uid}/myExercises). Privados, reutilizáveis em qualquer treino pessoal.
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IMAGE_LIMITS, isSafePhoto } from '../utils/imageAttach';
import { KINDS, defaultsForKind } from '../utils/exerciseKind';
import { EQUIPMENT, sanitizeEquipment } from '../utils/equipment';

export const MY_EXERCISE_GROUPS = [['peito', 'Peito'], ['costas', 'Costas'], ['ombros', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['pernas', 'Pernas'], ['gluteos', 'Glúteos'], ['panturrilha', 'Panturrilha'], ['core', 'Core'], ['cardio', 'Cardio'], ['mobilidade', 'Alongamento e mobilidade']];
export const MY_PREFIX = 'mine_';
const col = (uid) => collection(db, 'users', uid, 'myExercises');

/** Exercício pronto para gravar: só os campos aceitos pelas regras, com limites. */
export function buildMyExercise({ name, kind = 'strength', muscleGroup = 'peito', equipment = 'livre', sets, reps, rest, note = '', photo = null, createdAt = null }) {
  const k = KINDS.includes(kind) ? kind : 'strength';
  const d = defaultsForKind(k);
  const out = {
    name: String(name || '').trim().slice(0, 80),
    kind: k,
    muscleGroup: MY_EXERCISE_GROUPS.some(([g]) => g === muscleGroup) ? muscleGroup : 'peito',
    equipment: EQUIPMENT.includes(equipment) ? equipment : sanitizeEquipment([equipment])[0] || 'livre',
    sets: String(Math.min(12, Math.max(1, parseInt(sets, 10) || Number(d.sets)))),
    reps: String(reps || d.reps).slice(0, 12),
    rest: Math.min(600, Math.max(0, k === 'cardio' ? 0 : (Number.isFinite(Number(rest)) && rest !== '' && rest != null ? Number(rest) : d.rest))),
    note: String(note || '').slice(0, 160),
    createdAt: createdAt || new Date().toISOString()
  };
  if (isSafePhoto(photo, IMAGE_LIMITS.exercise.maxChars)) out.photo = photo;
  return out;
}

export async function listMyExercises(uid) {
  const snap = await getDocs(query(col(uid), orderBy('name')));
  return snap.docs.map((d) => ({ id: `${MY_PREFIX}${d.id}`, docId: d.id, isMine: true, ...d.data() }));
}

export async function saveMyExercise(uid, payload) {
  const ref = await addDoc(col(uid), { ...buildMyExercise(payload), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateMyExercise(uid, docId, payload) {
  await setDoc(doc(db, 'users', uid, 'myExercises', docId), { ...buildMyExercise(payload), updatedAt: serverTimestamp() });
}

export const deleteMyExercise = (uid, docId) => deleteDoc(doc(db, 'users', uid, 'myExercises', docId));

/** Exercício do aluno no formato da biblioteca (para busca, importação e fichas). A foto vira a imagem do exercício. */
export const myExerciseToLibrary = (e) => ({
  id: e.id, firestoreId: e.id, name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment, kind: e.kind,
  sets: Number(e.sets) || 3, reps: Number(e.reps) || 10, rest: Number(e.rest) || 0,
  description: e.note || 'Exercício criado por você.', machineImage: e.photo || null, videoUrl: null, mine: true
});
