import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExecutionExerciseCard from './ExecutionExerciseCard';

const ex = { name: 'Supino Reto Máquina', muscleGroup: 'peito', sets: '3', reps: '8-12', rest: 60, setTypes: ['warmup', 'normal', 'drop'] };
const history = [{ date: '2026-10-18T10:00:00.000Z', exercises: [{ name: 'Supino Reto Máquina', sets: [{ weight: 60, reps: 12, completed: true }, { weight: 60, reps: 12, completed: true }, { weight: 60, reps: 13, completed: true }] }] }];
const props = { ex, exIndex: 0, historyMap: { 'Supino Reto Máquina': 60 }, rawHistoryDocs: history, sessionData: {}, isLastExercise: false, onInput: jest.fn(), onCheckSet: jest.fn(), onAdjust: jest.fn(), onCopyLast: jest.fn(), onNote: jest.fn(), onOpenLoadHistory: jest.fn(), onZoom: jest.fn(), onShowVideo: jest.fn(), onNextExercise: jest.fn(), onFinish: jest.fn() };

beforeEach(() => jest.clearAllMocks());

test('mostra a carga sugerida por dupla progressão e "Usar" preenche só as séries de trabalho (drop com ~70%)', () => {
  render(<ExecutionExerciseCard {...props} />);
  expect(screen.getByText(/Subir para 62,5 kg/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Usar sugestão: 62,5 kg por 8 repetições'));
  const calls = props.onInput.mock.calls.map((c) => c.slice(1));
  expect(calls).toContainEqual([1, 'weight', '62.5']);
  expect(calls).toContainEqual([1, 'reps', '8']);
  expect(calls).toContainEqual([2, 'weight', '44']);          // drop: 70% de 62,5 em passos de 0,5
  expect(calls.some(([i]) => i === 0)).toBe(false);           // aquecimento não é preenchido
});

test('ao concluir sem digitar, a carga sugerida vai como dica de peso (e a do drop, reduzida)', () => {
  render(<ExecutionExerciseCard {...props} />);
  fireEvent.click(screen.getByLabelText('Concluir série 2'));
  expect(props.onCheckSet).toHaveBeenLastCalledWith(0, 1, '8', 3, 60, 'Supino Reto Máquina', 62.5);
  fireEvent.click(screen.getByLabelText('Concluir série 3'));
  expect(props.onCheckSet).toHaveBeenLastCalledWith(0, 2, '8', 3, 60, 'Supino Reto Máquina', 44);
});

test('sem histórico mostra a dica antiga e sem botão Usar; o botão Trocar chama onSwap', () => {
  const onSwap = jest.fn();
  render(<ExecutionExerciseCard {...props} rawHistoryDocs={[]} historyMap={{}} onSwap={onSwap} />);
  expect(screen.getByText(/Defina sua primeira carga/)).toBeInTheDocument();
  expect(screen.queryByText('Usar')).toBeNull();
  fireEvent.click(screen.getByLabelText('Trocar Supino Reto Máquina'));
  expect(onSwap).toHaveBeenCalledWith(0);
});
