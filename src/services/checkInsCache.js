import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

// Várias telas (Home, Treinos, Evolução, Detalhes) leem o histórico inteiro do aluno. Para poupar
// leituras do Firestore (cota do plano gratuito), o resultado é reaproveitado por alguns minutos
// e invalidado sempre que o aluno grava ou apaga um treino.
const TTL_MS = 5 * 60 * 1000;
const store = new Map(); // uid -> { at, promise, data }

export const invalidateCheckIns = (uid) => {
  if (uid) store.delete(uid); else store.clear();
};

export function fetchStudentCheckIns(uid, { now = Date.now(), load } = {}) {
  const hit = store.get(uid);
  if (hit && now - hit.at < TTL_MS) return hit.promise.then((rows) => rows.slice());

  const loader = load || (async () => {
    const snap = await getDocs(query(collection(db, 'checkIns'), where('userId', '==', uid), orderBy('date', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  const promise = Promise.resolve().then(loader);
  const entry = { at: now, promise };
  store.set(uid, entry);
  // Falhas não ficam em cache: a próxima tentativa lê de novo.
  promise.catch(() => { if (store.get(uid) === entry) store.delete(uid); });
  return promise.then((rows) => rows.slice());
}
