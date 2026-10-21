import React from 'react';
import { List, Lock, Search, Wifi, WifiOff } from 'lucide-react';

// Cabeçalho fixo da execução: nome, conectividade, cronômetro, progresso e modo de visualização.
const ExecutionHeader = ({ trainingName, isOnline, elapsedTime, completedSetsCount, totalSetsInTraining, progressPercent, viewMode, onChangeViewMode, lockSupported = false, lockEnabled = false, onToggleLock }) => (
    <div className="fixed top-0 md:top-20 left-0 right-0 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xl z-40 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex justify-between items-center gap-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-bold text-gray-800 dark:text-white text-sm leading-tight truncate">{trainingName}</h2>
                    <span className={`shrink-0 whitespace-nowrap text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${isOnline ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'}`}>
                        {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {isOnline ? 'Sincronizado' : 'Offline'}
                    </span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="font-mono font-black text-sm text-amber-800 dark:text-amber-400 dark:text-brand">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                    <span>•</span>
                    <span className="font-bold">{completedSetsCount}/{totalSetsInTraining} séries</span>
                </p>
            </div>

            {/* Barra de Progresso */}
            <div className="hidden sm:flex shrink-0 items-center gap-2 mx-1">
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{progressPercent}%</span>
            </div>

            {lockSupported && onToggleLock && (
                <button type="button" onClick={onToggleLock} aria-pressed={lockEnabled} aria-label="Controles na tela de bloqueio" title="Controles na tela de bloqueio" className={`shrink-0 min-h-[44px] min-w-[44px] grid place-items-center rounded-lg border text-xs font-bold transition-all ${lockEnabled ? 'bg-brand text-black border-transparent' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent dark:border-gray-700'}`}>
                    <Lock className="w-4 h-4" aria-hidden="true" />
                </button>
            )}

            {/* Toggle de Modo */}
            <div className="flex shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-transparent dark:border-gray-700">
                <button
                    onClick={() => onChangeViewMode('list')}
                    aria-pressed={viewMode === 'list'}
                    className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-amber-800 dark:text-brand' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    <List className="w-3.5 h-3.5" /> Lista
                </button>
                <button
                    onClick={() => onChangeViewMode('focus')}
                    aria-pressed={viewMode === 'focus'}
                    className={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'focus' ? 'bg-white dark:bg-gray-700 shadow-sm text-amber-800 dark:text-brand' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    <Search className="w-3.5 h-3.5" /> Foco
                </button>
            </div>
        </div>

        {/* Barra de Progresso Mobile */}
        <div className="sm:hidden mt-2">
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-brand to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    </div>
);

export default ExecutionHeader;
