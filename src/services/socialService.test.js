import { pairId, otherOf, relationOf, normalizeHandle, normalizeCode, lowerName, newFriendCode, validateHandle, sendRequest, respond, searchProfiles } from './socialService';
import { getDocs, orderBy, startAt, endAt, limit, where } from 'firebase/firestore';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ addDoc: jest.fn(), collection: jest.fn(), deleteField: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), endAt: jest.fn(), getDocs: jest.fn(), limit: jest.fn(), orderBy: jest.fn(), query: jest.fn(), startAt: jest.fn(), setDoc: jest.fn(), Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) }, where: jest.fn(), writeBatch: jest.fn() }));

describe('identificadores', () => {
  it('pairId é o mesmo nos dois sentidos e otherOf acha o outro', () => {
    expect(pairId('b', 'a')).toBe('a_b');
    expect(pairId('a', 'b')).toBe('a_b');
    expect(otherOf({ userA: 'a', userB: 'b' }, 'a')).toBe('b');
    expect(otherOf({ userA: 'a', userB: 'b' }, 'b')).toBe('a');
  });
  it('normaliza @usuário, código e nome', () => {
    expect(normalizeHandle(' @João_Silva ')).toBe('joão_silva');
    expect(normalizeCode(' ab12 cd34 ')).toBe('AB12CD34');
    expect(lowerName('  Ação Ávila ')).toBe('acao avila');
  });
  it('código de amigo: 8 caracteres sem símbolos ambíguos', () => {
    for (let i = 0; i < 50; i += 1) expect(newFriendCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(newFriendCode(() => 0)).toBe('AAAAAAAA');
  });
  it('valida @usuário', () => {
    expect(validateHandle('ana_2026')).toBe('');
    expect(validateHandle('ab')).toMatch(/3 a 20/);
    expect(validateHandle('Ana Silva')).toMatch(/3 a 20/);
    expect(validateHandle('a'.repeat(21))).toMatch(/3 a 20/);
  });
});

describe('relationOf', () => {
  const f = (over) => ({ userA: 'a', userB: 'b', requestedBy: 'a', status: 'pending', ...over });
  it('traduz o estado do ponto de vista de quem olha', () => {
    expect(relationOf(null, 'a')).toBe('none');
    expect(relationOf(f(), 'a')).toBe('pending-out');
    expect(relationOf(f(), 'b')).toBe('pending-in');
    expect(relationOf(f({ status: 'active' }), 'b')).toBe('active');
    expect(relationOf(f({ status: 'removed' }), 'a')).toBe('none');
    expect(relationOf(f({ status: 'blocked', blockedBy: 'b' }), 'b')).toBe('blocked-by-me');
    expect(relationOf(f({ status: 'blocked', blockedBy: 'b' }), 'a')).toBe('blocked');
  });
});

describe('pedidos de amizade', () => {
  const fs = require('firebase/firestore');
  const snap = (data) => ({ exists: () => !!data, id: 'a_b', data: () => data });
  let batch;
  beforeEach(() => {
    fs.doc.mockImplementation((db, col, id) => ({ path: `${col}/${id}` }));
    fs.collection.mockReturnValue({});
    fs.addDoc.mockResolvedValue({});
    batch = { set: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), commit: jest.fn().mockResolvedValue() };
    fs.writeBatch.mockReturnValue(batch);
  });
  afterEach(() => { fs.getDoc.mockReset(); });

  it('pedidos cruzados ao mesmo tempo: o segundo vira aceite, sem erro', async () => {
    fs.getDoc.mockResolvedValueOnce(snap(null)).mockResolvedValueOnce(snap({ userA: 'a', userB: 'b', status: 'pending', requestedBy: 'b' }));
    batch.commit.mockRejectedValueOnce(Object.assign(new Error('negado'), { code: 'permission-denied' }));
    await expect(sendRequest('a', 'b')).resolves.toBe('accepted');
    expect(batch.update).toHaveBeenCalledWith({ path: 'friendships/a_b' }, expect.objectContaining({ status: 'active' }));
  });

  it('se o outro lado já tinha pedido igual, devolve estado previsível', async () => {
    fs.getDoc.mockResolvedValueOnce(snap(null)).mockResolvedValueOnce(snap({ userA: 'a', userB: 'b', status: 'pending', requestedBy: 'a' }));
    batch.commit.mockRejectedValueOnce(Object.assign(new Error('negado'), { code: 'permission-denied' }));
    await expect(sendRequest('a', 'b')).resolves.toBe('sent');
  });

  it('negado por outro motivo continua sendo erro', async () => {
    fs.getDoc.mockResolvedValue(snap(null));
    batch.commit.mockRejectedValueOnce(Object.assign(new Error('negado'), { code: 'permission-denied' }));
    await expect(sendRequest('a', 'b')).rejects.toThrow('negado');
  });

  it('quem foi recusado espera um dia e tem no máximo 3 tentativas', async () => {
    const base = { userA: 'a', userB: 'b', status: 'removed', requestedBy: 'a' };
    fs.getDoc.mockResolvedValueOnce(snap({ ...base, declines: 1, retryAfter: { toMillis: () => Date.now() + 3600_000 } }));
    await expect(sendRequest('a', 'b')).rejects.toThrow(/Aguarde/);
    fs.getDoc.mockResolvedValueOnce(snap({ ...base, declines: 3, retryAfter: { toMillis: () => 1 } }));
    await expect(sendRequest('a', 'b')).rejects.toThrow(/tentativas/);
    fs.getDoc.mockResolvedValueOnce(snap({ ...base, declines: 1, retryAfter: { toMillis: () => 1 } }));
    await expect(sendRequest('a', 'b')).resolves.toBe('sent');
  });

  it('recusar soma uma recusa e fixa a espera; cancelar não mexe nesses campos', async () => {
    fs.getDoc.mockResolvedValueOnce(snap({ userA: 'a', userB: 'b', status: 'pending', requestedBy: 'a', declines: 1 }));
    await respond('b', 'a', 'decline');
    const patch = batch.update.mock.calls[0][1];
    expect(patch).toMatchObject({ status: 'removed', declines: 2 });
    expect(patch.retryAfter.toMillis()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    batch.update.mockClear();
    await respond('a', 'b', 'cancel');
    expect(batch.update.mock.calls[0][1]).not.toHaveProperty('declines');
  });
});

describe('searchProfiles (busca por nome e @)', () => {
  const snap = (rows) => ({ docs: rows.map((r) => ({ id: r.uid, data: () => r })) });
  const p = (uid, over = {}) => ({ uid, displayName: uid, displayNameLower: uid, handle: uid, discoverable: true, ...over });
  beforeEach(() => { jest.clearAllMocks(); });

  it('filtra descobríveis, ordena por prefixo e limita a 10 (a regra aceita até 20)', async () => {
    getDocs.mockResolvedValueOnce(snap([p('marcelo')])).mockResolvedValueOnce(snap([]));
    const out = await searchProfiles('  Marc ', { uid: 'eu', friendships: [] });
    expect(out.map((x) => x.uid)).toEqual(['marcelo']);
    expect(where).toHaveBeenCalledWith('discoverable', '==', true);
    expect(orderBy).toHaveBeenCalledWith('displayNameLower');
    expect(orderBy).toHaveBeenCalledWith('handle');
    expect(startAt).toHaveBeenCalledWith('marc');
    expect(endAt).toHaveBeenCalledWith('marc\uf8ff');
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('esconde quem bloqueou, quem foi bloqueado e o próprio usuário; junta nome e @ sem repetir', async () => {
    getDocs.mockResolvedValueOnce(snap([p('ana1'), p('ana2'), p('ana3'), p('eu')])).mockResolvedValueOnce(snap([p('ana1'), p('ana4')]));
    const friendships = [
      { userA: 'ana1', userB: 'eu', status: 'blocked', blockedBy: 'ana1' },   // ela me bloqueou
      { userA: 'ana2', userB: 'eu', status: 'blocked', blockedBy: 'eu' },     // eu bloqueei
      { userA: 'ana3', userB: 'eu', status: 'active' }
    ];
    const out = await searchProfiles('ana', { uid: 'eu', friendships });
    expect(out.map((x) => x.uid)).toEqual(['ana3', 'ana4']);
  });

  it('com @ busca só pelo usuário; nome com espaço busca só pelo nome; menos de 2 letras não consulta', async () => {
    getDocs.mockResolvedValue(snap([]));
    await searchProfiles('@ma', { uid: 'eu', friendships: [] });
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledWith('handle');
    jest.clearAllMocks(); getDocs.mockResolvedValue(snap([]));
    await searchProfiles('Ana Lu', { uid: 'eu', friendships: [] });
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(startAt).toHaveBeenCalledWith('ana lu');
    jest.clearAllMocks();
    expect(await searchProfiles('a', { uid: 'eu', friendships: [] })).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('se as duas consultas falham, avisa o erro; se só uma falha, usa a outra', async () => {
    getDocs.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' })).mockResolvedValueOnce(snap([p('bia')]));
    expect((await searchProfiles('bia', { uid: 'eu', friendships: [] })).map((x) => x.uid)).toEqual(['bia']);
    getDocs.mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b'));
    await expect(searchProfiles('bia', { uid: 'eu', friendships: [] })).rejects.toThrow('a');
  });
});
