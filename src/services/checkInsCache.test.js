import { fetchStudentCheckIns, invalidateCheckIns } from './checkInsCache';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), query: jest.fn(), where: jest.fn() }));

describe('checkInsCache', () => {
  beforeEach(() => invalidateCheckIns());

  it('reaproveita a leitura dentro do prazo e compartilha chamadas simultâneas', async () => {
    const load = jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const [x, y] = await Promise.all([fetchStudentCheckIns('u1', { load, now: 1000 }), fetchStudentCheckIns('u1', { load, now: 1500 })]);
    await fetchStudentCheckIns('u1', { load, now: 2000 });
    expect(load).toHaveBeenCalledTimes(1);
    expect(x).toEqual(y);
  });

  it('devolve cópia: alterar o resultado não contamina o cache', async () => {
    const load = jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const first = await fetchStudentCheckIns('u1', { load, now: 1 });
    first.reverse();
    const second = await fetchStudentCheckIns('u1', { load, now: 2 });
    expect(second.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('expira após 5 minutos e invalida sob demanda', async () => {
    const load = jest.fn().mockResolvedValue([]);
    await fetchStudentCheckIns('u1', { load, now: 0 });
    await fetchStudentCheckIns('u1', { load, now: 5 * 60 * 1000 + 1 });
    expect(load).toHaveBeenCalledTimes(2);
    invalidateCheckIns('u1');
    await fetchStudentCheckIns('u1', { load, now: 5 * 60 * 1000 + 2 });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('isola usuários e não guarda falhas', async () => {
    const bad = jest.fn().mockRejectedValue(new Error('x'));
    await expect(fetchStudentCheckIns('u1', { load: bad, now: 0 })).rejects.toThrow('x');
    const ok = jest.fn().mockResolvedValue([{ id: 'z' }]);
    await expect(fetchStudentCheckIns('u1', { load: ok, now: 1 })).resolves.toEqual([{ id: 'z' }]);
    await fetchStudentCheckIns('u2', { load: ok, now: 1 });
    expect(ok).toHaveBeenCalledTimes(2);
  });
});
