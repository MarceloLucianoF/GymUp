import React from 'react';
import { ClipboardList, Lock } from 'lucide-react';
import { normalizeRoutine, routineLetter, sortByRoutine } from '../../utils/routine';
import { plural } from '../../utils/text';

// Treinos que o próprio aluno montou ou importou, na ordem da ficha dele. Só aparece se ele compartilhou (coachShares.workouts).
export default function StudentOwnWorkouts({ own, name = 'O aluno' }) {
  if (!own) {
    return (
      <section className="surface flex items-start gap-3 p-5" aria-label="Treinos próprios do aluno">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Os treinos que {name} montou no app aparecem aqui quando ele autorizar, em Perfil › Treinador.
          Os treinos concluídos (abaixo) você sempre vê.
        </p>
      </section>
    );
  }
  const letters = new Map(normalizeRoutine(own.routine?.items || [], own.workouts).map((it, i) => [it.workoutId, routineLetter(i)]));
  const list = sortByRoutine(own.workouts, own.routine?.items || []);
  return (
    <section className="surface space-y-3 p-5" aria-labelledby="own-title">
      <h2 id="own-title" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
        <ClipboardList className="h-5 w-5 text-brand" aria-hidden="true" /> Treinos próprios do aluno
      </h2>
      {list.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">{name} ainda não montou treinos próprios.</p> : (
        <ul className="space-y-2">
          {list.map((w) => (
            <li key={w.id}>
              <details className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                <summary className="flex cursor-pointer items-center gap-3">
                  {letters.has(w.docId) && <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand font-display font-black text-black" aria-label={`Treino ${letters.get(w.docId)} da ficha`}>{letters.get(w.docId)}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-gray-900 dark:text-white">{w.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{plural((w.exercises || []).length, 'exercício', 'exercícios')}</span>
                  </span>
                </summary>
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {(w.exercises || []).map((ex, i) => <li key={`${ex.name}-${i}`}>{ex.name}{ex.sets ? ` · ${ex.sets}×${ex.reps || '-'}` : ''}</li>)}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
      {letters.size > 0 && <p className="text-xs text-gray-600 dark:text-gray-400">As letras mostram a ordem da ficha que o aluno montou.</p>}
    </section>
  );
}
