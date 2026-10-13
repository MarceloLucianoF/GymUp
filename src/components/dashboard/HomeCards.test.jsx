import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecordsCard from './RecordsCard';
import FriendsWeekCard from './FriendsWeekCard';
import CoachMessageCard from './CoachMessageCard';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('cartões extras do painel do aluno', () => {
  it('recordes: lista exercício, carga, marca anterior e quando; some sem recordes', () => {
    const { container, rerender } = wrap(<RecordsCard records={[{ exercise: 'Supino', weight: 80, previous: 75, date: new Date() }]} />);
    expect(screen.getByText('Supino: 80 kg')).toBeInTheDocument();
    expect(screen.getByText(/Antes 75 kg · hoje/)).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    rerender(<MemoryRouter><RecordsCard records={[]} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('amigos: com ranking mostra a posição e o pódio; sem amigos mostra o convite; sem dados volta ao texto padrão', () => {
    const rows = [{ uid: 'a', name: 'Bia', workouts: 3 }, { uid: 'u', name: 'Eu', workouts: 2, me: true }, { uid: 'c', name: 'Caio', workouts: 1 }];
    const { rerender } = wrap(<FriendsWeekCard preview={{ status: 'ready', rows, position: 2, total: 3 }} />);
    expect(screen.getByText('Você está em 2º entre 3 esta semana')).toBeInTheDocument();
    expect(screen.getByText('Bia')).toBeInTheDocument();
    expect(screen.getByText('Você')).toBeInTheDocument();
    rerender(<MemoryRouter><FriendsWeekCard preview={{ status: 'noFriends' }} /></MemoryRouter>);
    expect(screen.getByText(/Adicione amigos pelo @usuário/)).toBeInTheDocument();
    rerender(<MemoryRouter><FriendsWeekCard preview={{ status: 'loading' }} /></MemoryRouter>);
    expect(screen.getByText('Amigos e ranking')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/amigos');
  });

  it('mensagem do treinador: só aparece se não lida, com o nome e o texto, e leva ao chat', () => {
    const { container, rerender } = wrap(<CoachMessageCard coachName="Marcos" message={{ text: 'Treino liberado!', unread: true }} />);
    expect(screen.getByText('Mensagem de Marcos')).toBeInTheDocument();
    expect(screen.getByText('Treino liberado!')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/chat');
    rerender(<MemoryRouter><CoachMessageCard coachName="Marcos" message={{ text: 'x', unread: false }} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    rerender(<MemoryRouter><CoachMessageCard message={null} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
