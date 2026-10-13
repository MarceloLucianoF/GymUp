// jsdom não traz Web Crypto
global.crypto = global.crypto || require('crypto').webcrypto;

import { adherenceStatus, adherenceValidUntil, ADHERENCE, isAcademyInviteId, newAcademyId, newInviteId, memberId } from './academyService';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), increment: jest.fn(), query: jest.fn(),
  serverTimestamp: jest.fn(), setDoc: jest.fn(), where: jest.fn(), writeBatch: jest.fn(), deleteDoc: jest.fn(),
  Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) }
}));

test('aderência: sem documento é sem_dados; futuro é em_dia; vencido é atrasado', () => {
  const t = Date.now();
  expect(adherenceStatus(null)).toBe(ADHERENCE.noData);
  expect(adherenceStatus({})).toBe(ADHERENCE.noData);
  expect(adherenceStatus({ validUntil: { toMillis: () => t + 1000 } }, t)).toBe(ADHERENCE.onTrack);
  expect(adherenceStatus({ validUntil: { toMillis: () => t - 1000 } }, t)).toBe(ADHERENCE.late);
  expect(adherenceStatus({ validUntil: 'lixo' }, t)).toBe(ADHERENCE.noData);
});

test('validade gravada é de 7 dias', () => {
  const t = 1_000_000;
  expect(adherenceValidUntil(t).toMillis()).toBe(t + 7 * 86400000);
});

test('ids seguem o formato exigido pelas regras', () => {
  expect(newAcademyId()).toMatch(/^[a-z0-9]{20}$/);
  expect(isAcademyInviteId(newInviteId())).toBe(true);
  expect(isAcademyInviteId('i_abcdefghijklmnopqrst')).toBe(false);
  expect(memberId('abc', 'u1')).toBe('abc_u1');
});
