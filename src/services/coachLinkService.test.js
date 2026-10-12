import { normalizeCode, linkState, filterCoaches } from './coachLinkService';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), limit: jest.fn(), query: jest.fn(), where: jest.fn(), writeBatch: jest.fn() }));

describe('normalizeCode', () => {
  it('aceita o código puro ou o link de convite', () => {
    expect(normalizeCode('  abc123  ')).toBe('abc123');
    expect(normalizeCode('https://bohtreinar.marcelo-labs.workers.dev/convite/abc123')).toBe('abc123');
    expect(normalizeCode('https://x.com/convite/abc123?ref=1#a')).toBe('abc123');
    expect(normalizeCode(null)).toBe('');
  });
});

describe('linkState', () => {
  it('coachId no perfil vale como ativo (inclui vínculos antigos sem documento)', () => {
    expect(linkState({ coachId: 'c1' }, null)).toBe('active');
    expect(linkState({}, { status: 'pending' })).toBe('pending');
    expect(linkState({}, { status: 'rejected' })).toBe('rejected');
    expect(linkState({}, { status: 'revoked' })).toBe('revoked');
    expect(linkState({}, null)).toBe('none');
    expect(linkState({ coachId: null }, { status: 'active' })).toBe('none'); // sem coachId não há acesso
  });
});

describe('filterCoaches', () => {
  const list = [{ uid: '1', displayName: 'Marcos Silva', bio: 'Hipertrofia' }, { uid: '2', displayName: 'Ana Souza', bio: '' }];
  it('busca por nome ou bio sem acento', () => {
    expect(filterCoaches(list, 'marcos').map((c) => c.uid)).toEqual(['1']);
    expect(filterCoaches(list, 'HIPERTROFIA').map((c) => c.uid)).toEqual(['1']);
    expect(filterCoaches(list, '')).toHaveLength(2);
  });
});
