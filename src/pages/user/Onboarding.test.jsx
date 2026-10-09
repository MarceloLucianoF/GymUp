import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Onboarding from './Onboarding';

const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({ doc: jest.fn(() => 'ref'), updateDoc: (...a) => mockUpdateDoc(...a) }));
jest.mock('../../firebase/config', () => ({ db: {} }));
jest.mock('canvas-confetti', () => jest.fn());
jest.mock('../../hooks/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'u1', displayName: 'Ana' }, userProfile: {} }),
}));

const next = () => fireEvent.click(screen.getByRole('button', { name: /avançar|concluir/i }));

describe('Onboarding', () => {
  beforeEach(() => { mockUpdateDoc.mockReset(); localStorage.clear(); });

  test('valida passo e mostra alert', () => {
    render(<Onboarding />);
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: '' } });
    next();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Ana' } });
    next();
    next();
    expect(screen.getByRole('alert')).toHaveTextContent(/objetivo/i);
  });

  test('fluxo completo grava e mostra Tudo pronto', async () => {
    mockUpdateDoc.mockResolvedValue();
    render(<Onboarding />);
    next();
    fireEvent.click(screen.getByLabelText(/Força/));
    next();
    fireEvent.change(screen.getByLabelText('Idade'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Peso'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '175' } });
    expect(screen.getByText('22.9')).toBeInTheDocument();
    next();
    fireEvent.click(screen.getByLabelText(/Intermediário/));
    fireEvent.click(screen.getByRole('button', { name: '5x' }));
    next();
    next();
    expect(await screen.findByText(/Ver meu primeiro treino/)).toBeInTheDocument();
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload).toMatchObject({ goal: 'Força', age: 30, weight: 70, height: 175, experience: 'intermediario', weeklyGoal: 5 });
    expect(payload).not.toHaveProperty('coachId');
    expect(localStorage.getItem('academyup:weeklyGoal:u1')).toBe('5');
  });
});
