import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { generateWeekPlan, resolvePlanText } from '../../services/weekPlanService';
import { saveMyWorkout } from '../../services/myWorkouts';
import { DAY_LABELS, MAX_DAYS, MAX_STRENGTH_DAYS, MIN_DAYS, saveDescription, saveName, wantsRecoveryDay } from '../../utils/weekPlan';
import { describeEquipment } from '../../utils/equipment';
import { prescriptionLabel } from '../../utils/exerciseKind';

const fieldLabel = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400';
const chip = (on) => `pressable min-h-[44px] min-w-[44px] rounded-2xl px-4 text-sm font-black transition ${on ? 'bg-gradient-to-r from-brand to-[#FF9800] text-black' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100'}`;
const dayKey = (d) => `${d.weekday}-${d.label}`;

// Semana inteira pela IA: escolhe os dias, monta uma ficha por dia (sem repetir exercício entre dias do mesmo foco) e salva em "Meus treinos".
export default function WeekPlanTab({ user, userProfile, customExercises = [], onSaved }) {
  const goalDays = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number(userProfile?.weeklyGoal) || 3));
  const [days, setDaysState] = useState(goalDays);
  // Segue a meta do perfil (que pode chegar depois de abrir a aba) até a pessoa escolher outro número aqui
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setDaysState(goalDays); }, [goalDays]);
  const setDays = (n) => { touched.current = true; setDaysState(n); };
  const [minutes, setMinutes] = useState(45);
  const [cardio, setCardio] = useState(false);
  const [stretch, setStretch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [plan, setPlan] = useState(null);
  const [text, setText] = useState(null);
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState(false);

  const goal = userProfile?.goal || 'Hipertrofia';

  const build = async () => {
    setBusy(true); setPlan(null); setText(null); setSaved({}); setProgress({ done: 0, total: days, label: '' });
    try {
      const result = await generateWeekPlan({ days, goal, experience: userProfile?.experience, durationMinutes: minutes, equipment: userProfile?.gymEquipment, customExercises, includeCardio: cardio, includeStretch: stretch, onProgress: setProgress });
      if (!result.days.some((d) => d.workout)) { toast.error(result.warnings[0] || 'Não consegui montar a semana com os seus equipamentos.'); setBusy(false); return; }
      setPlan(result);
      setBusy(false);
      const t = await resolvePlanText(result);   // texto local na hora; a IA pode trocar em segundo plano
      setText(t);
    } catch (error) {
      console.error(error);
      toast.error('Não consegui montar a semana agora. Tente de novo.');
      setBusy(false);
    }
  };

  const persist = async (list) => {
    setSaving(true);
    let ok = 0;
    for (const d of list) {
      try {
        await saveMyWorkout(user.uid, { name: saveName(d), exercises: d.workout.exercises, source: 'ai', category: goal, description: saveDescription(d) });
        setSaved((s) => ({ ...s, [dayKey(d)]: true }));
        ok += 1;
      } catch (error) { console.error(error); }
    }
    setSaving(false);
    if (ok) { toast.success(ok === 1 ? 'Dia salvo em "Meus treinos".' : `${ok} dias salvos em "Meus treinos".`); onSaved?.(); }
    if (ok < list.length) toast.error('Alguns dias não foram salvos. Tente de novo.');
  };

  const pending = plan ? plan.days.filter((d) => d.workout && !saved[dayKey(d)]) : [];

  return (
    <div className="space-y-4">
      <div className="card-premium-glass p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
        <h4 className="text-xs font-black uppercase text-amber-800 dark:text-brand tracking-wider flex items-center gap-1.5"><CalendarDays className="w-4 h-4" aria-hidden="true" /> Montar a minha semana</h4>
        <div>
          <p className={fieldLabel} id="week-days">Quantos dias por semana?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="week-days">
            {Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i).map((n) => (
              <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={chip(days === n)}>{n}</button>
            ))}
          </div>
          {wantsRecoveryDay(days) && <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{MAX_STRENGTH_DAYS} treinos e 1 dia de alongamento e mobilidade para o corpo recuperar.</p>}
        </div>
        <div>
          <label htmlFor="week-min" className={fieldLabel}>Duração de cada treino</label>
          <select id="week-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full min-h-[48px] rounded-2xl bg-gray-100 px-4 text-base font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-brand/30 dark:bg-white/5 dark:text-white [&>option]:text-gray-900">
            {[30, 45, 60, 75].map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-bold text-gray-800 dark:text-gray-100"><input type="checkbox" checked={cardio} onChange={(e) => setCardio(e.target.checked)} className="h-5 w-5 accent-[#FFC107]" />Incluir um dia de cardio</label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-bold text-gray-800 dark:text-gray-100"><input type="checkbox" checked={stretch} onChange={(e) => setStretch(e.target.checked)} className="h-5 w-5 accent-[#FFC107]" />Incluir um dia de alongamento</label>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300">Objetivo: <b>{goal}</b>. Equipamentos: <b>{describeEquipment(userProfile?.gymEquipment)}</b>{customExercises.length ? `. Seus ${customExercises.length} exercícios criados entram na escolha` : ''}. <a href="/profile" className="font-bold text-brand underline">Ajustar no perfil</a></p>
        <button type="button" onClick={build} disabled={busy} className="btn-primary-gradient w-full min-h-[52px] rounded-2xl font-black disabled:opacity-60 flex items-center justify-center gap-2">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> {progress?.done ? `Montando... ${progress.done} de ${progress.total}` : 'Montando a semana...'}</> : <><Sparkles className="w-5 h-5" aria-hidden="true" /> {plan ? 'Montar de novo' : 'Montar a semana'}</>}
        </button>
      </div>

      {plan && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-2xl bg-brand/10 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-brand">Sua semana{text?.source === 'ai' ? ' (IA)' : ''}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-800 dark:text-gray-100">{text?.text || 'Escrevendo o resumo da semana...'}</p>
          </div>
          {plan.warnings.length > 0 && <ul className="rounded-2xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" role="status">{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <ul className="space-y-3">
            {plan.days.map((d) => (
              <li key={dayKey(d)} className="rounded-2xl bg-gray-100 p-4 dark:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-gray-600 dark:text-gray-300">{DAY_LABELS[d.weekday]}</p>
                    <h5 className="text-base font-black text-gray-900 dark:text-white">{d.label}</h5>
                    {d.workout && <p className="text-xs text-gray-600 dark:text-gray-300">{d.workout.exercises.length} exercícios · {d.workout.estimatedTime}</p>}
                  </div>
                  {d.workout && (saved[dayKey(d)]
                    ? <span className="inline-flex min-h-[40px] items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Salvo</span>
                    : <button type="button" disabled={saving} onClick={() => persist([d])} aria-label={`Salvar ${DAY_LABELS[d.weekday]}: ${d.label}`} className="min-h-[40px] rounded-xl bg-white px-3 text-xs font-black text-gray-900 disabled:opacity-60 dark:bg-white/10 dark:text-white">Salvar</button>)}
                </div>
                {d.workout ? (
                  <ol className="mt-2 space-y-1 text-sm text-gray-800 dark:text-gray-100">
                    {d.workout.exercises.map((e, i) => <li key={`${e.name}-${i}`} className="flex justify-between gap-2"><span className="min-w-0 truncate">{e.name}</span><span className="shrink-0 text-xs font-bold text-gray-600 dark:text-gray-300">{prescriptionLabel(e)}</span></li>)}
                  </ol>
                ) : <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">{d.error}</p>}
              </li>
            ))}
          </ul>
          {pending.length > 0 && (
            <button type="button" onClick={() => persist(pending)} disabled={saving} className="btn-primary-gradient w-full min-h-[52px] rounded-2xl font-black disabled:opacity-60">{saving ? 'Salvando...' : pending.length === plan.days.filter((d) => d.workout).length ? 'Salvar a semana em Meus treinos' : `Salvar os ${pending.length} restantes`}</button>
          )}
          {pending.length === 0 && <p className="text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">Tudo salvo. Abra "Meus treinos" para começar.</p>}
          <button type="button" onClick={build} disabled={busy} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200"><RefreshCw className="w-4 h-4" aria-hidden="true" />Montar de novo</button>
        </div>
      )}
    </div>
  );
}
