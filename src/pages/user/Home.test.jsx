/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import Home from './Home';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const mockAuth = { user: { uid: 'u1', displayName: 'Ana Souza' }, userProfile: null };
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../../hooks/useRole', () => ({ useRole: () => ({ isCoach: false }) }));
jest.mock('../../hooks/useStudentHome', () => ({
  ...jest.requireActual('../../hooks/useStudentHome'),
  useStudentHome: jest.fn(),
  useWeeklyGoal: () => [4, jest.fn()],
}));
jest.mock('../../hooks/useMyCoach', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../hooks/useHomeExtras', () => ({ useFriendsPreview: () => ({ status: 'noFriends' }), useCoachMessage: jest.fn() }));
jest.mock('../../services/myWorkouts', () => ({ listMyWorkouts: jest.fn() }));
jest.mock('../../components/chat/StudentChatWidget', () => () => null);
jest.mock('../../components/ai/AICoachModal', () => () => null);
jest.mock('../../components/coach/CoachLinkModal', () => () => null);

const { useStudentHome, computeStats, computeAchievements } = require('../../hooks/useStudentHome');
const useMyCoach = require('../../hooks/useMyCoach').default;
const { useCoachMessage } = require('../../hooks/useHomeExtras');

const today = new Date().toISOString();
const history = [{ id: 'c1', trainingId: 't1', trainingName: 'Treino A', date: today, totalVolume: 2500, duration: 1800, exercises: [{ name: 'Supino', sets: [{ weight: 80, reps: 10 }] }] }];
beforeEach(() => { require('../../services/myWorkouts').listMyWorkouts.mockResolvedValue([]); });
const setup = ({ activeSession = null, unread = false, coachState = 'active' } = {}) => {
  const stats = computeStats(history);
  useStudentHome.mockReturnValue({
    loading: false, error: null, refresh: jest.fn(),
    data: {
      profile: { displayName: 'Ana Souza' }, history, trainings: [{ firestoreId: 't1', name: 'Treino A', exercises: [{ name: 'Supino' }] }],
      activeSession, stats, achievements: computeAchievements(stats), refreshing: false,
      errors: { profile: null, history: null, trainings: null }, discardActiveSession: jest.fn(),
    },
  });
  useMyCoach.mockReturnValue({ loading: false, state: coachState, coach: { displayName: 'Marcos' } });
  useCoachMessage.mockReturnValue(unread ? { text: 'Bora treinar!', unread: true } : null);
  return render(<MemoryRouter><Home /></MemoryRouter>);
};
const order = (container) => [...container.querySelectorAll('[data-home-block]')].map((n) => n.getAttribute('data-home-block'));

test('ordem da Home: treino, atalhos, pendências, meta, amigos e evolução (no máximo 6 blocos)', () => {
  const { container } = setup({ unread: true });
  expect(order(container)).toEqual(['treino', 'atalhos', 'pendencias', 'meta', 'amigos', 'evolucao']);
  expect(screen.getByRole('button', { name: /INICIAR TREINO/ })).toBeInTheDocument();
  expect(screen.getByText('Mensagem de Marcos')).toBeInTheDocument();
});

test('sem recado não há bloco de pendências; com treino em andamento o primeiro bloco é "Continuar"', () => {
  const { container } = setup({ activeSession: { trainingId: 't1', trainingName: 'Treino A', sessionData: {} } });
  expect(order(container)).toEqual(['treino', 'atalhos', 'meta', 'amigos', 'evolucao']);
  const first = container.querySelector('[data-home-block="treino"]');
  expect(within(first).getByRole('button', { name: /CONTINUAR/ })).toBeInTheDocument();
});

test('atalhos existentes no app e "Ver evolução" no lugar dos cartões de números', () => {
  setup();
  const nav = screen.getByRole('navigation', { name: 'Atalhos' });
  const links = within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
  expect(links).toEqual([
    ['Registrar medida', '/measurements?nova=1'],
    ['Falar com professor', '/chat'],
    ['Histórico', '/history'],
    ['Ferramentas', '/ferramentas'],
  ]);
  expect(screen.getByRole('link', { name: /Ver evolução/ })).toHaveAttribute('href', '/measurements');
  expect(screen.getByText(/1 treino no mês · 2,5 t de volume · recorde 80 kg/)).toBeInTheDocument();
  expect(screen.queryByText('Treinos no mês')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Amigos e ranking' })).toHaveAttribute('href', '/amigos');
  expect(screen.getByLabelText(/Sequência de 1 dia/)).toBeInTheDocument();
});

test('sem professor vinculado, o atalho vira "Vincular professor"', () => {
  setup({ coachState: 'none' });
  const nav = screen.getByRole('navigation', { name: 'Atalhos' });
  expect(within(nav).getByRole('button', { name: 'Vincular professor' })).toBeInTheDocument();
});
