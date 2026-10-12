import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockSend = jest.fn();
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: (...args) => mockSend(...args) }));
jest.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('react-hot-toast', () => {
  const toast = jest.fn();
  toast.success = jest.fn();
  toast.error = jest.fn();
  toast.loading = jest.fn();
  return { __esModule: true, default: toast };
});

const ForgotPassword = require('./ForgotPassword').default;

const submit = async (email) => {
  render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.click(screen.getByRole('button', { name: /enviar|recuperar/i }));
};

describe('ForgotPassword - sem revelar quais e-mails têm conta', () => {
  beforeEach(() => mockSend.mockReset());

  it('e-mail sem conta responde igual ao sucesso', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/user-not-found' }));
    await submit('ninguem@exemplo.com');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Se o e-mail tiver conta/));
    expect(screen.queryByText(/não cadastrado/i)).toBeNull();
  });

  it('e-mail com conta mostra a mesma mensagem', async () => {
    mockSend.mockResolvedValueOnce();
    await submit('ana@exemplo.com');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Se o e-mail tiver conta/));
  });
});
