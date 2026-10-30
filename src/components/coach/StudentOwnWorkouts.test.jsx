import React from 'react';
import { render, screen } from '@testing-library/react';
import StudentOwnWorkouts from './StudentOwnWorkouts';

test('sem autorização mostra o aviso', () => {
  render(<StudentOwnWorkouts own={null} name="Carla" />);
  expect(screen.getByText(/Carla montou no app aparecem aqui quando ele autorizar/)).toBeInTheDocument();
});

test('lista na ordem da ficha do aluno, com a letra', () => {
  const workouts = [
    { id: 'my_a', docId: 'a', name: 'Pernas', exercises: [{ name: 'Agachamento', sets: '4', reps: '8' }] },
    { id: 'my_b', docId: 'b', name: 'Peito', exercises: [{ name: 'Supino' }, { name: 'Crucifixo' }] }
  ];
  render(<StudentOwnWorkouts own={{ workouts, routine: { items: [{ workoutId: 'b' }, { workoutId: 'a' }] } }} />);
  const names = screen.getAllByText(/^(Pernas|Peito)$/).map((n) => n.textContent);
  expect(names).toEqual(['Peito', 'Pernas']);
  expect(screen.getByLabelText('Treino A da ficha')).toBeInTheDocument();
  expect(screen.getByText('2 exercícios')).toBeInTheDocument();
});
