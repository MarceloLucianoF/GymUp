// Comparação de uma sessão do histórico com a anterior da mesma ficha (volume e carga por exercício).
// Puro: recebe check-ins já lidos (do próprio aluno) e não toca no Firestore.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isWork = (set) => set?.type !== 'warmup';
const time = (item) => {
  const t = new Date(item?.date).getTime();
  return Number.isNaN(t) ? null : t;
};
const norm = (s) => String(s || '').trim().toLowerCase();

/** Volume de uma série: soma das partes (drop/cluster) quando houver; senão carga x repetições. */
export const setVolume = (set) => {
  if (Array.isArray(set?.parts) && set.parts.length > 0) {
    return set.parts.reduce((acc, p) => acc + num(p?.weight) * num(p?.reps), 0);
  }
  return num(set?.weight) * num(set?.reps);
};

/** Carga da série para recorde: a 1ª parte em drop/cluster; senão a carga registrada. */
const setLoad = (set) => num(set?.weight) || (Array.isArray(set?.parts) ? num(set.parts[0]?.weight) : 0);

/** Volume de trabalho do exercício (aquecimento fica fora, como no total da sessão). */
export const exerciseVolume = (ex) => (ex?.sets || []).filter(isWork).reduce((acc, s) => acc + setVolume(s), 0);

/** Maior carga de trabalho do exercício. */
export const exerciseTopLoad = (ex) => (ex?.sets || []).filter(isWork).reduce((m, s) => Math.max(m, setLoad(s)), 0);

const sessionVolume = (session) => {
  const stored = num(session?.totalVolume);
  if (stored > 0) return stored;
  return (session?.exercises || []).reduce((acc, ex) => acc + exerciseVolume(ex), 0);
};

/** Mesma ficha: pelo ID da ficha quando os dois têm; senão pelo nome do treino. */
export const sameTraining = (a, b) => {
  if (a?.trainingId && b?.trainingId) return a.trainingId === b.trainingId;
  return !!norm(a?.trainingName) && norm(a?.trainingName) === norm(b?.trainingName);
};

/** A sessão anterior (mais recente antes desta) da mesma ficha, ou null. */
export function findPreviousSession(history, current, currentId) {
  const cur = time(current);
  if (cur === null) return null;
  let best = null;
  let bestT = -Infinity;
  (history || []).forEach((h) => {
    const id = h.id || h.firestoreId;
    if (currentId && id === currentId) return;
    const t = time(h);
    if (t === null || t >= cur || !sameTraining(h, current)) return;
    if (t > bestT) { best = h; bestT = t; }
  });
  return best;
}

const pct = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

/**
 * Compara duas sessões. Devolve null sem sessão anterior.
 * exercises: um item por exercício desta sessão (status 'new' quando não existia na anterior) e,
 * no fim, os que saíram (status 'removed').
 */
export function compareSessions(current, previous) {
  if (!current || !previous) return null;
  const prevByName = new Map();
  (previous.exercises || []).forEach((ex) => { if (!prevByName.has(norm(ex.name))) prevByName.set(norm(ex.name), ex); });
  const seen = new Set();

  const exercises = (current.exercises || []).map((ex) => {
    const key = norm(ex.name);
    seen.add(key);
    const before = prevByName.get(key);
    const volume = exerciseVolume(ex);
    const load = exerciseTopLoad(ex);
    if (!before) return { name: ex.name, status: 'new', volume, load, prevVolume: null, prevLoad: null, volumeDelta: null, volumePct: null, loadDelta: null };
    const prevVolume = exerciseVolume(before);
    const prevLoad = exerciseTopLoad(before);
    return {
      name: ex.name,
      status: 'both',
      volume,
      load,
      prevVolume,
      prevLoad,
      volumeDelta: volume - prevVolume,
      volumePct: pct(volume, prevVolume),
      loadDelta: load - prevLoad,
    };
  });
  (previous.exercises || []).forEach((ex) => {
    const key = norm(ex.name);
    if (seen.has(key)) return;
    seen.add(key);
    exercises.push({ name: ex.name, status: 'removed', volume: null, load: null, prevVolume: exerciseVolume(ex), prevLoad: exerciseTopLoad(ex), volumeDelta: null, volumePct: null, loadDelta: null });
  });

  const volume = sessionVolume(current);
  const prevVolume = sessionVolume(previous);
  return {
    previous,
    volume,
    prevVolume,
    volumeDelta: volume - prevVolume,
    volumePct: pct(volume, prevVolume),
    exercises,
  };
}
