import { activeWorkoutService as svc } from './activeWorkoutService';

const UID = 'u1';
const doc = (db, col, id) => ({ col, id });

const item = (n, extra = {}) => ({ userId: UID, trainingId: 't1', date: new Date(2026, 9, n).toISOString(), totalVolume: n, ...extra });

describe('fila offline de check-ins (idempotente)', () => {
  beforeEach(() => { localStorage.clear(); svc.syncing = {}; });

  test('newCheckInId gera ids únicos', () => {
    const ids = new Set(Array.from({ length: 50 }, () => svc.newCheckInId()));
    expect(ids.size).toBe(50);
  });

  test('saveOfflineCheckIn atribui clientId e ignora o mesmo check-in repetido', () => {
    const payload = item(1, { clientId: 'abc' });
    svc.saveOfflineCheckIn(UID, payload);
    svc.saveOfflineCheckIn(UID, payload);
    const queue = svc.getOfflineCheckIns(UID);
    expect(queue).toHaveLength(1);
    expect(queue[0].clientId).toBe('abc');
    svc.saveOfflineCheckIn(UID, item(2));
    expect(svc.getOfflineCheckIns(UID)[1].clientId).toBeTruthy();
  });

  test('envia cada item para checkIns/{clientId} e esvazia a fila', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    svc.saveOfflineCheckIn(UID, item(2, { clientId: 'b' }));
    const calls = [];
    const setDoc = jest.fn(async (ref, data) => { calls.push([ref.id, data.clientId]); });
    const synced = await svc.syncPendingCheckIns(UID, {}, setDoc, doc);
    expect(synced).toBe(2);
    expect(calls).toEqual([['a', 'a'], ['b', 'b']]);
    expect(svc.getOfflineCheckIns(UID)).toEqual([]);
  });

  test('falha no meio da fila: o enviado sai, o restante fica e o reenvio não duplica', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    svc.saveOfflineCheckIn(UID, item(2, { clientId: 'b' }));
    svc.saveOfflineCheckIn(UID, item(3, { clientId: 'c' }));
    const written = new Map();
    let failB = true;
    const setDoc = jest.fn(async (ref, data) => {
      if (ref.id === 'b' && failB) throw new Error('rede');
      written.set(ref.id, data);
    });
    expect(await svc.syncPendingCheckIns(UID, {}, setDoc, doc)).toBe(2);
    expect(svc.getOfflineCheckIns(UID).map((i) => i.clientId)).toEqual(['b']);
    failB = false;
    expect(await svc.syncPendingCheckIns(UID, {}, setDoc, doc)).toBe(1);
    expect([...written.keys()].sort()).toEqual(['a', 'b', 'c']); // 3 documentos, nenhum duplicado
    expect(svc.getOfflineCheckIns(UID)).toEqual([]);
  });

  test('itens antigos sem clientId recebem id determinístico (estável entre tentativas)', async () => {
    localStorage.setItem(`academyup_pending_checkins_${UID}`, JSON.stringify([{ ...item(5), queuedAt: 1 }]));
    const ids = [];
    const setDoc = jest.fn(async (ref) => { ids.push(ref.id); throw new Error('rede'); });
    await svc.syncPendingCheckIns(UID, {}, setDoc, doc);
    await svc.syncPendingCheckIns(UID, {}, setDoc, doc);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toMatch(/^legacy-u1-/);
  });

  test('sincronizações simultâneas não enviam em dobro', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const setDoc = jest.fn(async () => { await gate; });
    const first = svc.syncPendingCheckIns(UID, {}, setDoc, doc);
    const second = await svc.syncPendingCheckIns(UID, {}, setDoc, doc);
    expect(second).toBe(0);
    release();
    expect(await first).toBe(1);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});

describe('fila offline: concorrência, recarga e falhas', () => {
  beforeEach(() => { localStorage.clear(); svc.syncing = {}; });
  const net = (code = 'unavailable') => Object.assign(new Error('rede'), { code });

  test('treino enfileirado por outra aba durante o envio não se perde', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    const saver = jest.fn(async (id) => {
      if (id === 'a') svc.saveOfflineCheckIn(UID, item(2, { clientId: 'novo' })); // outra aba termina um treino agora
    });
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(1);
    expect(svc.getOfflineCheckIns(UID).map((i) => i.clientId)).toEqual(['novo']);
  });

  test('recarregar a página mantém a fila; reenviar muitas vezes grava cada ID uma só vez', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    const stored = new Map();
    const saver = jest.fn(async (id, data) => { stored.set(id, data); });
    const offline = jest.fn(async () => { throw net(); });
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, offline)).toBe(0);
    svc.syncing = {}; // "recarregou": memória zerada, localStorage permanece
    expect(svc.getOfflineCheckIns(UID)).toHaveLength(1);
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(1);
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(0);
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(0);
    expect([...stored.keys()]).toEqual(['a']);
    expect(svc.getOfflineCheckIns(UID)).toEqual([]);
  });

  test('perda de rede no envio: o item continua na fila com tentativas e motivo, e não vira falha definitiva', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    await svc.syncPendingCheckIns(UID, {}, null, null, async () => { throw net(); });
    const [it] = svc.getOfflineCheckIns(UID);
    expect(it).toMatchObject({ clientId: 'a', attempts: 1, lastError: 'unavailable', permanent: false });
    expect(svc.queueStatus(UID)).toEqual({ total: 1, failed: 0 });
  });

  test('erro que repetir não resolve vira falha: não reenvia sozinho, só quando o usuário pede', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    await svc.syncPendingCheckIns(UID, {}, null, null, async () => { throw net('permission-denied'); });
    expect(svc.queueStatus(UID)).toEqual({ total: 1, failed: 1 });
    const saver = jest.fn(async () => {});
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(0);
    expect(saver).not.toHaveBeenCalled();
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver, { force: true })).toBe(1);
    expect(svc.queueStatus(UID)).toEqual({ total: 0, failed: 0 });
  });

  test('os campos de controle da fila não vão para o documento do check-in', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    await svc.syncPendingCheckIns(UID, {}, null, null, async () => { throw net(); });
    const sent = [];
    await svc.syncPendingCheckIns(UID, {}, null, null, async (id, data) => { sent.push(data); });
    expect(Object.keys(sent[0])).not.toEqual(expect.arrayContaining(['attempts']));
    expect(sent[0]).not.toHaveProperty('lastError');
    expect(sent[0]).not.toHaveProperty('permanent');
    expect(sent[0]).not.toHaveProperty('queuedAt');
  });

  test('outra aba com a trava ativa: não envia; trava vencida não bloqueia', async () => {
    svc.saveOfflineCheckIn(UID, item(1, { clientId: 'a' }));
    localStorage.setItem('academyup_sync_lock_u1', String(Date.now()));
    const saver = jest.fn(async () => {});
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(0);
    localStorage.setItem('academyup_sync_lock_u1', String(Date.now() - 60_000));
    expect(await svc.syncPendingCheckIns(UID, {}, null, null, saver)).toBe(1);
    expect(localStorage.getItem('academyup_sync_lock_u1')).toBeNull();
  });
});

