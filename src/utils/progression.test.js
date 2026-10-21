import { dropLoad, loadStep, parseRepRange, suggestNext } from './progression';

const doc = (sets, name = 'Supino', date = '2026-10-18T10:00:00.000Z') => ({ date, exercises: [{ name, sets }] });
const s = (weight, reps, extra = {}) => ({ weight, reps, completed: true, ...extra });

test('faixa de repetições da ficha', () => {
  expect(parseRepRange('8-12')).toEqual({ lo: 8, hi: 12 });
  expect(parseRepRange('12 a 8')).toEqual({ lo: 8, hi: 12 });
  expect(parseRepRange('10')).toEqual({ lo: 10, hi: 10 });
  expect(parseRepRange('')).toEqual({ lo: 8, hi: 12 });
  expect(parseRepRange('até a falha')).toEqual({ lo: 8, hi: 12 });
});

describe('dupla progressão', () => {
  test('todas as séries no teto: sobe a carga e volta ao piso', () => {
    const r = suggestNext({ historyDocs: [doc([s(60, 12), s(60, 12), s(60, 13)])], exName: 'Supino', reps: '8-12', exercise: { name: 'Supino Reto Máquina' } });
    expect(r).toMatchObject({ kind: 'increase', load: 62.5, reps: 8 });
    expect(r.text).toMatch(/Subir para 62,5 kg/);
  });
  test('halteres sobem de 2 em 2 kg (de 1 em 1 abaixo de 20 kg)', () => {
    expect(suggestNext({ historyDocs: [doc([s(20, 12), s(20, 12)])], exName: 'Supino', reps: '8-12', exercise: { name: 'Supino com Halteres', equipment: 'halter' } }).load).toBe(22);
    expect(suggestNext({ historyDocs: [doc([s(12, 12), s(12, 12)])], exName: 'Supino', reps: '8-12', exercise: { name: 'Rosca Martelo', equipment: 'halter' } }).load).toBe(13);
    expect(loadStep({ name: 'Leg Press' }, 100)).toBe(2.5);
  });
  test('abaixo do teto: mantém a carga e pede uma repetição a mais (a série mais fraca manda)', () => {
    const r = suggestNext({ historyDocs: [doc([s(60, 10), s(60, 9), s(60, 10)])], exName: 'Supino', reps: '8-12', exercise: {} });
    expect(r).toMatchObject({ kind: 'reps', load: 60, reps: 10 });
  });
  test('abaixo do piso: repete a carga até chegar ao piso', () => {
    expect(suggestNext({ historyDocs: [doc([s(70, 6), s(70, 5)])], exName: 'Supino', reps: '8-12', exercise: {} })).toMatchObject({ kind: 'hold', load: 70, reps: 8 });
  });
  test('repetição única na ficha: bateu o alvo em todas, sobe a carga', () => {
    expect(suggestNext({ historyDocs: [doc([s(40, 10), s(40, 10)])], exName: 'Supino', reps: '10', exercise: {} })).toMatchObject({ kind: 'increase', load: 42.5, reps: 10 });
  });
  test('aquecimento e drop-set não entram na conta', () => {
    const r = suggestNext({ historyDocs: [doc([s(20, 15, { type: 'warmup' }), s(60, 12), s(60, 12), s(40, 6, { type: 'drop' })])], exName: 'Supino', reps: '8-12', exercise: {} });
    expect(r).toMatchObject({ kind: 'increase', load: 62.5 });
    expect(r.last).toMatchObject({ load: 60, minReps: 12 });
  });
  test('só vale a carga mais alta: séries mais leves não puxam a regra para baixo', () => {
    const r = suggestNext({ historyDocs: [doc([s(50, 12), s(60, 12), s(60, 12)])], exName: 'Supino', reps: '8-12', exercise: {} });
    expect(r).toMatchObject({ kind: 'increase', load: 62.5 });
  });
  test('sem histórico do exercício devolve null; usa o treino mais recente que tem o exercício', () => {
    expect(suggestNext({ historyDocs: [], exName: 'Supino', reps: '8-12' })).toBeNull();
    expect(suggestNext({ historyDocs: [doc([s(10, 10)], 'Outro')], exName: 'Supino', reps: '8-12' })).toBeNull();
    const r = suggestNext({ historyDocs: [doc([s(10, 10)], 'Outro'), doc([s(50, 8)]), doc([s(30, 12)])], exName: 'Supino', reps: '8-12' });
    expect(r.last.load).toBe(50);
  });
  test('última vez sem carga registrada: pede para definir', () => {
    expect(suggestNext({ historyDocs: [doc([s(0, 12), s(0, 12)])], exName: 'Supino', reps: '8-12' }).kind).toBe('start');
  });
  test('carga do drop-set: cerca de 70%, em passos de 0,5 kg', () => {
    expect(dropLoad(60)).toBe(42);
    expect(dropLoad(16)).toBe(11);
    expect(dropLoad(0)).toBe(0);
  });
});

describe('esforço percebido (RPE)', () => {
  const r = (weight, reps, rpe) => ({ weight, reps, completed: true, rpe });
  test('bateu o teto no limite do esforço: segura a carga', () => {
    const out = suggestNext({ historyDocs: [doc([r(60, 12, 10), r(60, 12, 10), r(60, 12, 9)])], exName: 'Supino', reps: '8-12', exercise: {} });
    expect(out).toMatchObject({ kind: 'hold', load: 60, reps: 12 });
    expect(out.text).toMatch(/limite do esforço/);
  });
  test('bateu o teto e achou leve: salto maior', () => {
    const out = suggestNext({ historyDocs: [doc([r(60, 12, 7), r(60, 12, 7), r(60, 12, 6)])], exName: 'Supino', reps: '8-12', exercise: {} });
    expect(out).toMatchObject({ kind: 'increase', load: 65 });
    expect(out.text).toMatch(/achou leve/);
  });
  test('bateu o teto com esforço normal: salto de sempre; sem RPE marcado em todas, ignora o esforço', () => {
    expect(suggestNext({ historyDocs: [doc([r(60, 12, 8), r(60, 12, 8), r(60, 12, 9)])], exName: 'Supino', reps: '8-12', exercise: {} }).load).toBe(62.5);
    expect(suggestNext({ historyDocs: [doc([r(60, 12, 10), s(60, 12), s(60, 12)])], exName: 'Supino', reps: '8-12', exercise: {} }).load).toBe(62.5);
  });
  test('dentro da faixa mas muito leve: já sobe um salto', () => {
    expect(suggestNext({ historyDocs: [doc([r(40, 9, 6), r(40, 9, 6), r(40, 10, 5)])], exName: 'Supino', reps: '8-12', exercise: {} })).toMatchObject({ kind: 'increase', load: 42.5, reps: 8 });
    expect(suggestNext({ historyDocs: [doc([r(40, 9, 8), r(40, 9, 8)])], exName: 'Supino', reps: '8-12', exercise: {} }).kind).toBe('reps');
  });
  test('a média de esforço vai em last.rpe', () => {
    expect(suggestNext({ historyDocs: [doc([r(40, 10, 8), r(40, 10, 9)])], exName: 'Supino', reps: '8-12', exercise: {} }).last.rpe).toBe(8.5);
  });
});
