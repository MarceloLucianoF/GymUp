import React from 'react';

// --- CARD DE CONSISTÊNCIA ---
const ConsistencyCard = ({ history }) => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentWorkouts = history.filter(h => new Date(h.date) >= twoWeeksAgo).length;
    let status = "Iniciando";
    let color = "text-brand bg-brand/10 border border-brand/25";
    if(recentWorkouts >= 8) { status = "Imparável"; color = "text-orange-500 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900"; }
    else if(recentWorkouts >= 4) { status = "Constante"; color = "text-green-500 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"; }

    return (
        <div className="bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-brand/10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2 gap-2">
                <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider leading-tight">Frequência (14d)</h3>
                <span className={`text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap ${color}`}>{status}</span>
            </div>
            <div>
                <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-gray-800 dark:text-white">{recentWorkouts}</span>
                    <span className="text-sm text-gray-400 font-bold mb-1">treinos</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Nos últimos 14 dias.</p>
            </div>
        </div>
    );
};

export default ConsistencyCard;
