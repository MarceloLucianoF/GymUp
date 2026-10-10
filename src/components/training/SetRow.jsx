import React from 'react';
import { Check, Circle, Trophy } from 'lucide-react';

const inputClass = (isFocusMode) =>
    `w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-3 py-3 text-center font-black text-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand transition-all min-h-[52px] ${isFocusMode ? 'h-16 text-2xl' : ''}`;

// Linha de uma série: carga, repetições e botão de conclusão.
const RPE_OPTIONS = [6, 7, 8, 9, 10];
const stepBtn = 'min-h-[36px] flex-1 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

const SetRow = ({ setIndex, data, weightPlaceholder, repsPlaceholder, isFocusMode, isPR, onInput, onCheck, onAdjust }) => {
    const isDone = data.completed;

    return (
        <div className={`p-3 sm:p-4 transition-colors duration-500 ${isDone ? 'bg-emerald-500/10' : ''}`}>
        <div className="flex items-center gap-3">
            <span className="w-8 text-center text-sm font-bold text-gray-500 dark:text-gray-400">#{setIndex + 1}</span>

            <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="relative">
                    <input
                        type="number" inputMode="decimal" placeholder={weightPlaceholder || '-'}
                        aria-label={`Carga da série ${setIndex + 1} (kg)`}
                        value={data.weight || ''}
                        onChange={(e) => onInput(setIndex, 'weight', e.target.value)}
                        className={inputClass(isFocusMode)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 dark:text-gray-400 font-bold pointer-events-none">KG</span>
                </div>
                <div className="relative">
                    <input
                        type="number" inputMode="numeric" placeholder={repsPlaceholder}
                        aria-label={`Repetições da série ${setIndex + 1}`}
                        value={data.reps || ''}
                        onChange={(e) => onInput(setIndex, 'reps', e.target.value)}
                        className={inputClass(isFocusMode)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 dark:text-gray-400 font-bold pointer-events-none">REPS</span>
                </div>
            </div>

            <button
                onClick={() => onCheck(setIndex)}
                aria-label={isDone ? `Desmarcar série ${setIndex + 1}` : `Concluir série ${setIndex + 1}`}
                aria-pressed={!!isDone}
                className={`${isFocusMode ? 'w-16 h-16' : 'w-14 h-14'} shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-90 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                }`}
            >
                {isDone ? <Check className="w-7 h-7 animate-scale-in" strokeWidth={3} aria-hidden="true" /> : <Circle className="w-6 h-6" aria-hidden="true" />}
            </button>
        </div>
        {isPR && (
            <div role="status" className="mt-2 ml-11 inline-flex items-center gap-1 rounded-full bg-brand/15 border border-brand/40 px-2.5 py-1 text-[11px] font-black text-brand">
                <Trophy className="w-3.5 h-3.5 fill-current" aria-hidden="true" /> RECORDE de carga!
            </div>
        )}
        {onAdjust && (
            <div className="mt-2 ml-11 mr-[4.5rem] grid grid-cols-2 gap-3">
                <div className="flex gap-1.5">
                    <button type="button" className={stepBtn} aria-label="Diminuir 2,5 kg" onClick={() => onAdjust(setIndex, 'weight', -2.5)}>-2,5</button>
                    <button type="button" className={stepBtn} aria-label="Aumentar 2,5 kg" onClick={() => onAdjust(setIndex, 'weight', 2.5)}>+2,5</button>
                </div>
                <div className="flex gap-1.5">
                    <button type="button" className={stepBtn} aria-label="Diminuir 1 repetição" onClick={() => onAdjust(setIndex, 'reps', -1)}>-1</button>
                    <button type="button" className={stepBtn} aria-label="Aumentar 1 repetição" onClick={() => onAdjust(setIndex, 'reps', 1)}>+1</button>
                </div>
            </div>
        )}
        {isDone && (
            <div className="mt-2 ml-11 flex items-center gap-1.5" role="group" aria-label={`Esforço (RPE) da série ${setIndex + 1}`}>
                <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 mr-1">RPE</span>
                {RPE_OPTIONS.map(v => (
                    <button
                        key={v} type="button" aria-pressed={data.rpe === v}
                        onClick={() => onInput(setIndex, 'rpe', data.rpe === v ? undefined : v)}
                        className={`min-w-[36px] min-h-[36px] rounded-full text-xs font-black transition-all active:scale-90 ${data.rpe === v ? 'bg-brand text-black' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'}`}
                    >{v}</button>
                ))}
            </div>
        )}
        </div>
    );
};

export default SetRow;
