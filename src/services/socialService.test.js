import { pairId, otherOf, relationOf, normalizeHandle, normalizeCode, lowerName, newFriendCode, validateHandle } from './socialService';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ addDoc: jest.fn(), collection: jest.fn(), deleteField: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), limit: jest.fn(), query: jest.fn(), where: jest.fn(), writeBatch: jest.fn() }));

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
