import { renderHook, act } from '@testing-library/react';
import { useWeeklyGoal } from './useStudentHome';

const mockUpdate = jest.fn();
const mockCommit = jest.fn();
const mockGetDoc = jest.fn();
const mockBatchUpdate = jest.fn();
jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('../services/activeWorkoutService', () => ({ activeWorkoutService: {} }));
jest.mock('../services/checkInsCache', () => ({ fetchStudentCheckIns: jest.fn(), invalidateCheckIns: jest.fn() }));
jest.mock('../services/checkInService', () => ({ saveCheckIn: jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), setDoc: jest.fn(),
  doc: (db, col, id) => ({ col, id }),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdate(...args),
  writeBatch: () => ({ update: (...a) => mockBatchUpdate(...a), commit: () => mockCommit() })
}));

const flush = async () => { await act(async () => { jest.advanceTimersByTime(800); await Promise.resolve(); }); };

describe('meta semanal sincronizada', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); [mockUpdate, mockCommit, mockGetDoc, mockBatchUpdate].forEach((m) => m.mockReset()); mockUpdate.mockResolvedValue(); mockCommit.mockResolvedValue(); mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ weeklyGoal: 4 }) }); });
  afterEach(() => jest.useRealTimers());

  it('usa a meta gravada no perfil e a guarda como cópia local', async () => {
    const { result } = renderHook(() => useWeeklyGoal('u1', 5, true));
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem('academyup:weeklyGoal:u1')).toBe('5');
    await flush();
    expect(mockCommit).not.toHaveBeenCalled();                      // nada a migrar
  });

  it('alterar grava perfil e perfil social no MESMO lote, uma vez (cliques juntados)', async () => {
    const { result } = renderHook(() => useWeeklyGoal('u1', 4, true));
    act(() => { result.current[1](5); result.current[1](6); });
    expect(result.current[0]).toBe(6);
    await flush();
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate.mock.calls.map(([ref, data]) => [ref.col, data.weeklyGoal])).toEqual([['users', 6], ['publicProfiles', 6]]);
  });

  it('sem perfil social, o lote leva só o perfil; fora de 2 a 7 é ajustado', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const { result } = renderHook(() => useWeeklyGoal('u1', 4, true));
    act(() => { result.current[1](99); });
    expect(result.current[0]).toBe(7);
    await flush();
    expect(mockBatchUpdate.mock.calls.map(([ref]) => ref.col)).toEqual(['users']);
  });

  it('perfil social divergente é reconciliado quando o perfil é lido (sem tocar no perfil do aluno)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ weeklyGoal: 2 }) });
    renderHook(() => useWeeklyGoal('u1', 5, true));
    await flush();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].col).toBe('publicProfiles');
    expect(mockUpdate.mock.calls[0][1].weeklyGoal).toBe(5);
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('só migra a cópia local depois que o perfil foi lido, e só se o perfil não tem meta', async () => {
    localStorage.setItem('academyup:weeklyGoal:u1', '3');
    const { rerender } = renderHook(({ ready }) => useWeeklyGoal('u1', undefined, ready), { initialProps: { ready: false } });
    await flush();
    expect(mockCommit).not.toHaveBeenCalled();                      // perfil ainda carregando: não sobrescreve
    rerender({ ready: true });
    await flush();
    expect(mockBatchUpdate.mock.calls[0][1].weeklyGoal).toBe(3);    // migrou o 3 local
  });

  it('o valor do perfil vence a cópia local diferente', () => {
    localStorage.setItem('academyup:weeklyGoal:u1', '2');
    const { result } = renderHook(() => useWeeklyGoal('u1', 6, true));
    expect(result.current[0]).toBe(6);
  });
});
