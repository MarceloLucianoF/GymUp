import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, Clock, Scale, Dumbbell, ClipboardList, StickyNote, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { db } from '../../firebase/config';
import { getCoachNote, saveCoachNote } from '../../services/coachNotes';
import { useAuthContext } from '../../hooks/AuthContext';
import { formatDate, formatTonnage } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import Reveal from '../../components/ui/Reveal';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/coach/Avatar';
import BarChart from '../../components/coach/BarChart';
import LineChart from '../../components/coach/LineChart';
import StatusBadge from '../../components/coach/StatusBadge';
import Tabs from '../../components/coach/Tabs';
import AssignTrainingModal from '../../components/coach/AssignTrainingModal';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { chatState, studentStatus, timeAgo, startOfDay, toDate, DAY_MS } from '../../components/coach/helpers';
import { btnPrimary, btnGhost, inputCls, labelCls, pageCls } from '../../components/coach/styles';

const TABS = [
  { id: 'summary', label: 'Resumo' },
  { id: 'workouts', label: 'Treinos' },
  { id: 'progress', label: 'Evolução' },
  { id: 'notes', label: 'Notas' }
];

// Treinos por semana (últimas `weeks` semanas, mais antiga primeiro).
const weeklyFrequency = (checkIns, weeks = 8) => {
  const today = startOfDay();
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = new Date(today.getTime() - (weeks - 1 - i) * 7 * DAY_MS);
    return { end, label: end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: 0 };
  });
  checkIns.forEach((c) => {
    const d = toDate(c.date);
    if (!d) return;
    const weeksAgo = Math.floor((today.getTime() + DAY_MS - 1 - d.getTime()) / (7 * DAY_MS));
    const idx = weeks - 1 - weeksAgo;
    if (idx >= 0 && idx < weeks) buckets[idx].value += 1;
  });
  return buckets;
};


function Delta({ value, unit = 'kg' }) {
  if (value === null) return <span className="text-gray-400">-</span>;
  const Icon = value < 0 ? TrendingDown : value > 0 ? TrendingUp : Minus;
  const color = value === 0 ? 'text-gray-500' : value < 0 ? 'text-emerald-500' : 'text-amber-500';
  return <span className={`inline-flex items-center gap-1 font-bold ${color}`}><Icon className="h-4 w-4" aria-hidden="true" />{value > 0 ? '+' : ''}{value.toFixed(1)}{unit}</span>;
}

export default function StudentDetailsPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [student, setStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('summary');
  const [assigning, setAssigning] = useState(false);
  const [note, setNote] = useState('');

  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError(false);
      try {
        const userDoc = await getDoc(doc(db, 'users', studentId));
        if (!userDoc.exists()) {
          toast.error('Aluno não encontrado');
          navigate('/coach/students');
          return;
        }
        const [historySnap, measSnap, trainingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'checkIns'), where('userId', '==', studentId), orderBy('date', 'desc'), limit(60))),
          getDocs(query(collection(db, 'measurements'), where('userId', '==', studentId), orderBy('date', 'asc'))),
          getDocs(query(collection(db, 'trainings'), where('coachId', '==', uid)))
        ]);
        if (cancelled) return;
        setStudent({ id: userDoc.id, ...userDoc.data() });
        setHistory(historySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMeasurements(measSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTrainings(trainingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name))));
        try {
          const savedNote = await getCoachNote(uid, studentId);
          if (!cancelled) setNote(savedNote);
        } catch (noteError) {
          console.warn('Notas indisponíveis:', noteError?.code || noteError);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(true);
          toast.error('Erro ao carregar detalhes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (uid) load();
    return () => { cancelled = true; };
  }, [studentId, uid, navigate, reloadKey]);

  const saveNote = useCallback(async () => {
    try {
      await saveCoachNote(uid, studentId, note);
      toast.success('Nota salva.');
    } catch (e) {
      toast.error('Não foi possível salvar a nota.');
    }
  }, [uid, studentId, note]);

  const derived = useMemo(() => {
    const now = new Date();
    const last30 = history.filter((c) => now - new Date(c.date) <= 30 * DAY_MS);
    const volumes = history.filter((c) => c.totalVolume > 0);
    const avgVolume = volumes.length ? volumes.reduce((a, c) => a + c.totalVolume, 0) / volumes.length : 0;
    const lastWorkout = history[0]?.date || student?.lastWorkoutDate || null;
    const volumeSeries = history.slice(0, 10).reverse().map((c) => ({
      label: String(toDate(c.date)?.getDate() ?? ''), hint: formatDate(c.date), value: c.totalVolume || 0
    }));
    const weights = measurements.filter((m) => Number.isFinite(Number(m.weight)));
    const first = weights[0];
    const latest = weights[weights.length - 1];
    return {
      workouts30: last30.length,
      avgVolume,
      lastWorkout,
      status: studentStatus(lastWorkout, now),
      frequency: weeklyFrequency(history),
      volumeSeries,
      weightSeries: weights.map((m) => ({ label: formatDate(m.date, { day: '2-digit', month: '2-digit' }), value: Number(m.weight) })),
      firstWeight: first ? Number(first.weight) : null,
      latestWeight: latest ? Number(latest.weight) : null,
      photos: measurements.filter((m) => m.photo).slice(-4).reverse()
    };
  }, [history, measurements, student]);

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-5xl"><PageSkeleton cards={4} /></div></div>;
  if (error) return <div className={pageCls}><ErrorState onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} /></div>;

  const currentTraining = trainings.find((t) => t.id === student.currentTrainingId);
  const weightDelta = derived.firstWeight !== null && derived.latestWeight !== null ? derived.latestWeight - derived.firstWeight : null;
  const currentWeight = derived.latestWeight ?? (Number(student.weight) || null);

  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-5xl space-y-5">
        <button type="button" onClick={() => navigate('/coach/students')} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Alunos
        </button>

        <header className="surface aurora-bg animate-fade-up overflow-hidden p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Avatar name={student.displayName} src={student.photoURL} size="xl" />
              <div className="min-w-0">
                <h1 className="truncate font-display text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">{student.displayName || 'Aluno'}</h1>
                <p className="truncate text-sm text-gray-500">{student.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={derived.status} />
                  {student.goal && <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-brand">{student.goal}</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={() => navigate('/coach/chat', { state: chatState({ ...student, uid: student.id }) })} className={btnPrimary}><MessageSquare className="h-4 w-4" /> Mensagem</button>
              <button type="button" onClick={() => setAssigning(true)} className={btnGhost}><ClipboardList className="h-4 w-4" /> Ficha</button>
            </div>
          </div>
        </header>

        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'summary' && (
          <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={Dumbbell} label="Treinos em 30 dias" value={derived.workouts30} accent="brand" />
              <StatCard icon={Scale} label="Volume médio (t)" value={derived.avgVolume / 1000} decimals={1} accent="blue" />
              <StatCard icon={Scale} label="Peso atual (kg)" value={currentWeight ?? '--'} decimals={1} accent="green" />
              <StatCard icon={Clock} label="Último treino" value={derived.lastWorkout ? timeAgo(derived.lastWorkout) : 'Nunca'} accent="red" />
            </div>
            <section className="surface flex items-center gap-3 p-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand"><ClipboardList className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ficha atual</p>
                <p className="truncate font-bold text-gray-900 dark:text-white">{student.currentTrainingId ? (currentTraining?.name || 'Ficha de outro autor') : 'Sem ficha ativa'}</p>
              </div>
              <button type="button" onClick={() => setAssigning(true)} className={btnGhost}>{student.currentTrainingId ? 'Trocar' : 'Atribuir'}</button>
            </section>
            <div className="grid gap-5 lg:grid-cols-2">
              <Reveal>
                <section className="surface h-full p-5">
                  <h2 className="mb-4 font-display text-base font-black text-gray-900 dark:text-white">Frequência semanal</h2>
                  <BarChart data={derived.frequency} ariaLabel="Treinos por semana" />
                </section>
              </Reveal>
              <Reveal delay={80}>
                <section className="surface h-full p-5">
                  <h2 className="mb-4 font-display text-base font-black text-gray-900 dark:text-white">Volume por treino</h2>
                  {derived.volumeSeries.length === 0 ? <EmptyState title="Sem dados de volume" /> : (
                    <BarChart data={derived.volumeSeries} formatValue={(v) => formatTonnage(v)} ariaLabel="Volume dos últimos treinos" />
                  )}
                </section>
              </Reveal>
            </div>
          </div>
        )}

        {tab === 'workouts' && (
          <section role="tabpanel" id="panel-workouts" aria-labelledby="tab-workouts" className="surface p-5">
            <h2 className="mb-4 font-display text-base font-black text-gray-900 dark:text-white">Linha do tempo</h2>
            {history.length === 0 ? <EmptyState icon={Dumbbell} title="Nenhum treino registrado." /> : (
              <ol className="relative space-y-1 border-l-2 border-brand/30 pl-5">
                {history.map((item, i) => (
                  <li key={item.id} className="relative animate-fade-up pb-4" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand dark:border-gray-900" aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-bold text-gray-900 dark:text-white">{item.trainingName || 'Treino'}</h3>
                      <span className="text-xs text-gray-400">{formatDate(item.date)} · {timeAgo(item.date)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{Math.floor((item.duration || 0) / 60)} min</span>
                      <span className="inline-flex items-center gap-1"><Scale className="h-3 w-3" aria-hidden="true" />{formatTonnage(item.totalVolume)}</span>
                      {Array.isArray(item.exercises) && <span className="inline-flex items-center gap-1"><Dumbbell className="h-3 w-3" aria-hidden="true" />{item.exercises.length} exercícios</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {tab === 'progress' && (
          <div role="tabpanel" id="panel-progress" aria-labelledby="tab-progress" className="space-y-5">
            <section className="surface p-5">
              <h2 className="mb-4 font-display text-base font-black text-gray-900 dark:text-white">Peso corporal</h2>
              {derived.weightSeries.length === 0 ? (
                <EmptyState icon={Scale} title="Sem medidas registradas." description="O aluno registra o peso na tela de medidas." />
              ) : (
                <>
                  {derived.weightSeries.length >= 2 && <LineChart data={derived.weightSeries} unit="kg" ariaLabel="Evolução do peso" />}
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5"><dt className="text-[11px] font-bold uppercase text-gray-500">Inicial</dt><dd className="font-display text-lg font-black text-gray-900 dark:text-white">{derived.firstWeight?.toFixed(1)} kg</dd></div>
                    <div className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5"><dt className="text-[11px] font-bold uppercase text-gray-500">Atual</dt><dd className="font-display text-lg font-black text-gray-900 dark:text-white">{derived.latestWeight?.toFixed(1)} kg</dd></div>
                    <div className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5"><dt className="text-[11px] font-bold uppercase text-gray-500">Variação</dt><dd className="font-display text-lg"><Delta value={weightDelta} /></dd></div>
                  </dl>
                </>
              )}
            </section>
            {derived.photos.length > 0 && (
              <section className="surface p-5">
                <h2 className="mb-4 font-display text-base font-black text-gray-900 dark:text-white">Fotos de progresso</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {derived.photos.map((m) => (
                    <figure key={m.id}>
                      <img src={m.photo} alt={`Progresso em ${formatDate(m.date)}`} loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
                      <figcaption className="mt-1 text-center text-[11px] text-gray-500">{formatDate(m.date)}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <section role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" className="surface space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white"><StickyNote className="h-5 w-5 text-brand" /> Notas privadas</h2>
            <p className="text-xs text-gray-500">Visíveis apenas para você: o aluno não tem acesso a estas notas.</p>
            <label htmlFor="coach-note" className={labelCls}>Observações sobre {student.displayName || 'o aluno'}</label>
            <textarea id="coach-note" rows={6} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} py-3`} placeholder="Lesões, preferências, combinados..." />
            <button type="button" onClick={saveNote} className={btnPrimary}>Salvar nota</button>
          </section>
        )}
      </div>

      {assigning && (
        <AssignTrainingModal student={student} trainings={trainings} onClose={() => setAssigning(false)}
          onAssigned={(trainingId) => setStudent((s) => ({ ...s, currentTrainingId: trainingId }))}
          onCreateTraining={() => navigate('/admin/trainings')} />
      )}
    </div>
  );
}
