import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import RoutineTodayCard from './RoutineTodayCard';
import { routineNext } from '../../utils/routine';

const w = (docId, name) => ({ id: `my_${docId}`, docId, name, exercises: [{}, {}, {}], estimatedTime: '40 min' });
const workouts = [w('a', 'Peito'), w('b', 'Costas'), w('c', 'Pernas')];
const items = [{ workoutId: 'a' }, { workoutId: 'b' }, { workoutId: 'c' }];
const WED = new Date('2026-10-21T15:00:00-03:00').getTime();
const view = (status, onStart = jest.fn()) => render(<MemoryRouter><RoutineTodayCard status={status} onStart={onStart} /></MemoryRouter>);

test('depois de concluir o Treino A, mostra "Próximo: Treino B" e começa por ele', () => {
  const onStart = jest.fn();
  view(routineNext({ items, workouts, history: [{ trainingId: 'my_a', date: '2026-10-21T08:00:00-03:00' }], now: WED }), onStart);
  expect(screen.getByRole('heading', { name: 'Próximo: Treino B' })).toBeInTheDocument();
  expect(screen.getByText('Treino de hoje feito')).toBeInTheDocument();
  expect(screen.getByText('Costas · depois do Treino A')).toBeInTheDocument();
  expect(screen.getByLabelText('Treino A: Peito, feito nesta semana')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Adiantar: Treino B/ }));
  expect(onStart).toHaveBeenCalledWith('my_b');
  expect(screen.getByRole('link', { name: 'Organizar ficha' })).toHaveAttribute('href', '/trainings');
});

test('com dia marcado para hoje, mostra o de hoje; sem ficha, nada', () => {
  const { container, rerender } = view(routineNext({ items: [{ workoutId: 'a', day: 0 }, { workoutId: 'b', day: 2 }], workouts, history: [], now: WED }));
  expect(screen.getByRole('heading', { name: 'Hoje: Treino B' })).toBeInTheDocument();
  rerender(<MemoryRouter><RoutineTodayCard status={null} onStart={jest.fn()} /></MemoryRouter>);
  expect(container).toBeEmptyDOMElement();
});
