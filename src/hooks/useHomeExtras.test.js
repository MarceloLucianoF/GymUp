import { renderHook, act } from '@testing-library/react';
import { useFriendsPreview, markChatSeen, chatSeenKey, chatIdOf } from './useHomeExtras';

const mockSocial = { getSocialProfile: jest.fn(), listFriendships: jest.fn(), loadRanking: jest.fn() };
jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), getDocs: jest.fn(), limit: jest.fn(), orderBy: jest.fn(), query: jest.fn() }));
jest.mock('../services/socialService', () => ({
  getSocialProfile: (...a) => mockSocial.getSocialProfile(...a),
  listFriendships: (...a) => mockSocial.listFriendships(...a),
  loadRanking: (...a) => mockSocial.loadRanking(...a)
}));

const settle = async () => { await act(async () => { jest.advanceTimersByTime(1000); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

describe('cartão de amigos respeita a escolha de participar', () => {
  beforeEach(() => { jest.useFakeTimers(); Object.values(mockSocial).forEach((m) => m.mockReset()); });
  afterEach(() => jest.useRealTimers());

  it('quem saiu do ranking não tem amigos nem placar lidos (status notSharing)', async () => {
    mockSocial.getSocialProfile.mockResolvedValue({ shareRanking: false });
    const { result } = renderHook(() => useFriendsPreview('u1'));
    await settle();
    expect(result.current.status).toBe('notSharing');
    expect(mockSocial.listFriendships).not.toHaveBeenCalled();
    expect(mockSocial.loadRanking).not.toHaveBeenCalled();
  });

  it('sem perfil social: noProfile; sem amigos ativos: noFriends (sem ler placar)', async () => {
    mockSocial.getSocialProfile.mockResolvedValue(null);
    const a = renderHook(() => useFriendsPreview('u1'));
    await settle();
    expect(a.result.current.status).toBe('noProfile');
    mockSocial.getSocialProfile.mockResolvedValue({ shareRanking: true });
    mockSocial.listFriendships.mockResolvedValue([{ status: 'pending' }, { status: 'blocked' }]);
    const b = renderHook(() => useFriendsPreview('u2'));
    await settle();
    expect(b.result.current.status).toBe('noFriends');
    expect(mockSocial.loadRanking).not.toHaveBeenCalled();
  });

  it('participando com amigos ativos: posição e total; só eu no ranking vira noFriends; falha vira error', async () => {
    mockSocial.getSocialProfile.mockResolvedValue({ shareRanking: true });
    mockSocial.listFriendships.mockResolvedValue([{ status: 'active' }]);
    mockSocial.loadRanking.mockResolvedValue({ rows: [{ uid: 'a', position: 1 }, { uid: 'u1', me: true, position: 2 }] });
    const a = renderHook(() => useFriendsPreview('u1'));
    await settle();
    expect(a.result.current).toMatchObject({ status: 'ready', position: 2, total: 2 });
    mockSocial.loadRanking.mockResolvedValue({ rows: [{ uid: 'u3', me: true, position: 1 }] });
    const b = renderHook(() => useFriendsPreview('u3'));
    await settle();
    expect(b.result.current.status).toBe('noFriends');
    mockSocial.loadRanking.mockRejectedValue(new Error('x'));
    const c = renderHook(() => useFriendsPreview('u4'));
    await settle();
    expect(c.result.current.status).toBe('error');
  });
});

describe('auxiliares do chat', () => {
  it('ID do chat é o mesmo nos dois sentidos e a marca de visto fica por usuário', () => {
    expect(chatIdOf('b', 'a')).toBe('a_b');
    expect(chatIdOf('a', 'b')).toBe('a_b');
    localStorage.clear();
    markChatSeen('u1', 123);
    expect(localStorage.getItem(chatSeenKey('u1'))).toBe('123');
    expect(localStorage.getItem(chatSeenKey('u2'))).toBeNull();
  });
});
