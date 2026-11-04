import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkoutCustomizer, { EMPTY_PREFS, filledCount } from './WorkoutCustomizer';

function Harness({ focus = 'Costas e Bíceps', onValue }) {
  const [value, setValue] = useState(EMPTY_PREFS);
  return <WorkoutCustomizer focus={focus} value={value} onChange={(v) => { setValue(v); onValue?.(v); }} defaultExperience="intermediario" defaultDays={4} />;
}

test('fechado por padrão; abre e mostra ênfases do foco escolhido', () => {
  render(<Harness />);
  const toggle = screen.getByRole('button', { name: /Personalizar \(opcional\)/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Largura (puxadas)')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Largura (puxadas)' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Peito superior' })).not.toBeInTheDocument();
  // o perfil aparece marcado como ponto de partida
  expect(screen.getByRole('button', { name: 'Intermediário' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '4 dias' })).toHaveAttribute('aria-pressed', 'true');
});

test('as respostas viram preferências do pedido e podem ser limpas', () => {
  const onValue = jest.fn();
  render(<Harness onValue={onValue} />);
  fireEvent.click(screen.getByRole('button', { name: /Personalizar/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Largura (puxadas)' }));
  fireEvent.click(screen.getByRole('button', { name: '8' }));
  fireEvent.change(screen.getByLabelText('Evitar exercícios'), { target: { value: 'levantamento terra' } });
  fireEvent.change(screen.getByLabelText('Algo mais para o Coach saber'), { target: { value: 'dor no ombro' } });
  expect(onValue).toHaveBeenLastCalledWith(expect.objectContaining({ emphasis: 'costas_largura', count: 8, avoid: 'levantamento terra', notes: 'dor no ombro' }));
  expect(screen.getByRole('button', { name: /Personalizar \(opcional\) · 4 escolhas/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar personalização' }));
  expect(onValue).toHaveBeenLastCalledWith(EMPTY_PREFS);
});

test('contagem de respostas preenchidas', () => {
  expect(filledCount(EMPTY_PREFS)).toBe(0);
  expect(filledCount({ ...EMPTY_PREFS, include: '  ', count: 6 })).toBe(1);
});
