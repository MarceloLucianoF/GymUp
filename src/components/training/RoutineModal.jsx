import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, X } from 'lucide-react';
import Modal from '../common/Modal';
import { DAY_LABELS } from '../../utils/weekPlan';
import { ROUTINE_MAX, normalizeRoutine, routineLetter } from '../../utils/routine';

// "Minha ficha": o aluno escolhe quais dos seus treinos entram, em que ordem (A, B, C...) e, se quiser, o dia de cada um.
// Reordenar é por setas (acessível por teclado e leitor de tela). Grava só ao tocar em "Salvar ficha".
export default function RoutineModal({ workouts = [], items = [], onClose, onSave }) {
  const [list, setList] = useState(() => normalizeRoutine(items, workouts));
  const [saving, setSaving] = useState(false);
  const byDoc = new Map(workouts.map((w) => [w.docId, w]));
  const chosen = new Set(list.map((it) => it.workoutId));
  const available = workouts.filter((w) => !chosen.has(w.docId));

  const move = (i, delta) => setList((prev) => {
    const j = i + delta;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const add = (docId) => setList((prev) => (prev.length >= ROUTINE_MAX ? prev : [...prev, { workoutId: docId, day: null }]));
  const remove = (i) => setList((prev) => prev.filter((_, k) => k !== i));
  const setDay = (i, value) => setList((prev) => prev.map((it, k) => (k === i ? { ...it, day: value === '' ? null : Number(value) } : it)));

  const save = async () => {
    setSaving(true);
    try { await onSave(list); } finally { setSaving(false); }
  };

  const iconBtn = 'pressable grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-800 disabled:opacity-40 dark:bg-white/10 dark:text-white';

  return (
    <Modal onClose={onClose} label="Minha ficha" layer="z-[120]" className="w-full max-w-xl">
      <div className="max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-5 text-gray-900 dark:bg-[#111827] dark:text-white">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Minha ficha</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 dark:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Escolha os treinos e a ordem em que você faz. A Home mostra o próximo da sequência; com dia marcado, vale o dia.</p>

        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Ordem da ficha</h3>
        {list.length === 0 ? (
          <p className="mb-4 rounded-2xl bg-gray-100 p-4 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">Nenhum treino na ficha ainda. Adicione abaixo.</p>
        ) : (
          <ol className="mb-4 space-y-2" aria-label="Treinos da ficha em ordem">
            {list.map((it, i) => {
              const name = byDoc.get(it.workoutId)?.name || 'Treino';
              const letter = routineLetter(i);
              return (
                <li key={it.workoutId} className="rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand font-display text-lg font-black text-black" aria-hidden="true">{letter}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Treino {letter}</span>
                      <span className="block truncate text-sm font-bold">{name}</span>
                    </span>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${name}`} className={iconBtn}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Descer ${name}`} className={iconBtn}><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => remove(i)} aria-label={`Tirar ${name} da ficha`} className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><X className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                  <select
                    value={it.day == null ? '' : String(it.day)}
                    onChange={(e) => setDay(i, e.target.value)}
                    aria-label={`Dia da semana de ${name}`}
                    className="mt-2 min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-800 dark:border-white/10 dark:bg-[#0B0F19] dark:text-white"
                  >
                    <option value="">Sem dia fixo (segue a ordem)</option>
                    {DAY_LABELS.map((d, k) => <option key={d} value={k}>{d}</option>)}
                  </select>
                </li>
              );
            })}
          </ol>
        )}

        {available.length > 0 && (
          <>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Adicionar à ficha</h3>
            <ul className="mb-4 space-y-2">
              {available.map((w) => (
                <li key={w.docId}>
                  <button type="button" onClick={() => add(w.docId)} disabled={list.length >= ROUTINE_MAX} aria-label={`Adicionar ${w.name} à ficha`} className="pressable flex min-h-[44px] w-full items-center gap-2 rounded-2xl bg-gray-100 px-3 text-left text-sm font-bold text-gray-800 disabled:opacity-40 dark:bg-white/10 dark:text-white">
                    <Plus className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span className="truncate">{w.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="pressable min-h-[48px] rounded-2xl bg-gray-100 text-sm font-bold text-gray-800 dark:bg-white/10 dark:text-white">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary-gradient pressable min-h-[48px] text-sm font-black disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Salvar ficha
          </button>
        </div>
      </div>
    </Modal>
  );
}
