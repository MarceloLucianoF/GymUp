import React from 'react';
import { Target, Sparkles, Play, Clock, ClipboardList, Dumbbell } from 'lucide-react';

// Escolhe o treino do dia: prescrito pelo coach ou próximo da sequência.
export const pickNextTraining = (trainings, lastWorkoutId, assignedTrainingId) => {
  if (assignedTrainingId) {
    const assigned = trainings.find((t) => t.firestoreId === assignedTrainingId);
    if (assigned) return { training: assigned, isAssigned: true };
  }
  if (trainings.length === 0) return { training: null, isAssigned: false };
  if (lastWorkoutId) {
    const lastIndex = trainings.findIndex((t) => t.firestoreId === lastWorkoutId);
    if (lastIndex !== -1 && lastIndex < trainings.length - 1) return { training: trainings[lastIndex + 1], isAssigned: false };
  }
  return { training: trainings[0], isAssigned: false };
};

// --- CARD "TREINO DE HOJE" ---
const RecommendedWorkoutCard = ({ lastWorkoutId, trainings, onStart, assignedTrainingId }) => {
  const { training: nextTraining, isAssigned } = pickNextTraining(trainings, lastWorkoutId, assignedTrainingId);

  if (!nextTraining) {
    return (
      <div className="surface flex flex-col items-center p-8 text-center">
        <Dumbbell className="mb-3 h-10 w-10 text-brand/60" aria-hidden="true" />
        <p className="font-bold text-gray-800 dark:text-gray-100">Nenhum treino disponível</p>
        <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">Aguarde seu treinador criar uma ficha ou vincule-se a um coach.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#FFB300] to-[#FF9800] p-5 text-black shadow-xl shadow-brand/20 sm:p-7">
      <Target className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-black/10" aria-hidden="true" />
      <div className="relative z-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {isAssigned ? 'Prescrito pelo Coach' : 'Treino de hoje'}
          </span>
          {nextTraining.difficulty && (
            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{nextTraining.difficulty}</span>
          )}
        </div>

        <h2 className="font-display text-2xl font-black leading-tight sm:text-4xl">{nextTraining.name}</h2>
        <p className="mt-1.5 line-clamp-2 max-w-lg text-sm text-black/75">
          {nextTraining.description || 'Foco total no progresso e consistência.'}
        </p>

        <div className="mt-4 flex items-center gap-4 text-xs font-bold text-black/80">
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> ~45 min</span>
          <span className="flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" aria-hidden="true" /> {nextTraining.exercises?.length || 0} exercícios</span>
        </div>

        <button
          type="button"
          onClick={() => onStart(nextTraining.firestoreId)}
          className="pressable animate-pulse-ring mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-black px-8 text-base font-black text-brand shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/40 sm:w-auto"
        >
          <Play className="h-5 w-5 fill-current" aria-hidden="true" /> INICIAR TREINO
        </button>
      </div>
    </div>
  );
};

export default RecommendedWorkoutCard;
