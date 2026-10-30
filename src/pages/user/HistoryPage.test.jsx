import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import HistoryPage from './HistoryPage';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn(), dismiss: jest.fn() }) }));
const mockAuth = { user: { uid: 'u1' } };
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../../firebase/config', () => ({ db: {} }));
jest.mock('../../services/checkInService', () => ({ removeCheckIn: jest.fn() }));
jest.mock('../../services/checkInsCache', () => ({ invalidateCheckIns: jest.fn() }));

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const mockRows = [
  { id: 'c2', userId: 'u1', trainingId: 'A', trainingName: 'Treino A', date: new Date(y, m, 2, 10).toISOString(), totalVolume: 1000, duration: 1800, exercises: [{ name: 'Supino', sets: [{ weight: 60, reps: 10 }] }] },
  { id: 'c1', userId: 'u1', trainingId: 'B', trainingName: 'Treino B', date: new Date(y, m, 1, 10).toISOString(), totalVolume: 800, duration: 1500, exercises: [{ name: 'Agachamento', sets: [{ weight: 80, reps: 8 }] }] },
  { id: 'c0', userId: 'u1', trainingId: 'A', trainingName: 'Treino A', date: new Date(y, m - 1, 15, 10).toISOString(), totalVolume: 900, duration: 1700, exercises: [{ name: 'Supino', sets: [{ weight: 55, reps: 10 }] }, { name: 'Agachamento', sets: [{ weight: 70, reps: 8 }] }] },
];

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), where: jest.fn(), orderBy: jest.fn(),
  onSnapshot: (q, next) => { next({ docs: mockRows.map(({ id, ...data }) => ({ id, data: () => data })) }); return () => {}; },
}));

beforeEach(() => { require('../../services/checkInService').removeCheckIn.mockResolvedValue(true); });
const renderPage = () => render(<MemoryRouter><HistoryPage /></MemoryRouter>);
const titles = () => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent).filter((t) => /^Treino [AB]$/.test(t));

test('tocar num dia do calendário mostra só aquele dia; tocar de novo volta a mostrar tudo', () => {
  renderPage();
  expect(titles()).toEqual(['Treino A', 'Treino B', 'Treino A']);
  const calendar = screen.getByRole('region', { name: 'Calendário de treinos' });
  const day1 = within(calendar).getAllByRole('button', { pressed: false }).find((b) => /^1 de /.test(b.getAttribute('aria-label')));
  fireEvent.click(day1);
  expect(titles()).toEqual(['Treino B']);
  expect(screen.getByText('1 atividade encontrada')).toBeInTheDocument();
  fireEvent.click(within(calendar).getByRole('button', { pressed: true }));
  expect(titles()).toHaveLength(3);
});

test('filtra por ficha e por exercício, e limpa os filtros', () => {
  renderPage();
  fireEvent.change(screen.getByLabelText('Ficha'), { target: { value: 'id:A' } });
  expect(titles()).toEqual(['Treino A', 'Treino A']);
  fireEvent.change(screen.getByLabelText('Exercício'), { target: { value: 'agachamento' } });
  expect(titles()).toEqual(['Treino A']);
  fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
  expect(titles()).toHaveLength(3);
});

test('excluir pede confirmação no diálogo antes de apagar', async () => {
  const { removeCheckIn } = require('../../services/checkInService');
  renderPage();
  fireEvent.click(screen.getAllByRole('button', { name: 'Apagar registro' })[0]);
  expect(removeCheckIn).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
  await screen.findByText('3 atividades encontradas');
  expect(removeCheckIn).toHaveBeenCalledWith({}, 'u1', 'c2');
});
