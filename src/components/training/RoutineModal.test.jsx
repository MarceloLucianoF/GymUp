import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RoutineModal from './RoutineModal';

const w = (docId, name) => ({ id: `my_${docId}`, docId, name, exercises: [{}] });
const workouts = [w('p', 'Peito e Tríceps'), w('c', 'Costas e Bíceps'), w('l', 'Pernas')];
const names = () => within(screen.getByRole('list', { name: 'Treinos da ficha em ordem' }))
  .getAllByText(/^(Peito|Costas|Pernas)/).map((n) => n.textContent);

test('cria a ficha com 3 treinos, reordena com as setas e marca o dia', async () => {
  const onSave = jest.fn().mockResolvedValue();
  render(<RoutineModal workouts={workouts} items={[]} onClose={jest.fn()} onSave={onSave} />);
  expect(screen.getByText(/Nenhum treino na ficha/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Pernas à ficha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Peito e Tríceps à ficha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Costas e Bíceps à ficha' }));
  expect(names()).toEqual(['Pernas', 'Peito e Tríceps', 'Costas e Bíceps']);

  // o primeiro não sobe e o último não desce
  expect(screen.getByRole('button', { name: 'Subir Pernas' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Descer Pernas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Descer Pernas' }));
  expect(names()).toEqual(['Peito e Tríceps', 'Costas e Bíceps', 'Pernas']);
  expect(screen.getByRole('button', { name: 'Descer Pernas' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Subir Costas e Bíceps' }));
  expect(names()).toEqual(['Costas e Bíceps', 'Peito e Tríceps', 'Pernas']);
  expect(screen.getByText('Treino A')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Dia da semana de Pernas'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith([
    { workoutId: 'c', day: null }, { workoutId: 'p', day: null }, { workoutId: 'l', day: 4 }
  ]));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar ficha' })).toBeEnabled());
});

test('treino apagado some da ficha; tirar um treino o devolve para "Adicionar"', () => {
  render(<RoutineModal workouts={workouts} items={[{ workoutId: 'p' }, { workoutId: 'apagado' }]} onClose={jest.fn()} onSave={jest.fn()} />);
  expect(names()).toEqual(['Peito e Tríceps']);
  fireEvent.click(screen.getByRole('button', { name: 'Tirar Peito e Tríceps da ficha' }));
  expect(screen.getByRole('button', { name: 'Adicionar Peito e Tríceps à ficha' })).toBeInTheDocument();
});
