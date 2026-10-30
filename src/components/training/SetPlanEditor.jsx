import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { PLAN_LIMITS, SET_HINTS, TECHNIQUES, applyTechnique, normalizeSetTypes, planLabel, techniqueOf } from '../../utils/setTypes';

const STYLE = {
  normal: 'bg-gray-50 text-gray-800 ring-1 ring-gray-200 dark:bg-white/5 dark:text-gray-100 dark:ring-white/10',
  warmup: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100',
  drop: 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100',
  failure: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100',
  cluster: 'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100'
};
const field = 'min-h-[44px] rounded-xl bg-white ring-1 ring-black/10 dark:ring-white/15 px-2 text-center text-base font-bold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand dark:bg-white/10 dark:text-white';
const iconBtn = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 dark:bg-white/10 dark:text-gray-100';
const onlyDigits = (v, max = 3) => String(v).replace(/\D/g, '').slice(0, max);

// Plano de séries de um exercício: em cada série, repetições próprias e uma técnica (aquecimento, isometria antes/depois, drop com cargas,
// drop + falha, falha, cluster em blocos); e, se houver exercício seguinte, combinar os dois (bi-set). Compartilhado entre "Meu treino" e o
// editor de fichas do treinador. Os valores ficam como digitados; quem salva limpa com `normalizeSetPlan`.
export default function SetPlanEditor({ idBase, sets, reps = '', types, plan, onChange, link, onLink, canLink = true }) {
  const count = Math.max(1, Math.min(PLAN_LIMITS.sets, Number(sets) || 3));
  const list = normalizeSetTypes(types, count);
  const items = Array.from({ length: count }, (_, i) => (Array.isArray(plan) && plan[i] && typeof plan[i] === 'object' ? plan[i] : {}));
  const change = (i, type, item) => {
    const nextTypes = [...list]; nextTypes[i] = type;
    const nextItems = [...items]; nextItems[i] = item;
    onChange(nextTypes, nextItems);
  };
  const patchItem = (i, changes) => change(i, list[i], { ...items[i], ...changes });
  const firstHint = list.find((t) => t !== 'normal');

  return (
    <div className="mt-2 space-y-2 text-xs">
      <div>
        <p className="font-bold" id={`${idBase}-types`}>Séries: repetições e técnica</p>
        <ol className="mt-1 space-y-1.5" aria-labelledby={`${idBase}-types`}>
          {items.map((item, i) => {
            const tech = techniqueOf(list[i], item);
            const n = i + 1;
            const label = planLabel(item, reps);
            return (
              <li key={i} className={`rounded-xl p-1.5 ${STYLE[list[i]]}`}>
                <div className="flex items-center gap-1.5">
                  <span className="w-7 shrink-0 text-center font-black">{n}</span>
                  {tech === 'cluster' ? null : (
                    <input
                      value={item.reps || ''} placeholder={String(reps || '10')} maxLength={7}
                      onChange={(e) => patchItem(i, { reps: e.target.value.replace(/[^\d-]/g, '').slice(0, 7) })}
                      aria-label={`Repetições da série ${n}`} className={`${field} w-16 shrink-0`}
                    />
                  )}
                  <select
                    value={tech} onChange={(e) => { const r = applyTechnique(e.target.value, item); change(i, r.type, r.item); }}
                    aria-label={`Técnica da série ${n}`}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-white px-2 text-sm font-bold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand dark:bg-gray-800 dark:text-white"
                  >
                    {TECHNIQUES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>

                {(tech === 'isoBefore' || tech === 'isoAfter') && (
                  <div className="mt-1.5 ml-[2.125rem] flex flex-wrap items-center gap-1.5">
                    <input
                      inputMode="numeric" value={item[tech === 'isoBefore' ? 'isoBeforeSec' : 'isoAfterSec'] ?? ''}
                      onChange={(e) => patchItem(i, { [tech === 'isoBefore' ? 'isoBeforeSec' : 'isoAfterSec']: onlyDigits(e.target.value) })}
                      aria-label={`Segundos de isometria ${tech === 'isoBefore' ? 'antes' : 'depois'} da série ${n}`} className={`${field} w-16`}
                    />
                    <span className="font-bold">s de isometria {tech === 'isoBefore' ? 'antes das repetições' : 'depois das repetições'}</span>
                  </div>
                )}

                {(tech === 'drop' || tech === 'dropFailure') && (
                  <div className="mt-1.5 ml-[2.125rem] flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">Cargas do drop (kg):</span>
                    {(item.drops || [{}]).map((d, k) => (
                      <input
                        key={k} inputMode="decimal" placeholder="kg" value={d?.load ?? ''}
                        onChange={(e) => { const drops = [...(item.drops || [{}])]; drops[k] = { load: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) }; patchItem(i, { drops }); }}
                        aria-label={`Carga do drop ${k + 1} da série ${n} (kg)`} className={`${field} w-16`}
                      />
                    ))}
                    <button type="button" onClick={() => patchItem(i, { drops: [...(item.drops || [{}]), {}] })} disabled={(item.drops || []).length >= PLAN_LIMITS.drops} aria-label={`Adicionar drop na série ${n}`} className={iconBtn}><Plus className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => patchItem(i, { drops: (item.drops || [{}]).slice(0, -1) })} disabled={(item.drops || []).length <= 1} aria-label={`Remover o último drop da série ${n}`} className={iconBtn}><Minus className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                )}

                {tech === 'cluster' && (
                  <div className="mt-1.5 ml-[2.125rem] flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">Blocos (reps):</span>
                    {(item.blocks || [4, 4, 4]).map((b, k) => (
                      <input
                        key={k} inputMode="numeric" value={b ?? ''}
                        onChange={(e) => { const blocks = [...(item.blocks || [4, 4, 4])]; blocks[k] = onlyDigits(e.target.value, 2); patchItem(i, { blocks }); }}
                        aria-label={`Repetições do bloco ${k + 1} da série ${n}`} className={`${field} w-12`}
                      />
                    ))}
                    <button type="button" onClick={() => { const blocks = item.blocks || [4, 4, 4]; patchItem(i, { blocks: [...blocks, blocks[blocks.length - 1] || 4] }); }} disabled={(item.blocks || []).length >= PLAN_LIMITS.blocks} aria-label={`Adicionar bloco na série ${n}`} className={iconBtn}><Plus className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => patchItem(i, { blocks: (item.blocks || [4, 4, 4]).slice(0, -1) })} disabled={(item.blocks || [4, 4, 4]).length <= 2} aria-label={`Remover o último bloco da série ${n}`} className={iconBtn}><Minus className="h-4 w-4" aria-hidden="true" /></button>
                    <label className="flex items-center gap-1.5 font-bold">
                      <input inputMode="numeric" value={item.blockRestSec ?? ''} onChange={(e) => patchItem(i, { blockRestSec: onlyDigits(e.target.value, 2) })} aria-label={`Pausa entre os blocos da série ${n} (segundos)`} className={`${field} w-14`} />
                      s entre blocos
                    </label>
                  </div>
                )}

                {label && tech !== 'normal' && tech !== 'warmup' && <p className="mt-1 ml-[2.125rem] font-bold" aria-live="polite">{label}</p>}
              </li>
            );
          })}
        </ol>
        {firstHint && <p className="mt-1 text-gray-600 dark:text-gray-300">{SET_HINTS[firstHint]}</p>}
      </div>
      {canLink && (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 font-bold">
          <input type="checkbox" checked={!!link} onChange={(e) => onLink(e.target.checked)} className="h-5 w-5 accent-[#FFC107]" />
          Combinar com o próximo exercício (bi-set, tri-set)
        </label>
      )}
    </div>
  );
}
