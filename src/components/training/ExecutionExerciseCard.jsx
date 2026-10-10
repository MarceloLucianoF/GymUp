import React from 'react';
import { createPortal } from 'react-dom';
import { Dumbbell, Video, Timer, History, Sparkles, Check, ArrowRight, Trophy, Copy, StickyNote } from 'lucide-react';
import SetRow from './SetRow';
import { getLastReps, getSmartTip, getLastNote, getLastSessionSets, isPRSet, noteKey, NOTE_MAX } from '../../utils/training';

// Card de exercício da execução do treino (modo lista ou foco).
const ExecutionExerciseCard = ({
    ex, exIndex, isFocusMode = false,
    historyMap, rawHistoryDocs, sessionData,
    isLastExercise,
    onInput, onCheckSet, onAdjust, onCopyLast, onNote, onOpenLoadHistory, onZoom, onShowVideo, onNextExercise, onFinish
}) => {
    if (!ex) return null;

    const setsCount = parseInt(ex.sets, 10) || 3;
    const setsArray = Array.from({ length: setsCount });
    const exName = ex.name || `Exercício ${exIndex + 1}`;
    const lastLoad = historyMap[exName];
    const restSeconds = ex.rest || 60;

    const repsRaw = (ex.reps && String(ex.reps) !== 'undefined') ? String(ex.reps) : '10';
    const repsPlaceholder = repsRaw.includes('-') ? repsRaw.split('-')[0] : (repsRaw !== 'undefined' ? repsRaw : '10');

    // Inteligência de Progressão de Carga + Repetições
    const lastReps = getLastReps(rawHistoryDocs, exName);
    const targetRepsNum = parseInt(repsPlaceholder, 10) || 10;
    const smartTip = getSmartTip(lastLoad, lastReps, targetRepsNum);

    const lastNote = getLastNote(rawHistoryDocs, exName);
    const hasLastSession = getLastSessionSets(rawHistoryDocs, exName).length > 0;
    const noteValue = sessionData[noteKey(exIndex)]?.note || '';

    const isSetDone = (sIdx) => sessionData[`${exIndex}-${sIdx}`]?.completed;
    const allDone = setsArray.every((_, sIdx) => isSetDone(sIdx));
    const nextUndoneIndex = setsArray.findIndex((_, sIdx) => !isSetDone(sIdx));

    const checkSet = (setIndex) => onCheckSet(exIndex, setIndex, repsPlaceholder, setsCount, restSeconds, exName);

    return (
        <div className={`surface animate-fade-up overflow-hidden ${isFocusMode ? 'min-h-[50vh] flex flex-col' : ''}`}>
            {/* Card Header */}
            <div className="p-4 flex gap-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-white/[0.03] relative">
                <div className={`${isFocusMode ? 'w-24 h-24' : 'w-16 h-16'} bg-gray-200 dark:bg-gray-900 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-800 transition-all cursor-zoom-in group`}>
                    {ex.machineImage ?
                        <img
                            src={ex.machineImage}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            alt={exName}
                            loading="lazy"
                            onClick={() => onZoom({
                                image: ex.machineImage,
                                name: exName,
                                muscleGroup: ex.muscleGroup || 'Geral',
                                description: ex.description || '',
                                execution: ex.execution || ''
                            })}
                        /> :
                        <div className="h-full flex items-center justify-center">
                            <Dumbbell className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                        </div>
                    }
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={`${isFocusMode ? 'text-xl' : 'text-lg'} font-black text-gray-800 dark:text-white leading-tight truncate`}>{exName}</h3>
                    <p className="text-xs text-gray-500 mt-1 uppercase font-bold">{ex.muscleGroup || 'Geral'}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded font-bold">Meta: {setsCount}x {repsRaw}</span>
                        {lastLoad ? (
                            <button
                                onClick={() => onOpenLoadHistory(exName)}
                                className="text-[10px] bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
                                title="Ver histórico de cargas deste exercício"
                            >
                                <History className="w-3 h-3" /> ↺ {lastLoad}kg
                            </button>
                        ) : null}
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <Timer className="w-3 h-3" /> {restSeconds}s
                        </span>
                    </div>
                </div>
                {/* Botão de Dica/Vídeo no header */}
                {isFocusMode && ex.videoUrl && (
                    <button onClick={onShowVideo} aria-label="Ver vídeo do exercício" className="absolute top-4 right-4 text-xl opacity-50 hover:opacity-100 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <Video className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                )}
            </div>

            {/* Dica Inteligente de Progresso de Cargas */}
            <div className="bg-brand/10 border-y border-brand/20 px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-brand shrink-0 animate-pulse" />
                    <span className="font-bold text-brand truncate">
                        {smartTip}
                    </span>
                </div>
            </div>

            {/* Cópia da última sessão e nota do exercício */}
            <div className="px-4 py-3 space-y-2 border-b border-gray-100 dark:border-gray-700/50">
                {hasLastSession && (
                    <button
                        type="button" onClick={() => onCopyLast(exIndex, exName, setsCount)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 text-xs font-black text-brand active:scale-95 transition-all"
                    >
                        <Copy className="w-4 h-4" aria-hidden="true" /> Copiar da última sessão
                    </button>
                )}
                {lastNote && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <StickyNote className="w-4 h-4 shrink-0" aria-hidden="true" /> <span><b>Última nota:</b> {lastNote}</span>
                    </p>
                )}
                <input
                    type="text" maxLength={NOTE_MAX} value={noteValue}
                    onChange={(e) => onNote(exIndex, e.target.value)}
                    placeholder="Nota do exercício (ex.: ajustar banco no 4)"
                    aria-label={`Nota para ${exName}`}
                    className="w-full rounded-xl bg-gray-100 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand"
                />
            </div>

            {/* Séries */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50 flex-1 overflow-y-auto">
                {setsArray.map((_, setIndex) => (
                    <SetRow
                        key={setIndex}
                        setIndex={setIndex}
                        data={sessionData[`${exIndex}-${setIndex}`] || {}}
                        weightPlaceholder={lastLoad}
                        repsPlaceholder={repsPlaceholder}
                        isFocusMode={isFocusMode}
                        isPR={!!sessionData[`${exIndex}-${setIndex}`]?.completed && isPRSet(sessionData[`${exIndex}-${setIndex}`]?.weight, lastLoad)}
                        onAdjust={(sIdx, field, delta) => onAdjust(exIndex, sIdx, field, delta, field === 'weight' ? lastLoad : targetRepsNum)}
                        onInput={(sIdx, field, value) => onInput(exIndex, sIdx, field, value)}
                        onCheck={checkSet}
                    />
                ))}
            </div>

            {/* BARRA DE AÇÃO RÁPIDA 1-TOQUE (ERGONOMIA DE MÃO ÚNICA) */}
            {isFocusMode && createPortal(
                <div className="fixed inset-x-0 z-[60] px-4 pointer-events-none" style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}>
                  <div className="pointer-events-auto mx-auto max-w-2xl rounded-3xl bg-white/90 dark:bg-gray-900/90 p-2 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-xl animate-slide-up">
                    {allDone ? (
                        <button
                            onClick={() => (isLastExercise ? onFinish() : onNextExercise())}
                            className="w-full btn-primary-gradient pressable min-h-[60px] text-base font-black rounded-2xl shadow-xl"
                        >
                            {!isLastExercise ? (
                                <>PRÓXIMO EXERCÍCIO <ArrowRight className="w-5 h-5" /></>
                            ) : (
                                <>FINALIZAR TREINO <Trophy className="w-5 h-5 text-black" /></>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (nextUndoneIndex !== -1) checkSet(nextUndoneIndex);
                            }}
                            className="w-full bg-gradient-to-r from-brand to-[#FF9800] text-black min-h-[60px] text-base font-black rounded-2xl shadow-lg shadow-brand/30 flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
                        >
                            <Check className="w-5 h-5" /> CONCLUIR SÉRIE #{nextUndoneIndex + 1} & DESCANSAR
                        </button>
                    )}
                  </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ExecutionExerciseCard;
