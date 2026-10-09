import React from 'react';
import { Flame, Trash2, RotateCcw } from 'lucide-react';

// --- CARD DE TREINO EM ANDAMENTO (RECUPERAÇÃO AUTOMÁTICA) ---
const ActiveWorkoutBanner = ({ activeSession, onContinue, onDiscard }) => {
    if (!activeSession) return null;
    
    // Contar séries concluídas
    const completedSetsCount = activeSession.sessionData 
      ? Object.values(activeSession.sessionData).filter(s => s?.completed).length 
      : 0;

    return (
        <div className="bg-gradient-to-r from-orange-600 via-[#FF9800] to-brand p-0.5 rounded-3xl shadow-xl animate-fade-in-up mb-8">
            <div className="bg-gray-900/90 backdrop-blur-xl p-5 sm:p-6 rounded-[22px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-orange-500/20">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 mt-1">
                        <Flame className="w-6 h-6 text-orange-400 animate-pulse fill-orange-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">Treino em Andamento</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">{activeSession.trainingName}</h3>
                        <p className="text-xs text-gray-300 mt-1">
                            <span className="font-bold text-white">{completedSetsCount}</span> séries concluídas • Clique para retornar de onde parou
                        </p>
                    </div>
                </div>

                <div className="flex gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                    <button 
                        onClick={onDiscard} 
                        className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Descartar
                    </button>
                    <button 
                        onClick={onContinue}
                        className="flex-1 sm:flex-initial btn-primary-gradient text-xs px-6 py-3"
                    >
                        <RotateCcw className="w-4 h-4" /> CONTINUAR TREINO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActiveWorkoutBanner;
