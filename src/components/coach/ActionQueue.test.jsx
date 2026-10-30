import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import ActionQueue from './ActionQueue';
import { nudgeStudent } from '../../services/pushService';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../services/pushService', () => ({ nudgeAvailable: () => true, nudgeStudent: jest.fn() }));

const items = [
  { id: 'inactive-ana', type: 'inactive', student: { uid: 'ana', displayName: 'Ana' }, days: 9, detail: '9 dias sem treinar' },
  { id: 'inactive-bia', type: 'inactive', student: { uid: 'bia', displayName: 'Bia' }, days: null, detail: 'Ainda não treinou' },
  { id: 'nofile-caio', type: 'nofile', student: { uid: 'caio', displayName: 'Caio' }, detail: 'Sem ficha atribuída' }
];
const noop = () => {};
const renderQueue = () => render(<ActionQueue items={items} onMessage={noop} onView={noop} onMarkPaid={noop} onAssign={noop} />);

test('"Lembrar" só aparece para aluno parado com dias conhecidos', () => {
  renderQueue();
  expect(screen.getByRole('button', { name: 'Lembrar Ana de voltar a treinar' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Lembrar Bia/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Lembrar Caio/ })).toBeNull();
});

test.each([
  ['sent', 'success', 'Lembrete enviado'],
  ['no-subscription', 'error', 'O aluno não ativou as notificações'],
  ['rate-limited', 'error', 'Já foi lembrado nas últimas 24 h']
])('resposta %s vira o aviso certo', async (result, kind, text) => {
  nudgeStudent.mockResolvedValueOnce(result);
  renderQueue();
  fireEvent.click(screen.getByRole('button', { name: 'Lembrar Ana de voltar a treinar' }));
  await waitFor(() => expect(toast[kind]).toHaveBeenCalledWith(text));
  expect(nudgeStudent).toHaveBeenLastCalledWith('ana', 9);
});
