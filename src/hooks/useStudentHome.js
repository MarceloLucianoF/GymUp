import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { activeWorkoutService } from '../services/activeWorkoutService';

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

export function useWeeklyGoal(uid) {
  const read = useCallback(() => {
    if (!uid) return GOAL_DEFAULT;
    try {
      const raw = localStorage.getItem(goalKey(uid));
      return raw === null ? GOAL_DEFAULT : clampGoal(raw);
    } catch {
      return GOAL_DEFAULT;
    }
  }, [uid]);
  const [goal, setGoalState] = useState(read);
  useEffect(() => { setGoalState(read()); }, [read]);
  const setGoal = useCallback((n) => {
    const v = clampGoal(n);
    setGoalState(v);
    try { localStorage.setItem(goalKey(uid), String(v)); } catch { /* storage indisponível */ }
  }, [uid]);
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
  let level = 'Iniciante';
  let nextLevelTreinos = 10;
  let base = 0;
  if (totalTreinos >= 100) { level = 'Lenda'; nextLevelTreinos = 1000; base = 100; }
  else if (totalTreinos >= 50) { level = 'Monstro'; nextLevelTreinos = 100; base = 50; }
  else if (totalTreinos >= 25) { level = 'Atleta'; nextLevelTreinos = 50; base = 25; }
  else if (totalTreinos >= 10) { level = 'Focado'; nextLevelTreinos = 25; base = 10; }
  const progress = Math.min(100, Math.max(0, ((totalTreinos - base) / (nextLevelTreinos - base)) * 100));
  return { totalTreinos, maxGlobalLoad, level, nextLevelTreinos, progress, ...computeStreaks(history) };
};

export const computeAchievements = (stats) => [
  { id: 'first', label: 'Primeiro treino', hint: '1 treino', unlocked: stats.totalTreinos >= 1 },
  { id: 'streak7', label: '7 dias seguidos', hint: 'Sequência de 7 dias', unlocked: stats.bestStreak >= 7 },
  { id: 't10', label: '10 treinos', hint: '10 treinos', unlocked: stats.totalTreinos >= 10 },
  { id: 't50', label: '50 treinos', hint: '50 treinos', unlocked: stats.totalTreinos >= 50 },
  { id: 't100', label: '100 treinos', hint: '100 treinos', unlocked: stats.totalTreinos >= 100 },
];

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
    const synced = await activeWorkoutService.syncPendingCheckIns(uid, db, addDoc, collection);
    if (synced > 0 && mounted.current) toast.success(`✓ ${synced} treino(s) pendente(s) sincronizado(s)!`);
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
      getDocs(query(collection(db, 'checkIns'), where('userId', '==', uid), orderBy('date', 'desc'))),
      getDocs(query(collection(db, 'trainings'), orderBy('name', 'asc'))),
    ]);
    if (!fresh()) return;

    const next = { ...EMPTY_ERRORS };
    if (pRes.status === 'fulfilled') {
      if (pRes.value.exists()) setProfile(pRes.value.data());
    } else { console.error('Erro Home (perfil):', pRes.reason); next.profile = pRes.reason; }
    if (hRes.status === 'fulfilled') {
      setHistory(hRes.value.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const onOnline = async () => {
      try {
        const synced = await syncPending();
        if (synced > 0 && mounted.current) await load();
      } catch (e) { console.error('Erro ao sincronizar online:', e); }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('active-workout-updated', onWorkoutUpdate);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('active-workout-updated', onWorkoutUpdate);
    };
  }, [uid, load, syncPending]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { if (mounted.current) setRefreshing(false); }
  }, [load]);

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
