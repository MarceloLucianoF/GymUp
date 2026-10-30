import React from 'react';
import { render, screen, within } from '@testing-library/react';
import AchievementBadges from './AchievementBadges';
import { computeAchievements } from '../../utils/achievements';

const at = (d) => new Date(2026, 0, d, 12).toISOString();
const ci = (d) => ({ date: at(d), createdAt: at(d), duration: 1800, setsCompleted: 4, exercises: [{ name: 'Supino', sets: [{ weight: 40, reps: 10 }] }] });

test('mostra as obtidas com como ganhou e a data, e as próximas bloqueadas com o que falta', () => {
  const { achievements } = computeAchievements([ci(5), ci(6)]);
  render(<AchievementBadges achievements={achievements} />);
  const won = screen.getByRole('list', { name: 'Conquistas obtidas' });
  expect(within(won).getByText('Primeiro treino')).toBeInTheDocument();
  expect(within(won).getByText(/Concluiu o primeiro treino\. Em 05\/01\/2026/)).toBeInTheDocument();
  const next = screen.getByRole('list', { name: 'Próximas conquistas' });
  expect(within(next).getByText('Faltam 8 treinos.')).toBeInTheDocument();
  expect(within(next).getAllByText('(bloqueada)')).toHaveLength(achievements.length - 1);
});

test('sem conquistas: explica como ganhar a primeira', () => {
  render(<AchievementBadges achievements={computeAchievements([]).achievements} />);
  expect(screen.getByText(/Nenhuma ainda/)).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Conquistas obtidas' })).toBeNull();
});
