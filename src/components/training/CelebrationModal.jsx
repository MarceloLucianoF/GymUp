import React from 'react';
import toast from 'react-hot-toast';
import { Trophy, Share2, RotateCcw, Sparkles, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { buildShareText } from '../../utils/training';
import { TREND_LABEL } from '../../utils/sessionSummary';
import { fmtKg } from '../../utils/progression';

const TREND_STYLE = {
    load: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    reps: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    same: 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300',
    down: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
    new: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200'
};
const TrendIcon = ({ trend }) => (trend === 'load' || trend === 'reps' ? <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /> : trend === 'down' ? <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" /> : <Minus className="w-3.5 h-3.5" aria-hidden="true" />);

// Tela de treino concluído (sem fechar por clique fora: o treino já foi salvo).
const CelebrationModal = ({ stats, summary, onFinish, onRepeat }) => {
    const facts = summary?.facts;
    const handleShare = async () => {
        const text = buildShareText(stats);
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Treino concluído', text });
                return;
            }
            await navigator.clipboard.writeText(text);
            toast.success('Resumo copiado!');
        } catch (e) {
            if (e?.name === 'AbortError') return;
            try {
                await navigator.clipboard.writeText(text);
                toast.success('Resumo copiado!');
            } catch (err) {
                toast.error('Não foi possível compartilhar.');
            }
        }
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Treino concluído" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#1F2937] border border-brand/30 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[94vh] overflow-y-auto shadow-2xl text-center relative animate-scale-in">
                <div className="w-20 h-20 bg-gradient-to-br from-brand to-[#FF9800] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand/20">
                    <Trophy className="w-10 h-10 text-black fill-current animate-bounce" />
                </div>

                <span className="bg-brand/10 text-amber-800 dark:text-brand text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-brand/20 inline-block mb-2">
                    Sensacional!
                </span>

                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">TREINO CONCLUÍDO!</h2>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-6">Excelente trabalho! Mais um passo em direção ao seu objetivo.</p>

                {stats.newPRs && stats.newPRs.length > 0 && (
                    <div className="mb-6 p-3.5 bg-brand/10 border border-brand/30 rounded-2xl text-left">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-brand uppercase tracking-wider mb-1">
                            <Trophy className="w-4 h-4 fill-current" /> Novo Recorde Pessoal!
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300">
                            Superou sua marca anterior em <span className="font-bold text-gray-900 dark:text-white">{stats.newPRs.join(', ')}</span>!
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">Tempo Total</p>
                        <p className="text-xl font-black text-amber-800 dark:text-brand font-mono mt-0.5">{stats.timeStr}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">Volume Total</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white font-mono mt-0.5">{stats.volumeKg}kg</p>
                        {facts && facts.volumePct !== null && facts.volumePct !== 0 && (
                            <p className={`text-[11px] font-bold mt-0.5 ${facts.volumePct > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>{facts.volumePct > 0 ? '+' : ''}{facts.volumePct}% que da última vez</p>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">Séries Concluídas</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white font-mono mt-0.5">{stats.completedSetsCount}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">Exercícios</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white font-mono mt-0.5">{stats.executedExercisesCount}</p>
                    </div>
                </div>

                {summary && (
                    <section aria-label="Resumo do treino" className="mb-6 space-y-4 text-left">
                        <div className="rounded-2xl bg-brand/10 p-4">
                            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-brand"><Sparkles className="h-4 w-4" aria-hidden="true" /> Resumo do treino{summary.source === 'ai' ? ' (IA)' : ''}</p>
                            <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100" aria-live="polite">{summary.text}</p>
                            {summary.loading && <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">Pedindo um texto mais natural à IA...</p>}
                        </div>
                        {facts && facts.exercises.length > 0 && (
                            <div>
                                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300">Como foi cada exercício</h3>
                                <ul className="space-y-1.5">
                                    {facts.exercises.map((e) => (
                                        <li key={e.name} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/80">
                                            <span className="min-w-0"><span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{e.name}</span>{e.top && <span className="text-xs text-gray-600 dark:text-gray-300">Melhor série: {fmtKg(e.top.weight)} kg × {e.top.reps}</span>}</span>
                                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${TREND_STYLE[e.trend]}`}><TrendIcon trend={e.trend} />{e.trend === 'load' && e.delta ? `+${fmtKg(e.delta)} kg` : e.trend === 'reps' && e.delta ? `+${e.delta} rep${e.delta === 1 ? '' : 's'}` : TREND_LABEL[e.trend]}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {facts && facts.next.length > 0 && (
                            <div>
                                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300">Para o próximo treino</h3>
                                <ul className="space-y-1.5">
                                    {facts.next.map((n) => (
                                        <li key={n.name} className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800/80 dark:text-gray-100"><b>{n.name}</b>: {fmtKg(n.load)} kg por {n.reps} repetições{n.kind === 'increase' ? ' (carga maior)' : ''}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button type="button" onClick={handleShare} className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border border-brand/40 text-amber-800 dark:text-brand text-sm font-black active:scale-95 transition-all">
                        <Share2 className="w-4 h-4" aria-hidden="true" /> Compartilhar
                    </button>
                    {onRepeat && (
                        <button type="button" onClick={onRepeat} className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border border-brand/40 text-amber-800 dark:text-brand text-sm font-black active:scale-95 transition-all">
                            <RotateCcw className="w-4 h-4" aria-hidden="true" /> Treinar de novo
                        </button>
                    )}
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
