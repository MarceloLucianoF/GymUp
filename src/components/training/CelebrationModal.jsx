import React from 'react';
import { Trophy } from 'lucide-react';

// Tela de treino concluído (sem fechar por clique fora: o treino já foi salvo).
const CelebrationModal = ({ stats, onFinish }) => {
    return (
        <div role="dialog" aria-modal="true" aria-label="Treino concluído" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#1F2937] border border-brand/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden animate-scale-in">
                <div className="w-20 h-20 bg-gradient-to-br from-brand to-[#FF9800] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand/20">
                    <Trophy className="w-10 h-10 text-black fill-current animate-bounce" />
                </div>

                <span className="bg-brand/10 text-brand text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-brand/20 inline-block mb-2">
                    Sensacional! 🔥
                </span>

                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">TREINO CONCLUÍDO!</h2>
                <p className="text-gray-400 text-xs mb-6">Excelente trabalho! Mais um passo em direção ao seu objetivo.</p>

                {stats.newPRs && stats.newPRs.length > 0 && (
                    <div className="mb-6 p-3.5 bg-brand/10 border border-brand/30 rounded-2xl text-left">
                        <div className="flex items-center gap-1.5 text-xs font-black text-brand uppercase tracking-wider mb-1">
                            <Trophy className="w-4 h-4 fill-current" /> Novo Recorde Pessoal!
                        </div>
                        <p className="text-xs text-gray-300">
                            Superou sua marca anterior em <span className="font-bold text-white">{stats.newPRs.join(', ')}</span>! 🚀
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Tempo Total</p>
                        <p className="text-xl font-black text-brand font-mono mt-0.5">{stats.timeStr}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Volume Total</p>
                        <p className="text-xl font-black text-white font-mono mt-0.5">{stats.volumeKg}kg</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Séries Concluídas</p>
                        <p className="text-xl font-black text-white font-mono mt-0.5">{stats.completedSetsCount}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Exercícios</p>
                        <p className="text-xl font-black text-white font-mono mt-0.5">{stats.executedExercisesCount}</p>
                    </div>
                </div>

                <button 
                    onClick={onFinish}
                    className="w-full btn-primary-gradient py-4 text-base rounded-2xl touch-target"
                >
                    VOLTAR AO PAINEL
                </button>
            </div>
        </div>
    );
};

export default CelebrationModal;
