// Memória curta de leituras caras (cota do Firestore). Compartilha chamadas simultâneas e não guarda falhas.
const store = new Map(); // chave -> { at, promise }

export const clearTtlCache = (prefix = '') => {
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
};

export function cachedLoad(key, loader, { ttlMs = 3 * 60 * 1000, now = Date.now(), force = false } = {}) {
  const hit = store.get(key);
  if (!force && hit && now - hit.at < ttlMs) return hit.promise;
  const entry = { at: now, promise: Promise.resolve().then(loader) };
  store.set(key, entry);
  entry.promise.catch(() => { if (store.get(key) === entry) store.delete(key); });
  return entry.promise;
}
