import { renderHook, act } from '@testing-library/react';
import { useWeeklyGoal } from './useStudentHome';

const mockUpdate = jest.fn();
jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('../services/activeWorkoutService', () => ({ activeWorkoutService: {} }));
jest.mock('../services/checkInsCache', () => ({ fetchStudentCheckIns: jest.fn(), invalidateCheckIns: jest.fn() }));
jest.mock('../services/checkInService', () => ({ saveCheckIn: jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(),
  doc: (db, col, id) => ({ col, id }),
  updateDoc: (...args) => mockUpdate(...args)
}));

const flush = async () => { await act(async () => { jest.advanceTimersByTime(800); await Promise.resolve(); }); };

describe('meta semanal sincronizada', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); mockUpdate.mockReset(); mockUpdate.mockResolvedValue(); });
  afterEach(() => jest.useRealTimers());

  it('usa a meta gravada no perfil e a guarda como cópia local', () => {
    const { result } = renderHook(() => useWeeklyGoal('u1', 5, true));
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem('academyup:weeklyGoal:u1')).toBe('5');
    expect(mockUpdate).not.toHaveBeenCalled();                      // nada a migrar
  });

  it('alterar grava no perfil e no perfil social uma só vez (cliques juntados)', async () => {
    const { result } = renderHook(() => useWeeklyGoal('u1', 4, true));
    act(() => { result.current[1](5); result.current[1](6); });
    expect(result.current[0]).toBe(6);
    await flush();
    const calls = mockUpdate.mock.calls.map(([ref, data]) => [ref.col, data.weeklyGoal]);
    expect(calls).toEqual([['users', 6], ['publicProfiles', 6]]);
  });

  it('fora de 2 a 7 é ajustado; falha no perfil social (sem perfil) não quebra', async () => {
    mockUpdate.mockImplementation((ref) => (ref.col === 'publicProfiles' ? Promise.reject({ code: 'not-found' }) : Promise.resolve()));
    const { result } = renderHook(() => useWeeklyGoal('u1', 4, true));
    act(() => { result.current[1](99); });
    expect(result.current[0]).toBe(7);
    await flush();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('só migra a cópia local depois que o perfil foi lido, e só se o perfil não tem meta', async () => {
    localStorage.setItem('academyup:weeklyGoal:u1', '3');
    const { rerender } = renderHook(({ ready }) => useWeeklyGoal('u1', undefined, ready), { initialProps: { ready: false } });
    await flush();
    expect(mockUpdate).not.toHaveBeenCalled();                      // perfil ainda carregando: não sobrescreve
    rerender({ ready: true });
    await flush();
    expect(mockUpdate.mock.calls[0][1].weeklyGoal).toBe(3);         // migrou o 3 local
  });

  it('o valor do perfil vence a cópia local diferente', () => {
    localStorage.setItem('academyup:weeklyGoal:u1', '2');
    const { result } = renderHook(() => useWeeklyGoal('u1', 6, true));
    expect(result.current[0]).toBe(6);
  });
});
