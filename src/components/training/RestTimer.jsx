import React from 'react';
import { Timer, SkipForward, Pause, Play } from 'lucide-react';
import { useRestTimer } from '../../hooks/useRestTimer';

// Overlay de descanso (tela cheia). Não fecha por clique fora para evitar pulos acidentais.
const RestTimer = ({ endTime, duration, onFinish, onClose, onAdjust }) => {
    const { remaining, isPaused, togglePause } = useRestTimer({ endTime, onFinish, onAdjust });

    const totalDuration = duration || 60;

    // Calcular progresso do SVG
    const circumference = 2 * Math.PI * 120;
    const progress = totalDuration > 0 ? (remaining / totalDuration) : 0;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div role="dialog" aria-modal="true" aria-label="Descanso entre séries" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in p-6">
            <div className="text-center text-white w-full max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-6">
                    <Timer className="w-5 h-5 text-brand animate-spin" style={{ animationDuration: '3s' }} />
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-300">
                        Descanso Ativo {isPaused && '(Pausado)'}
                    </p>
                </div>

                <div className="relative w-64 h-64 mx-auto flex items-center justify-center mb-8">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" aria-hidden="true">
                        <circle cx="128" cy="128" r="120" stroke="#222" strokeWidth="8" fill="transparent" />
                        <circle
                            cx="128" cy="128" r="120" stroke={isPaused ? "#888" : "#FFC107"} strokeWidth="8" fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-300 ease-linear"
                        />
                    </svg>
                    <div className="text-7xl font-black font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(255,193,7,0.35)]">
                        {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                    <button onClick={() => onAdjust(-15000)} className="min-h-[48px] bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-sm transition-all active:scale-95">-15s</button>
                    <button onClick={() => onAdjust(30000)} className="min-h-[48px] bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-sm transition-all active:scale-95">+30s</button>
                    <button onClick={() => onAdjust(60000)} className="min-h-[48px] bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-sm transition-all active:scale-95">+60s</button>
                    <button onClick={togglePause} aria-label={isPaused ? 'Retomar descanso' : 'Pausar descanso'} className="min-h-[48px] bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                </div>

                <button onClick={onClose} className="w-full min-h-[56px] bg-red-600 hover:bg-red-500 rounded-2xl font-black transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 text-sm active:scale-95">
                    <SkipForward className="w-4 h-4" /> Pular Descanso
                </button>
            </div>
        </div>
    );
};

export default RestTimer;
