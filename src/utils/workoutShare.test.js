import { duplicatePayload, workoutShareText } from './workoutShare';

const workout = { name: 'Treino de Braço', exercises: [
  { name: 'Rosca Scott Martelo com Halteres', sets: '3', reps: '6-10', setTypes: ['drop', 'drop', 'drop'], note: 'carga 16 kg', superset: 'A' },
  { name: 'Tríceps Francês na Polia Unilateral', sets: '3', reps: '12', superset: 'A' },
  { name: 'Esteira', kind: 'cardio', reps: '15', sets: '1' },
  { name: 'Prancha', kind: 'timed', sets: '3', reps: '30' }
] };

test('texto do treino: prescrição por tipo, plano de séries, anotação e superset agrupado', () => {
  const t = workoutShareText(workout);
  expect(t.split('\n')).toEqual([
    'Treino: Treino de Braço',
    'Bi-set A:',
    '  - Rosca Scott Martelo com Halteres: 3 x 6-10 [3 Drop] (carga 16 kg)',
    '  - Tríceps Francês na Polia Unilateral: 3 x 12',
    '- Esteira: 15 min',
    '- Prancha: 3 x 30 s',
    '',
    'Feito no BohTreinar'
  ]);
  expect(t).not.toMatch(/https?:|@|uid/i);
});

test('duplicar: nome com "(cópia)" sem acumular, conteúdo copiado sem compartilhar referência', () => {
  const copy = duplicatePayload(workout);
  expect(copy.name).toBe('Treino de Braço (cópia)');
  expect(duplicatePayload({ ...workout, name: 'Treino de Braço (cópia)' }).name).toBe('Treino de Braço (cópia)');
  expect(copy.exercises).toHaveLength(4);
  expect(copy.exercises[0]).not.toBe(workout.exercises[0]);
  expect(duplicatePayload({ name: 'x'.repeat(90), exercises: [] }).name).toHaveLength(80);
  expect(duplicatePayload({ name: 'A', exercises: [], photo: 'data:image/jpeg;base64,/9j/', source: 'ai' })).toMatchObject({ source: 'ai', photo: 'data:image/jpeg;base64,/9j/' });
});

test('rótulo do grupo pelo tamanho: tri-set e circuito', () => {
  const ex = (name, g) => ({ name, sets: '3', reps: '10', superset: g });
  expect(workoutShareText({ name: 'T', exercises: [ex('a', 'A'), ex('b', 'A'), ex('c', 'A')] })).toMatch(/^Tri-set A:$/m);
  expect(workoutShareText({ name: 'T', exercises: [ex('a', 'B'), ex('b', 'B'), ex('c', 'B'), ex('d', 'B')] })).toMatch(/^Circuito B:$/m);
});
