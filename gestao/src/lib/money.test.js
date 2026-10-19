import { describe, expect, test } from 'vitest';
import { centsToInput, chargesToCsv, dateBR, formatBRL, monthLabel, parseBRL, shiftMonth } from './money';

describe('dinheiro', () => {
  test('formata em reais', () => { expect(formatBRL(12345)).toMatch(/R\$\s?123,45/); expect(formatBRL(0)).toMatch(/0,00/); });
  test('interpreta vários formatos e recusa lixo', () => {
    expect(parseBRL('R$ 1.234,56')).toBe(123456);
    expect(parseBRL('99')).toBe(9900);
    expect(parseBRL('99,9')).toBe(9990);
    expect(parseBRL('1234.56')).toBe(123456);
    expect(parseBRL('1.234')).toBe(123400);
    for (const bad of ['', 'abc', '-5', '1,234,56', '99999999999']) expect(parseBRL(bad)).toBeNull();
  });
  test('ida e volta para o campo', () => { expect(centsToInput(9990)).toBe('99,90'); expect(parseBRL(centsToInput(123456))).toBe(123456); });
});

describe('meses', () => {
  test('desloca e vira o ano', () => { expect(shiftMonth('2026-12', 1)).toBe('2027-01'); expect(shiftMonth('2026-01', -1)).toBe('2025-12'); expect(shiftMonth('2026-10', -5)).toBe('2026-05'); });
  test('rótulos em português', () => { expect(monthLabel('2026-10')).toMatch(/outubro/i); expect(dateBR('2026-10-05')).toBe('05/10/2026'); });
});

describe('exportação em planilha', () => {
  test('separador ponto e vírgula, vírgula decimal, aspas e proteção contra fórmula', () => {
    const csv = chargesToCsv([{ referenceMonth: '2026-10', studentName: '=cmd|evil', planName: 'Plano; "Gold"', dueDate: '2026-10-05', amountCents: 10000, discountCents: 500, netCents: 9500, status: 'overdue', paidAt: null, paidAmountCents: null, paymentMethod: null, note: '' }]);
    expect(csv.startsWith('﻿Mês;Aluno')).toBe(true);
    expect(csv).toContain("'=cmd|evil");
    expect(csv).not.toMatch(/;=cmd|^=cmd/m);
    expect(csv).toContain('"Plano; ""Gold"""');
    expect(csv).toContain('100,00;5,00;95,00;Em atraso');
  });
});
