import { formatElapsed } from './ExecutionHeader';

test('cronômetro com horas a partir de 60 min', () => {
  expect(formatElapsed(65)).toBe('1:05');
  expect(formatElapsed(59 * 60 + 59)).toBe('59:59');
  expect(formatElapsed(230 * 60 + 53)).toBe('3:50:53');
  expect(formatElapsed(undefined)).toBe('0:00');
});
