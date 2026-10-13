import { rotationGroup, suggestNext, isInactive, goalSentence, whenLabel } from './rotation';

const NOW = new Date(2026, 9, 14, 15, 0);                      // quarta, 14/10/2026 (fuso local)
const at = (daysAgo, hour = 10) => new Date(2026, 9, 14 - daysAgo, hour).toISOString();
const pkg = (id, name, order, extra = {}) => ({ firestoreId: id, name, packageId: 'p1', order, ...extra });
const A = pkg('a', 'Treino A', 0), B = pkg('b', 'Treino B', 1), C = pkg('c', 'Treino C', 2);
const done = (trainingId, daysAgo, name) => ({ trainingId, trainingName: name || trainingId, date: at(daysAgo) });

describe('grupo de rotação', () => {
  it('programa (packageId) na ordem definida; ignora arquivadas e pausadas', () => {
    expect(rotationGroup([C, A, B], A).map((t) => t.name)).toEqual(['Treino A', 'Treino B', 'Treino C']);
    expect(rotationGroup([A, B, { ...C, status: 'archived' }], A).map((t) => t.name)).toEqual(['Treino A', 'Treino B']);
    expect(rotationGroup([A, { ...B, paused: true }, C], A).map((t) => t.name)).toEqual(['Treino A', 'Treino C']);
  });

  it('sem programa: fichas "Treino A/B/C" do mesmo treinador; ficha avulsa gira sozinha', () => {
    const mk = (id, name, coachId) => ({ firestoreId: id, name, coachId });
    const list = [mk('1', 'Treino C — Pernas', 'x'), mk('2', 'Treino A — Peito', 'x'), mk('3', 'Treino B — Costas', 'x'), mk('4', 'Full Body Express', 'x'), mk('5', 'Treino A — de outro', 'y')];
    expect(rotationGroup(list, list[1]).map((t) => t.firestoreId)).toEqual(['2', '3', '1']);
    expect(rotationGroup(list, list[3]).map((t) => t.firestoreId)).toEqual(['4']);
  });

  it('ficha atribuída arquivada não gira', () => {
    expect(rotationGroup([{ ...A, archived: true }, B], { ...A, archived: true })).toEqual([]);
    expect(isInactive({ status: 'Pausada' })).toBe(true);
    expect(isInactive({ name: 'ok' })).toBe(false);
  });
});

describe('próxima ficha', () => {
  const base = { trainings: [A, B, C], assignedId: 'a', weeklyGoal: 4, weekCount: 1, now: NOW };

  it('depois da A vem a B; depois da última volta à primeira', () => {
    expect(suggestNext({ ...base, history: [done('a', 1)] }).training.name).toBe('Treino B');
    const r = suggestNext({ ...base, history: [done('c', 0), done('b', 2)] });
    expect(r.training.name).toBe('Treino A');
    expect(r.source).toBe('sequence');
    expect(r.reason).toBe('Você concluiu Treino C hoje. A próxima da sequência (1 de 3) é Treino A.');
  });

  it('usa a conclusão mais recente do programa e fala em "ontem" pelo dia do calendário (não por 24 h)', () => {
    const r = suggestNext({ ...base, history: [{ trainingId: 'a', date: new Date(2026, 9, 13, 23, 50).toISOString() }, done('b', 5)] });
    expect(r.last.daysAgo).toBe(1);
    expect(r.reason).toContain('ontem');
    expect(r.training.name).toBe('Treino B');
  });

  it('não repete a mesma ficha quando há outras; ficha única segue sendo a única', () => {
    expect(suggestNext({ ...base, history: [done('b', 1)] }).training.name).toBe('Treino C');
    const solo = suggestNext({ trainings: [A], assignedId: 'a', history: [done('a', 1)], weeklyGoal: 3, weekCount: 0, now: NOW });
    expect(solo.training.name).toBe('Treino A');
    expect(solo.source).toBe('assigned');
  });

  it('nada concluído: começa pela ficha atribuída; sem atribuição prefere a que nunca foi feita', () => {
    expect(suggestNext({ ...base, assignedId: 'b', history: [] })).toMatchObject({ source: 'first', training: { name: 'Treino B' } });
    const r = suggestNext({ trainings: [A, B, C], assignedId: null, history: [done('a', 1)], weeklyGoal: 4, weekCount: 0, now: NOW });
    expect(r.source).toBe('fallback');
    expect(r.training.name).toBe('Treino B');                                    // nunca feita
    const all = suggestNext({ trainings: [A, B], assignedId: null, history: [done('b', 0), done('a', 3)], weeklyGoal: 4, weekCount: 0, now: NOW });
    expect(all.training.name).toBe('Treino A');                                  // evita repetir a última
  });

  it('só conta treinos concluídos e já ocorridos; ignora registros sem data ou de outras fichas', () => {
    const r = suggestNext({ ...base, history: [{ trainingId: 'a', date: 'x' }, { trainingId: 'zzz', date: at(0) }, { trainingId: 'a', date: new Date(2027, 0, 1).toISOString() }] });
    expect(r.source).toBe('first');
  });

  it('meta da semana: números reais, bônus quando cumprida, treinou hoje', () => {
    const met = suggestNext({ ...base, weekCount: 4, history: [done('a', 0)], trainedToday: true });
    expect(met.goal.met).toBe(true);
    expect(goalSentence(met.goal, true)).toBe('Meta da semana cumprida (4 de 4): um treino a mais é bônus.');
    const open = suggestNext({ ...base, weekCount: 3, history: [done('a', 0)], trainedToday: true });
    expect(goalSentence(open.goal, true)).toBe('Hoje já treinou. Faltam 1 treino para a meta (3 de 4).');
    expect(goalSentence({ weeklyGoal: 0 })).toBe('');
  });

  it('sem fichas disponíveis (tudo arquivado) não sugere nada; rótulos de data', () => {
    expect(suggestNext({ trainings: [{ ...A, archived: true }], assignedId: 'a', history: [], now: NOW }).training).toBeNull();
    expect(whenLabel(0)).toBe('hoje');
    expect(whenLabel(3)).toBe('há 3 dias');
  });
});
