import * as fa from 'firebase/auth';
import { changeEmail, changePassword, connectGoogle, createPassword, disconnectGoogle, friendlySecurityError, loginMethods, passwordProblem } from './accountSecurity';

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn((email, pw) => ({ email, pw })) },
  GoogleAuthProvider: jest.fn(),
  browserPopupRedirectResolver: {},
  linkWithCredential: jest.fn(async () => ({})),
  linkWithPopup: jest.fn(async () => ({})),
  reauthenticateWithCredential: jest.fn(async () => ({})),
  reauthenticateWithPopup: jest.fn(async () => ({})),
  sendPasswordResetEmail: jest.fn(async () => {}),
  unlink: jest.fn(async () => ({})),
  updatePassword: jest.fn(async () => {}),
  verifyBeforeUpdateEmail: jest.fn(async () => {})
}));
jest.mock('./nativeApp', () => ({ isNativeApp: () => false, nativeGoogleCredential: jest.fn() }));

const pwUser = { email: 'a@b.com', providerData: [{ providerId: 'password' }] };
const googleUser = { email: 'a@b.com', providerData: [{ providerId: 'google.com' }] };
// O CRA zera as implementações dos mocks entre testes (resetMocks).
beforeEach(() => { fa.EmailAuthProvider.credential.mockImplementation((email, pw) => ({ email, pw })); });

test('loginMethods e regras da senha nova', () => {
  expect(loginMethods(pwUser)).toEqual({ password: true, google: false });
  expect(loginMethods({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] })).toEqual({ password: true, google: true });
  expect(passwordProblem('abc1')).toMatch(/8 caracteres/);
  expect(passwordProblem('abcdefgh')).toMatch(/letras e números/);
  expect(passwordProblem('abcdefg1', 'abcdefg2')).toMatch(/não conferem/);
  expect(passwordProblem('abcdefg1', 'abcdefg1')).toBe('');
});

test('trocar senha confirma a atual antes de gravar a nova', async () => {
  await changePassword(pwUser, 'velha123', 'nova12345');
  expect(fa.reauthenticateWithCredential).toHaveBeenCalledWith(pwUser, { email: 'a@b.com', pw: 'velha123' });
  expect(fa.updatePassword).toHaveBeenCalledWith(pwUser, 'nova12345');
  await expect(changePassword(pwUser, '', 'nova12345')).rejects.toThrow('senha atual');
  await expect(changePassword(pwUser, 'x', 'curta')).rejects.toThrow(/8 caracteres/);
  expect(fa.updatePassword).toHaveBeenCalledTimes(1);
});

test('criar senha (conta Google) confirma com o Google e liga e-mail e senha', async () => {
  await createPassword(googleUser, 'nova12345');
  expect(fa.reauthenticateWithPopup).toHaveBeenCalled();
  expect(fa.linkWithCredential).toHaveBeenCalledWith(googleUser, { email: 'a@b.com', pw: 'nova12345' });
});

test('conectar Google usa o popup; desconectar exige senha criada', async () => {
  await connectGoogle(pwUser);
  expect(fa.linkWithPopup).toHaveBeenCalled();
  await expect(disconnectGoogle(googleUser)).rejects.toThrow(/Crie uma senha/);
  expect(fa.unlink).not.toHaveBeenCalled();
  await disconnectGoogle({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] });
  expect(fa.unlink).toHaveBeenCalledWith(expect.anything(), 'google.com');
});

test('mensagens amigáveis', () => {
  expect(friendlySecurityError({ code: 'auth/invalid-credential' })).toBe('Senha atual incorreta.');
  expect(friendlySecurityError({ code: 'auth/credential-already-in-use' })).toMatch(/outro usuário/);
  expect(friendlySecurityError({ code: 'x' })).toMatch(/Tente de novo/);
});

test('trocar e-mail: valida, confirma a senha e manda o link ao novo endereço', async () => {
  await expect(changeEmail(pwUser, 'invalido', { password: 'x' })).rejects.toThrow('e-mail válido');
  await expect(changeEmail(pwUser, 'A@B.com', { password: 'x' })).rejects.toThrow('já é o seu');
  await expect(changeEmail(pwUser, 'novo@b.com', {})).rejects.toThrow('senha atual');
  expect(await changeEmail(pwUser, ' Novo@B.com ', { password: 'velha123' })).toBe('novo@b.com');
  expect(fa.reauthenticateWithCredential).toHaveBeenCalledWith(pwUser, { email: 'a@b.com', pw: 'velha123' });
  expect(fa.verifyBeforeUpdateEmail).toHaveBeenCalledWith(pwUser, 'novo@b.com', expect.objectContaining({ url: expect.stringMatching(/\/login$/) }));
});

test('trocar e-mail sem senha (só Google) confirma com o Google', async () => {
  await changeEmail(googleUser, 'novo@b.com');
  expect(fa.reauthenticateWithPopup).toHaveBeenCalled();
  expect(fa.verifyBeforeUpdateEmail).toHaveBeenCalled();
});
