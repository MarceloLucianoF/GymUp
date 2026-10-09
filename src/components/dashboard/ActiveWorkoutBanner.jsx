import React from 'react';
import { Flame, Trash2, RotateCcw } from 'lucide-react';

// --- CARD DE TREINO EM ANDAMENTO (RECUPERAÇÃO AUTOMÁTICA) ---
const ActiveWorkoutBanner = ({ activeSession, onContinue, onDiscard }) => {
  if (!activeSession) return null;

  const completedSetsCount = activeSession.sessionData
    ? Object.values(activeSession.sessionData).filter((s) => s?.completed).length
    : 0;

  return (
    <div className="rounded-3xl bg-gradient-to-r from-orange-600 via-[#FF9800] to-brand p-0.5 shadow-xl shadow-orange-500/20 animate-scale-in">
      <div className="flex flex-col gap-4 rounded-[22px] bg-gray-900/95 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/20">
            <Flame className="h-6 w-6 animate-pulse fill-orange-400 text-orange-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">Treino em andamento</span>
            </div>
            <h3 className="font-display text-xl font-black tracking-tight text-white sm:text-2xl">{activeSession.trainingName}</h3>
            <p className="mt-1 text-xs text-gray-300">
              <span className="font-bold text-white">{completedSetsCount}</span> séries concluídas • retome de onde parou
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 gap-2.5 sm:w-auto">
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Descartar treino em andamento"
            className="pressable flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-gray-800 px-4 text-xs font-bold text-gray-200 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Descartar
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="btn-primary-gradient animate-pulse-ring pressable min-h-[48px] flex-1 px-6 text-sm sm:flex-initial"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> CONTINUAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveWorkoutBanner;
