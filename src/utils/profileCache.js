// Cópia mínima do perfil para a primeira pintura: o app mostra a tela com ela enquanto o perfil verdadeiro é lido do
// Firestore (que espera o App Check). Nada de saúde nem contato (peso, altura, idade, e-mail, telefone). Serve só para a
// interface; quem autoriza são as regras do Firestore, e o perfil lido de lá substitui esta cópia assim que chega.
export const PROFILE_CACHE_KEY = 'bt_profile_cache_v1';
const FIELDS = ['uid', 'role', 'displayName', 'photoURL', 'onboardedAt', 'termsAcceptedAt', 'termsVersion', 'goal', 'coachId', 'currentTrainingId', 'weeklyGoal'];
const ROLES = ['user', 'coach', 'admin'];

export const cacheableProfile = (data) => {
  if (!data || typeof data !== 'object') return null;
  const out = {};
  FIELDS.forEach((k) => { if (data[k] !== undefined && data[k] !== null && typeof data[k] !== 'object') out[k] = data[k]; });
  return ROLES.includes(out.role) ? out : null;
};

const store = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; } };

export const readCachedProfile = (uid, storage = store()) => {
  try {
    const parsed = JSON.parse(storage?.getItem(PROFILE_CACHE_KEY) || 'null');
    if (!parsed || parsed.uid !== uid) return null;
    return cacheableProfile(parsed);
  } catch (e) { return null; }
};

export const writeCachedProfile = (data, storage = store()) => {
  try {
    const slim = cacheableProfile(data);
    if (slim && slim.uid) storage?.setItem(PROFILE_CACHE_KEY, JSON.stringify(slim));
  } catch (e) { /* sem armazenamento */ }
};

export const clearCachedProfile = (storage = store()) => {
  try { storage?.removeItem(PROFILE_CACHE_KEY); } catch (e) { /* ignora */ }
};
