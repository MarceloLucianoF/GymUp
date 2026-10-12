import { normalizeCode, linkState, filterCoaches, isInviteId, newInviteId, inviteStatus, parseFee, INVITE_MESSAGES } from './coachLinkService';

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

describe('convite por link', () => {
  it('ID do convite: formato i_ + 20 caracteres, aleatório e distinguível do UID do treinador', () => {
    const id = newInviteId();
    expect(isInviteId(id)).toBe(true);
    expect(newInviteId()).not.toBe(id);
    expect(isInviteId('bDDFE2kKpDagWh18OiNKMJojGbR2')).toBe(false);   // UID de treinador
    expect(isInviteId('i_curto')).toBe(false);
    expect(normalizeCode(`https://x.com/convite/${id}`)).toBe(id);
  });

  it('situação: ativo, revogado, expirado, esgotado e inexistente', () => {
    const now = 1_000_000;
    const base = { expiresAt: { toMillis: () => now + 1000 }, maxUses: 2, uses: 1, revoked: false };
    expect(inviteStatus(base, now)).toBe('ok');
    expect(inviteStatus({ ...base, revoked: true }, now)).toBe('revoked');
    expect(inviteStatus({ ...base, expiresAt: { toMillis: () => now - 1 } }, now)).toBe('expired');
    expect(inviteStatus({ ...base, uses: 2 }, now)).toBe('exhausted');
    expect(inviteStatus(null, now)).toBe('missing');
    Object.values(INVITE_MESSAGES).forEach((m) => expect(m.length).toBeGreaterThan(10));
  });
});

describe('parseFee (mensalidade)', () => {
  it('aceita número positivo, com vírgula ou ponto, até 2 casas', () => {
    expect(parseFee('120')).toBe(120);
    expect(parseFee('175,5')).toBe(175.5);
    expect(parseFee(' 99.90 ')).toBe(99.9);
    expect(parseFee(150)).toBe(150);
  });
  it('recusa vazio, zero, negativo, texto, notação científica e valor enorme', () => {
    ['', ' ', '0', '0,00', '-5', 'abc', '1e3', '12,345', '100001', null, undefined].forEach((v) => expect(parseFee(v)).toBeNull());
  });
});

describe('parseFee com allowZero (isento no Financeiro)', () => {
  it('aceita 0 só com a opção; continua recusando negativo e texto', () => {
    expect(parseFee('0', { allowZero: true })).toBe(0);
    expect(parseFee('0,00', { allowZero: true })).toBe(0);
    expect(parseFee('-1', { allowZero: true })).toBeNull();
    expect(parseFee('abc', { allowZero: true })).toBeNull();
    expect(parseFee('0')).toBeNull();
  });
});
