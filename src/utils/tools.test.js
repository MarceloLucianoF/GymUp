import {
  epley1RM, brzycki1RM, percentTable, calcPlates, kgToLb, lbToKg, calcBMI, bmiCategory, dailyWaterMl, formatClock,
} from './tools';

describe('1RM', () => {
  it('calcula Epley e Brzycki', () => {
    expect(epley1RM(100, 10)).toBe(133.3);
    expect(brzycki1RM(100, 10)).toBe(133.3);
    expect(epley1RM(100, 1)).toBe(100);
  });
  it('trata bordas', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(-10, 5)).toBe(0);
    expect(brzycki1RM(100, 0)).toBe(0);
    expect(brzycki1RM(100, 37)).toBe(0);
    expect(epley1RM('abc', 5)).toBe(0);
  });
  it('monta tabela de porcentagens', () => {
    const t = percentTable(100);
    expect(t[0]).toEqual({ pct: 50, weight: 50 });
    expect(t).toHaveLength(10);
    expect(percentTable(0)).toEqual([]);
    expect(percentTable(-5)).toEqual([]);
  });
});

describe('calcPlates', () => {
  it('100kg com barra 20 = 25+15 por lado', () => {
    const r = calcPlates(100, 20);
    expect(r.perSide).toEqual([25, 15]);
    expect(r.remainder).toBe(0);
    expect(r.total).toBe(100);
  });
  it('usa 1,25 e reporta resto', () => {
    expect(calcPlates(22.5, 20).perSide).toEqual([1.25]);
    const r = calcPlates(21, 20);
    expect(r.perSide).toEqual([]);
    expect(r.remainder).toBe(0.5);
    expect(r.total).toBe(20);
  });
  it('barra maior que a carga e entradas inválidas', () => {
    expect(calcPlates(15, 20)).toMatchObject({ valid: false, reason: 'below-bar', perSide: [] });
    expect(calcPlates(0, 20).valid).toBe(false);
    expect(calcPlates(-50, 20).valid).toBe(false);
    expect(calcPlates(20, 20)).toMatchObject({ valid: true, perSide: [] });
  });
});

describe('conversões e saúde', () => {
  it('converte kg e lb', () => {
    expect(kgToLb(100)).toBe(220.46);
    expect(lbToKg(220.46)).toBe(100);
    expect(kgToLb(0)).toBe(0);
    expect(kgToLb('x')).toBe(0);
  });
  it('IMC', () => {
    expect(calcBMI(70, 175)).toBe(22.9);
    expect(calcBMI(0, 175)).toBe(0);
    expect(calcBMI(70, 0)).toBe(0);
    expect(bmiCategory(22.9)).toBe('Peso normal');
    expect(bmiCategory(17)).toBe('Abaixo do peso');
    expect(bmiCategory(31)).toBe('Obesidade grau I');
    expect(bmiCategory(0)).toBe('');
  });
  it('hidratação e relógio', () => {
    expect(dailyWaterMl(70)).toBe(2450);
    expect(dailyWaterMl(-1)).toBe(0);
    expect(formatClock(75)).toBe('01:15');
    expect(formatClock(-3)).toBe('00:00');
  });
});
