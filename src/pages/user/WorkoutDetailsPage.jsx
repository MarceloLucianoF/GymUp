import { SET_SHORT } from '../../utils/setTypes';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthContext } from '../../hooks/AuthContext';
import { db } from '../../firebase/config';
import { Clock, Scale, CheckCircle2, Dumbbell, FileText, XCircle, ArrowLeft, Download, Trophy, RotateCcw, Trash2, LineChart } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatTonnage } from '../../utils/format';
import { fetchStudentCheckIns, invalidateCheckIns } from '../../services/checkInsCache';
import { removeCheckIn } from '../../services/checkInService';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import { trainingStillExists } from '../../services/trainingAvailability';
import { findPreviousSession, compareSessions } from '../../utils/sessionCompare';
import SessionComparison from '../../components/history/SessionComparison';
import { useConfirm } from '../../hooks/useConfirm';
import { btnPrimary, btnDanger } from '../../components/coach/styles';

import { toHealthConnectSession } from '../../utils/healthExport';
import { stillSrc } from '../../utils/exerciseMedia';
export default function WorkoutDetailsPage() {
  const { checkInId } = useParams();
  const navigate = useNavigate();
  
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();
  const [past, setPast] = useState([]); // histórico do próprio aluno
  const [repeatable, setRepeatable] = useState(null); // null = verificando; true/false = a ficha ainda existe?
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog } = useConfirm();
  const isOwner = !!(user?.uid && workout?.userId === user.uid);

  // Baixa a sessão no formato do Health Connect (arquivo local, nada vai para a nuvem).
  const exportHealth = () => {
    const session = toHealthConnectSession(workout);
    if (!session) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `treino-${session.startTime.slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setWorkout(null);
      try {
        const docRef = doc(db, 'checkIns', checkInId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setWorkout(docSnap.data());
        } else {
          console.error("Treino não encontrado");
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [checkInId]);

  // Histórico do próprio aluno (userId == uid) para comparação e recordes
  useEffect(() => {
    if (!user?.uid || !workout || workout.userId !== user.uid) return undefined;
    let cancelled = false;
    fetchStudentCheckIns(user.uid)
      .then((rows) => { if (!cancelled) setPast(rows); })
      .catch((err) => console.error('Erro ao buscar histórico para comparação:', err));
    return () => { cancelled = true; };
  }, [user?.uid, workout]);

  // "Repetir treino": só se a ficha ainda existir para este aluno
  useEffect(() => {
    if (!isOwner || !workout?.trainingId) { setRepeatable(false); return undefined; }
    let alive = true;
    setRepeatable(null);
    trainingStillExists(workout.trainingId, user.uid).then((ok) => { if (alive) setRepeatable(ok); });
    return () => { alive = false; };
  }, [isOwner, workout?.trainingId, user?.uid]);

  const comparison = useMemo(() => {
    if (!workout) return null;
    return compareSessions(workout, findPreviousSession(past, workout, checkInId));
  }, [past, workout, checkInId]);

  const handleRepeat = async () => {
    const active = activeWorkoutService.getActiveSession(user.uid);
    if (active && active.trainingId !== workout.trainingId) {
      const ok = await confirm({
        title: 'Há um treino em andamento',
        message: `Repetir este treino descarta o que está em andamento (${active.trainingName || 'outro treino'}).`,
        confirmLabel: 'Descartar e repetir',
        danger: true,
      });
      if (!ok) return;
      activeWorkoutService.clearActiveSession(user.uid);
    }
    navigate(`/execution/${workout.trainingId}`);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Excluir este treino?',
      message: 'O registro sai do histórico e da contagem da semana. Não dá para desfazer.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await removeCheckIn(db, user.uid, checkInId);
      invalidateCheckIns(user.uid);
      toast.success('Treino excluído.');
      navigate('/history', { replace: true });
    } catch (e) {
      console.error('Erro ao excluir treino:', e);
      toast.error('Não foi possível excluir. Tente de novo.');
      setDeleting(false);
    }
  };

  const summary = useMemo(() => {
    if (!workout) return null;
    const cur = new Date(workout.date).getTime();
    const before = past.filter((p) => p.id !== checkInId && new Date(p.date).getTime() < cur);
    const maxOf = (list, name) => list.reduce((m, p) => Math.max(m, ...(p.exercises || []).filter((e) => e.name === name).flatMap((e) => (e.sets || []).map((s) => Number(s.weight) || 0)), 0), 0);
    const records = (workout.exercises || []).map((ex) => {
      const now = Math.max(0, ...(ex.sets || []).map((s) => Number(s.weight) || 0));
      return { name: ex.name, weight: now, isPR: now > 0 && before.length > 0 && now > maxOf(before, ex.name) };
    });
    const best = records.reduce((b, r) => (r.weight > (b?.weight || 0) ? r : b), null);
    return { prs: records.filter((r) => r.isPR), best };
  }, [past, workout, checkInId]);

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8" role="status" aria-label="Carregando"><div className="max-w-3xl mx-auto space-y-4"><div className="skeleton-shimmer h-14 rounded-2xl"></div><div className="grid grid-cols-3 gap-3">{[0,1,2].map(i => <div key={i} className="skeleton-shimmer h-24 rounded-3xl"></div>)}</div><div className="skeleton-shimmer h-56 rounded-3xl"></div></div></div>;

  if (!workout) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] flex flex-col items-center justify-center text-gray-500">
        <p className="text-xl">Treino não encontrado.</p>
        <button onClick={() => navigate(-1)} className="mt-4 min-h-[44px] px-5 rounded-2xl btn-primary-gradient text-sm">Voltar</button>
    </div>
  );

  // Formatação
  const date = formatDate(workout.date, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const durationMinutes = Math.floor(workout.duration / 60);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] p-4 md:p-8 pb-32 transition-colors">
      {dialog}
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header com Botão Voltar */}
        <div className="flex items-center gap-4 animate-fade-up">
            <button onClick={() => navigate(-1)} aria-label="Voltar" className="pressable surface !rounded-full w-11 h-11 shrink-0 text-gray-700 dark:text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white leading-tight">{workout.trainingName}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 first-letter:uppercase">{date}</p>
            </div>
            {toHealthConnectSession(workout) && (
                <button type="button" onClick={exportHealth} aria-label="Exportar para Saúde (JSON)" className="pressable surface !rounded-full w-11 h-11 shrink-0 text-gray-700 dark:text-white flex items-center justify-center">
                    <Download className="w-5 h-5" aria-hidden="true" />
                </button>
            )}
        </div>

        {/* Resumo Geral (Stats) */}
        <div className="grid grid-cols-3 gap-3">
            <div className="surface p-4 text-center flex flex-col items-center justify-center animate-scale-in">
                <Clock className="w-6 h-6 text-brand mb-1" />
                <p className="text-[10px] uppercase font-bold text-gray-600 dark:text-gray-400">Duração</p>
                <p className="font-black text-gray-800 dark:text-white text-lg">{durationMinutes} min</p>
            </div>
            <div className="surface p-4 text-center flex flex-col items-center justify-center animate-scale-in">
                <Scale className="w-6 h-6 text-brand mb-1" />
                <p className="text-[10px] uppercase font-bold text-gray-600 dark:text-gray-400">Volume</p>
                <p className="font-black text-gray-800 dark:text-white text-lg">{formatTonnage(workout.totalVolume, ' ton')}</p>
            </div>
            <div className="surface p-4 text-center flex flex-col items-center justify-center animate-scale-in">
                <CheckCircle2 className="w-6 h-6 text-brand mb-1" />
                <p className="text-[10px] uppercase font-bold text-gray-600 dark:text-gray-400">Exercícios</p>
                <p className="font-black text-gray-800 dark:text-white text-lg">{workout.exercises?.length || 0}</p>
            </div>
        </div>

        {/* Ações da sessão */}
        {isOwner && (
          <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Ações do treino">
            {repeatable !== false && workout.trainingId && (
              <button type="button" onClick={handleRepeat} disabled={repeatable === null} className={`${btnPrimary} min-h-[52px] flex-1 text-base`}>
                <RotateCcw className="h-5 w-5" aria-hidden="true" /> {repeatable === null ? 'Verificando a ficha...' : 'Repetir treino'}
              </button>
            )}
            <button type="button" onClick={handleDelete} disabled={deleting} className={`${btnDanger} min-h-[52px] sm:w-auto`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        )}
        {isOwner && repeatable === false && workout.trainingId && (
          <p className="-mt-3 px-1 text-xs text-gray-600 dark:text-gray-400">A ficha deste treino não existe mais, então não dá para repeti-lo.</p>
        )}

        {/* Texto do resumo pós-treino (gravado no fim do treino) */}
        {typeof workout.summary?.text === 'string' && workout.summary.text.length > 0 && workout.summary.text.length <= 700 && (
          <section className="surface p-4 sm:p-5 space-y-2" aria-label="Resumo do treino">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Resumo do treino{workout.summary.source === 'ai' ? ' (IA)' : ''}</h3>
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">{workout.summary.text}</p>
          </section>
        )}

        {/* Recordes e comparação */}
        {summary && (summary.prs.length > 0 || summary.best) && (
          <section className="surface p-4 sm:p-5 space-y-3" aria-label="Recordes e comparação">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wider">Resumo</h3>
            {summary.best && (
              <p className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <Trophy className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
                Maior carga: <strong>{summary.best.weight} kg</strong> em {summary.best.name}
              </p>
            )}
            {summary.prs.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Novos recordes">
                {summary.prs.map((r) => (
                  <li key={r.name} className="rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-400 dark:text-brand">Recorde: {r.name} {r.weight} kg</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Comparação com a sessão anterior da mesma ficha */}
        <SessionComparison comparison={comparison} />

        {/* Lista de Exercícios Detalhada */}
        <div className="space-y-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 ml-1 text-sm uppercase tracking-wider">Detalhes da Sessão</h3>
            
            {workout.exercises?.map((ex, i) => (
                <div key={i} style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }} className="surface animate-fade-up p-4 sm:p-5">
                    <div className="flex items-center gap-4 mb-4 border-b border-gray-100 dark:border-white/10 pb-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                             {ex.machineImage ? (
                                <img src={stillSrc(ex.machineImage)} className="w-full h-full object-cover" alt="" loading="lazy" />
                             ) : (
                                <Dumbbell className="w-6 h-6 text-gray-600 dark:text-gray-500" />
                             )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-800 dark:text-white text-lg">{ex.name}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{ex.muscleGroup}</p>
                        </div>
                        {isOwner && ex.name && (
                            <Link to={`/analytics/${encodeURIComponent(ex.name)}`} aria-label={`Ver evolução de ${ex.name}`} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-amber-800 dark:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                                <LineChart className="h-5 w-5" aria-hidden="true" />
                            </Link>
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                        <span>Set</span>
                        <span>Carga (kg)</span>
                        <span>Reps</span>
                        <span>Status</span>
                    </div>

                    <div className="space-y-2">
                        {ex.sets?.map((set, j) => (
                            <div key={j} className="grid grid-cols-4 gap-2 text-center items-center min-h-[40px] py-2 bg-gray-50 dark:bg-white/5 rounded-xl text-sm">
                                <span className="font-mono text-gray-600 dark:text-gray-400 text-xs">{j + 1}{set.type && SET_SHORT[set.type] ? <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 font-sans text-[10px] font-black text-gray-700 dark:bg-white/10 dark:text-gray-200">{SET_SHORT[set.type]}</span> : null}</span>
                                <span className="font-black text-gray-800 dark:text-white">{set.weight || '-'}</span>
                                <span className="font-bold text-gray-600 dark:text-gray-300">{set.reps || '-'}</span>
                                <span className="flex items-center justify-center">
                                  {set.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        {/* Observações do Aluno */}
        {workout.notes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-5 rounded-2xl border border-yellow-200 dark:border-yellow-800/30 flex gap-3">
                <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-yellow-800 dark:text-yellow-500 mb-1 text-sm">Notas do Treino</h4>
                    <p className="text-sm text-yellow-900 dark:text-yellow-100/80 italic">"{workout.notes}"</p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}