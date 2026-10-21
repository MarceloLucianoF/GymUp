import React from 'react';
import { render, screen } from '@testing-library/react';
import CelebrationModal from './CelebrationModal';

const stats = { trainingName: 'Superiores A', timeStr: '50:00', volumeKg: 3300, completedSetsCount: 9, executedExercisesCount: 3, newPRs: ['Supino Reto Máquina'] };
const facts = {
  minutes: 50, volume: 3300, workSets: 9, volumePct: 10, week: { done: 2, goal: 4 }, highlights: [], attention: [],
  exercises: [
    { name: 'Supino Reto Máquina', top: { weight: 55, reps: 10 }, workSets: 3, trend: 'load', delta: 5 },
    { name: 'Remada Máquina (Sentado)', top: { weight: 40, reps: 11 }, workSets: 3, trend: 'reps', delta: 1 },
    { name: 'Rosca Direta', top: { weight: 10, reps: 8 }, workSets: 3, trend: 'down', delta: null },
    { name: 'Abdominal', top: { weight: 0, reps: 15 }, workSets: 3, trend: 'new', delta: null }
  ],
  next: [{ name: 'Supino Reto Máquina', kind: 'increase', load: 57.5, reps: 8 }]
};

test('mostra o texto, a variação do volume, cada exercício com a tendência e o que fazer no próximo treino', () => {
  render(<CelebrationModal stats={stats} summary={{ facts, text: 'Treino forte de 50 minutos.', source: 'local', loading: false }} onFinish={jest.fn()} />);
  expect(screen.getByText('Treino forte de 50 minutos.')).toBeInTheDocument();
  expect(screen.getByText('+10% que da última vez')).toBeInTheDocument();
  expect(screen.getByText('+5 kg')).toBeInTheDocument();
  expect(screen.getByText('+1 rep')).toBeInTheDocument();
  expect(screen.getByText('Abaixo')).toBeInTheDocument();
  expect(screen.getByText('Novo')).toBeInTheDocument();
  expect(screen.getByText(/Melhor série: 55 kg × 10/)).toBeInTheDocument();
  expect(screen.getByText(/57,5 kg por 8 repetições \(carga maior\)/)).toBeInTheDocument();
  expect(screen.queryByText(/\(IA\)/)).toBeNull();
});

test('texto da IA recebe a marca e, enquanto espera, avisa que está pedindo à IA', () => {
  const { rerender } = render(<CelebrationModal stats={stats} summary={{ facts, text: 'Texto local.', source: 'local', loading: true }} onFinish={jest.fn()} />);
  expect(screen.getByText(/Pedindo um texto mais natural à IA/)).toBeInTheDocument();
  rerender(<CelebrationModal stats={stats} summary={{ facts, text: 'Texto da IA com 50 minutos.', source: 'ai', loading: false }} onFinish={jest.fn()} />);
  expect(screen.getByText(/Resumo do treino \(IA\)/)).toBeInTheDocument();
  expect(screen.queryByText(/Pedindo um texto/)).toBeNull();
});

test('sem resumo (telas antigas) continua como antes', () => {
  render(<CelebrationModal stats={stats} onFinish={jest.fn()} />);
  expect(screen.getByText('TREINO CONCLUÍDO!')).toBeInTheDocument();
  expect(screen.queryByLabelText('Resumo do treino')).toBeNull();
});
