import { bodyDensity, bodyFatPercent, fatAndLeanMass, requiredSites, siri } from './bodyComposition';

describe('bodyComposition (Jackson-Pollock + Siri)', () => {
  test('Pollock 3, homem: peito, abdome e coxa', () => {
    const input = { protocol: 'pollock3', sex: 'male', age: 30, skinfolds: { chest: 10, abdomen: 20, thigh: 15 } };
    expect(bodyDensity(input)).toBeCloseTo(1.0676965, 6);
    expect(bodyFatPercent(input)).toBe(13.6);
  });

  test('Pollock 3, mulher: tríceps, suprailíaca e coxa (ignora dobras de fora do protocolo)', () => {
    const input = { protocol: 'pollock3', sex: 'female', age: 25, skinfolds: { triceps: 20, suprailiac: 15, thigh: 25, chest: 99 } };
    expect(bodyDensity(input)).toBeCloseTo(1.0447181, 6);
    expect(bodyFatPercent(input)).toBe(23.8);
  });

  test('Pollock 7, homem e mulher (aceita vírgula decimal)', () => {
    const seven = (each) => Object.fromEntries(requiredSites('pollock7', 'male').map((s) => [s, each]));
    const male = { protocol: 'pollock7', sex: 'male', age: 40, skinfolds: { ...seven(14), thigh: '16' } };
    expect(bodyFatPercent(male)).toBe(15.9);
    const female = { protocol: 'pollock7', sex: 'female', age: '35', skinfolds: { ...seven(17), thigh: '18,0' } };
    expect(bodyFatPercent(female)).toBe(24);
  });

  test('falta de dado ou valor implausível devolve null', () => {
    expect(bodyFatPercent({ protocol: 'pollock3', sex: 'male', age: 30, skinfolds: { chest: 10, abdomen: 20 } })).toBeNull();
    expect(bodyFatPercent({ protocol: 'pollock3', sex: 'x', age: 30, skinfolds: { chest: 10, abdomen: 20, thigh: 15 } })).toBeNull();
    expect(bodyFatPercent({ protocol: 'durnin', sex: 'male', age: 30, skinfolds: {} })).toBeNull();
    expect(bodyFatPercent({ protocol: 'pollock3', sex: 'male', skinfolds: { chest: 10, abdomen: 20, thigh: 15 } })).toBeNull();
    expect(bodyFatPercent({ protocol: 'pollock3', sex: 'male', age: 30, skinfolds: { chest: -1, abdomen: 20, thigh: 15 } })).toBeNull();
    expect(bodyFatPercent({ protocol: 'pollock3', sex: 'male', age: 20, skinfolds: { chest: 1, abdomen: 1, thigh: 1 } })).toBeNull();
    expect(siri(0)).toBeNull();
  });

  test('massa gorda e magra', () => {
    expect(fatAndLeanMass(80, 20)).toEqual({ fat: 16, lean: 64 });
    expect(fatAndLeanMass(null, 20)).toBeNull();
  });
});
