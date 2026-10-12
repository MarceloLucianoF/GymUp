// Política de senha do Firebase Authentication do projeto (console): mínimo de 8 caracteres,
// com maiúscula, número e caractere especial. Mantida aqui para o aluno ver o erro antes de enviar.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = 'Mínimo 8, com maiúscula, número e símbolo';

export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  if (value.length < PASSWORD_MIN_LENGTH) return `Senha muito curta (mínimo ${PASSWORD_MIN_LENGTH}).`;
  if (!/[A-Z]/.test(value)) return 'Inclua ao menos uma letra maiúscula.';
  if (!/[0-9]/.test(value)) return 'Inclua ao menos um número.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Inclua ao menos um símbolo (por exemplo ! @ # $).';
  return '';
}
