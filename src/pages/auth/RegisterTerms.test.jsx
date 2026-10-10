import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockRegister = jest.fn().mockResolvedValue({});
jest.mock('../../hooks/AuthContext', () => ({
  useAuthContext: () => ({ login: jest.fn(), register: mockRegister, authLoading: false, user: null }),
}));
jest.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('react-hot-toast', () => {
  const toast = jest.fn();
  toast.loading = jest.fn(() => 'id');
  toast.success = jest.fn();
  toast.error = jest.fn();
  return { __esModule: true, default: toast };
});

const Register = require('./Register').default;

const fill = async () => {
  await userEvent.type(screen.getByLabelText('Nome Completo'), 'Ana');
  await userEvent.type(screen.getByLabelText('Email'), 'ana@b.com');
  await userEvent.type(screen.getByLabelText('Senha'), '123456');
  await userEvent.type(screen.getByLabelText('Confirmar'), '123456');
};

describe('Register - aceite dos termos', () => {
  beforeEach(() => mockRegister.mockClear());

  it('não envia sem marcar o aceite e foca o checkbox', async () => {
    render(<MemoryRouter><Register /></MemoryRouter>);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar Gratuitamente' }));
    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    expect(screen.getByText(/Aceite os Termos/)).toHaveAttribute('role', 'alert');
  });

  it('envia depois de marcar o aceite e expõe links legais', async () => {
    render(<MemoryRouter><Register /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos');
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade');
    await fill();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar Gratuitamente' }));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cadastrar Gratuitamente' })).toBeEnabled());
  });
});
