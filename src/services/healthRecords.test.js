import { getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  buildAssessment, buildAnamnesis, compareAssessments, consentCovers, getConsent, grantConsent, parqNeedsClearance,
  revokeConsent, saveAnamnesis, toNumber, CONSENT_VERSION
} from './healthRecords';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (db, col) => ({ col }),
  doc: (db, col, id) => (typeof db === 'object' && db.col ? { id: 'novoId' } : { col, id }),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  setDoc: jest.fn(async () => {}),
  deleteDoc: jest.fn(async () => {})
}));

const ALLOWED = ['userId', 'coachId', 'kind', 'date', 'createdAt', 'updatedAt', 'createdBy', 'sex', 'age', 'weight', 'height', 'perimeters', 'skinfolds', 'bodyFat', 'bioimpedance', 'notes'];

describe('buildAssessment', () => {
  test('avaliação do instrutor: calcula % de gordura e guarda só campos do contrato', () => {
    const data = buildAssessment({
      date: '2026-10-29', sex: 'male', age: '30', weight: '80,5', height: '178', extra: 'x',
      perimeters: { arm: '35', waist: '', neck: '40' },
      skinfolds: { protocol: 'pollock3', chest: '10', abdomen: '20', thigh: '15', knee: '3' },
      bioimpedance: { bodyFat: '', water: '55' }, notes: '  ok  '
    }, { userId: 'stu1', authorId: 'coach1', kind: 'instructor', coachId: 'coach1' });
    expect(Object.keys(data).every((k) => ALLOWED.includes(k))).toBe(true);
    expect(data).toMatchObject({
      userId: 'stu1', kind: 'instructor', coachId: 'coach1', createdBy: 'coach1', date: '2026-10-29', sex: 'male', age: 30,
      weight: 80.5, height: 178, perimeters: { arm: 35 }, bodyFat: 13.6, bioimpedance: { water: 55 }, notes: 'ok'
    });
    expect(data.skinfolds).toEqual({ protocol: 'pollock3', chest: 10, abdomen: 20, thigh: 15 });
  });

  test('avaliação própria não leva coachId; fora do intervalo é descartado', () => {
    const data = buildAssessment({ weight: '5', height: '999', age: '7', sex: 'x', date: 'ontem' }, { userId: 'u', authorId: 'u', kind: 'self' });
    expect(data.coachId).toBeUndefined();
    expect(data.weight).toBeUndefined();
    expect(data.height).toBeUndefined();
    expect(data.age).toBeUndefined();
    expect(data.sex).toBeUndefined();
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(() => buildAssessment({}, { userId: 'u', authorId: 'u', kind: 'hack' })).toThrow();
  });

  test('toNumber aceita vírgula e respeita o intervalo', () => {
    expect(toNumber('12,34', [0, 100])).toBe(12.3);
    expect(toNumber('', [0, 100])).toBeUndefined();
    expect(toNumber('abc', [0, 100])).toBeUndefined();
    expect(toNumber(101, [0, 100])).toBeUndefined();
  });
});

describe('anamnese', () => {
  test('PAR-Q sempre com 7 respostas booleanas e aviso quando há "sim"', () => {
    const data = buildAnamnesis({ parq: { 2: true }, injuries: 'joelho', goals: 'x'.repeat(2000), extra: 1 }, { userId: 'u', version: 3 });
    expect(data.parq).toEqual([false, false, true, false, false, false, false]);
    expect(data.goals).toHaveLength(1000);
    expect(data.extra).toBeUndefined();
    expect(parqNeedsClearance(data.parq)).toBe(true);
    expect(parqNeedsClearance([false, false])).toBe(false);
  });

  test('saveAnamnesis cria a próxima versão', async () => {
    const saved = await saveAnamnesis({ parq: [] }, { userId: 'u', previous: [{ version: 1 }, { version: 4 }] });
    expect(saved.version).toBe(5);
    expect(setDoc).toHaveBeenCalledWith({ col: 'anamneses', id: 'novoId' }, expect.objectContaining({ userId: 'u', version: 5 }));
  });
});

describe('consentimento', () => {
  test('conceder grava professor, versão e data; revogar apaga', async () => {
    const data = await grantConsent('u', 'coach1');
    expect(data).toMatchObject({ coachId: 'coach1', version: CONSENT_VERSION });
    expect(setDoc).toHaveBeenCalledWith({ col: 'healthConsents', id: 'u' }, data);
    await revokeConsent('u');
    expect(deleteDoc).toHaveBeenCalledWith({ col: 'healthConsents', id: 'u' });
    await expect(grantConsent('u', null)).rejects.toThrow();
  });

  test('getConsent: inexistente ou negado vira null; outro erro propaga', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getConsent('u')).toBeNull();
    getDoc.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    expect(await getConsent('u')).toBeNull();
    getDoc.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await expect(getConsent('u')).rejects.toMatchObject({ code: 'unavailable' });
  });

  test('consentCovers só vale para o professor nomeado', () => {
    expect(consentCovers({ coachId: 'c1' }, 'c1')).toBe(true);
    expect(consentCovers({ coachId: 'c1' }, 'c2')).toBe(false);
    expect(consentCovers(null, 'c1')).toBe(false);
  });
});

test('compareAssessments mostra diferenças lado a lado', () => {
  const rows = compareAssessments({ weight: 80, perimeters: { waist: 90 } }, { weight: 78.5, bodyFat: 15, perimeters: { waist: 86 } });
  expect(rows.find((r) => r.label === 'Peso')).toMatchObject({ a: 80, b: 78.5, delta: -1.5 });
  expect(rows.find((r) => r.label === 'Cintura')).toMatchObject({ delta: -4 });
  expect(rows.find((r) => r.label.startsWith('Gordura (dobras)'))).toMatchObject({ a: undefined, b: 15, delta: null });
  expect(rows.find((r) => r.label === 'Altura')).toBeUndefined();
});
