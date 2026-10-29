import { useEffect } from 'react';

// Trava a rolagem da página de trás enquanto um modal, wizard ou painel está aberto.
// `overflow: hidden` no body não basta no iOS Safari (o toque ainda rola a página). Por isso o body fica `position: fixed`
// no ponto atual (`top: -scrollY`) e, ao destravar, volta exatamente para onde estava.
// Contador: modais empilhados (ex.: confirmação por cima do Coach IA) só destravam quando o último fecha.

let locks = 0;
let saved = null;

const STYLE_KEYS = ['position', 'top', 'left', 'right', 'width', 'overflow'];

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  locks += 1;
  if (locks > 1) return;
  const { body } = document;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  saved = { scrollY, style: Object.fromEntries(STYLE_KEYS.map((k) => [k, body.style[k]])) };
  Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined' || locks === 0) return;
  locks -= 1;
  if (locks > 0 || !saved) return;
  const { scrollY, style } = saved;
  saved = null;
  Object.assign(document.body.style, style);
  // Sem rolagem guardada não há o que restaurar (evita o scrollTo, que o jsdom não implementa).
  if (scrollY > 0) {
    try { window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, scrollY); }
  }
}

/** Para testes: quantos modais estão segurando a trava. */
export const bodyScrollLockCount = () => locks;

/** Trava a rolagem do fundo enquanto `active` for verdadeiro (padrão: enquanto o componente estiver montado). */
export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [active]);
}
