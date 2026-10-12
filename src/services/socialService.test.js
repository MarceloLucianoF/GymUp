import { pairId, otherOf, relationOf, normalizeHandle, normalizeCode, lowerName, newFriendCode, validateHandle, sendRequest, respond } from './socialService';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ addDoc: jest.fn(), collection: jest.fn(), deleteField: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), limit: jest.fn(), query: jest.fn(), setDoc: jest.fn(), Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) }, where: jest.fn(), writeBatch: jest.fn() }));

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
