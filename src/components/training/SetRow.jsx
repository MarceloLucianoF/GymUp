import React from 'react';
import { Check, Circle } from 'lucide-react';

const inputClass = (isFocusMode) =>
    `w-full bg-gray-100 dark:bg-white/5 rounded-2xl px-3 py-3 text-center font-black text-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand transition-all min-h-[52px] ${isFocusMode ? 'h-16 text-2xl' : ''}`;

// Linha de uma série: carga, repetições e botão de conclusão.
const SetRow = ({ setIndex, data, weightPlaceholder, repsPlaceholder, isFocusMode, onInput, onCheck }) => {
    const isDone = data.completed;

    return (
        <div className={`flex items-center gap-3 p-3 sm:p-4 transition-colors duration-500 ${isDone ? 'bg-emerald-500/10' : ''}`}>
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
    );
};

export default SetRow;
