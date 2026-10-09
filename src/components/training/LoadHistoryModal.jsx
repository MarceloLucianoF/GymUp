import React from 'react';
import { History, X } from 'lucide-react';
import Modal from '../common/Modal';

// Histórico de cargas máximas de um exercício.
const LoadHistoryModal = ({ exerciseName, historyLogs, onClose }) => {
    if (!exerciseName) return null;

    return (
        <Modal onClose={onClose} label={`Histórico de cargas: ${exerciseName}`} className="w-full max-w-sm">
            <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 w-full shadow-2xl relative animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <span className="text-[10px] font-bold text-brand uppercase tracking-wider">Histórico de Cargas</span>
                        <h3 className="text-lg font-black text-gray-800 dark:text-white leading-tight">{exerciseName}</h3>
                    </div>
                    <button aria-label="Fechar" onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full bg-gray-100 dark:bg-gray-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {historyLogs && historyLogs.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {historyLogs.map((item, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{item.date}</p>
                                    <p className="text-[10px] text-gray-400">{item.setsCount} séries efetuadas</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-black text-brand">{item.maxWeight}kg</span>
                                    <p className="text-[10px] text-gray-400">Máxima</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-gray-400">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-50 text-brand" />
                        <p className="text-xs font-medium">Nenhum registro anterior encontrado para este exercício.</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default LoadHistoryModal;
