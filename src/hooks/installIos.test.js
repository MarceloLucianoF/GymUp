import { renderHook } from '@testing-library/react';
import { useInstallPrompt, isIos, isIosSafari, isInAppBrowser } from './useInstallPrompt';

const UA = {
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
};
const setUa = (ua) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });

beforeEach(() => { localStorage.clear(); window.matchMedia = jest.fn().mockReturnValue({ matches: false }); Object.defineProperty(window.navigator, 'standalone', { value: false, configurable: true }); });

describe('instalação no iPhone', () => {
  test('Safari do iPhone: mostra o passo a passo', () => {
    setUa(UA.safari);
    expect([isIos(), isIosSafari(), isInAppBrowser()]).toEqual([true, true, false]);
    const { result } = renderHook(() => useInstallPrompt());
    expect([result.current.showIosHelp, result.current.visible, result.current.iosSafari]).toEqual([true, true, true]);
  });
  test('Chrome do iPhone: também mostra a ajuda, avisando do Safari', () => {
    setUa(UA.chrome);
    const { result } = renderHook(() => useInstallPrompt());
    expect([result.current.showIosHelp, result.current.visible, result.current.iosSafari]).toEqual([true, true, false]);
  });
  test('navegador embutido (Instagram): orienta abrir no Safari', () => {
    setUa(UA.instagram);
    const { result } = renderHook(() => useInstallPrompt());
    expect([result.current.inApp, result.current.visible, result.current.iosSafari]).toEqual([true, true, false]);
  });
  test('já instalado (standalone do iOS): não mostra nada', () => {
    setUa(UA.safari);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.visible).toBe(false);
  });
  test('Android sem o evento de instalação: não mostra a ajuda do iPhone', () => {
    setUa(UA.android);
    const { result } = renderHook(() => useInstallPrompt());
    expect([result.current.showIosHelp, result.current.visible]).toEqual([false, false]);
  });
});
