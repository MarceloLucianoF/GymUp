jest.mock('../firebase/config', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('./academyTrainingService', () => ({ getMyAssignedTraining: jest.fn() }));
import { AcademyApiError } from './academyApi';
import { loadSnapshot, saveSnapshot, toSnapshot } from './academySnapshot';
import { loadAssignedTraining } from './academyTrainingSource';
import { getMyAssignedTraining } from './academyTrainingService';

const ACAD = 'acad000000000000000001';
const training = { academyId: ACAD, assignmentId: 'asg_00000000000001', trainingVersionId: 'tpl_1', versionHash: 'f'.repeat(64), name: 'Perna A', description: '', version: 1, exercises: [{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }] };
beforeEach(() => { localStorage.clear(); getMyAssignedTraining.mockResolvedValue({ assignment: { versionId: 'antigo_1' }, version: { name: 'Firestore' } }); });   // o CRA zera mocks a cada teste

test('com a API desligada usa o caminho antigo (Firestore)', async () => {
  const r = await loadAssignedTraining(ACAD, 'u1', { enabled: false, api: {} });
  expect(r.version.name).toBe('Firestore');
  expect(getMyAssignedTraining).toHaveBeenCalledWith(ACAD, 'u1');
});

test('com a API ligada devolve a versão atribuída e salva o snapshot (id, hash, exercícios)', async () => {
  const r = await loadAssignedTraining(ACAD, 'u1', { enabled: true, api: { training: async () => ({ training }) } });
  expect(r.source).toBe('api');
  expect(r.assignment).toMatchObject({ versionId: 'tpl_1', assignmentId: 'asg_00000000000001', versionHash: 'f'.repeat(64) });
  expect(r.version.exercises).toHaveLength(1);
  expect(loadSnapshot('u1', ACAD)).toMatchObject({ trainingVersionId: 'tpl_1', versionHash: 'f'.repeat(64) });
  expect(getMyAssignedTraining).not.toHaveBeenCalled();
});

test('offline (erro de rede): usa o snapshot salvo; sem snapshot, devolve null', async () => {
  const offline = { training: async () => { throw new AcademyApiError('network', 0); } };
  expect(await loadAssignedTraining(ACAD, 'u1', { enabled: true, api: offline })).toBeNull();
  saveSnapshot('u1', toSnapshot(training));
  const r = await loadAssignedTraining(ACAD, 'u1', { enabled: true, api: offline });
  expect(r.source).toBe('snapshot');
  expect(r.assignment.versionId).toBe('tpl_1');
});

test('o servidor é a autoridade: sem ficha apaga o snapshot; sem vínculo apaga e NÃO devolve ficha antiga', async () => {
  saveSnapshot('u1', toSnapshot(training));
  expect(await loadAssignedTraining(ACAD, 'u1', { enabled: true, api: { training: async () => ({ training: null }) } })).toBeNull();
  expect(loadSnapshot('u1', ACAD)).toBeNull();
  saveSnapshot('u1', toSnapshot(training));
  await expect(loadAssignedTraining(ACAD, 'u1', { enabled: true, api: { training: async () => { throw new AcademyApiError('membership_inactive', 403); } } })).rejects.toMatchObject({ code: 'membership_inactive' });
  expect(loadSnapshot('u1', ACAD)).toBeNull();
});

test('outro erro do servidor (ex.: limite) não cai no snapshot nem o apaga', async () => {
  saveSnapshot('u1', toSnapshot(training));
  await expect(loadAssignedTraining(ACAD, 'u1', { enabled: true, api: { training: async () => { throw new AcademyApiError('rate_limited', 429); } } })).rejects.toMatchObject({ code: 'rate_limited' });
  expect(loadSnapshot('u1', ACAD)).not.toBeNull();
});
