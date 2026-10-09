import React from 'react';
import { Target, Flame, Sparkles, Play, Clock, ClipboardList } from 'lucide-react';

// --- CARD DE TREINO RECOMENDADO ---
const RecommendedWorkoutCard = ({ lastWorkoutId, trainings, onStart, assignedTrainingId }) => {
  let nextTraining = null;
  let isAssigned = false;

  if (assignedTrainingId) {
      nextTraining = trainings.find(t => t.firestoreId === assignedTrainingId);
      if (nextTraining) isAssigned = true;
  }

  if (!nextTraining && trainings.length > 0) {
      if (lastWorkoutId) {
          const lastIndex = trainings.findIndex(t => t.firestoreId === lastWorkoutId);
          if (lastIndex !== -1 && lastIndex < trainings.length - 1) {
              nextTraining = trainings[lastIndex + 1];
          } else {
              nextTraining = trainings[0];
          }
      } else {
          nextTraining = trainings[0];
      }
  }

  if (!nextTraining) return (
      <div className="p-8 bg-gray-100 dark:bg-gray-800 rounded-3xl text-center border-2 border-dashed border-gray-300 dark:border-gray-700 mb-8">
          <p className="text-gray-500 font-medium">Nenhum treino disponível.</p>
          <p className="text-xs text-gray-400 mt-1">Aguarde seu treinador criar uma ficha ou vincule-se a um coach.</p>
      </div>
  );

  return (
    <div className={`rounded-3xl p-6 shadow-xl relative overflow-hidden mb-8 group transition-all transform hover:scale-[1.01] hover:-translate-y-0.5 duration-350 border ${
        isAssigned 
        ? 'bg-gradient-to-br from-brand to-[#FF9800] text-black shadow-brand/10 border-brand/20 hover:shadow-[0_0_30px_rgba(255,193,7,0.2)]' 
        : 'bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md text-gray-800 dark:text-white shadow-black/5 dark:shadow-black/25 border-gray-100 dark:border-brand/10 hover:border-brand/30 hover:shadow-[0_0_25px_rgba(255,193,7,0.06)]'
    }`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-4 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
            {isAssigned ? <Target className="w-32 h-32 text-black" /> : <Flame className="w-32 h-32 text-white" />}
        </div>
        
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1.5 ${isAssigned ? 'bg-black/10 text-black' : 'bg-black/20 text-white/90'}`}>
                    {isAssigned ? (
                        <><Sparkles className="w-3 h-3" /> Prescrito pelo Coach</>
                    ) : (
                        'Sugestão do Dia'
                    )}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${isAssigned ? 'bg-black/10 text-black/80' : 'bg-brand/10 text-brand'}`}>
                    {nextTraining.difficulty}
                </span>
            </div>
            
            <h2 className="text-3xl font-black mb-2 leading-tight">{nextTraining.name}</h2>
            <p className={`text-sm mb-6 max-w-lg line-clamp-2 ${isAssigned ? 'text-black/80' : 'text-gray-400 dark:text-gray-300'}`}>
                {nextTraining.description || "Foco total no progresso e consistência."}
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button 
                    onClick={() => onStart(nextTraining.firestoreId)}
                    className={`px-8 py-3.5 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 btn-premium hover-glow-brand transition-all duration-300 group ${
                        isAssigned 
                        ? 'bg-black text-white hover:bg-black/90' 
                        : 'bg-gradient-to-r from-brand to-[#FF9800] text-black hover:from-brand hover:to-brand-dark hover:shadow-[0_0_20px_rgba(255,193,7,0.35)]'
                    }`}
                >
                    <Play className="w-4 h-4 fill-current transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-0.5" /> INICIAR TREINO
                </button>
                <div className={`flex items-center gap-4 text-xs font-bold px-4 py-2 rounded-lg w-fit ${isAssigned ? 'bg-black/10 text-black/90' : 'bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-white/90 border border-gray-200 dark:border-gray-700'}`}>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ~45 min</span>
                    <span className={`w-1 h-1 rounded-full ${isAssigned ? 'bg-black/30' : 'bg-white/50'}`}></span>
                    <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> {nextTraining.exercises?.length || 0} Exercícios</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default RecommendedWorkoutCard;
