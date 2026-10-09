import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Copy, Trash2, ClipboardList, Timer, Layers, ArrowLeft } from 'lucide-react';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/ui/PageHeader';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { estimateWorkout, toDate, timeAgo } from '../../components/coach/helpers';
import { btnPrimary, inputCls, pageCls } from '../../components/coach/styles';

const LEVEL_CLS = {
  Iniciante: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Intermediário: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Avançado: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  Elite: 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
};

const stamp = (t) => toDate(t.updatedAt || t.createdAt)?.getTime() || 0;

// Lista de fichas do treinador. A edição acontece no WorkoutEditor (/admin/trainings/:id).
export default function CoachTrainingsPage() {
  const { confirm, dialog } = useConfirm();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchTrainings = useCallback(async () => {
    setError(false);
    try {
      // Sem orderBy: inclui fichas antigas sem updatedAt; ordena no cliente.
      const snap = await getDocs(query(collection(db, 'trainings'), where('coachId', '==', user.uid)));
      setTrainings(snap.docs.map((d) => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => stamp(b) - stamp(a)));
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Erro ao carregar fichas.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) fetchTrainings(); }, [user, fetchTrainings]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return trainings.filter((t) => !term || `${t.name} ${t.description || ''}`.toLowerCase().includes(term));
  }, [trainings, search]);

  const create = async (base = {}) => {
    setBusy(true);
    const toastId = toast.loading(base.exercises ? 'Duplicando...' : 'Criando ficha...');
    try {
      const ref = await addDoc(collection(db, 'trainings'), {
        name: base.name ? `${base.name} (cópia)` : 'Nova ficha',
        description: base.description || '',
        difficulty: base.difficulty || 'Iniciante',
        exercises: base.exercises || [],
        coachId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success(base.exercises ? 'Ficha duplicada!' : 'Ficha criada!', { id: toastId });
      navigate(`/admin/trainings/${ref.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível criar a ficha.', { id: toastId });
      setBusy(false);
    }
  };

  const handleDelete = async (t) => {
    if (!(await confirm({ title: 'Excluir ficha', message: `Excluir "${t.name}"? Alunos que usam esta ficha ficarão sem treino atribuído.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'trainings', t.firestoreId));
      setTrainings((prev) => prev.filter((x) => x.firestoreId !== t.firestoreId));
      toast.success('Ficha removida.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover.');
    }
  };

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-6xl"><PageSkeleton cards={3} /></div></div>;
  if (error) return <div className={pageCls}><ErrorState onRetry={() => { setLoading(true); fetchTrainings(); }} /></div>;

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-6xl space-y-5">
        <button type="button" onClick={() => navigate('/coach/dashboard')} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand"><ArrowLeft className="h-4 w-4" /> Painel</button>
        <PageHeader eyebrow="Treinos" title="Minhas fichas" subtitle="Monte as fichas que seus alunos vão executar."
          actions={<button type="button" disabled={busy} onClick={() => create()} className={btnPrimary}><Plus className="h-4 w-4" /> Nova ficha</button>} />

        {trainings.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Buscar ficha" placeholder="Buscar ficha..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} pl-11`} />
          </div>
        )}

        {trainings.length === 0 ? (
          <div className="surface"><EmptyState icon={ClipboardList} title="Você ainda não criou nenhuma ficha." description="Crie a primeira e atribua aos seus alunos."
            action={<button type="button" disabled={busy} onClick={() => create()} className={btnPrimary}>Criar a primeira</button>} /></div>
        ) : visible.length === 0 ? (
          <div className="surface"><EmptyState icon={Search} title="Nenhuma ficha encontrada." /></div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((t, i) => {
              const exs = (t.exercises || []).filter((e) => e && typeof e === 'object');
              const est = estimateWorkout(exs);
              const groups = [...new Set(exs.map((e) => e.muscleGroup).filter(Boolean))].slice(0, 3);
              return (
                <li key={t.firestoreId} className="surface surface-hover animate-fade-up flex flex-col overflow-hidden" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                  <button type="button" onClick={() => navigate(`/admin/trainings/${t.firestoreId}`)} className="flex-1 p-5 text-left">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${LEVEL_CLS[t.difficulty] || 'bg-gray-500/15 text-gray-500'}`}>{t.difficulty || 'Ficha'}</span>
                      <span className="text-[11px] text-gray-400">{stamp(t) ? timeAgo(stamp(t)) : ''}</span>
                    </div>
                    <h2 className="truncate font-display text-xl font-black text-gray-900 dark:text-white">{t.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500">{t.description || 'Sem descrição.'}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-500">
                      <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />{t.exercises?.length || 0} exerc.</span>
                      {est.sets > 0 && <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" aria-hidden="true" />{est.sets} séries</span>}
                      {est.minutes > 0 && <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" aria-hidden="true" />~{est.minutes} min</span>}
                    </div>
                    {groups.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">{groups.map((g) => <span key={g} className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">{g}</span>)}</div>
                    )}
                  </button>
                  <div className="flex border-t border-gray-100 dark:border-white/10">
                    <button type="button" onClick={() => navigate(`/admin/trainings/${t.firestoreId}`)} aria-label={`Editar ${t.name}`} className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 text-xs font-bold text-gray-600 hover:bg-brand/10 dark:text-gray-300"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button type="button" disabled={busy} onClick={() => create(t)} aria-label={`Duplicar ${t.name}`} className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 border-l border-gray-100 text-xs font-bold text-gray-600 hover:bg-brand/10 disabled:opacity-50 dark:border-white/10 dark:text-gray-300"><Copy className="h-3.5 w-3.5" /> Duplicar</button>
                    <button type="button" onClick={() => handleDelete(t)} aria-label={`Excluir ${t.name}`} className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 border-l border-gray-100 text-xs font-bold text-rose-500 hover:bg-rose-500/10 dark:border-white/10"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
