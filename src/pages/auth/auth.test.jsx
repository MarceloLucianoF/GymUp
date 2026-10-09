import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockLogin = jest.fn();
jest.mock('../../hooks/AuthContext', () => ({
  useAuthContext: () => ({ login: mockLogin, register: jest.fn(), authLoading: false, user: null }),
}));
jest.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: jest.fn() }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('react-hot-toast', () => {
  const toast = jest.fn();
  toast.loading = jest.fn(() => 'id');
  toast.success = jest.fn();
  toast.error = jest.fn();
  return { __esModule: true, default: toast };
});

const Login = require('./Login').default;
const Register = require('./Register').default;

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Login', () => {
  beforeEach(() => mockLogin.mockReset());

  it('associa labels aos campos e define autocomplete', () => {
    wrap(<Login />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('alterna visibilidade da senha com aria-pressed', async () => {
    wrap(<Login />);
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
  });

  it('mostra erro com role=alert, foca o email e evita duplo envio', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciais inválidas'));
    wrap(<Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Acessar Conta' }));
    expect(await screen.findByText('Credenciais inválidas', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByRole('alert').some((el) => el.textContent === 'Credenciais inválidas')).toBe(true);
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});

describe('Register', () => {
  it('foca o primeiro campo inválido e mostra erro', async () => {
    wrap(<Register />);
    await userEvent.type(screen.getByLabelText('Nome Completo'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), '123');
    await userEvent.type(screen.getByLabelText('Confirmar'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar Gratuitamente' }));
    expect(screen.getByLabelText('Senha')).toHaveFocus();
    expect(screen.getByText('Senha muito curta (mínimo 6).', { selector: 'p' })).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
  });
});
