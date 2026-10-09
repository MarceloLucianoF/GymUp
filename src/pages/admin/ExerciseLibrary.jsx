import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Plus, Pencil, Trash2, Dumbbell, ArrowLeft, X } from 'lucide-react';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../../components/common/Modal';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { btnPrimary, btnGhost, inputCls, labelCls, pageCls } from '../../components/coach/styles';

const BASE_GROUPS = ['Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Cardio', 'Full Body'];
const EMPTY_FORM = { name: '', muscleGroup: 'Peito', demoUrl: '', equipment: 'Máquina' };
const norm = (s) => String(s || '').trim().toLowerCase();
const cap = (s) => { const t = String(s || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) : 'Outros'; };

export default function ExerciseLibrary() {
  const { confirm, dialog } = useConfirm();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [group, setGroup] = useState('all');
  const [form, setForm] = useState(null); // null = fechado; { id?, ...campos }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchExercises = async () => {
      setError(false);
      try {
        const snap = await getDocs(query(collection(db, 'exercises'), orderBy('name')));
        if (!cancelled) setExercises(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
        if (!cancelled) { setError(true); toast.error('Erro ao carregar biblioteca.'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchExercises();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const groups = useMemo(() => {
    const seen = new Map(BASE_GROUPS.map((g) => [norm(g), g]));
    exercises.forEach((e) => { if (e.muscleGroup && !seen.has(norm(e.muscleGroup))) seen.set(norm(e.muscleGroup), cap(e.muscleGroup)); });
    const present = new Set(exercises.map((e) => norm(e.muscleGroup)));
    return { all: [...seen.entries()], filters: [...seen.entries()].filter(([k]) => present.has(k)) };
  }, [exercises]);

  const filtered = useMemo(() => {
    const term = norm(searchTerm);
    return exercises.filter((ex) => (group === 'all' || norm(ex.muscleGroup) === group)
      && (!term || norm(ex.name).includes(term) || norm(ex.muscleGroup).includes(term) || norm(ex.equipment).includes(term)));
  }, [exercises, searchTerm, group]);

  const openEdit = (ex) => setForm({ id: ex.id, name: ex.name || '', muscleGroup: ex.muscleGroup || 'Peito', demoUrl: ex.demoUrl || ex.machineImage || '', equipment: ex.equipment || '' });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Nome é obrigatório');
    setSaving(true);
    const toastId = toast.loading('Salvando...');
    const fields = { name: form.name.trim(), muscleGroup: form.muscleGroup, equipment: form.equipment.trim(), demoUrl: form.demoUrl.trim(), machineImage: form.demoUrl.trim() };
    try {
      if (form.id) {
        await updateDoc(doc(db, 'exercises', form.id), { ...fields, updatedAt: serverTimestamp() });
        setExercises((prev) => prev.map((x) => (x.id === form.id ? { ...x, ...fields } : x)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')));
        toast.success('Exercício atualizado!', { id: toastId });
      } else {
        const data = { ...fields, createdBy: user.uid, createdAt: serverTimestamp() };
        const ref = await addDoc(collection(db, 'exercises'), data);
        setExercises((prev) => [...prev, { id: ref.id, ...fields }].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')));
        toast.success('Exercício criado!', { id: toastId });
      }
      setForm(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex) => {
    if (!(await confirm({ title: 'Excluir exercício', message: `Excluir "${ex.name}"? Isso pode afetar fichas existentes.`, confirmLabel: 'Excluir', danger: true }))) return;
    try {
      await deleteDoc(doc(db, 'exercises', ex.id));
      setExercises((prev) => prev.filter((x) => x.id !== ex.id));
      toast.success('Exercício removido.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover.');
    }
  };

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-6xl"><PageSkeleton cards={3} /></div></div>;
  if (error) return <div className={pageCls}><ErrorState onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} /></div>;

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-6xl space-y-5">
        <button type="button" onClick={() => navigate('/coach/dashboard')} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-gray-500 hover:text-brand"><ArrowLeft className="h-4 w-4" /> Painel</button>
        <PageHeader eyebrow="Biblioteca" title="Exercícios" subtitle={`${exercises.length} movimentos disponíveis para suas fichas`}
          actions={<button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className={btnPrimary}><Plus className="h-4 w-4" /> Novo</button>} />

        <div className="surface space-y-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Buscar exercício" placeholder="Buscar por nome, grupo ou equipamento" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${inputCls} pl-11`} />
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filtrar por grupo muscular">
            {[['all', 'Todos'], ...groups.filters].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(key)}
                className={`pressable min-h-[44px] shrink-0 rounded-2xl px-4 text-sm font-bold transition ${group === key ? 'bg-brand text-black' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>{label}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="surface"><EmptyState icon={Dumbbell} title="Nenhum exercício encontrado." description={searchTerm || group !== 'all' ? 'Tente outro termo ou grupo.' : 'Cadastre o primeiro exercício da biblioteca.'}
            action={exercises.length === 0 && <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className={btnPrimary}>Novo exercício</button>} /></div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((ex, i) => (
              <li key={ex.id} className="surface surface-hover animate-fade-up flex flex-col overflow-hidden" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                <div className="flex items-center gap-3 p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                    {(ex.demoUrl || ex.machineImage) ? <img src={ex.demoUrl || ex.machineImage} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Dumbbell className="h-7 w-7 text-gray-400" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-gray-900 dark:text-white">{ex.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-brand">{cap(ex.muscleGroup)}</span>
                      {ex.equipment && <span className="text-[11px] text-gray-500">{ex.equipment}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex border-t border-gray-100 dark:border-white/10">
                  <button type="button" onClick={() => openEdit(ex)} aria-label={`Editar ${ex.name}`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 text-xs font-bold text-gray-600 hover:bg-brand/10 dark:text-gray-300"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                  <button type="button" onClick={() => handleDelete(ex)} aria-label={`Excluir ${ex.name}`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border-l border-gray-100 text-xs font-bold text-rose-500 hover:bg-rose-500/10 dark:border-white/10"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && (
        <Modal onClose={() => setForm(null)} label={form.id ? 'Editar exercício' : 'Novo exercício'} className="w-full max-w-lg">
          <form onSubmit={handleSave} className="surface max-h-[90vh] space-y-4 overflow-y-auto bg-white p-5 dark:bg-gray-900 animate-scale-in sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-black text-gray-900 dark:text-white">{form.id ? 'Editar exercício' : 'Novo exercício'}</h2>
              <button type="button" aria-label="Fechar" onClick={() => setForm(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label htmlFor="ex-name" className={labelCls}>Nome</label>
              <input id="ex-name" required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Supino inclinado" className={inputCls} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ex-group" className={labelCls}>Grupo muscular</label>
                <select id="ex-group" value={form.muscleGroup} onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })} className={`${inputCls} cursor-pointer`}>
                  {[...new Set([...BASE_GROUPS, ...groups.all.map(([, l]) => l), form.muscleGroup])].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ex-eq" className={labelCls}>Equipamento</label>
                <input id="ex-eq" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="Ex: Halteres" className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="ex-url" className={labelCls}>URL da imagem / GIF (opcional)</label>
              <input id="ex-url" type="url" inputMode="url" value={form.demoUrl} onChange={(e) => setForm({ ...form, demoUrl: e.target.value })} placeholder="https://..." className={inputCls} />
              {form.demoUrl && <img src={form.demoUrl} alt="Pré-visualização" className="mt-3 h-32 w-full rounded-2xl bg-gray-100 object-contain dark:bg-white/5" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancelar</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
