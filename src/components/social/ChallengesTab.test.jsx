import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ChallengesTab from './ChallengesTab';

jest.mock('../../firebase/config', () => ({ db: {} }));
jest.mock('react-hot-toast', () => Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }));
jest.mock('../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: async () => true, dialog: null }) }));

const today = new Date();
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (n) => key(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n, 12));
const profile = { displayName: 'Ana', handle: 'ana' };
const challenge = (over = {}) => ({
  id: 'c1', name: 'Novembro forte', durationDays: 7, startDay: plus(-2), endDay: plus(4), ownerId: 'u0', code: 'ABCD2345', memberCount: 3, status: 'active',
  me: { uid: 'u1', activeDays: 1, lastDay: plus(-1) },
  members: [
    { uid: 'u0', displayName: 'Bia', handle: 'bia', activeDays: 3, lastDay: plus(0) },
    { uid: 'u1', displayName: 'Ana', handle: 'ana', activeDays: 1, lastDay: plus(-1) },
    { uid: 'u2', displayName: 'Caio', handle: 'caio', activeDays: 2, lastDay: plus(0) }
  ],
  ...over
});
const makeServices = (list = [challenge()]) => ({
  listMyChallenges: jest.fn().mockResolvedValue(list),
  syncMyScores: jest.fn(async (uid, l) => l),
  fetchStudentCheckIns: jest.fn().mockResolvedValue([]),
  createChallenge: jest.fn().mockResolvedValue({ id: 'n', code: 'NEWCODE2' }),
  joinChallenge: jest.fn().mockResolvedValue({ id: 'c9', already: false }),
  leaveChallenge: jest.fn().mockResolvedValue(),
  endChallenge: jest.fn().mockResolvedValue(),
  deleteChallenge: jest.fn().mockResolvedValue(3)
});

test('sem perfil social pede para criar o perfil', () => {
  render(<ChallengesTab uid="u1" profile={null} services={makeServices()} />);
  expect(screen.getByText(/Crie seu perfil social primeiro/)).toBeInTheDocument();
});

test('mostra o placar por dias ativos e atualiza a própria contagem ao abrir', async () => {
  const services = makeServices();
  render(<ChallengesTab uid="u1" profile={profile} services={services} />);
  const board = await screen.findByRole('list', { name: /Placar de Novembro forte/ });
  const rows = within(board).getAllByRole('listitem');
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining('Bia'), expect.stringContaining('Caio'), expect.stringContaining('Ana (você)')
  ]);
  expect(rows[0]).toHaveTextContent('3 dias');
  expect(rows[2]).toHaveTextContent('1 dia');
  expect(screen.getByText(/dia 3 de 7/)).toBeInTheDocument();
  await waitFor(() => expect(services.syncMyScores).toHaveBeenCalledWith('u1', expect.any(Array), [], profile));
  expect(screen.getByRole('button', { name: /Sair do desafio/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Apagar desafio/ })).not.toBeInTheDocument();
});

test('criar com 30 dias e entrar com código (normalizado)', async () => {
  const services = makeServices([]);
  render(<ChallengesTab uid="u1" profile={profile} services={services} initialCode="abcd-2345" />);
  await screen.findByText(/Nenhum desafio ainda/);
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Mês todo' } });
  fireEvent.click(screen.getByLabelText('30 dias'));
  fireEvent.click(screen.getByRole('button', { name: 'Criar desafio' }));
  await waitFor(() => expect(services.createChallenge).toHaveBeenCalledWith('u1', profile, { name: 'Mês todo', durationDays: 30 }));
  expect(screen.getByLabelText('Código do desafio')).toHaveValue('ABCD2345');
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await waitFor(() => expect(services.joinChallenge).toHaveBeenCalledWith('u1', profile, 'ABCD2345'));
});

test('sair e, para o dono, encerrar e apagar', async () => {
  const services = makeServices();
  const { unmount } = render(<ChallengesTab uid="u1" profile={profile} services={services} />);
  fireEvent.click(await screen.findByRole('button', { name: /Sair do desafio/ }));
  await waitFor(() => expect(services.leaveChallenge).toHaveBeenCalledWith('u1', 'c1'));
  unmount();

  const own = makeServices([challenge({ ownerId: 'u1' })]);
  render(<ChallengesTab uid="u1" profile={profile} services={own} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Encerrar desafio' }));
  await waitFor(() => expect(own.endChallenge).toHaveBeenCalledWith('c1'));
  fireEvent.click(screen.getByRole('button', { name: /Apagar desafio/ }));
  await waitFor(() => expect(own.deleteChallenge).toHaveBeenCalledWith('c1', 'ABCD2345'));
  expect(screen.queryByRole('button', { name: /Sair do desafio/ })).not.toBeInTheDocument();
});
