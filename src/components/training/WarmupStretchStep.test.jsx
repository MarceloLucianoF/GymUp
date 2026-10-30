import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import WarmupStretchStep from './WarmupStretchStep';
import { exercises as LIBRARY } from '../../data/exercises';
import { buildWarmupStretch, needsWarmupStep } from '../../utils/stretchWorkout';
import { summarizeSession } from '../../utils/training';

const warmup = buildWarmupStretch(LIBRARY);
const strength = [{ name: 'Supino reto', sets: 3, reps: '10' }, { name: 'Remada', sets: 3, reps: '10' }];

describe('quando a etapa aparece', () => {
  test('só com warmupStretch: true e sem o alongamento já no início da ficha', () => {
    expect(needsWarmupStep({ warmupStretch: true, exercises: strength }, [warmup])).toBe(true);
    expect(needsWarmupStep({ exercises: strength }, [warmup])).toBe(false);   // ficha antiga, sem o campo
    expect(needsWarmupStep({ warmupStretch: false, exercises: strength }, [warmup])).toBe(false);
    expect(needsWarmupStep({ warmupStretch: true, exercises: [...warmup, ...strength] }, [warmup])).toBe(false);
    expect(needsWarmupStep({ warmupStretch: true, exercises: strength }, [[]])).toBe(false);
  });

  test('alongamento inserido com outra biblioteca (mesmos exercícios) também conta como "já tem"', () => {
    const otherOrder = [warmup[1], warmup[0], warmup[2], ...strength];
    expect(needsWarmupStep({ warmupStretch: true, exercises: otherOrder }, [warmup])).toBe(false);
  });
});

describe('WarmupStretchStep', () => {
  afterEach(() => jest.useRealTimers());

  test('mostra a etapa com o 1º alongamento e o cronômetro', () => {
    render(<WarmupStretchStep exercises={warmup} onDone={jest.fn()} />);
    expect(screen.getByRole('heading', { name: /Alongamento geral \(5 min\)/ })).toBeInTheDocument();
    expect(screen.getByText(`1 de ${warmup.length}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: warmup[0].name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pular/ })).toBeInTheDocument();
  });

  test('Pular encerra a etapa sem registrar séries nem volume', () => {
    const onDone = jest.fn();
    render(<WarmupStretchStep exercises={warmup} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /Pular/ }));
    expect(onDone).toHaveBeenCalledWith('skipped');
    // a etapa não toca nas séries: a sessão continua vazia e o resumo do treino segue zerado
    expect(summarizeSession(strength, {})).toMatchObject({ totalVolume: 0, setsCompleted: 0, executedExercises: [] });
  });

  test('Próximo avança e, no último, conclui a etapa', () => {
    const onDone = jest.fn();
    const three = warmup.slice(0, 3);
    render(<WarmupStretchStep exercises={three} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByText('2 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir alongamento' }));
    expect(onDone).toHaveBeenCalledWith('done');
  });

  test('cronômetro conta o tempo do exercício e avisa no fim', () => {
    jest.useFakeTimers();
    render(<WarmupStretchStep exercises={[{ name: 'Gato-vaca', kind: 'timed', reps: 3 }]} onDone={jest.fn()} />);
    expect(screen.getByText('0:03')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Iniciar/ }));
    act(() => { jest.advanceTimersByTime(3500); });
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('Tempo!')).toBeInTheDocument();
  });
});
