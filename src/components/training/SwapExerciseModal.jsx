import React from 'react';
import { Dumbbell, X } from 'lucide-react';
import { equivalentsFor } from '../../utils/exerciseSwap';
import { stillSrc } from '../../utils/exerciseMedia';
import { isSafePhoto } from '../../utils/imageAttach';

// Escolha de um exercício equivalente durante o treino. "Só hoje" troca nesta sessão; "Na minha ficha" (treino pessoal) troca também
// no treino salvo. A prescrição (séries, repetições, descanso, tipos de série e superset) continua a do exercício trocado.
export default function SwapExerciseModal({ isOpen, onClose, exercise, library, owned, excludeNames, canPersist, onPick }) {
  if (!isOpen || !exercise) return null;
  const options = equivalentsFor(exercise, library, { owned, excludeNames, limit: 8 });
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/85 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Trocar ${exercise.name}`}>
      <div className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-5 text-gray-900 dark:bg-[#111827] dark:text-white sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Trocar exercício</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">No lugar de <b>{exercise.name}</b>. As séries, repetições e o descanso continuam os mesmos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {options.length === 0 ? (
          <p className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-200">Não achei equivalentes com os equipamentos da sua academia. Você pode ajustar os equipamentos no Perfil.</p>
        ) : (
          <ul className="space-y-2">
            {options.map((o) => {
              const src = o.ref.machineImage || o.ref.demoUrl;
              const shown = typeof src === 'string' && (src.startsWith('/') || isSafePhoto(src, 50000)) ? stillSrc(src) : null;
              return (
                <li key={o.ref.id || o.name} className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    {shown ? <img src={shown} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-gray-500 dark:bg-white/10"><Dumbbell className="h-5 w-5" aria-hidden="true" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{o.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{[o.equipment, o.why].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  <div className={`mt-2 grid gap-2 ${canPersist ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <button type="button" onClick={() => onPick(o.ref, 'hoje')} aria-label={`Trocar por ${o.name} só hoje`} className="min-h-[44px] rounded-2xl bg-brand text-sm font-black text-black">Só hoje</button>
                    {canPersist && <button type="button" onClick={() => onPick(o.ref, 'ficha')} aria-label={`Trocar por ${o.name} na minha ficha`} className="min-h-[44px] rounded-2xl bg-white text-sm font-bold text-gray-900 dark:bg-white/10 dark:text-white">Na minha ficha</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
