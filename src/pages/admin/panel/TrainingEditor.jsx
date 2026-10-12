import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, TriangleAlert, X } from 'lucide-react';
import Drawer from './Drawer';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../../components/coach/styles';
import { DIFFICULTIES, MUSCLE_GROUPS, filterExercises, moveItem, trainingIssues, entryId } from './adminUtils';

const LEVELS = DIFFICULTIES.map(([v, l]) => [l, l]);

export default function TrainingEditor({ initial, exercises, exerciseMap, editingId, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', difficulty: 'Intermediário', ...initial });
  const [entries, setEntries] = useState(initial?.exercises || []);
  const [term, setTerm] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const nameOf = (entry) => {
    if (entry && typeof entry === 'object') return entry.name || 'Exercício';
    return exerciseMap.get(entry)?.name || 'Exercício removido';
  };
  const issues = useMemo(() => trainingIssues({ name: form.name, exercises: entries }, exerciseMap), [form.name, entries, exerciseMap]);
  const taken = new Set(entries.map(entryId));
  const options = useMemo(() => filterExercises(exercises, { term, group, status: 'ativos' }).filter((ex) => !taken.has(ex.firestoreId)).slice(0, 40), [exercises, term, group, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Informe o nome da ficha.'); return; }
    if (entries.length === 0) { setError('Adicione ao menos um exercício.'); return; }
    setError('');
    setSaving(true);
    try { await onSave({ name: form.name.trim(), description: form.description, difficulty: form.difficulty, exercises: entries }); }
    finally { setSaving(false); }
  };

  return (
    <Drawer
      title={editingId ? 'Editar ficha' : 'Nova ficha'}
      subtitle="Monte a ordem dos exercícios e confira os avisos antes de salvar."
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" form="training-form" disabled={saving} className={btnPrimary}>{saving ? 'Salvando...' : 'Salvar ficha'}</button>
        </div>
      )}
    >
      <form id="training-form" onSubmit={submit} noValidate className="space-y-7">
        <section className="space-y-3">
          <div><label htmlFor="tr-name" className={labelCls}>Nome</label><input id="tr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Ex.: Treino A: Peitoral + Dorsal" autoFocus /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="tr-level" className={labelCls}>Nível</label>
              <select id="tr-level" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className={`${inputCls} cursor-pointer`}>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label htmlFor="tr-desc" className={labelCls}>Descrição</label><input id="tr-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="Foco e objetivo" /></div>
          </div>
        </section>

        {issues.length > 0 && (
          <section aria-label="Avisos da ficha" className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
            {issues.map((i) => (
              <p key={i.id} className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {i.text}</p>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Exercícios da ficha ({entries.length})</h3>
          {entries.length === 0 ? <p className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">Nenhum exercício ainda. Use a busca abaixo.</p> : (
            <ol className="space-y-2">
              {entries.map((entry, i) => (
                <li key={`${entryId(entry)}-${i}`} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 pl-3 dark:border-white/10 dark:bg-white/5">
                  <span className="w-5 text-center text-xs font-black text-gray-600 dark:text-gray-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-white">{nameOf(entry)}</span>
                  <button type="button" aria-label={`Subir ${nameOf(entry)}`} disabled={i === 0} onClick={() => setEntries((l) => moveItem(l, i, i - 1))} className="pressable flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 disabled:opacity-30 dark:text-gray-300"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" aria-label={`Descer ${nameOf(entry)}`} disabled={i === entries.length - 1} onClick={() => setEntries((l) => moveItem(l, i, i + 1))} className="pressable flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 disabled:opacity-30 dark:text-gray-300"><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" aria-label={`Remover ${nameOf(entry)}`} onClick={() => setEntries((l) => l.filter((_, idx) => idx !== i))} className="pressable flex h-10 w-10 items-center justify-center rounded-xl text-rose-700 dark:text-rose-400"><X className="h-4 w-4" aria-hidden="true" /></button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Adicionar exercício</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <input type="search" aria-label="Buscar exercício para adicionar" placeholder="Buscar pelo nome" value={term} onChange={(e) => setTerm(e.target.value)} className={inputCls} />
            <select aria-label="Filtrar por grupo" value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputCls} cursor-pointer`}><option value="">Todos os grupos</option>{MUSCLE_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-2xl border border-gray-200 p-2 dark:border-white/10">
            {options.length === 0 && <li className="p-3 text-sm text-gray-600 dark:text-gray-400">Nenhum exercício disponível com esse filtro.</li>}
            {options.map((ex) => (
              <li key={ex.firestoreId}>
                <button type="button" onClick={() => setEntries((l) => [...l, ex.firestoreId])} className="pressable flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5">
                  <span className="min-w-0"><span className="block truncate font-bold text-gray-900 dark:text-white">{ex.name}</span><span className="text-xs capitalize text-gray-600 dark:text-gray-400">{ex.muscleGroup} · {ex.sets}x{ex.reps}</span></span>
                  <Plus className="h-4 w-4 shrink-0 text-amber-800 dark:text-brand" aria-hidden="true" />
                  <span className="sr-only">Adicionar à ficha</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {error && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">{error}</p>}
      </form>
    </Drawer>
  );
}
