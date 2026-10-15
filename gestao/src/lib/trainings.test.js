import { describe, expect, test } from 'vitest';
import { emptyDraft, emptyExercise, hasErrors, move, toPayload, validateDraft } from './trainings';

const ok = () => ({ name: 'Perna A', description: '', exercises: [{ name: 'Agachamento', muscleGroup: '', sets: '3', reps: '10', rest: 60 }, { name: 'Leg Press', muscleGroup: 'pernas', sets: '4', reps: '8-12', rest: 90 }] });

describe('validateDraft', () => {
  test('ficha válida não tem erros', () => expect(hasErrors(validateDraft(ok()))).toBe(false));
  test('rascunho vazio pede nome e exercício', () => {
    const e = validateDraft(emptyDraft());
    expect(e.name).toMatch(/nome/i);
    expect(e.exercises[0]).toMatch(/nome do exercício/i);
  });
  test('limites: 20 exercícios, descanso 0 a 300, séries e repetições obrigatórias', () => {
    const d = ok();
    d.exercises = Array.from({ length: 21 }, (_, i) => ({ ...emptyExercise(), name: `Ex ${i}` }));
    expect(validateDraft(d).list).toMatch(/20/);
    const r = ok(); r.exercises[0].rest = 301;
    expect(validateDraft(r).exercises[0]).toMatch(/descanso/);
    const s = ok(); s.exercises[1].sets = ' ';
    expect(validateDraft(s).exercises[1]).toMatch(/séries/);
  });
  test('nome repetido (sem acento ou caixa) é recusado, porque a comparação de versões usa o nome', () => {
    const d = ok(); d.exercises[1].name = 'agachamento ';
    expect(validateDraft(d).exercises[1]).toMatch(/Repetido/);
  });
});

describe('toPayload e move', () => {
  test('apara textos, converte descanso e omite grupo vazio', () => {
    const d = ok(); d.name = '  Perna A '; d.exercises[0].rest = '45';
    const p = toPayload(d);
    expect(p.name).toBe('Perna A');
    expect(p.exercises[0]).toEqual({ name: 'Agachamento', sets: '3', reps: '10', rest: 45 });
    expect(p.exercises[1].muscleGroup).toBe('pernas');
  });
  test('move respeita os limites da lista', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(move([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
  });
});
