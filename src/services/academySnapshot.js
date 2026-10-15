// Snapshot local da ficha atribuída: serve para LER e EXECUTAR o treino sem internet. Não é autoridade: nada aqui libera acesso;
// o servidor decide, e o snapshot some quando o aluno sai da academia ou a atribuição acaba. Guarda só o que a ficha tem (sem dado pessoal).
const PREFIX = 'academyup_ac_snapshot_';
const key = (uid, academyId) => `${PREFIX}${uid}_${academyId}`;
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function toSnapshot(training, now = () => new Date().toISOString()) {
  return {
    academyId: training.academyId, assignmentId: training.assignmentId, trainingVersionId: training.trainingVersionId, versionHash: training.versionHash,
    name: training.name, description: training.description || '', version: training.version, exercises: training.exercises, downloadedAt: now()
  };
}
export const saveSnapshot = (uid, snapshot) => safe(() => { localStorage.setItem(key(uid, snapshot.academyId), JSON.stringify(snapshot)); return true; }, false);
export function loadSnapshot(uid, academyId) {
  return safe(() => {
    const raw = localStorage.getItem(key(uid, academyId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.academyId === academyId && Array.isArray(s.exercises) && s.trainingVersionId ? s : null;
  }, null);
}
export const clearSnapshot = (uid, academyId) => safe(() => { localStorage.removeItem(key(uid, academyId)); }, undefined);
export const clearAllSnapshots = (uid) => safe(() => { Object.keys(localStorage).filter((k) => k.startsWith(`${PREFIX}${uid}_`)).forEach((k) => localStorage.removeItem(k)); }, undefined);
