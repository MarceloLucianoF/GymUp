// Montagem da semana inteira. Cada dia é uma ficha feita pelo gerador (IA com validação, ou plano local se ela falhar ou demorar).
// Dias do mesmo foco são feitos em "ondas": a segunda ocorrência sabe o que a primeira usou e evita repetir exercícios.
import { aiService } from './aiService';
import { InsufficientExercisesError } from '../utils/workoutComposer';
import { exercises as defaultExercises } from '../data/exercises';
import { buildCardioWorkout } from '../utils/cardioWorkout';
import { buildStretchWorkout } from '../utils/stretchWorkout';
import { chooseSplit, freeWeekdays, localPlanText, pickFreeDay, planAiMessages, planTextMatches, wantsRecoveryDay } from '../utils/weekPlan';

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('demorou')), ms);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

export async function generateWeekPlan({ days = 3, goal = 'Hipertrofia', experience = 'iniciante', durationMinutes = 45, equipment = [], customExercises = [], includeCardio = false, includeStretch = false, onProgress, ai = aiService, timeoutMs = 35000 } = {}) {
  const split = chooseSplit(days, experience);
  const used = {};                      // foco -> nomes já usados em dias anteriores do mesmo foco
  const results = new Array(split.length).fill(null);
  let done = 0;

  const buildDay = async (item, index) => {
    const base = { goal, muscleFocus: item.focus, durationMinutes, customExercises, equipment, excludeNames: [...(used[item.focus] || [])] };
    let workout = null; let error = null;
    try { workout = await withTimeout(ai.generateAIWorkout(base), timeoutMs); } catch (e) {
      if (e instanceof InsufficientExercisesError) error = e.message;
      else {
        try { workout = ai.generateLocalWorkout(base); } catch (e2) { error = e2 instanceof InsufficientExercisesError ? e2.message : 'Não consegui montar este dia.'; }
      }
    }
    done += 1;
    onProgress?.({ done, total: split.length + (includeCardio ? 1 : 0) + (includeStretch || wantsRecoveryDay(days) ? 1 : 0), label: item.label });
    results[index] = { ...item, kind: 'strength', workout, error };
  };

  const maxOcc = Math.max(...split.map((s) => s.occurrence));
  for (let occ = 1; occ <= maxOcc; occ += 1) {
    const idxs = split.map((s, i) => (s.occurrence === occ ? i : -1)).filter((i) => i >= 0);
    await Promise.all(idxs.map((i) => buildDay(split[i], i)));
    idxs.forEach((i) => {
      const r = results[i];
      if (r.workout) used[r.focus] = [...(used[r.focus] || []), ...r.workout.exercises.map((e) => e.name)];
    });
  }

  const days_ = [...results];
  const taken = [];
  const free = freeWeekdays(split);
  const addCardio = () => {
    const wd = pickFreeDay(free, taken);
    if (wd !== null) { taken.push(wd); days_.push({ focus: 'Cardio', weekday: wd, label: 'Cardio', occurrence: 1, kind: 'cardio', workout: buildCardioWorkout('', { goal, durationMinutes: 30 }), error: null }); onProgress?.({ done: days_.length, total: days_.length, label: 'Cardio' }); }
  };
  const addStretch = () => {
    const wd = pickFreeDay(free, taken);
    const w = buildStretchWorkout([...customExercises, ...defaultExercises]);
    if (wd !== null && w) { taken.push(wd); days_.push({ focus: 'Alongamento', weekday: wd, label: 'Alongamento e mobilidade', occurrence: 1, kind: 'stretch', workout: w, error: null }); }
  };
  // 7 dias: a divisão tem 6 de musculação e o dia que sobra é sempre alongamento e mobilidade (vem antes do cardio)
  const recovery = wantsRecoveryDay(days);
  if (recovery) addStretch();
  if (includeCardio) addCardio();
  if (includeStretch && !recovery) addStretch();
  days_.sort((a, b) => a.weekday - b.weekday);
  const plan = { goal, durationMinutes, days: days_, warnings: days_.filter((d) => d.error).map((d) => `${d.label}: ${d.error}`) };
  return plan;
}

/** Texto que explica a semana: o da IA se os números baterem, senão o local. Nunca lança. */
export async function resolvePlanText(plan, { ai = aiService } = {}) {
  const local = localPlanText(plan);
  try {
    const reply = await withTimeout(ai.summarizeFacts(planAiMessages(plan)), 25000);
    const clean = String(reply || '').replace(/\s+/g, ' ').trim();
    if (clean && planTextMatches(clean, plan)) return { text: clean, source: 'ai' };
  } catch (e) { /* fica o texto local */ }
  return { text: local, source: 'local' };
}
