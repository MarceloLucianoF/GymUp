import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, Timer } from 'lucide-react';
import { timedSeconds } from '../../utils/exerciseKind';

// Etapa opcional "Alongamento geral (5 min)" antes do 1º exercício: cronômetro por exercício, "Próximo" e "Pular".
// Não mexe nas séries da sessão: concluir ou pular só chama onDone (sem volume, sem séries registradas).
export default function WarmupStretchStep({ exercises = [], onDone }) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const ex = exercises[index] || null;
  const total = ex ? timedSeconds(ex) : 0;
  const [left, setLeft] = useState(total);
  const leftRef = useRef(total);   // o efeito do cronômetro lê daqui (o estado ainda é o do exercício anterior na troca)

  useEffect(() => { leftRef.current = total; setLeft(total); }, [index, total]);
  useEffect(() => {
    if (!running) return undefined;
    const endAt = Date.now() + leftRef.current * 1000;
    const id = setInterval(() => {
      const rest = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      leftRef.current = rest;
      setLeft(rest);
      if (rest === 0) setRunning(false);
    }, 250);
    return () => clearInterval(id);
  }, [running, index]);

  if (!ex) return null;
  const last = index >= exercises.length - 1;
  const next = () => { if (last) { onDone('done'); return; } setIndex((i) => i + 1); setRunning(true); };
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <section className="surface animate-fade-in p-5" aria-labelledby="warmup-step-title">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="warmup-step-title" className="flex items-center gap-1.5 font-display text-lg font-black text-gray-900 dark:text-white"><Timer className="h-5 w-5 text-brand" aria-hidden="true" /> Alongamento geral (5 min)</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">Opcional. Não conta séries nem volume.</p>
        </div>
        <button type="button" onClick={() => onDone('skipped')} className="pressable flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-gray-100 px-3 text-sm font-bold text-gray-800 dark:bg-white/10 dark:text-gray-200">
          <SkipForward className="h-4 w-4" aria-hidden="true" /> Pular
        </button>
      </div>

      <p className="text-xs font-bold text-gray-600 dark:text-gray-400">{index + 1} de {exercises.length}</p>
      <h3 className="mt-1 text-base font-black text-gray-900 dark:text-white">{ex.name}</h3>
      {ex.machineImage && <img src={ex.machineImage} alt="" className="mx-auto mt-3 h-40 w-full max-w-xs rounded-2xl bg-white object-contain" />}
      {(ex.execution || ex.description) && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{ex.execution || ex.description}</p>}

      <p className="mt-4 text-center font-display text-5xl font-black tabular-nums text-gray-900 dark:text-white" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Tempo restante: </span><span>{mm}:{ss}</span>
      </p>
      {left === 0 && <p className="mt-1 text-center text-sm font-bold text-green-700 dark:text-green-400">Tempo!</p>}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setRunning((r) => !r)} disabled={left === 0} className="pressable flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 text-sm font-black text-gray-800 disabled:opacity-50 dark:border-white/15 dark:text-gray-100">
          {running ? <><Pause className="h-4 w-4" aria-hidden="true" /> Pausar</> : <><Play className="h-4 w-4" aria-hidden="true" /> {left < total ? 'Continuar' : 'Iniciar'}</>}
        </button>
        <button type="button" onClick={next} className="pressable min-h-[48px] flex-[2] rounded-2xl bg-brand text-sm font-black text-black">
          {last ? 'Concluir alongamento' : 'Próximo'}
        </button>
      </div>
    </section>
  );
}
