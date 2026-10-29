import { isAppLaunch } from './appLaunch';

const setStandalone = (matches) => { window.matchMedia = jest.fn().mockReturnValue({ matches }); };

afterEach(() => { delete window.Capacitor; delete window.navigator.standalone; setStandalone(false); });

test('navegador comum abre a página de divulgação', () => {
  setStandalone(false);
  expect(isAppLaunch('')).toBe(false);
  expect(isAppLaunch('?utm_source=x')).toBe(false);
});

test('?source=pwa (start_url antigo) conta como app', () => {
  setStandalone(false);
  expect(isAppLaunch('?source=pwa')).toBe(true);
});

test('PWA instalado (display-mode standalone ou iOS) conta como app', () => {
  setStandalone(true);
  expect(isAppLaunch('')).toBe(true);
  setStandalone(false);
  window.navigator.standalone = true;
  expect(isAppLaunch('')).toBe(true);
});

test('app Android (Capacitor) conta como app', () => {
  setStandalone(false);
  window.Capacitor = { isNativePlatform: () => true };
  expect(isAppLaunch('')).toBe(true);
});
