import React, { useId, useState } from 'react';
import { Check, ChevronDown, Layers, Repeat, Timer } from 'lucide-react';
import ExerciseExecution from './ExerciseExecution';
import CheckInForm from '../training/CheckInForm';

const Stat = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
    <Icon className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
    {children}
  </span>
);

function ExerciseCard({ exercise, isCompleted, onCheckIn, exerciseNumber }) {
  const [showExecutionDetails, setShowExecutionDetails] = useState(false);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const detailsId = useId();

  const handleCheckInSubmit = (data) => {
    onCheckIn(exercise.id, data);
    setShowCheckInForm(false);
  };

  return (
    <article className={`surface p-4 sm:p-5 animate-fade-up ${isCompleted ? 'ring-1 ring-emerald-500/40' : ''}`}>
      <header className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-base font-black ${
            isCompleted ? 'bg-emerald-500/15 text-emerald-500' : 'bg-brand/15 text-brand'
          }`}
        >
          {isCompleted ? <Check className="h-5 w-5" aria-label="Concluído" /> : exerciseNumber}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-black leading-tight text-gray-900 dark:text-white">{exercise.name}</h3>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{exercise.muscleGroup}</p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <Stat icon={Layers}>{exercise.sets} séries</Stat>
        <Stat icon={Repeat}>{exercise.reps} reps</Stat>
        <Stat icon={Timer}>{exercise.rest}s descanso</Stat>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowExecutionDetails((v) => !v)}
          aria-expanded={showExecutionDetails}
          aria-controls={detailsId}
          className="pressable inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
        >
          {showExecutionDetails ? 'Fechar detalhes' : 'Ver execução'}
          <ChevronDown className={`h-4 w-4 transition-transform ${showExecutionDetails ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {!isCompleted && (
          <button
            type="button"
            onClick={() => setShowCheckInForm((v) => !v)}
            aria-expanded={showCheckInForm}
            className="btn-primary-gradient pressable inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            {showCheckInForm ? 'Cancelar check-in' : 'Marcar completo'}
          </button>
        )}
      </div>

      <div id={detailsId}>{showExecutionDetails && <ExerciseExecution exercise={exercise} />}</div>
      {showCheckInForm && (
        <CheckInForm exercise={exercise} onSubmit={handleCheckInSubmit} onCancel={() => setShowCheckInForm(false)} />
      )}
    </article>
  );
}

export default ExerciseCard;
