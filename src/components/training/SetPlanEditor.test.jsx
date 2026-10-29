import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SetPlanEditor from './SetPlanEditor';
import { normalizeSetPlan } from '../../utils/setTypes';

// Pai controlado, como "Meu treino" e o editor de fichas: guarda tipos e plano e repassa a cada mudança.
function Host({ onChange, sets = '3', initialTypes = null, initialPlan = null }) {
  const [types, setTypes] = useState(initialTypes);
  const [plan, setPlan] = useState(initialPlan);
  return (
    <SetPlanEditor idBase="t" sets={sets} reps="6-10" types={types} plan={plan} canLink={false}
      onChange={(t, p) => { setTypes(t); setPlan(p); onChange(t, p); }} />
  );
}
const last = (fn) => fn.mock.calls[fn.mock.calls.length - 1];

test('cada série tem reps próprias e técnica; isometria, drop com cargas e cluster viram o plano salvo', () => {
  const onChange = jest.fn();
  render(<Host onChange={onChange} />);
  expect(screen.getAllByLabelText(/^Técnica da série/)).toHaveLength(3);
  expect(screen.getByLabelText('Repetições da série 1')).toHaveAttribute('placeholder', '6-10');

  // série 1: 10'' de isometria + 15 repetições
  fireEvent.change(screen.getByLabelText('Repetições da série 1'), { target: { value: '15' } });
  fireEvent.change(screen.getByLabelText('Técnica da série 1'), { target: { value: 'isoBefore' } });
  expect(screen.getByLabelText('Segundos de isometria antes da série 1')).toHaveValue('10');
  expect(screen.getByText("10'' iso + 15")).toBeInTheDocument();

  // série 2: drop + falha com cargas 16 e 12
  fireEvent.change(screen.getByLabelText('Técnica da série 2'), { target: { value: 'dropFailure' } });
  fireEvent.change(screen.getByLabelText('Carga do drop 1 da série 2 (kg)'), { target: { value: '16' } });
  fireEvent.click(screen.getByLabelText('Adicionar drop na série 2'));
  fireEvent.change(screen.getByLabelText('Carga do drop 2 da série 2 (kg)'), { target: { value: '12' } });
  expect(screen.getByText('6-10 + drop 16/12 até a falha')).toBeInTheDocument();

  // série 3: cluster 4-4-4, pausa 10 s; remove um bloco e não deixa ficar com menos de 2
  fireEvent.change(screen.getByLabelText('Técnica da série 3'), { target: { value: 'cluster' } });
  expect(screen.queryByLabelText('Repetições da série 3')).toBeNull();
  expect(screen.getByText('4-4-4 (10 s)')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Remover o último bloco da série 3'));
  expect(screen.getByLabelText('Remover o último bloco da série 3')).toBeDisabled();

  const [types, plan] = last(onChange);
  expect(types).toEqual(['normal', 'drop', 'cluster']);
  expect(normalizeSetPlan(plan, 3)).toEqual([
    { reps: '15', isoBeforeSec: 10 },
    { drops: [{ load: 16 }, { load: 12 }], failure: true },
    { blocks: [4, 4], blockRestSec: 10 }
  ]);
});

test('limite de 4 drops; ficha antiga com drop sem plano abre como drop', () => {
  const onChange = jest.fn();
  render(<Host onChange={onChange} sets="2" initialTypes={['normal', 'drop']} />);
  expect(screen.getByLabelText('Técnica da série 2')).toHaveValue('drop');
  const add = screen.getByLabelText('Adicionar drop na série 2');
  fireEvent.click(add); fireEvent.click(add); fireEvent.click(add);
  expect(screen.getAllByLabelText(/^Carga do drop \d da série 2/)).toHaveLength(4);
  expect(add).toBeDisabled();
  expect(onChange).toHaveBeenCalled();
});
