import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WeekPlanTab from './WeekPlanTab';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../services/myWorkouts', () => ({ saveMyWorkout: jest.fn().mockResolvedValue('my_1') }));
jest.mock('../../services/weekPlanService', () => ({ generateWeekPlan: jest.fn(), resolvePlanText: jest.fn() }));

const { generateWeekPlan, resolvePlanText } = require('../../services/weekPlanService');
const { saveMyWorkout } = require('../../services/myWorkouts');
const toast = require('react-hot-toast').default;

const ex = (name) => ({ firestoreId: name, name, muscleGroup: 'peito', sets: '3', reps: '8-12', rest: 60 });
const day = (weekday, label) => ({ weekday, label, focus: label, kind: 'strength', occurrence: 1, error: null, workout: { estimatedTime: '45 min', exercises: [ex(`${label} 1`), ex(`${label} 2`)] } });
const plan = { goal: 'Hipertrofia', durationMinutes: 45, warnings: [], days: [day(0, 'Peito e Tríceps'), day(2, 'Costas e Bíceps'), day(4, 'Pernas Completo')] };
const profile = { goal: 'Hipertrofia', weeklyGoal: 3, experience: 'intermediario', gymEquipment: ['halter', 'livre'] };

beforeEach(() => { jest.clearAllMocks(); generateWeekPlan.mockResolvedValue(plan); resolvePlanText.mockResolvedValue({ text: 'Você treina 3 vezes na semana, com 45 minutos por treino.', source: 'ai' }); });

test('começa com os dias da meta do perfil, passa as preferências ao gerador e mostra a semana com o texto da IA', async () => {
  render(<WeekPlanTab user={{ uid: 'u1' }} userProfile={profile} customExercises={[{ id: 'mine_1' }]} />);
  expect(screen.getByRole('button', { name: '3', pressed: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  fireEvent.click(screen.getByLabelText('Incluir um dia de cardio'));
  fireEvent.change(screen.getByLabelText('Duração de cada treino'), { target: { value: '60' } });
  fireEvent.click(screen.getByText('Montar a semana'));
  await screen.findByText('Sua semana (IA)');
  expect(generateWeekPlan).toHaveBeenCalledWith(expect.objectContaining({ days: 4, durationMinutes: 60, includeCardio: true, includeStretch: false, goal: 'Hipertrofia', experience: 'intermediario', equipment: ['halter', 'livre'], customExercises: [{ id: 'mine_1' }] }));
  expect(screen.getByText('Você treina 3 vezes na semana, com 45 minutos por treino.')).toBeInTheDocument();
  expect(screen.getByText('Segunda')).toBeInTheDocument();
  expect(screen.getByText('Peito e Tríceps 1')).toBeInTheDocument();
  expect(screen.getAllByText('3 x 8-12').length).toBeGreaterThan(0);
});

test('salvar um dia e depois a semana inteira grava cada um como treino pessoal da IA', async () => {
  const onSaved = jest.fn();
  render(<WeekPlanTab user={{ uid: 'u1' }} userProfile={profile} onSaved={onSaved} />);
  fireEvent.click(screen.getByText('Montar a semana'));
  await screen.findByText('Sua semana (IA)');
  fireEvent.click(screen.getByLabelText('Salvar Quarta: Costas e Bíceps'));
  await waitFor(() => expect(saveMyWorkout).toHaveBeenCalledTimes(1));
  expect(saveMyWorkout.mock.calls[0][1]).toMatchObject({ name: 'Semana · Qua · Costas e Bíceps', source: 'ai', category: 'Hipertrofia' });
  expect(saveMyWorkout.mock.calls[0][1].description).toMatch(/quarta-feira/);
  fireEvent.click(await screen.findByText('Salvar os 2 restantes'));
  await waitFor(() => expect(saveMyWorkout).toHaveBeenCalledTimes(3));
  expect(await screen.findByText(/Tudo salvo/)).toBeInTheDocument();
  expect(onSaved).toHaveBeenCalled();
});

test('semana sem nenhum dia possível mostra o aviso e não abre resultado', async () => {
  generateWeekPlan.mockResolvedValue({ goal: 'Hipertrofia', durationMinutes: 45, days: [{ ...day(0, 'Peito e Tríceps'), workout: null, error: 'Poucos exercícios com os seus equipamentos.' }], warnings: ['Peito e Tríceps: Poucos exercícios com os seus equipamentos.'] });
  render(<WeekPlanTab user={{ uid: 'u1' }} userProfile={profile} />);
  fireEvent.click(screen.getByText('Montar a semana'));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Peito e Tríceps: Poucos exercícios com os seus equipamentos.'));
  expect(screen.queryByText(/Sua semana/)).toBeNull();
});
