import React from 'react';
import { PlayCircle } from 'lucide-react';

const TIPS = [
  'Mantenha a postura correta durante todo o movimento.',
  'Controle a fase excêntrica (descida) do movimento.',
  'Respeite o tempo de descanso para otimizar a recuperação.',
  'Concentre-se na contração do músculo alvo.',
  'Ajuste a carga para que as últimas repetições sejam desafiadoras.',
];

function ExerciseExecution({ exercise }) {
  return (
    <div className="mt-4 space-y-4 rounded-2xl bg-gray-50 p-4 animate-fade-up dark:bg-white/5">
      <h4 className="font-display text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white">Como executar</h4>

      {exercise.machineImage && (
        <figure>
          <img
            src={exercise.machineImage}
            alt={`Máquina para ${exercise.name}`}
            loading="lazy"
            className="max-h-64 w-full rounded-2xl bg-white object-contain dark:bg-black/20"
          />
          <figcaption className="mt-1.5 text-center text-xs text-gray-500 dark:text-gray-400">Máquina: {exercise.name}</figcaption>
        </figure>
      )}

      {exercise.execution && <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{exercise.execution}</p>}

      <div>
        <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dicas importantes</h5>
        <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          {TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {exercise.videoUrl && (
        <a
          href={exercise.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary-gradient pressable inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <PlayCircle className="h-5 w-5" aria-hidden="true" /> Ver vídeo de execução
        </a>
      )}
    </div>
  );
}

export default ExerciseExecution;
