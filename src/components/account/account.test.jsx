import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CoachPaymentStatus from './CoachPaymentStatus';
import AccountSecurity from './AccountSecurity';
import { applyA11y, loadA11y, saveA11y } from '../../utils/a11yPrefs';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: null } }));
jest.mock('../../services/accountSecurity', () => ({
  ...jest.requireActual('../../services/accountSecurity'),
  changePassword: jest.fn(), createPassword: jest.fn(), connectGoogle: jest.fn(), disconnectGoogle: jest.fn(), sendResetLink: jest.fn()
}));

describe('CoachPaymentStatus', () => {
  it('sem treinador não mostra nada', () => {
    const { container } = render(<CoachPaymentStatus profile={{ paymentStatus: 'paid' }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('mostra valor, situação e data do último pagamento', () => {
    render(<CoachPaymentStatus profile={{ coachId: 'c', monthlyFee: 150, paymentStatus: 'paid', paymentDate: '2026-10-05T12:00:00.000Z' }} />);
    expect(screen.getByText('Em dia')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?150,00 por mês/)).toBeInTheDocument();
    expect(screen.getByText(/Último pagamento registrado/)).toBeInTheDocument();
  });
  it('atrasada pede para falar com o treinador; isento não mostra valor', () => {
    const { rerender } = render(<CoachPaymentStatus profile={{ coachId: 'c', monthlyFee: 100, paymentStatus: 'overdue' }} />);
    expect(screen.getByText(/regularizar/)).toBeInTheDocument();
    rerender(<CoachPaymentStatus profile={{ coachId: 'c', monthlyFee: 0, paymentStatus: 'exempt' }} />);
    expect(screen.getByText('Isento')).toBeInTheDocument();
    expect(screen.queryByText(/por mês/)).toBeNull();
  });
});

describe('AccountSecurity', () => {
  it('quem entra com senha vê "Trocar senha", link por e-mail e "Conectar Google"', () => {
    render(<AccountSecurity user={{ email: 'a@b.com', emailVerified: true, providerData: [{ providerId: 'password' }] }} />);
    expect(screen.getByText('Verificado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link de redefinição/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(screen.getByLabelText('Senha atual')).toBeInTheDocument();
  });
  it('quem só entra com Google pode criar senha e não pode desconectar o Google', () => {
    render(<AccountSecurity user={{ email: 'a@b.com', providerData: [{ providerId: 'google.com' }] }} />);
    expect(screen.queryByRole('button', { name: 'Desconectar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Criar senha' }));
    expect(screen.queryByLabelText('Senha atual')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'abc12345' } });
    fireEvent.change(screen.getByLabelText('Repita a nova senha'), { target: { value: 'abc12399' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar senha' }));
    expect(screen.getByRole('alert').textContent).toMatch(/não conferem/);
  });
});

describe('a11yPrefs', () => {
  afterEach(() => { localStorage.clear(); applyA11y(loadA11y()); });
  it('salva, recarrega e aplica as classes no html', () => {
    saveA11y({ textSize: 'xlarge', reduceMotion: true, highContrast: false });
    expect(loadA11y()).toEqual({ textSize: 'xlarge', reduceMotion: true, highContrast: false });
    const html = document.documentElement.classList;
    expect(html.contains('a11y-text-xl')).toBe(true);
    expect(html.contains('a11y-reduce-motion')).toBe(true);
    expect(html.contains('a11y-contrast')).toBe(false);
  });
  it('valor salvo inválido volta ao padrão', () => {
    localStorage.setItem('bt-a11y', '{"textSize":"gigante"}');
    expect(loadA11y().textSize).toBe('normal');
    localStorage.setItem('bt-a11y', 'xx');
    expect(loadA11y()).toEqual({ textSize: 'normal', reduceMotion: false, highContrast: false });
  });
});
