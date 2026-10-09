import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const noteId = (coachId, studentId) => `${coachId}_${studentId}`;
const legacyKey = (coachId, studentId) => `coachNotes:${coachId}:${studentId}`;

// Notas privadas do treinador sobre um aluno (coleção coachNotes: o aluno não tem acesso).
export async function getCoachNote(coachId, studentId) {
  const snap = await getDoc(doc(db, 'coachNotes', noteId(coachId, studentId)));
  if (snap.exists()) return snap.data().text || '';
  // Migração: notas antigas ficavam só no navegador do treinador.
  try {
    return localStorage.getItem(legacyKey(coachId, studentId)) || '';
  } catch {
    return '';
  }
}

export async function saveCoachNote(coachId, studentId, text) {
  await setDoc(doc(db, 'coachNotes', noteId(coachId, studentId)), {
    coachId,
    studentId,
    text: String(text).slice(0, 5000),
    updatedAt: new Date().toISOString()
  });
  try {
    localStorage.removeItem(legacyKey(coachId, studentId));
  } catch {
    // sem armazenamento local: nada a limpar
  }
}
