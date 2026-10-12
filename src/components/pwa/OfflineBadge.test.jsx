import React from 'react';
import { render, screen } from '@testing-library/react';

const mockState = { online: true, total: 0, failed: 0, syncing: false, retry: jest.fn() };
jest.mock('../../hooks/AuthContext', () => ({ useAuthContext: () => ({ user: { uid: 'u1' } }) }));
jest.mock('../../hooks/useOfflineSync', () => ({ useOfflineSync: () => mockState }));

const OfflineBadge = require('./OfflineBadge').default;
const set = (over) => Object.assign(mockState, { online: true, total: 0, failed: 0, syncing: false }, over);

describe('OfflineBadge', () => {
  it('sem pendência e online: nada visível', () => {
    set({});
    render(<OfflineBadge />);
    expect(screen.queryByText(/aguardando|offline|Sem conexão|Sincronizando|não foi/i)).toBeNull();
  });
  it('offline com pendência', () => {
    set({ online: false, total: 2 });
    render(<OfflineBadge />);
    expect(screen.getByText(/Sem conexão — 2 treinos aguardando/)).toBeInTheDocument();
  });
  it('online sincronizando e aguardando', () => {
    set({ total: 1, syncing: true });
    const { rerender } = render(<OfflineBadge />);
    expect(screen.getByText(/Sincronizando 1 treino\.\.\./)).toBeInTheDocument();
    set({ total: 1, syncing: false });
    rerender(<OfflineBadge />);
    expect(screen.getByText(/1 treino aguardando sincronização/)).toBeInTheDocument();
  });
  it('falha definitiva oferece tentar de novo', () => {
    set({ total: 1, failed: 1 });
    render(<OfflineBadge />);
    expect(screen.getByText(/1 treino não foi enviado/)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Tentar de novo' }).click();
    expect(mockState.retry).toHaveBeenCalled();
  });
});
