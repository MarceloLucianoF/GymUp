import { formatDate, formatTonnage, formatTime, formatDuration } from './format';

describe('formatDate', () => {
  it('retorna fallback para valores vazios ou inválidos', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate('não-é-data')).toBe('-');
    expect(formatDate(undefined, undefined, 'Recente')).toBe('Recente');
  });

  it('formata datas válidas em pt-BR', () => {
    expect(formatDate(new Date(2024, 2, 5), { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('05/03/2024');
  });
});

describe('formatTonnage', () => {
  it('converte kg em toneladas com 1 casa', () => {
    expect(formatTonnage(1250)).toBe('1.3t');
    expect(formatTonnage(0)).toBe('0.0t');
  });
  it('trata entrada inválida e unidade custom', () => {
    expect(formatTonnage('abc')).toBe('0.0t');
    expect(formatTonnage(2000, ' ton')).toBe('2.0 ton');
  });
});

describe('formatTime', () => {
  it('retorna fallback quando inválido', () => {
    expect(formatTime(null, '...')).toBe('...');
    expect(formatTime('x')).toBe('');
  });
  it('aceita Timestamp do Firestore e Date', () => {
    const d = new Date(2024, 0, 1, 9, 5);
    expect(formatTime({ seconds: d.getTime() / 1000 })).toMatch(/09.05/);
    expect(formatTime(d)).toMatch(/09.05/);
  });
});

describe('formatDuration', () => {
  it('formata mm:ss', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(0)).toBe('00:00');
  });
  it('formata h:mm:ss a partir de 1h', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });
  it('limita negativos e inválidos a zero', () => {
    expect(formatDuration(-10)).toBe('00:00');
    expect(formatDuration('abc')).toBe('00:00');
  });
});
