import { WORKOUT_PRESETS, getPreset, applyPreset, reorder, formatMinutes } from './coachWorkout';

describe('presets', () => {
  it('tem as três predefinições', () => {
    expect(WORKOUT_PRESETS.map((p) => p.id)).toEqual(['hipertrofia', 'forca', 'resistencia']);
    expect(getPreset('nada')).toBeNull();
  });
  it('aplica sem mutar', () => {
    const ex = { name: 'Supino', sets: '3', reps: '10', rest: 60 };
    expect(applyPreset(ex, getPreset('forca'))).toEqual({ name: 'Supino', sets: '5', reps: '3-5', rest: 150 });
    expect(ex.sets).toBe('3');
    expect(applyPreset(ex, null)).toBe(ex);
  });
});

describe('reorder', () => {
  it('move itens e ignora índices inválidos', () => {
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorder(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    const list = ['a', 'b'];
    expect(reorder(list, 0, 5)).toBe(list);
  });
});

describe('formatMinutes', () => {
  it('formata minutos e horas', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(65)).toBe('1 h 05 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(undefined)).toBe('0 min');
  });
});
