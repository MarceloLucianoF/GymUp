import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SetRow from './SetRow';

const base = { setIndex: 0, data: {}, weightPlaceholder: null, repsPlaceholder: '10', isFocusMode: false, isPR: false, onInput: jest.fn(), onCheck: jest.fn() };

test('o chip mostra o tipo, a dica quando não é normal, e o toque troca em ciclo', () => {
  const onType = jest.fn();
  const { rerender } = render(<SetRow {...base} type="normal" onType={onType} />);
  fireEvent.click(screen.getByLabelText('Tipo da série 1: Normal. Toque para mudar'));
  expect(onType).toHaveBeenCalledWith(0, 'warmup');
  expect(screen.queryByText(/Não conta no volume/)).toBeNull();
  rerender(<SetRow {...base} type="warmup" onType={onType} />);
  expect(screen.getByText('Aquec.')).toBeInTheDocument();
  expect(screen.getByText(/Não conta no volume nem nos recordes/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Tipo da série 1: Aquecimento. Toque para mudar'));
  expect(onType).toHaveBeenLastCalledWith(0, 'drop');
  rerender(<SetRow {...base} type="drop" onType={onType} />);
  expect(screen.getByText(/reduza cerca de 30% da carga/)).toBeInTheDocument();
});

test('sem onType (telas antigas) não aparece chip', () => {
  render(<SetRow {...base} />);
  expect(screen.queryByText('Normal')).toBeNull();
});
