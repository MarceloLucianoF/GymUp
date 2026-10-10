import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteAccountModal, { CONFIRM_WORD } from './DeleteAccountModal';

jest.mock('../../services/accountDeletion', () => ({
  ...jest.requireActual('../../services/accountDeletion'),
  deleteAccount: jest.fn(async () => ({}))
}));
const { deleteAccount } = jest.requireMock('../../services/accountDeletion');

const passwordUser = { uid: 'u1', email: 'a@b.com', providerData: [{ providerId: 'password' }] };
const googleUser = { uid: 'u2', providerData: [{ providerId: 'google.com' }] };

describe('DeleteAccountModal', () => {
  beforeEach(() => deleteAccount.mockClear());

  test('botão só habilita com a palavra de confirmação e a senha', async () => {
    render(<DeleteAccountModal user={passwordUser} onClose={() => {}} />);
    const submit = screen.getByRole('button', { name: /excluir definitivamente/i });
    expect(submit).toBeDisabled();
    userEvent.type(screen.getByLabelText(new RegExp(`Digite ${CONFIRM_WORD}`, 'i')), 'excluir');
    expect(submit).toBeDisabled();
    userEvent.type(screen.getByLabelText(/sua senha/i), 'segredo');
    expect(submit).toBeEnabled();
  });

  test('conta Google não pede senha e dispara a exclusão', async () => {
    const onDeleted = jest.fn();
    render(<DeleteAccountModal user={googleUser} onClose={() => {}} onDeleted={onDeleted} />);
    expect(screen.queryByLabelText(/sua senha/i)).toBeNull();
    userEvent.type(screen.getByLabelText(new RegExp(`Digite ${CONFIRM_WORD}`, 'i')), CONFIRM_WORD);
    userEvent.click(screen.getByRole('button', { name: /excluir definitivamente/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  test('erro da exclusão aparece como alerta e libera nova tentativa', async () => {
    deleteAccount.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    render(<DeleteAccountModal user={passwordUser} onClose={() => {}} />);
    userEvent.type(screen.getByLabelText(new RegExp(`Digite ${CONFIRM_WORD}`, 'i')), CONFIRM_WORD);
    userEvent.type(screen.getByLabelText(/sua senha/i), 'errada');
    userEvent.click(screen.getByRole('button', { name: /excluir definitivamente/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');
    expect(screen.getByRole('button', { name: /excluir definitivamente/i })).toBeEnabled();
  });

  test('método de login não suportado mostra aviso e não permite excluir', () => {
    render(<DeleteAccountModal user={{ uid: 'u3', providerData: [] }} onClose={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/suporte/i);
    expect(screen.getByRole('button', { name: /excluir definitivamente/i })).toBeDisabled();
  });
});
