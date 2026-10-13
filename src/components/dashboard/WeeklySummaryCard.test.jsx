import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WeeklySummaryCard from './WeeklySummaryCard';
import { buildWeeklySummary, localNarrative } from '../../utils/weeklySummary';

const NOW = new Date(2026, 9, 14, 15, 0);
const w = (d) => ({ id: `w${d}`, trainingId: 't', date: new Date(2026, 9, d, 10).toISOString(), duration: 3000, totalVolume: 1000, setsCompleted: 10, exercises: [{ name: 'Supino', sets: [{ weight: 50 }] }] });
const show = (facts, narrative, onPeriod = jest.fn()) => render(<MemoryRouter><WeeklySummaryCard facts={facts} narrative={narrative} period="current" onPeriod={onPeriod} /></MemoryRouter>);

describe('cartão do resumo semanal', () => {
  const facts = buildWeeklySummary({ history: [w(12), w(13), w(14)], weeklyGoal: 4, now: NOW });

  it('mostra os números antes do texto e o texto usa os mesmos números', () => {
    show(facts, { text: localNarrative(facts), source: 'local' });
    const list = screen.getByRole('list', { name: 'Números do período' });
    expect(list).toHaveTextContent('3/4');
    expect(list).toHaveTextContent('150');
    expect(list).toHaveTextContent('3,0 t');
    expect(screen.getByTestId('summary-text')).toHaveTextContent('3 de 4 treinos');
    expect(screen.getByTestId('summary-text')).toHaveTextContent('150 minutos');
    expect(screen.getByText(/Resumo automático/)).toBeInTheDocument();
    expect(screen.getByText(/fuso/)).toBeInTheDocument();
    expect(screen.getByText(/em andamento/)).toBeInTheDocument();
  });

  it('texto da IA vem identificado como tal', () => {
    show(facts, { text: 'Você completou 3 de 4 treinos.', source: 'ai' });
    expect(screen.getByText(/gerado por IA a partir dos números acima/)).toBeInTheDocument();
  });

  it('semana sem treinos: estado vazio com ação útil; alternar o período chama onPeriod', async () => {
    const empty = buildWeeklySummary({ history: [], weeklyGoal: 3, now: NOW });
    const onPeriod = jest.fn();
    show(empty, { text: localNarrative(empty), source: 'local' }, onPeriod);
    expect(screen.getByText(/Nenhum treino concluído nesta semana ainda/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver minhas fichas' })).toHaveAttribute('href', '/trainings');
    await userEvent.click(screen.getByRole('button', { name: 'Semana passada' }));
    expect(onPeriod).toHaveBeenCalledWith('last');
    expect(screen.getByRole('button', { name: 'Esta semana' })).toHaveAttribute('aria-pressed', 'true');
  });
});
