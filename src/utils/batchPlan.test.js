import { planBatch, summarizeBatch } from './batchPlan';

const target = { seriesId: 's1', version: 2, versionId: 's1_2' };
const students = [
  { userId: 'a', displayName: 'Ana', teacherId: 't1' },
  { userId: 'b', displayName: 'Bia', teacherId: 't1' },
  { userId: 'c', displayName: 'Caio', teacherId: '' },
  { userId: 'd', displayName: 'Davi', teacherId: 't2' }
];
const assigned = [
  { studentId: 'a', seriesId: 's1', version: 1, versionId: 's1_1' },
  { studentId: 'b', seriesId: 's1', version: 2, versionId: 's1_2' },
  { studentId: 'd', seriesId: 's9', version: 3, versionId: 's9_3' }
];
const plan = (mode, selectedIds) => planBatch({ students, assigned, target, mode, selectedIds, seriesNames: { s1: 'Perna', s9: 'Costas' } });
const ids = (rows) => rows.filter((r) => r.included).map((r) => r.studentId);

describe('planBatch', () => {
  test('todos: atualiza, troca, atribui e pula quem já usa a versão', () => {
    const rows = plan('all');
    expect(ids(rows)).toEqual(['a', 'c', 'd']);
    expect(rows.find((r) => r.studentId === 'b')).toMatchObject({ action: 'skip', note: 'Já usa esta versão' });
    expect(rows.find((r) => r.studentId === 'a')).toMatchObject({ action: 'replace', note: 'Atualiza de v1' });
    expect(rows.find((r) => r.studentId === 'c')).toMatchObject({ action: 'assign', noTeacher: true });
    expect(rows.find((r) => r.studentId === 'd')).toMatchObject({ action: 'replace', otherSeries: true, note: 'Troca Costas v3' });
  });

  test('só novos: apenas quem não tem ficha', () => {
    expect(ids(plan('new'))).toEqual(['c']);
  });

  test('versão anterior: só quem usa versão mais antiga desta mesma ficha', () => {
    expect(ids(plan('outdated'))).toEqual(['a']);
  });

  test('selecionados: respeita a escolha, e a escolha de quem já usa a versão não grava', () => {
    expect(ids(plan('selected', ['c', 'b']))).toEqual(['c']);
    expect(ids(plan('selected', []))).toEqual([]);
  });

  test('resumo conta atribuições, trocas, outras fichas, sem professor e pulados', () => {
    expect(summarizeBatch(plan('all'))).toEqual({ total: 3, assign: 1, replace: 2, otherSeries: 1, noTeacher: 1, skipped: 1 });
  });
});
