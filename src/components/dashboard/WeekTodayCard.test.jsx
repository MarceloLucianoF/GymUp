import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WeekTodayCard from './WeekTodayCard';
import { weekStatus } from '../../utils/weekSchedule';

const w = (id, name) => ({ id, docId: id, name, estimatedTime: '45 min', exercises: [{}, {}, {}, {}, {}] });
const mine = [w('my_a', 'Semana · Seg · Peito e Tríceps'), w('my_b', 'Semana · Qua · Costas e Bíceps'), w('my_c', 'Semana · Sex · Pernas Completo')];
const WED = new Date('2026-10-21T15:00:00-03:00').getTime();

test('dia de treino: mostra o treino de hoje, o atraso e começa pelo botão', () => {
  const onStart = jest.fn();
  render(<WeekTodayCard status={weekStatus({ mine, history: [], now: WED })} onStart={onStart} />);
  expect(screen.getByRole('heading', { name: 'Costas e Bíceps' })).toBeInTheDocument();
  expect(screen.getByText('0 de 3 feitos')).toBeInTheDocument();
  expect(screen.getByText(/5 exercícios · 45 min/)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Começar: Costas e Bíceps/));
  expect(onStart).toHaveBeenCalledWith('my_b');
  fireEvent.click(screen.getByText(/Atrasado: Peito e Tríceps \(segunda\)/));
  expect(onStart).toHaveBeenLastCalledWith('my_a');
  expect(screen.getByLabelText('Qua: Costas e Bíceps, hoje')).toBeInTheDocument();
});

test('treino de hoje feito: oferece o próximo; semana completa agradece', () => {
  const done = [{ trainingId: 'my_a', date: '2026-10-19T10:00:00-03:00' }, { trainingId: 'my_b', date: '2026-10-21T10:00:00-03:00' }];
  const onStart = jest.fn();
  const { rerender } = render(<WeekTodayCard status={weekStatus({ mine, history: done, now: WED })} onStart={onStart} />);
  expect(screen.getByText('Treino de hoje feito')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Próximo: Sexta · Pernas Completo/ })).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Adiantar: Pernas Completo/));
  expect(onStart).toHaveBeenCalledWith('my_c');
  rerender(<WeekTodayCard status={weekStatus({ mine, history: [...done, { trainingId: 'my_c', date: '2026-10-21T11:00:00-03:00' }], now: WED })} onStart={onStart} />);
  expect(screen.getByRole('heading', { name: 'Semana completa!' })).toBeInTheDocument();
});

test('dia de descanso e sem semana montada', () => {
  const thu = new Date('2026-10-22T09:00:00-03:00').getTime();
  const { container, rerender } = render(<WeekTodayCard status={weekStatus({ mine, history: [], now: thu })} onStart={jest.fn()} />);
  expect(screen.getByText('Dia de descanso')).toBeInTheDocument();
  rerender(<WeekTodayCard status={null} onStart={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
