import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from './useOnlineStatus';
import { useInstallPrompt, DISMISS_KEY } from './useInstallPrompt';
import { useNotifications, shouldShowReminder, DEFAULT_PREFS } from './useNotifications';

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});

describe('useOnlineStatus', () => {
  it('reage aos eventos offline/online', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });
});

describe('useInstallPrompt', () => {
  it('captura beforeinstallprompt, instala e dispensa por 14 dias', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.visible).toBe(false);
    const evt = new Event('beforeinstallprompt');
    evt.prompt = jest.fn();
    evt.userChoice = Promise.resolve({ outcome: 'dismissed' });
    act(() => { window.dispatchEvent(evt); });
    expect(result.current.canInstall).toBe(true);
    expect(result.current.visible).toBe(true);
    await act(async () => { await result.current.install(); });
    expect(evt.prompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });

  it('lembra a dispensa e esconde quando standalone', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const evt = new Event('beforeinstallprompt');
    act(() => { window.dispatchEvent(evt); });
    act(() => { result.current.dismiss(); });
    expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy();
    expect(result.current.visible).toBe(false);

    localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const { result: r2 } = renderHook(() => useInstallPrompt());
    expect(r2.current.installed).toBe(true);
    expect(r2.current.visible).toBe(false);
  });
});

describe('useNotifications', () => {
  afterEach(() => { delete global.Notification; });

  it('persiste preferências por usuário', () => {
    const { result } = renderHook(() => useNotifications('u1'));
    expect(result.current.prefs).toEqual(DEFAULT_PREFS);
    act(() => { result.current.updatePrefs({ reminder: true, reminderTime: '07:30' }); });
    const { result: r2 } = renderHook(() => useNotifications('u2'));
    expect(r2.current.prefs.reminder).toBe(false);
    const { result: r3 } = renderHook(() => useNotifications('u1'));
    expect(r3.current.prefs.reminderTime).toBe('07:30');
  });

  it('pede permissão e usa o SW para notificar', async () => {
    global.Notification = { permission: 'default', requestPermission: jest.fn().mockResolvedValue('granted') };
    const showNotification = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: jest.fn().mockResolvedValue({ showNotification }) } });
    const { result } = renderHook(() => useNotifications('u1'));
    let ok;
    await act(async () => { await result.current.requestPermission(); });
    expect(result.current.permission).toBe('granted');
    global.Notification.permission = 'granted';
    await act(async () => { ok = await result.current.notify('T', 'B', { tag: 'x' }); });
    expect(ok).toBe(true);
    expect(showNotification).toHaveBeenCalledWith('T', expect.objectContaining({ body: 'B', tag: 'x' }));
  });

  it('não notifica sem permissão e vibra conforme preferência', async () => {
    global.Notification = { permission: 'denied' };
    navigator.vibrate = jest.fn();
    const { result } = renderHook(() => useNotifications('u1'));
    let ok;
    await act(async () => { ok = await result.current.notify('T', 'B'); });
    expect(ok).toBe(false);
    act(() => { result.current.vibrate(); });
    expect(navigator.vibrate).toHaveBeenCalled();
    act(() => { result.current.updatePrefs({ vibrate: false }); });
    navigator.vibrate.mockClear();
    act(() => { result.current.vibrate(); });
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('shouldShowReminder respeita horário e treino do dia', () => {
    const prefs = { reminder: true, reminderTime: '18:00' };
    expect(shouldShowReminder(prefs, false, new Date(2026, 0, 1, 19, 0))).toBe(true);
    expect(shouldShowReminder(prefs, false, new Date(2026, 0, 1, 10, 0))).toBe(false);
    expect(shouldShowReminder(prefs, true, new Date(2026, 0, 1, 19, 0))).toBe(false);
  });
});
