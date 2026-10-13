import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

// Meta semanal: `users.weeklyGoal` é a fonte da verdade (aderência do treinador); o perfil social (ranking de amigos) acompanha.
// Gravação em um lote só: ou os dois mudam ou nenhum. Se divergirem (perfil social criado depois, edição antiga), reconcilia.

const stamp = () => new Date().toISOString();

export async function saveWeeklyGoal(uid, value) {
  const social = await getDoc(doc(db, 'publicProfiles', uid)).catch(() => null);
  const batch = writeBatch(db);
  const updatedAt = stamp();
  batch.update(doc(db, 'users', uid), { weeklyGoal: value, updatedAt });
  if (social?.exists?.()) batch.update(doc(db, 'publicProfiles', uid), { weeklyGoal: value, updatedAt });
  await batch.commit();
}

/** Alinha o perfil social à meta do perfil quando divergem. Devolve true se corrigiu. */
export async function reconcileWeeklyGoal(uid, goal) {
  const social = await getDoc(doc(db, 'publicProfiles', uid)).catch(() => null);
  if (!social?.exists?.() || social.data().weeklyGoal === goal) return false;
  await updateDoc(doc(db, 'publicProfiles', uid), { weeklyGoal: goal, updatedAt: stamp() });
  return true;
}
