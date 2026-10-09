import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, ChevronUp, ChevronDown, Trash2, Search, Dumbbell, Layers, Repeat, Timer, X } from 'lucide-react';
import { db } from '../../firebase/config';
import Modal from '../../components/common/Modal';
import { useConfirm } from '../../hooks/useConfirm';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { estimateWorkout } from '../../components/coach/helpers';
import { btnPrimary, btnGhost, iconBtn, inputCls, labelCls, pageCls } from '../../components/coach/styles';

const LEVELS = ['Iniciante', 'Intermediário', 'Avançado', 'Elite'];
const norm = (s) => String(s || '').trim().toLowerCase();
const cap = (s) => { const t = String(s || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) : 'Outros'; };
let keySeed = 0;
const nextKey = () => `k${Date.now()}-${keySeed++}`;

// Formato único das fichas: sets/reps em texto, rest em segundos (o mesmo que o app do aluno lê).
const normalizeExercise = (raw, library) => {
  const lib = typeof raw === 'string' ? library.find((l) => l.id === raw) : library.find((l) => l.id === (raw?.firestoreId || raw?.exerciseId || raw?.id));
  const base = typeof raw === 'object' && raw ? raw : {};
  const sets = Array.isArray(base.sets) ? base.sets.length : (base.sets ?? lib?.sets ?? 3);
  const reps = Array.isArray(base.sets) ? (base.sets[0]?.reps ?? 10) : (base.reps ?? lib?.reps ?? 10);
  const out = {
    ...base,
    _key: nextKey(),
    firestoreId: base.firestoreId || base.exerciseId || lib?.id || (typeof raw === 'string' ? raw : base.id) || null,
    name: base.name || lib?.name || 'Exercício removido',
    muscleGroup: base.muscleGroup || lib?.muscleGroup || '',
    machineImage: base.machineImage || base.demoUrl || lib?.machineImage || lib?.demoUrl || null,
    sets: String(sets || 3),
    reps: String(reps || 10),
    rest: Number(base.rest ?? lib?.rest) || 60
  };
  delete out.exerciseId;
  delete out.demoUrl;
  delete out.id;
  return out;
};

const fromLibrary = (lib) => normalizeExercise({
  firestoreId: lib.id, name: lib.name, muscleGroup: lib.muscleGroup, machineImage: lib.machineImage || lib.demoUrl || null,
  videoUrl: lib.videoUrl || null, execution: lib.execution || '', description: lib.description || ''
}, [lib]);

// Remove campos auxiliares/undefined antes de gravar.
const serializeExercise = ({ _key, ...ex }) => Object.fromEntries(Object.entries(ex).filter(([, v]) => v !== undefined));

function AddExerciseModal({ library, onAdd, onClose, onGoLibrary }) {
  const [term, setTerm] = useState('');
  const [group, setGroup] = useState('all');
  const groups = useMemo(() => [...new Map(library.filter((l) => l.muscleGroup).map((l) => [norm(l.muscleGroup), cap(l.muscleGroup)]))], [library]);
  const list = library.filter((l) => (group === 'all' || norm(l.muscleGroup) === group) && (!term || norm(l.name).includes(norm(term))));
  return (
    <Modal onClose={onClose} label="Adicionar exercício" className="w-full max-w-2xl">
      <div className="surface flex h-[85vh] flex-col overflow-hidden bg-white dark:bg-gray-900 animate-scale-in">
        <div className="space-y-3 border-b border-gray-100 p-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Adicionar exercício</h2>
            <button type="button" aria-label="Fechar" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" autoFocus aria-label="Buscar exercício" placeholder="Buscar (ex: supino)" value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputCls} pl-11`} />
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Grupo muscular">
            {[['all', 'Todos'], ...groups].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={group === k} onClick={() => setGroup(k)} className={`pressable min-h-[44px] shrink-0 rounded-2xl px-4 text-sm font-bold ${group === k ? 'bg-brand text-black' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {library.length === 0 ? (
            <EmptyState icon={Dumbbell} title="Biblioteca vazia." action={<button type="button" onClick={onGoLibrary} className={btnPrimary}>Cadastrar exercícios</button>} />
          ) : list.length === 0 ? (
            <EmptyState title="Nenhum exercício encontrado." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((lib) => (
                <li key={lib.id}>
                  <button type="button" onClick={() => onAdd(lib)} className="pressable flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-gray-200 p-2 text-left transition hover:border-brand dark:border-white/10">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                      {(lib.machineImage || lib.demoUrl) ? <img src={lib.machineImage || lib.demoUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Dumbbell className="h-5 w-5 text-gray-400" />}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{lib.name}</span><span className="text-xs text-gray-500">{cap(lib.muscleGroup)}</span></span>
                    <Plus className="h-5 w-5 text-brand" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function WorkoutEditor() {
  const { trainingId } = useParams();
  const navigate = useNavigate();

  const [training, setTraining] = useState(null);
  const [library, setLibrary] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setError(false);
      try {
        const [snap, libSnap] = await Promise.all([
          getDoc(doc(db, 'trainings', trainingId)),
          getDocs(query(collection(db, 'exercises'), orderBy('name')))
        ]);
        if (cancelled) return;
        if (!snap.exists()) {
          toast.error('Treino não encontrado');
          navigate('/admin/trainings');
          return;
        }
        const lib = libSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const data = snap.data();
        setLibrary(lib);
        setTraining({
          id: snap.id,
          name: data.name || '',
          description: data.description || '',
          difficulty: data.difficulty || 'Iniciante',
          exercises: (data.exercises || []).map((ex) => normalizeExercise(ex, lib))
        });
        setDirty(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [trainingId, navigate, reloadKey]);

  // Aviso ao fechar a aba com alterações pendentes
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((patch) => { setTraining((prev) => ({ ...prev, ...patch })); setDirty(true); }, []);
  const updateExercise = (index, field, value) => update({ exercises: training.exercises.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)) });
  const removeExercise = (index) => update({ exercises: training.exercises.filter((_, i) => i !== index) });
  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= training.exercises.length) return;
    const next = [...training.exercises];
    [next[index], next[target]] = [next[target], next[index]];
    update({ exercises: next });
  };
  const addExercise = (lib) => {
    update({ exercises: [...training.exercises, fromLibrary(lib)] });
    toast.success(`${lib.name} adicionado`);
  };

  const summary = useMemo(() => {
    const exs = training?.exercises || [];
    const est = estimateWorkout(exs);
    const groups = {};
    exs.forEach((e) => { const g = cap(e.muscleGroup); groups[g] = (groups[g] || 0) + (Number(e.sets) || 0); });
    return { ...est, groups: Object.entries(groups).sort((a, b) => b[1] - a[1]) };
  }, [training]);

  const saveAll = async () => {
    if (!training.name.trim()) return toast.error('Dê um nome para a ficha.');
    setSaving(true);
    const toastId = toast.loading('Salvando ficha...');
    try {
      await updateDoc(doc(db, 'trainings', trainingId), {
        name: training.name.trim(),
        description: training.description,
        difficulty: training.difficulty,
        exercises: training.exercises.map(serializeExercise),
        updatedAt: serverTimestamp()
      });
      setDirty(false);
      toast.success('Ficha salva!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar. Verifique se a ficha é sua.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const goBack = async () => {
    if (dirty && !(await confirm({ title: 'Sair sem salvar?', message: 'Há alterações não salvas nesta ficha.', confirmLabel: 'Sair', danger: true }))) return;
    navigate('/admin/trainings');
  };

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-4xl"><PageSkeleton cards={3} /></div></div>;
  if (error || !training) return <div className={pageCls}><ErrorState onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} /></div>;

  return (
    <div className={`${pageCls} !pt-0`}>
      {dialog}
      <header className="sticky top-0 z-30 -mx-4 mb-5 flex items-center gap-2 border-b border-gray-200/70 bg-gray-50/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/90 sm:-mx-6 sm:px-6 md:-mx-8 md:top-20 md:px-8">
        <button type="button" aria-label="Voltar às fichas" onClick={goBack} className={iconBtn}><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Editor de ficha</p>
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{training.name || 'Sem nome'}{dirty && <span className="ml-2 text-xs font-medium text-amber-500">● não salvo</span>}</p>
        </div>
        <button type="button" onClick={saveAll} disabled={saving || !dirty} className={btnPrimary}><Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}</button>
      </header>

      <div className="mx-auto max-w-4xl space-y-5">
        <section className="surface animate-fade-up space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            <div>
              <label htmlFor="we-name" className={labelCls}>Nome da ficha</label>
              <input id="we-name" value={training.name} onChange={(e) => update({ name: e.target.value })} className={`${inputCls} font-display text-lg font-black`} placeholder="Ex: Hipertrofia A" />
            </div>
            <div>
              <label htmlFor="we-level" className={labelCls}>Nível</label>
              <select id="we-level" value={training.difficulty} onChange={(e) => update({ difficulty: e.target.value })} className={`${inputCls} cursor-pointer`}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="we-desc" className={labelCls}>Instruções</label>
            <textarea id="we-desc" rows={3} value={training.description} onChange={(e) => update({ description: e.target.value })} className={`${inputCls} resize-none py-3`} placeholder="Ex: Descanso de 60s entre séries, foco na execução..." />
          </div>
        </section>

        <section className="surface animate-fade-up p-5" style={{ animationDelay: '60ms' }} aria-label="Volume estimado">
          <h2 className="mb-3 font-display text-base font-black text-gray-900 dark:text-white">Volume estimado</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Dumbbell, label: 'Exercícios', value: training.exercises.length },
              { icon: Layers, label: 'Séries', value: summary.sets },
              { icon: Repeat, label: 'Repetições', value: summary.reps },
              { icon: Timer, label: 'Minutos (aprox.)', value: summary.minutes }
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5">
                <Icon className="mb-1 h-4 w-4 text-brand" aria-hidden="true" />
                <p className="font-display text-2xl font-black text-gray-900 dark:text-white"><AnimatedNumber value={value} duration={600} /></p>
                <p className="text-[11px] font-medium uppercase text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          {summary.groups.length > 0 && (
            <div className="mt-4 space-y-2">
              {summary.groups.map(([g, count]) => (
                <div key={g} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 truncate font-bold text-gray-600 dark:text-gray-300">{g}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-brand to-orange-500 transition-all duration-700" style={{ width: `${Math.min(100, (count / (summary.sets || 1)) * 100)}%` }} /></span>
                  <span className="w-12 shrink-0 text-right text-gray-500">{count} sér.</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-gray-400">Estimativa por séries x repetições e descanso; a carga real é registrada pelo aluno.</p>
        </section>

        <section aria-label="Exercícios da ficha" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Rotina ({training.exercises.length})</h2>
            <button type="button" onClick={() => setShowAdd(true)} className={btnGhost}><Plus className="h-4 w-4" /> Adicionar</button>
          </div>

          {training.exercises.length === 0 ? (
            <div className="surface"><EmptyState icon={Dumbbell} title="A ficha está vazia." description="Adicione exercícios da biblioteca." action={<button type="button" onClick={() => setShowAdd(true)} className={btnPrimary}>Adicionar exercício</button>} /></div>
          ) : (
            <ol className="space-y-3">
              {training.exercises.map((ex, i) => (
                <li key={ex._key} className="surface animate-scale-in p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${ex.name}`} className={`${iconBtn} !h-11 !w-11`}><ChevronUp className="h-5 w-5" /></button>
                      <span className="text-xs font-black text-gray-400" aria-hidden="true">{i + 1}</span>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === training.exercises.length - 1} aria-label={`Descer ${ex.name}`} className={`${iconBtn} !h-11 !w-11`}><ChevronDown className="h-5 w-5" /></button>
                    </div>
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                      {ex.machineImage ? <img src={ex.machineImage} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Dumbbell className="h-6 w-6 text-gray-400" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-gray-900 dark:text-white">{ex.name}</h3>
                      <p className="text-xs uppercase text-gray-500">{cap(ex.muscleGroup)}</p>
                    </div>
                    <button type="button" onClick={() => removeExercise(i)} aria-label={`Remover ${ex.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-5 w-5" /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor={`sets-${ex._key}`} className={labelCls}>Séries</label>
                      <input id={`sets-${ex._key}`} inputMode="numeric" value={ex.sets} onChange={(e) => updateExercise(i, 'sets', e.target.value.replace(/\D/g, ''))} className={`${inputCls} text-center font-bold`} />
                    </div>
                    <div>
                      <label htmlFor={`reps-${ex._key}`} className={labelCls}>Reps</label>
                      <input id={`reps-${ex._key}`} value={ex.reps} onChange={(e) => updateExercise(i, 'reps', e.target.value)} className={`${inputCls} text-center font-bold`} placeholder="10 ou 8-12" />
                    </div>
                    <div>
                      <label htmlFor={`rest-${ex._key}`} className={labelCls}>Descanso (s)</label>
                      <input id={`rest-${ex._key}`} inputMode="numeric" value={ex.rest} onChange={(e) => updateExercise(i, 'rest', Number(e.target.value.replace(/\D/g, '')) || 0)} className={`${inputCls} text-center font-bold`} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {showAdd && <AddExerciseModal library={library} onAdd={addExercise} onClose={() => setShowAdd(false)} onGoLibrary={() => navigate('/admin/exercises')} />}
    </div>
  );
}
