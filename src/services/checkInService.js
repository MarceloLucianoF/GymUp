import { doc, runTransaction } from 'firebase/firestore';

// Gravação e remoção de check-ins mantendo o contador `userStats/{uid}` consistente.
// Tudo acontece numa transação: as regras do Firestore só aceitam mudar o contador junto da criação/remoção
// de um check-in no mesmo lote, então o número nunca depende de confiança no cliente.

/** Grava o check-in (idempotente: reenvio do mesmo ID só atualiza o documento). Devolve true se criou um novo. */
export async function saveCheckIn(db, uid, id, data, run = runTransaction) {
  return run(db, async (tx) => {
    const checkInRef = doc(db, 'checkIns', id);
    const statsRef = doc(db, 'userStats', uid);
    const [existing, stats] = await Promise.all([tx.get(checkInRef), tx.get(statsRef)]);
    tx.set(checkInRef, data);
    if (existing.exists()) return false;
    const previous = stats.exists() ? Number(stats.data().checkInCount) || 0 : 0;
    tx.set(statsRef, { uid, checkInCount: previous + 1, lastCheckInAt: String(data.date || new Date().toISOString()), lastCheckInId: id });
    return true;
  });
}

/** Apaga o check-in e baixa o contador. Devolve true se havia algo para apagar. */
export async function removeCheckIn(db, uid, id, run = runTransaction) {
  return run(db, async (tx) => {
    const checkInRef = doc(db, 'checkIns', id);
    const statsRef = doc(db, 'userStats', uid);
    const [existing, stats] = await Promise.all([tx.get(checkInRef), tx.get(statsRef)]);
    if (!existing.exists()) return false;
    tx.delete(checkInRef);
    if (stats.exists()) {
      const current = Number(stats.data().checkInCount) || 0;
      const data = stats.data();
      tx.set(statsRef, { uid, checkInCount: Math.max(0, current - 1), lastCheckInAt: data.lastCheckInAt, lastCheckInId: data.lastCheckInId, lastRemovedId: id });
    }
    return true;
  });
}
