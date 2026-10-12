import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockVerify = jest.fn();
const mockConfirm = jest.fn();
const mockApply = jest.fn();
jest.mock('firebase/auth', () => ({
  verifyPasswordResetCode: (...a) => mockVerify(...a),
  confirmPasswordReset: (...a) => mockConfirm(...a),
  applyActionCode: (...a) => mockApply(...a)
}));
jest.mock('../../firebase/config', () => ({ auth: {} }));

const AuthAction = require('./AuthAction').default;
const { actionError } = require('./AuthAction');

const open = (query) => render(<MemoryRouter initialEntries={[`/auth/action?${query}`]}><AuthAction /></MemoryRouter>);

describe('AuthAction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redefine a senha: valida a política e confirma o código', async () => {
    mockVerify.mockResolvedValue('ana@x.com');
    mockConfirm.mockResolvedValue();
    open('mode=resetPassword&oobCode=abc');
    expect(await screen.findByText('ana@x.com')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Nova senha'), 'fraca');
    await userEvent.type(screen.getByLabelText('Confirmar senha'), 'fraca');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText(/muito curta/)).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Nova senha'));
    await userEvent.clear(screen.getByLabelText('Confirmar senha'));
    await userEvent.type(screen.getByLabelText('Nova senha'), 'Treino#2026');
    await userEvent.type(screen.getByLabelText('Confirmar senha'), 'Treino#2026');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith({}, 'abc', 'Treino#2026'));
    expect(await screen.findByText(/Senha alterada/)).toBeInTheDocument();
  });

  it('link expirado mostra o motivo e oferece novo link', async () => {
    mockVerify.mockRejectedValue({ code: 'auth/expired-action-code' });
    open('mode=resetPassword&oobCode=old');
    expect(await screen.findByText('Este link expirou. Peça um novo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('confirma e-mail e rejeita links incompletos', async () => {
    mockApply.mockResolvedValue();
    open('mode=verifyEmail&oobCode=ok');
    expect(await screen.findByText('E-mail confirmado.')).toBeInTheDocument();
  });

  it('link sem código é inválido', async () => {
    open('mode=resetPassword');
    expect(await screen.findByText(/inválido/)).toBeInTheDocument();
    expect(actionError('x')).toMatch(/Tente de novo/);
  });
});
