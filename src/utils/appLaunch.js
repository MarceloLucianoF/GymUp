// Aberto como app (PWA instalado, app Android ou atalho com ?source=pwa)? Nesse caso "/" vai direto ao app, não à página de divulgação.
export function isAppLaunch(search = typeof window !== 'undefined' ? window.location.search : '') {
  if (typeof window === 'undefined') return false;
  try { if (new URLSearchParams(search).get('source') === 'pwa') return true; } catch (_) { /* busca inválida */ }
  try { if (window.Capacitor?.isNativePlatform?.()) return true; } catch (_) { /* sem Capacitor */ }
  const standalone = window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false;
  return Boolean(standalone || window.navigator.standalone);
}
