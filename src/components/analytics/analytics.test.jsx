import React from 'react';
import { render, screen } from '@testing-library/react';
import MuscleBalance from './MuscleBalance';
import ExerciseChart from './ExerciseChart';

describe('MuscleBalance', () => {
  test('sem dados', () => {
    render(<MuscleBalance checkIns={[]} />);
    expect(screen.getByText(/Sem treinos no período/)).toBeInTheDocument();
  });
  test('lista grupos', () => {
    render(<MuscleBalance data={[{ group: 'Peito', volume: 2000, sessions: 2 }, { group: 'Costas', volume: 1000, sessions: 1 }]} />);
    expect(screen.getByText('Peito')).toBeInTheDocument();
    expect(screen.getByText(/2.0t · 2x/)).toBeInTheDocument();
  });
});

describe('ExerciseChart', () => {
  test('role img com resumo', () => {
    const points = [1, 2, 3].map((i) => ({ ts: i * 86400000, date: new Date(i * 86400000).toISOString(), value: 50 + i }));
    render(<ExerciseChart points={points} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/3 treinos/);
  });
  test('um ponto e vazio não quebram', () => {
    const { rerender } = render(<ExerciseChart points={[{ ts: 1, date: new Date(1).toISOString(), value: 10 }]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    rerender(<ExerciseChart points={[]} />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
