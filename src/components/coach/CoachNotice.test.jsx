import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CoachNotice from './CoachNotice';

afterEach(() => localStorage.clear());

test('aparece uma vez e some ao fechar, lembrando no aparelho por treinador', () => {
  const { unmount } = render(<CoachNotice uid="c1" />);
  expect(screen.getByRole('heading', { name: /o aluno escolhe o que você vê/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
  expect(screen.queryByRole('heading', { name: /o aluno escolhe/ })).toBeNull();
  unmount();
  render(<CoachNotice uid="c1" />);
  expect(screen.queryByRole('heading', { name: /o aluno escolhe/ })).toBeNull();
});

test('outro treinador no mesmo aparelho ainda vê; o X também fecha', () => {
  localStorage.setItem('bt-coach-notice:compartilhamento-2026-10-30:c1', '1');
  render(<CoachNotice uid="c2" />);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
  expect(screen.queryByRole('heading', { name: /o aluno escolhe/ })).toBeNull();
});
