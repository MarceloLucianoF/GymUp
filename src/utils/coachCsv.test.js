import { csvEscape, toCsv, studentsCsv, financeCsv, CSV_BOM } from './coachCsv';

describe('csvEscape', () => {
  it('trata vazios e números', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(12.5)).toBe('12.5');
    expect(csvEscape(-3)).toBe('-3');
  });
  it('coloca aspas e duplica aspas internas', () => {
    expect(csvEscape('Silva, João')).toBe('"Silva, João"');
    expect(csvEscape('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvEscape('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });
  it('quota o delimitador escolhido', () => {
    expect(csvEscape('a;b', ';')).toBe('"a;b"');
  });
  it('neutraliza fórmulas', () => {
    expect(csvEscape('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(csvEscape('@cmd')).toBe("'@cmd");
  });
});

describe('toCsv', () => {
  it('gera BOM, CRLF e cabeçalho', () => {
    const csv = toCsv([{ a: 'x', b: 'y,z' }], [{ header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b }]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}A,B\r\nx,"y,z"\r\n`);
  });
  it('permite sem BOM e com ponto e vírgula', () => {
    expect(toCsv([{ a: 1 }], [{ header: 'A', value: (r) => r.a }], { bom: false, delimiter: ';' })).toBe('A\r\n1\r\n');
  });
});

describe('csvs de domínio', () => {
  it('lista de alunos', () => {
    const csv = studentsCsv([{ displayName: 'Ana "A"', email: 'a@x.com', goal: 'Hipertrofia', lastWorkout: new Date(2024, 2, 5), status: 'risk', monthlyFee: 120 }]);
    expect(csv).toContain('Nome,E-mail,Objetivo,Último treino,Status,Mensalidade (R$)');
    expect(csv).toContain('"Ana ""A""",a@x.com,Hipertrofia,05/03/2024,Em risco,"120,00"');
  });
  it('financeiro', () => {
    const csv = financeCsv([{ displayName: 'Bia', email: 'b@x.com', monthlyFee: 99.9, paymentStatus: 'paid', paymentDateObj: new Date(2024, 2, 10) }], 'março de 2024');
    expect(csv).toContain('março de 2024,Bia,b@x.com,"99,90",Pago,10/03/2024');
  });
});
