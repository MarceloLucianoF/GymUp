import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import WorkoutDetailsPage from './WorkoutDetailsPage';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const mockAuth = { user: { uid: 'u1' } };
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../../firebase/config', () => ({ db: {} }));
jest.mock('../../services/checkInService', () => ({ removeCheckIn: jest.fn() }));
jest.mock('../../services/checkInsCache', () => ({ fetchStudentCheckIns: jest.fn(), invalidateCheckIns: jest.fn() }));
jest.mock('../../services/trainingAvailability', () => ({ trainingStillExists: jest.fn() }));
jest.mock('../../services/activeWorkoutService', () => ({ activeWorkoutService: { getActiveSession: jest.fn(), clearActiveSession: jest.fn() } }));

const mockCurrent = {
  userId: 'u1', trainingId: 'A', trainingName: 'Treino A', date: '2026-10-28T10:00:00.000Z', duration: 1800, totalVolume: 1235,
  exercises: [{ name: 'Supino', sets: [{ weight: 65, reps: 10, completed: true }, { weight: 65, reps: 9, completed: true }] }],
};
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

const cache = require('../../services/checkInsCache');
const avail = require('../../services/trainingAvailability');
const svc = require('../../services/checkInService');
const active = require('../../services/activeWorkoutService').activeWorkoutService;

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderPage = () => render(
  <MemoryRouter initialEntries={['/history/cur']}>
    <Routes>
      <Route path="/history/:checkInId" element={<WorkoutDetailsPage />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  require('firebase/firestore').getDoc.mockResolvedValue({ exists: () => true, data: () => mockCurrent });
  svc.removeCheckIn.mockResolvedValue(true);
  active.getActiveSession.mockReturnValue(null);
  cache.fetchStudentCheckIns.mockResolvedValue([
    { id: 'cur', ...mockCurrent },
    { id: 'prev', userId: 'u1', trainingId: 'A', trainingName: 'Treino A', date: '2026-10-20T10:00:00.000Z', totalVolume: 1200, exercises: [{ name: 'Supino', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }] }] },
  ]);
});

test('compara com a sessão anterior da mesma ficha (volume e carga por exercício)', async () => {
  avail.trainingStillExists.mockResolvedValue(true);
  renderPage();
  const box = await screen.findByRole('region', { name: 'Comparação com a sessão anterior' }, { timeout: 4000 });
  expect(within(box).getByTestId('volume-total')).toHaveTextContent('+2,9%');
  expect(within(box).getByText('Carga 60 kg → 65 kg')).toBeInTheDocument();
  expect(within(box).getByLabelText('Carga +5 kg')).toBeInTheDocument();
  expect(within(box).getByLabelText('Volume +2,9%')).toBeInTheDocument();
});

test('repetir treino abre a execução da mesma ficha quando ela ainda existe', async () => {
  avail.trainingStillExists.mockResolvedValue(true);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Repetir treino' }));
  expect(screen.getByTestId('where')).toHaveTextContent('/execution/A');
  expect(avail.trainingStillExists).toHaveBeenCalledWith('A', 'u1');
});

test('repetir com outro treino em andamento pede confirmação antes de descartar', async () => {
  avail.trainingStillExists.mockResolvedValue(true);
  active.getActiveSession.mockReturnValue({ trainingId: 'B', trainingName: 'Treino B' });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Repetir treino' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Descartar e repetir' }));
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/execution/A'));
  expect(active.clearActiveSession).toHaveBeenCalledWith('u1');
});

test('ficha apagada: sem "Repetir treino" e com o aviso', async () => {
  avail.trainingStillExists.mockResolvedValue(false);
  renderPage();
  expect(await screen.findByText(/A ficha deste treino não existe mais/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Repetir treino' })).not.toBeInTheDocument();
});

test('excluir só apaga depois da confirmação e volta ao histórico', async () => {
  avail.trainingStillExists.mockResolvedValue(true);
  renderPage();
  const group = await screen.findByRole('group', { name: 'Ações do treino' });
  fireEvent.click(within(group).getByRole('button', { name: 'Excluir' }));
  expect(svc.removeCheckIn).not.toHaveBeenCalled();
  const dialogBtns = screen.getAllByRole('button', { name: 'Excluir' });
  fireEvent.click(dialogBtns[dialogBtns.length - 1]);
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/history'));
  expect(svc.removeCheckIn).toHaveBeenCalledWith({}, 'u1', 'cur');
  expect(cache.invalidateCheckIns).toHaveBeenCalledWith('u1');
});
