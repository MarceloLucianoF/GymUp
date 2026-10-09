import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Dumbbell, Sparkles, Flame, PartyPopper } from 'lucide-react';
import useOnboarding, { goToDashboard } from '../../hooks/useOnboarding';
import {
  ProgressBar, ErrorAlert, OptionGroup, NumberField, FooterBar,
} from '../../components/onboarding/parts';
import {
  TOTAL_STEPS, LIMITS, bmiCategory,
} from '../../utils/onboarding';

const GOAL_OPTIONS = [
  { value: 'Hipertrofia', label: 'Hipertrofia', hint: 'Ganhar massa muscular', emoji: '💪' },
  { value: 'Emagrecimento', label: 'Emagrecimento', hint: 'Perder gordura', emoji: '🔥' },
  { value: 'Força', label: 'Força', hint: 'Levantar mais pesado', emoji: '🏋️' },
  { value: 'Resistência', label: 'Resistência', hint: 'Mais fôlego e disposição', emoji: '🏃' },
];
const LEVEL_OPTIONS = [
  { value: 'iniciante', label: 'Iniciante', hint: 'Menos de 6 meses de treino' },
  { value: 'intermediario', label: 'Intermediário', hint: 'De 6 meses a 2 anos' },
  { value: 'avancado', label: 'Avançado', hint: 'Mais de 2 anos' },
];
const TITLES = [
  'Bem-vindo ao AcademyUp',
  'Qual é o seu objetivo?',
  'Conte sobre o seu corpo',
  'Experiência e frequência',
  'Seu plano sugerido',
];

function Step({ step, data, setField, bmi, plan, coachError, onContinueWithoutCoach }) {
  switch (step) {
    case 0:
      return (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Em poucos passos montamos um plano sob medida. Como podemos te chamar?
          </p>
          <label htmlFor="ob-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Seu nome</label>
          <input
            id="ob-name"
            type="text"
            autoComplete="given-name"
            enterKeyHint="next"
            value={data.displayName}
            onChange={(e) => setField('displayName', e.target.value.slice(0, 60))}
            className="w-full rounded-2xl border-2 border-gray-200 dark:border-white/10 focus:border-brand bg-white dark:bg-white/5 px-4 py-3 text-xl font-semibold text-gray-900 dark:text-white outline-none"
          />
        </div>
      );
    case 1:
      return <OptionGroup name="goal" legend="Objetivo" value={data.goal} options={GOAL_OPTIONS} onChange={(v) => setField('goal', v)} columns="grid-cols-1 sm:grid-cols-2" />;
    case 2:
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="ob-age" label="Idade" unit="anos" value={data.age} onChange={(v) => setField('age', v)} placeholder="25" />
            <NumberField id="ob-weight" label="Peso" unit="kg" inputMode="decimal" value={data.weight} onChange={(v) => setField('weight', v)} placeholder="70" />
            <NumberField id="ob-height" label="Altura" unit="cm" value={data.height} onChange={(v) => setField('height', v)} placeholder="175" />
          </div>
          <div className="rounded-2xl bg-brand/10 p-4" aria-live="polite">
            <p className="text-sm text-gray-600 dark:text-gray-300">IMC estimado</p>
            <p className="text-3xl font-display font-bold text-gray-900 dark:text-white">
              {bmi === null ? '—' : bmi.toFixed(1)}
              {bmi !== null && <span className="ml-2 text-base font-medium text-gray-600 dark:text-gray-300">{bmiCategory(bmi)}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-1">Apenas uma referência, não é diagnóstico.</p>
          </div>
        </div>
      );
    case 3:
      return (
        <div className="space-y-6">
          <OptionGroup name="experience" legend="Experiência" value={data.experience} options={LEVEL_OPTIONS} onChange={(v) => setField('experience', v)} />
          <div>
            <label htmlFor="ob-days" className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              <span>Treinos por semana</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{data.weeklyGoal}</span>
            </label>
            <input
              id="ob-days"
              type="range"
              min={LIMITS.weeklyGoal[0]}
              max={LIMITS.weeklyGoal[1]}
              step={1}
              value={data.weeklyGoal}
              onChange={(e) => setField('weeklyGoal', Number(e.target.value))}
              className="w-full accent-brand h-8"
            />
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Atalhos de frequência">
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={data.weeklyGoal === n}
                  onClick={() => setField('weeklyGoal', n)}
                  className={`min-h-[44px] min-w-[44px] rounded-full font-semibold border-2 ${data.weeklyGoal === n ? 'bg-brand border-brand text-black' : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200'}`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="space-y-4">
          <div className="rounded-3xl bg-brand/10 p-5 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Flame aria-hidden="true" className="w-5 h-5 text-brand" /> {plan.days} dias por semana</p>
            <p className="text-sm text-gray-700 dark:text-gray-200"><strong>Divisão:</strong> {plan.split}</p>
            <p className="text-sm text-gray-700 dark:text-gray-200"><strong>Foco ({data.goal}):</strong> {plan.focus}</p>
            {plan.adjusted && <p className="text-xs text-gray-500">Ajustamos a frequência ao seu nível para uma progressão segura.</p>}
            <p className="italic text-gray-800 dark:text-gray-100">“{plan.quote}”</p>
          </div>
          <div>
            <label htmlFor="ob-coach" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Código do treinador (opcional)</label>
            <input
              id="ob-coach"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={data.coachId}
              onChange={(e) => setField('coachId', e.target.value.slice(0, 128))}
              className="w-full rounded-2xl border-2 border-gray-200 dark:border-white/10 focus:border-brand bg-white dark:bg-white/5 px-4 py-3 outline-none text-gray-900 dark:text-white"
            />
          </div>
          {coachError && (
            <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-4 py-3 space-y-2">
              <p>{coachError}</p>
              <button type="button" onClick={onContinueWithoutCoach} className="underline font-semibold min-h-[44px]">Continuar sem treinador</button>
            </div>
          )}
        </div>
      );
  }
}

export default function Onboarding() {
  const ob = useOnboarding();
  const { step, direction, data, error, saving, done } = ob;
  const headingRef = useRef(null);

  useEffect(() => { if (headingRef.current) headingRef.current.focus(); }, [step, done]);
  useEffect(() => {
    if (!done) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true }); } catch { /* canvas indisponível */ }
  }, [done]);

  if (done) {
    return (
      <main className="min-h-screen bg-white dark:bg-brand-darkBg flex items-center justify-center px-6">
        <div className="max-w-md text-center animate-fade-up">
          <PartyPopper aria-hidden="true" className="w-14 h-14 text-brand mx-auto mb-4" />
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold text-gray-900 dark:text-white outline-none">Tudo pronto{data.displayName ? `, ${data.displayName.trim().split(' ')[0]}` : ''}!</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-300">{ob.plan.quote}</p>
          <button type="button" onClick={goToDashboard} className="mt-8 min-h-[52px] w-full rounded-2xl bg-brand text-black font-bold">
            Ver meu primeiro treino
          </button>
        </div>
      </main>
    );
  }

  const onSubmit = (e) => { e.preventDefault(); ob.next(); };
  const last = step === TOTAL_STEPS - 1;
  const anim = direction >= 0 ? 'animate-fade-up' : 'animate-fade-in';

  return (
    <main className="min-h-screen bg-white dark:bg-brand-darkBg" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Dumbbell aria-hidden="true" className="w-4 h-4 text-brand" /> Passo {step + 1} de {TOTAL_STEPS}</span>
          <button type="button" onClick={ob.skip} disabled={saving} className="min-h-[44px] px-2 underline disabled:opacity-50">Pular por agora</button>
        </div>
        <ProgressBar step={step} />
        <form onSubmit={onSubmit} noValidate key={step} className={`mt-8 ${anim}`}>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-6 outline-none flex items-center gap-2">
            {step === 0 && <Sparkles aria-hidden="true" className="w-7 h-7 text-brand" />}
            {TITLES[step]}
          </h1>
          <Step step={step} data={data} setField={ob.setField} bmi={ob.bmi} plan={ob.plan} coachError={ob.coachError} onContinueWithoutCoach={() => ob.submit({ withCoach: false })} />
          <ErrorAlert message={error} />
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Enter</button>
        </form>
      </div>
      <FooterBar step={step} saving={saving} onBack={ob.back} onNext={ob.next} nextLabel={last ? 'Concluir' : 'Avançar'} />
    </main>
  );
}

