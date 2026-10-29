import React from 'react';
import { SET_HINTS, SET_LABELS, SET_SHORT, nextSetType, normalizeSetTypes, planSummary } from '../../utils/setTypes';

const STYLE = {
  normal: 'bg-white text-gray-700 dark:bg-white/10 dark:text-gray-200',
  warmup: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  drop: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
  failure: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
};

// Plano de séries de um exercício: toque em cada série para trocar (normal, aquecimento, drop-set, até a falha) e, se houver exercício
// seguinte, ligar os dois em superset. Compartilhado entre "Meu treino" e o editor de fichas do treinador.
export default function SetPlanEditor({ idBase, sets, types, onTypes, link, onLink, canLink = true }) {
  const count = Math.max(1, Math.min(12, Number(sets) || 3));
  const list = normalizeSetTypes(types, count);
  const summary = planSummary(list);
  return (
    <div className="mt-2 space-y-2 text-xs">
      <div>
        <p className="font-bold" id={`${idBase}-types`}>Tipo de cada série</p>
        <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-labelledby={`${idBase}-types`}>
          {list.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { const next = [...list]; next[i] = nextSetType(t); onTypes(next); }}
              aria-label={`Série ${i + 1}: ${SET_LABELS[t]}. Toque para mudar`}
              className={`min-h-[40px] rounded-xl px-3 font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${STYLE[t]}`}
            >
              {i + 1} · {SET_SHORT[t]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{summary ? `${summary}. ` : 'Todas normais. '}{list.filter((t) => t !== 'normal').slice(0, 1).map((t) => SET_HINTS[t])}</p>
      </div>
      {canLink && (
        <label className="flex min-h-[40px] cursor-pointer items-center gap-2 font-bold">
          <input type="checkbox" checked={!!link} onChange={(e) => onLink(e.target.checked)} className="h-5 w-5 accent-[#FFC107]" />
          Combinar com o próximo exercício (bi-set, tri-set)
        </label>
      )}
    </div>
  );
}
