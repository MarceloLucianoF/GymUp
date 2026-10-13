import { feeOf, computeStats, statusTotals, feeUpdate, isExempt, DEFAULT_FEE } from './billing';

const s = (fee, status) => ({ monthlyFee: fee, paymentStatus: status });

describe('mensalidade e isenção', () => {
  it('zero gravado é isento, não cai no valor padrão', () => {
    expect(feeOf({ monthlyFee: 0, paymentStatus: 'exempt' })).toBe(0);
    expect(feeOf({ monthlyFee: 0 })).toBe(0);
    expect(feeOf({})).toBe(DEFAULT_FEE);
    expect(feeOf({ monthlyFee: 150 })).toBe(150);
    expect(feeOf({ monthlyFee: 150, paymentStatus: 'exempt' })).toBe(0);   // isento sempre vale 0
  });

  it('isento fica fora de previsto, a receber, inadimplentes e porcentagem', () => {
    const list = [s(100, 'paid'), s(100, 'pending'), s(100, 'overdue'), s(0, 'exempt'), s(0, 'exempt')];
    expect(computeStats(list)).toEqual({ total: 300, received: 100, pending: 200, overdueCount: 1, overdueTotal: 100, exemptCount: 2, pct: 33 });
  });

  it('totais por situação incluem os isentos (contagem, valor 0)', () => {
    const t = statusTotals([s(100, 'paid'), s(0, 'exempt'), s(50, undefined)]);
    expect(t.find((x) => x.id === 'exempt')).toEqual({ id: 'exempt', count: 1, total: 0 });
    expect(t.find((x) => x.id === 'pending')).toEqual({ id: 'pending', count: 1, total: 50 });
  });

  it('cadastro antigo com mensalidade 0 (sem situação exempt) também conta como isento', () => {
    expect(isExempt({ monthlyFee: 0, paymentStatus: 'pending' })).toBe(true);
    expect(computeStats([s(0, 'pending'), s(100, 'paid')])).toMatchObject({ total: 100, exemptCount: 1 });
    expect(feeUpdate(s(0, 'pending'), 80, 'x')).toEqual({ monthlyFee: 80, paymentStatus: 'pending', lastPaymentUpdate: 'x' });
  });

  it('editar o valor: 0 vira isento; valor positivo tira o isento; aluno comum só muda o valor', () => {
    expect(feeUpdate(s(100, 'paid'), 0, 'x')).toEqual({ monthlyFee: 0, paymentStatus: 'exempt', lastPaymentUpdate: 'x' });
    expect(feeUpdate(s(0, 'exempt'), 90, 'x')).toEqual({ monthlyFee: 90, paymentStatus: 'pending', lastPaymentUpdate: 'x' });
    expect(feeUpdate(s(100, 'overdue'), 120, 'x')).toEqual({ monthlyFee: 120 });
    expect(isExempt(s(0, 'exempt'))).toBe(true);
  });
});
