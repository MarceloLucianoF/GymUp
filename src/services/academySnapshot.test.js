import { clearAllSnapshots, clearSnapshot, loadSnapshot, saveSnapshot, toSnapshot } from './academySnapshot';

const training = { academyId: 'acad000000000000000001', assignmentId: 'asg_00000000000001', trainingVersionId: 'tpl_1', versionHash: 'f'.repeat(64), name: 'Perna A', description: '', version: 1, exercises: [{ name: 'Agachamento', sets: '3', reps: '10', rest: 60 }] };
beforeEach(() => localStorage.clear());

test('toSnapshot guarda só a ficha e o que o app precisa (id, versão, hash, exercícios, data de download)', () => {
  const s = toSnapshot({ ...training, extra: 'nao-entra' }, () => '2026-10-14T00:00:00.000Z');
  expect(Object.keys(s).sort()).toEqual(['academyId', 'assignmentId', 'description', 'downloadedAt', 'exercises', 'name', 'trainingVersionId', 'version', 'versionHash']);
  expect(s.downloadedAt).toBe('2026-10-14T00:00:00.000Z');
});

test('salva, carrega por usuário e academia, e apaga', () => {
  const s = toSnapshot(training);
  expect(saveSnapshot('u1', s)).toBe(true);
  expect(loadSnapshot('u1', s.academyId).trainingVersionId).toBe('tpl_1');
  expect(loadSnapshot('u2', s.academyId)).toBeNull();                      // outro usuário do mesmo aparelho não lê
  expect(loadSnapshot('u1', 'outra000000000000000000')).toBeNull();
  clearSnapshot('u1', s.academyId);
  expect(loadSnapshot('u1', s.academyId)).toBeNull();
});

test('snapshot corrompido ou de outra academia é ignorado; limpar tudo só apaga o usuário', () => {
  const s = toSnapshot(training);
  localStorage.setItem(`academyup_ac_snapshot_u1_${s.academyId}`, '{nao-json');
  expect(loadSnapshot('u1', s.academyId)).toBeNull();
  localStorage.setItem(`academyup_ac_snapshot_u1_${s.academyId}`, JSON.stringify({ ...s, academyId: 'trocada000000000000000' }));
  expect(loadSnapshot('u1', s.academyId)).toBeNull();
  saveSnapshot('u1', s); saveSnapshot('u2', s);
  clearAllSnapshots('u1');
  expect(loadSnapshot('u1', s.academyId)).toBeNull();
  expect(loadSnapshot('u2', s.academyId)).not.toBeNull();
});

test('sem localStorage disponível não quebra', () => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw new Error('cheio'); };
  expect(saveSnapshot('u1', toSnapshot(training))).toBe(false);
  Storage.prototype.setItem = real;
});
