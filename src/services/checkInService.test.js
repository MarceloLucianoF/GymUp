import { saveCheckIn, removeCheckIn } from './checkInService';

jest.mock('firebase/firestore', () => ({ doc: (db, col, id) => ({ col, id }), runTransaction: jest.fn() }));

// Transação em memória: tx.get/set/delete sobre um mapa, com o mesmo contrato do SDK.
const memory = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  const key = (ref) => `${ref.col}/${ref.id}`;
  const run = async (db, fn) => {
    const writes = [];
    const tx = {
      get: async (ref) => ({ exists: () => store.has(key(ref)), data: () => store.get(key(ref)) }),
      set: (ref, data) => writes.push(['set', key(ref), data]),
      delete: (ref) => writes.push(['del', key(ref)])
    };
    const result = await fn(tx);
    writes.forEach(([op, k, data]) => (op === 'set' ? store.set(k, data) : store.delete(k)));
    return result;
  };
  return { store, run };
};

describe('saveCheckIn', () => {
  it('cria o check-in e abre o contador em 1', async () => {
    const m = memory();
    expect(await saveCheckIn({}, 'u1', 'c1', { userId: 'u1', date: '2026-10-12T10:00:00Z' }, m.run)).toBe(true);
    expect(m.store.get('userStats/u1')).toMatchObject({ uid: 'u1', checkInCount: 1, lastCheckInAt: '2026-10-12T10:00:00Z', lastCheckInId: 'c1', weekCount: 1, streak: 1 });
    // Espelho público: só o que o ranking mostra (nenhum horário nem total).
    const pub = m.store.get('publicStats/u1');
    expect(pub).toMatchObject({ uid: 'u1', weekWorkouts: 1, activeDays: 1, streak: 1 });
    expect(Object.keys(pub).sort()).toEqual(['activeDays', 'lastActiveDay', 'streak', 'uid', 'updatedAt', 'weekKey', 'weekWorkouts']);
  });

  it('soma 1 por check-in novo e não conta reenvio do mesmo ID (idempotência)', async () => {
    const m = memory({ 'userStats/u1': { uid: 'u1', checkInCount: 4, lastCheckInAt: 'x', lastCheckInId: 'a' } });
    await saveCheckIn({}, 'u1', 'c2', { userId: 'u1', date: 'd' }, m.run);
    expect(m.store.get('userStats/u1').checkInCount).toBe(5);
    const statsBefore = m.store.get('publicStats/u1').updatedAt;
    expect(await saveCheckIn({}, 'u1', 'c2', { userId: 'u1', date: 'd2' }, m.run)).toBe(false);
    expect(m.store.get('userStats/u1').checkInCount).toBe(5);
    expect(m.store.get('checkIns/c2').date).toBe('d'); // o primeiro envio vale: reenvio não regrava o documento
    expect(m.store.get('publicStats/u1').updatedAt).toBe(statsBefore);   // nem o espelho público
  });
});

describe('removeCheckIn', () => {
  it('apaga e baixa o contador, registrando o ID removido', async () => {
    const m = memory({ 'checkIns/c1': { userId: 'u1' }, 'userStats/u1': { uid: 'u1', checkInCount: 2, lastCheckInAt: 'x', lastCheckInId: 'c1' } });
    expect(await removeCheckIn({}, 'u1', 'c1', m.run)).toBe(true);
    expect(m.store.has('checkIns/c1')).toBe(false);
    expect(m.store.get('userStats/u1')).toMatchObject({ uid: 'u1', checkInCount: 1, lastCheckInAt: 'x', lastCheckInId: 'c1', lastRemovedId: 'c1' });
  });

  it('não baixa abaixo de zero e ignora check-in que não existe', async () => {
    const m = memory({ 'checkIns/c1': { userId: 'u1' }, 'userStats/u1': { uid: 'u1', checkInCount: 0, lastCheckInAt: 'x', lastCheckInId: 'c1' } });
    await removeCheckIn({}, 'u1', 'c1', m.run);
    expect(m.store.get('userStats/u1').checkInCount).toBe(0);
    expect(await removeCheckIn({}, 'u1', 'inexistente', m.run)).toBe(false);
  });
});
