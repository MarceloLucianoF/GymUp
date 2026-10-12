import { validatePassword } from './password';

describe('validatePassword', () => {
  it('aceita senha que cumpre a política', () => {
    expect(validatePassword('Treino#2026')).toBe('');
  });
  it('explica o que falta', () => {
    expect(validatePassword('Ab1!')).toMatch(/curta/);
    expect(validatePassword('treino#2026')).toMatch(/maiúscula/);
    expect(validatePassword('Treino#abcd')).toMatch(/número/);
    expect(validatePassword('Treino2026a')).toMatch(/símbolo/);
    expect(validatePassword(undefined)).toMatch(/curta/);
  });
});
