import React from 'react';
import Modal from '../common/Modal';

// Zoom da imagem do exercício com descrição e instruções de execução.
const ExerciseZoomModal = ({ exercise, onClose }) => {
    if (!exercise) return null;

    return (
        <Modal onClose={onClose} label={`Detalhes de ${exercise.name}`} className="w-full max-w-lg">
            <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full shadow-2xl relative overflow-hidden animate-fade-in-up text-gray-800 dark:text-white">
                <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="absolute top-4 right-4 w-9 h-9 bg-gray-150 dark:bg-black/40 hover:bg-gray-200 dark:hover:bg-black/60 rounded-full flex items-center justify-center text-gray-600 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
                >
                    ✕
                </button>

                <h3 className="text-xl font-black mb-1 text-brand pr-8 leading-tight">{exercise.name}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-4">{exercise.muscleGroup}</p>

                {/* Zoomable Image Container */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 flex items-center justify-center mb-6 group cursor-zoom-in">
                    <img
                        src={exercise.image}
                        alt={exercise.name}
                        className="w-full h-full object-contain transition-transform duration-300 hover:scale-125"
                    />
                    <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-gray-300 font-bold uppercase tracking-wider pointer-events-none opacity-85 group-hover:opacity-0 transition-opacity">
                        Passe o cursor para dar zoom
                    </div>
                </div>

                {/* Instructions */}
                <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
                    {exercise.description && (
                        <div>
                            <h4 className="text-xs font-bold text-brand uppercase mb-1">Sobre</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{exercise.description}</p>
                        </div>
                    )}
                    {exercise.execution && (
                        <div>
                            <h4 className="text-xs font-bold text-brand uppercase mb-1">Como Executar</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{exercise.execution}</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ExerciseZoomModal;
