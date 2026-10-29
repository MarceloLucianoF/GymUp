import { buildStretchWorkout, isStretchRequest } from './stretchWorkout';
import { exercises } from '../data/exercises';
import { aiService } from '../services/aiService';

test('reconhece pedido de alongamento e mobilidade', () => {
  expect(isStretchRequest('Monte um treino de alongamento')).toBe(true);
  expect(isStretchRequest('quero um aquecimento antes do treino')).toBe(true);
  expect(isStretchRequest('treino de peito')).toBe(false);
});

test('sequência de alongamento usa só exercícios do grupo mobilidade, por tempo, com GIF', () => {
  const w = buildStretchWorkout(exercises);
  expect(w.exercises).toHaveLength(8);
  w.exercises.forEach((e) => { expect(e.kind).toBe('timed'); expect(Number(e.reps)).toBeGreaterThanOrEqual(20); expect(e.machineImage).toMatch(/\.gif$/); });
  expect(w.exercises[0].name).toMatch(/Aquecimento/);   // aquecimento primeiro
  expect(w.exercises.slice(0, 2).every((e) => /Aquecimento/.test(e.name))).toBe(true);
  expect(buildStretchWorkout([{ name: 'Supino', muscleGroup: 'peito' }])).toBeNull();
});

test('o gerador entrega a sequência quando o pedido é de alongamento, sem músculo específico', () => {
  const w = aiService.generateLocalWorkout({ userRequest: 'Monte um treino de alongamento' });
  expect(w.name).toBe('Alongamento e mobilidade');
  expect(w.composition.source).toBe('regras');
});

describe('mobilidade por região e alongamento antes do treino', () => {
  const { stretchRegion, isFocusedStretchRequest, buildWarmupStretch, startsWithWarmup } = require('./stretchWorkout');
  const { needsTools } = require('../services/aiService');

  test('reconhece a região pedida e quando o pedido é de mobilidade mesmo citando músculo', () => {
    expect(stretchRegion('mobilidade de ombro')).toBe('ombros');
    expect(stretchRegion('alongamento para o quadril')).toBe('quadril');
    expect(stretchRegion('mobilidade da coluna torácica')).toBe('coluna');
    expect(stretchRegion('mobilidade de tornozelo')).toBe('pernas');
    expect(stretchRegion('mobilidade geral')).toBeNull();
    expect(isFocusedStretchRequest('Monte um treino de mobilidade de ombro')).toBe(true);
    expect(isFocusedStretchRequest('alongamento para lombar')).toBe(true);
    expect(isFocusedStretchRequest('treino de peito com aquecimento')).toBe(false);
    expect(isFocusedStretchRequest('treino de pernas e alongamento no fim')).toBe(false);
    expect(needsTools('quero um treino de mobilidade')).toBe(true);
  });

  test.each([
    ['Monte um treino de mobilidade de ombro', 'Mobilidade de ombros', /ombro|escápula|cotovelo|parede|peit|dorsal|bastão|braços|tríceps/i],
    ['quero uma sequência de mobilidade de quadril', 'Mobilidade de quadril', /quadril|glúteo|flexor|adutor|virilha|corredor|mundo|posterior/i],
    ['treino de mobilidade da coluna', 'Mobilidade de coluna', /torácica|tronco|gato|criança|lombar|pélvica|costas|dorsal|mundo|inchworm|pescoço/i]
  ])('"%s" monta a sequência da região com os exercícios novos', (request, title, re) => {
    const w = aiService.generateLocalWorkout({ userRequest: request });
    expect(w.name).toBe(title);
    expect(w.exercises.length).toBeGreaterThanOrEqual(5);
    expect(w.exercises.length).toBeLessThanOrEqual(8);
    w.exercises.forEach((e) => { expect(e.kind).toBe('timed'); expect(e.name).toMatch(re); });
  });

  test('"mobilidade geral" e "treino de alongamento" dão a sessão de corpo inteiro; "treino de peito" continua de força', () => {
    expect(aiService.generateLocalWorkout({ userRequest: 'treino de mobilidade geral' }).name).toBe('Alongamento e mobilidade');
    const peito = aiService.generateLocalWorkout({ userRequest: 'treino de peito com aquecimento' });
    expect(peito.name).not.toMatch(/Mobilidade|Alongamento/);
  });

  test('alongamento geral antes do treino: 5 a 6 exercícios por tempo, curtos, sem repetir', () => {
    const w = buildWarmupStretch(exercises);
    expect(w.length).toBeGreaterThanOrEqual(5);
    expect(w.length).toBeLessThanOrEqual(6);
    expect(new Set(w.map((e) => e.name)).size).toBe(w.length);
    w.forEach((e) => { expect(e.kind).toBe('timed'); expect(e.sets).toBe(1); expect(e.reps).toBeGreaterThanOrEqual(20); expect(e.muscleGroup).toBe('mobilidade'); });
    expect(startsWithWarmup(w.map((e) => e.name), w)).toBe(true);
    expect(startsWithWarmup(['Supino'], w)).toBe(false);
    expect(buildWarmupStretch([{ name: 'Supino', muscleGroup: 'peito' }])).toEqual([]);
  });
});
