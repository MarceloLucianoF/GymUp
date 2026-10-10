const KEY = 'bt_chunk_reload_at';
const WINDOW_MS = 30000;

export const isChunkLoadError = (error) => {
  const text = `${error?.name || ''} ${error?.message || error || ''}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|dynamically imported module|Failed to fetch dynamically/i.test(text);
};

/** Recarrega a página uma única vez (janela de 30 s) para pegar a versão nova dos chunks. Retorna true se recarregou. */
export const reloadOnceForChunkError = (error, { storage, reload } = {}) => {
  if (!isChunkLoadError(error)) return false;
  try {
    const store = storage || window.sessionStorage;
    const last = Number(store.getItem(KEY) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    store.setItem(KEY, String(Date.now()));
  } catch {
    return false; // sem storage não dá para evitar loop: não recarrega
  }
  (reload || (() => window.location.reload()))();
  return true;
};
