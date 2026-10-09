import { useCallback, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';
import {
  TOTAL_STEPS, validateStep, buildPayload, buildSkipPayload, suggestPlan, calcBmi,
} from '../utils/onboarding';

// Mesma chave usada por useWeeklyGoal (src/hooks/useStudentHome.js).
const goalKey = (uid) => `academyup:weeklyGoal:${uid}`;

export function saveWeeklyGoalLocal(uid, value) {
  try { localStorage.setItem(goalKey(uid), String(value)); } catch { /* storage indisponível */ }
}

// O AuthContext não expõe refresh: recarregamos a rota para reler users/{uid}.
export function goToDashboard() {
  window.location.assign('/dashboard');
}

export default function useOnboarding() {
  const { user, userProfile } = useAuthContext();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState(() => ({
    displayName: userProfile?.displayName || user?.displayName || '',
    goal: '',
    age: '',
    weight: '',
    height: '',
    experience: '',
    weeklyGoal: 4,
    coachId: '',
  }));
  const [error, setError] = useState('');
  const [coachError, setCoachError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const setField = useCallback((key, value) => {
    setData((d) => ({ ...d, [key]: value }));
    setError('');
    if (key === 'coachId') setCoachError('');
  }, []);

  const bmi = useMemo(() => calcBmi(data.weight, data.height), [data.weight, data.height]);
  const plan = useMemo(() => suggestPlan(data), [data]);

  const persist = useCallback(async (payload, goal) => {
    await updateDoc(doc(db, 'users', user.uid), payload);
    if (goal !== undefined) saveWeeklyGoalLocal(user.uid, goal);
  }, [user]);

  const submit = useCallback(async ({ withCoach = true } = {}) => {
    if (saving || !user) return;
    for (let s = 0; s < TOTAL_STEPS; s += 1) {
      const msg = validateStep(s, withCoach ? data : { ...data, coachId: '' });
      if (msg) { setStep(s); setError(msg); return; }
    }
    const hasCoach = withCoach && data.coachId.trim() !== '';
    setSaving(true);
    setError('');
    setCoachError('');
    try {
      await persist(buildPayload(data, { withCoach }), data.weeklyGoal);
      setDone(true);
    } catch (e) {
      if (hasCoach) {
        setCoachError('Não foi possível vincular esse código de treinador. Confira o código ou siga sem treinador.');
      } else {
        setError('Não foi possível salvar agora. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  }, [data, persist, saving, user]);

  const skip = useCallback(async () => {
    if (saving || !user) return;
    setSaving(true);
    setError('');
    try {
      await persist(buildSkipPayload());
      goToDashboard();
    } catch (e) {
      setError('Não foi possível pular agora. Tente novamente.');
      setSaving(false);
    }
  }, [persist, saving, user]);

  const next = useCallback(() => {
    const msg = validateStep(step, data);
    if (msg) { setError(msg); return; }
    setError('');
    if (step >= TOTAL_STEPS - 1) { submit(); return; }
    setDirection(1);
    setStep((s) => s + 1);
  }, [data, step, submit]);

  const back = useCallback(() => {
    if (step === 0) return;
    setError('');
    setDirection(-1);
    setStep((s) => s - 1);
  }, [step]);

  return {
    step, direction, data, setField, error, coachError, saving, done,
    bmi, plan, next, back, skip, submit,
  };
}
