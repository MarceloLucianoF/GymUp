import { useEffect } from 'react';

export const SITE_URL = 'https://bohtreinar.bohtreinar-app.workers.dev';
export const SITE_NAME = 'BohTreinar';

const upsertMeta = (selector, create, value) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', value);
};

const metaByName = (name) => () => {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  return el;
};

/**
 * Define title e description da rota atual (e restaura o título anterior ao sair).
 * Em rotas privadas use noindex para não expor telas autenticadas a buscadores.
 */
export default function usePageMeta(title, description, { noindex = false } = {}) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} · ${SITE_NAME}` : previousTitle;
    if (description) upsertMeta('meta[name="description"]', metaByName('description'), description);
    if (noindex) upsertMeta('meta[name="robots"]', metaByName('robots'), 'noindex, nofollow');
    return () => {
      document.title = previousTitle;
      if (noindex) document.head.querySelector('meta[name="robots"]')?.remove();
    };
  }, [title, description, noindex]);
}
