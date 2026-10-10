import { chunk, runInChunks, planBulkAssign } from './coachBatch';

describe('chunk', () => {
  it('divide em lotes', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 30)).toEqual([]);
  });
  it('tamanho inválido vira 1', () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe('runInChunks', () => {
  it('separa sucessos e falhas e respeita o tamanho do lote', async () => {
    let running = 0;
    let peak = 0;
    const worker = async (n) => {
      running += 1; peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
      if (n === 3) throw new Error('boom');
    };
    const { ok, failed } = await runInChunks([1, 2, 3, 4, 5], 2, worker);
    expect(ok).toEqual([1, 2, 4, 5]);
    expect(failed.map((f) => f.item)).toEqual([3]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('planBulkAssign', () => {
  const trainings = [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }];
  it('classifica quem muda e quem já tem a ficha', () => {
    const students = [{ id: 's1', currentTrainingId: 't1' }, { id: 's2', currentTrainingId: 't2' }, { id: 's3' }, { id: 's4', currentTrainingId: 'x' }];
    const plan = planBulkAssign(students, 't1', trainings);
    expect(plan.same.map((s) => s.id)).toEqual(['s1']);
    expect(plan.change.map((c) => [c.student.id, c.from])).toEqual([['s2', 'B'], ['s3', null], ['s4', 'Ficha removida']]);
  });
});
