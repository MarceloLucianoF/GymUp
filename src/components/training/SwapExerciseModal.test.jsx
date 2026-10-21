import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SwapExerciseModal from './SwapExerciseModal';
import { exercises } from '../../data/exercises';

const current = exercises.find((e) => e.name === 'Supino Reto Máquina');

test('lista equivalentes e troca só hoje ou na ficha', () => {
  const onPick = jest.fn();
  render(<SwapExerciseModal isOpen onClose={jest.fn()} exercise={current} library={exercises} owned={[]} excludeNames={['Supino Reto Máquina']} canPersist onPick={onPick} />);
  expect(screen.getByText('Trocar exercício')).toBeInTheDocument();
  expect(screen.queryByText('Supino Reto Máquina', { selector: 'p' })).toBeNull();         // o atual não aparece como opção
  const firstName = screen.getAllByRole('listitem')[0].querySelector('p.font-bold').textContent;
  fireEvent.click(screen.getByLabelText(`Trocar por ${firstName} só hoje`));
  expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ name: firstName }), 'hoje');
  fireEvent.click(screen.getByLabelText(`Trocar por ${firstName} na minha ficha`));
  expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ name: firstName }), 'ficha');
});

test('treino que não é do aluno só oferece "Só hoje"; sem equivalentes mostra o aviso', () => {
  const { rerender } = render(<SwapExerciseModal isOpen onClose={jest.fn()} exercise={current} library={exercises} owned={[]} excludeNames={[]} canPersist={false} onPick={jest.fn()} />);
  expect(screen.queryByText('Na minha ficha')).toBeNull();
  rerender(<SwapExerciseModal isOpen onClose={jest.fn()} exercise={current} library={exercises} owned={['cardio']} excludeNames={[]} canPersist={false} onPick={jest.fn()} />);
  expect(screen.getByText(/Não achei equivalentes/)).toBeInTheDocument();
});

test('fechado não renderiza', () => {
  const { container } = render(<SwapExerciseModal isOpen={false} onClose={jest.fn()} exercise={current} library={exercises} onPick={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
