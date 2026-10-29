import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExecutionHeader, { formatElapsed } from './ExecutionHeader';

test('cronômetro com horas a partir de 60 min', () => {
  expect(formatElapsed(65)).toBe('1:05');
  expect(formatElapsed(59 * 60 + 59)).toBe('59:59');
  expect(formatElapsed(230 * 60 + 53)).toBe('3:50:53');
  expect(formatElapsed(undefined)).toBe('0:00');
});

const baseProps = { trainingName: 'Treino A', isOnline: true, elapsedTime: 90, completedSetsCount: 2, totalSetsInTraining: 10, progressPercent: 20, viewMode: 'list', onChangeViewMode: () => {} };

test('botão de início no cabeçalho sai da execução sem finalizar', () => {
  const onGoHome = jest.fn();
  render(<ExecutionHeader {...baseProps} onGoHome={onGoHome} />);
  const btn = screen.getByRole('button', { name: /ir para o início/i });
  expect(btn.className).toMatch(/min-h-\[44px\]/);
  expect(btn.className).toMatch(/min-w-\[44px\]/);
  fireEvent.click(btn);
  expect(onGoHome).toHaveBeenCalledTimes(1);
});

test('sem onGoHome não mostra o botão de início', () => {
  render(<ExecutionHeader {...baseProps} />);
  expect(screen.queryByRole('button', { name: /ir para o início/i })).toBeNull();
});
