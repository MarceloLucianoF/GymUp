import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, query, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { activeWorkoutService } from '../services/activeWorkoutService';
import { fetchStudentCheckIns, invalidateCheckIns } from '../services/checkInsCache';
import { saveCheckIn } from '../services/checkInService';
import { saveWeeklyGoal, reconcileWeeklyGoal } from '../services/goalService';
import { computeAchievements as computeGameAchievements } from '../utils/achievements';

// --- Metas semanais (localStorage por usuário) ---
export const GOAL_MIN = 2;
export const GOAL_MAX = 7;
export const GOAL_DEFAULT = 4;
const goalKey = (uid) => `academyup:weeklyGoal:${uid}`;

const clampGoal = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return GOAL_DEFAULT;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, v));
};

/**
 * Meta semanal do aluno. A fonte da verdade é `users.weeklyGoal` (o treinador usa para a aderência e o ranking de amigos
 * usa o perfil público); o localStorage é só cópia para abrir sem espera e para quem ainda não tinha a meta gravada.
 * Alterar grava no perfil e, se existir, no perfil social (com atraso para juntar os cliques de + e -).
 */
export function useWeeklyGoal(uid, profileGoal, profileReady = false) {
  const hasServerGoal = profileGoal !== undefined && profileGoal !== null && Number.isFinite(Number(profileGoal));
  const read = useCallback(() => {
    if (!uid) return GOAL_DEFAULT;
    try {
      const raw = localStorage.getItem(goalKey(uid));
      return raw === null ? GOAL_DEFAULT : clampGoal(raw);
    } catch {
      return GOAL_DEFAULT;
    }
  }, [uid]);
  const [goal, setGoalState] = useState(() => (hasServerGoal ? clampGoal(profileGoal) : read()));
  const timer = useRef(null);

  const persist = useCallback((v) => {
    if (!uid) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await saveWeeklyGoal(uid, v); } catch (e) { console.warn('Meta semanal não gravada:', e?.code || e); }
    }, 700);
  }, [uid]);

  // O valor gravado no perfil manda; sem ele, usa a cópia local e a grava uma vez (migração de quem só tinha o localStorage).
  useEffect(() => {
    if (hasServerGoal) {
      const v = clampGoal(profileGoal);
      setGoalState(v);
      try { localStorage.setItem(goalKey(uid), String(v)); } catch { /* storage indisponível */ }
      if (profileReady && uid) reconcileWeeklyGoal(uid, v).catch(() => {});   // perfil social divergente: alinha
      return;
    }
    const local = read();
    setGoalState(local);
    let hasLocal = false;
    try { hasLocal = localStorage.getItem(goalKey(uid)) !== null; } catch { hasLocal = false; }
    // Só migra depois que o perfil verdadeiro foi lido (senão o valor padrão sobrescreveria o que está gravado).
    if (profileReady && !hasServerGoal && hasLocal && uid) persist(local);
  }, [uid, profileGoal, hasServerGoal, profileReady, read, persist]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setGoal = useCallback((n) => {
    const v = clampGoal(n);
    setGoalState(v);
    try { localStorage.setItem(goalKey(uid), String(v)); } catch { /* storage indisponível */ }
    persist(v);
  }, [uid, persist]);
  return [goal, setGoal];
}

// --- Cálculos puros ---
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const computeStreaks = (history) => {
  const keys = new Set();
  history.forEach((h) => {
    const d = new Date(h.date);
    if (!Number.isNaN(d.getTime())) keys.add(dayKey(d));
  });
  const sorted = [...keys].sort().reverse(); // mais recente primeiro
  const dayDiff = (a, b) => Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);
  let best = 0;
  let run = 0;
  sorted.forEach((k, i) => {
    run = i > 0 && dayDiff(sorted[i - 1], k) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  });
  let streak = 0;
  if (sorted.length > 0) {
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    if (sorted[0] === today || sorted[0] === yesterday) {
      streak = 1;
      for (let i = 0; i < sorted.length - 1 && dayDiff(sorted[i], sorted[i + 1]) === 1; i++) streak++;
    }
  }
  return { streak, bestStreak: best };
};

export const computeStats = (history) => {
  const totalTreinos = history.length;
  let maxGlobalLoad = 0;
  history.forEach((t) => {
    (t.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        const w = Number(s.weight) || 0;
        if (w > maxGlobalLoad) maxGlobalLoad = w;
      });
    });
  });
  // Nível e conquistas: mesma conta da Evolução (utils/achievements, com as regras anti-abuso).
  const { count: levelTreinos, level: lv, achievements } = computeGameAchievements(history);
  return {
    totalTreinos, maxGlobalLoad, levelTreinos, level: lv.name, nextLevelTreinos: lv.nextAt ?? levelTreinos, progress: lv.progress,
    achievements, ...computeStreaks(history),
  };
};

/** Conquistas já calculadas em computeStats (mantido para quem lê `data.achievements`). */
export const computeAchievements = (stats) => stats?.achievements || [];

const EMPTY_ERRORS = { profile: null, history: null, trainings: null };

/**
 * Carrega os dados da Home do aluno. Cada bloco falha isoladamente.
 * Segurança: histórico sempre filtrado por userId == uid.
 */
export function useStudentHome(user, userProfile) {
  const uid = user?.uid;
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const syncPending = useCallback(async () => {
    const synced = await activeWorkoutService.syncPendingCheckIns(uid, db, setDoc, doc, (id, data) => saveCheckIn(db, uid, id, data));
    if (synced > 0) invalidateCheckIns(uid);
    if (synced > 0 && mounted.current) toast.success(`${synced} treino(s) pendente(s) sincronizado(s)!`, { id: 'offline-synced' });
    return synced;
  }, [uid]);

  const load = useCallback(async () => {
    if (!uid) return;
    const id = ++runId.current;
    const fresh = () => mounted.current && id === runId.current;

    try { await syncPending(); } catch (e) { console.error('Erro sync Home:', e); }
    if (!fresh()) return;
    setActiveSession(activeWorkoutService.getActiveSession(uid));

    const [pRes, hRes, tRes] = await Promise.allSettled([
      getDoc(doc(db, 'users', uid)),
      fetchStudentCheckIns(uid),
      getDocs(query(collection(db, 'trainings'), orderBy('name', 'asc'))),
    ]);
    if (!fresh()) return;

    const next = { ...EMPTY_ERRORS };
    if (pRes.status === 'fulfilled') {
      if (pRes.value.exists()) setProfile(pRes.value.data());
    } else { console.error('Erro Home (perfil):', pRes.reason); next.profile = pRes.reason; }
    if (hRes.status === 'fulfilled') {
      setHistory(hRes.value);
    } else { console.error('Erro Home (histórico):', hRes.reason); next.history = hRes.reason; }
    if (tRes.status === 'fulfilled') {
      setTrainings(tRes.value.docs.map((d) => ({ firestoreId: d.id, ...d.data() })));
    } else { console.error('Erro Home (treinos):', tRes.reason); next.trainings = tRes.reason; }
    setErrors(next);
  }, [uid, syncPending]);

  // Carga inicial (somente quando o usuário muda)
  useEffect(() => {
    if (!uid) return undefined;
    setLoading(true);
    load().finally(() => { if (mounted.current) setLoading(false); });
    return () => { runId.current += 1; };
  }, [uid, load]);

  // Listeners: dependem só do uid; refetch apenas se algo foi sincronizado
  useEffect(() => {
    if (!uid) return undefined;
    const onWorkoutUpdate = () => setActiveSession(activeWorkoutService.getActiveSession(uid));
    // A fila é sincronizada pelo gerenciador global (useOfflineSync); aqui só recarrega quando ele terminar.
    const onOnline = async () => { if (mounted.current) await load(); };
    window.addEventListener('offline-queue-synced', onOnline);
    window.addEventListener('active-workout-updated', onWorkoutUpdate);
    return () => {
      window.removeEventListener('offline-queue-synced', onOnline);
      window.removeEventListener('active-workout-updated', onWorkoutUpdate);
    };
  }, [uid, load, syncPending]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    invalidateCheckIns(uid);
    try { await load(); } finally { if (mounted.current) setRefreshing(false); }
  }, [load, uid]);

  const discardActiveSession = useCallback(() => {
    if (!uid) return;
    activeWorkoutService.clearActiveSession(uid);
    setActiveSession(null);
  }, [uid]);

  const stats = useMemo(() => computeStats(history), [history]);
  const achievements = useMemo(() => computeAchievements(stats), [stats]);
  const mergedProfile = useMemo(() => (profile || userProfile ? { ...(userProfile || {}), ...(profile || {}) } : null), [profile, userProfile]);
  const hasError = Object.values(errors).some(Boolean);

  const data = useMemo(() => ({
    profile: mergedProfile, history, trainings, activeSession, stats, achievements,
    refreshing, errors, discardActiveSession,
  }), [mergedProfile, history, trainings, activeSession, stats, achievements, refreshing, errors, discardActiveSession]);

  return { data, loading, error: hasError ? errors : null, refresh };
}
