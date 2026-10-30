// Preferências de acessibilidade do aparelho (Perfil › Aparência e acessibilidade). Ficam no navegador e viram classes no <html>:
// tamanho do texto (o Tailwind usa rem, então tudo escala junto), menos animação e mais contraste nos textos secundários.
const KEY = 'bt-a11y';
export const TEXT_SIZES = { normal: 'Padrão', large: 'Grande', xlarge: 'Muito grande' };
export const DEFAULT_A11Y = { textSize: 'normal', reduceMotion: false, highContrast: false };

export function loadA11y() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      textSize: TEXT_SIZES[saved.textSize] ? saved.textSize : 'normal',
      reduceMotion: saved.reduceMotion === true,
      highContrast: saved.highContrast === true
    };
  } catch (_) {
    return { ...DEFAULT_A11Y };
  }
}

export function applyA11y(prefs, root = document.documentElement) {
  root.classList.toggle('a11y-text-lg', prefs.textSize === 'large');
  root.classList.toggle('a11y-text-xl', prefs.textSize === 'xlarge');
  root.classList.toggle('a11y-reduce-motion', !!prefs.reduceMotion);
  root.classList.toggle('a11y-contrast', !!prefs.highContrast);
}

export function saveA11y(prefs) {
  applyA11y(prefs);
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) { /* navegação privada: vale só nesta visita */ }
}
