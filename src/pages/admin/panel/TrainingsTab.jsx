import React, { useMemo, useState } from 'react';
import { Copy, Edit3, Layers, Plus, Search, Trash2, TriangleAlert, Users } from 'lucide-react';
import EmptyState from '../../../components/common/EmptyState';
import { btnPrimary, inputCls } from '../../../components/coach/styles';
import { GROUP_LABEL, trainingGroups, trainingIssues, updatedAtOf } from './adminUtils';

const actBtn = 'pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '—');

export default function TrainingsTab({ trainings, exerciseMap, usage, coachNames, onNew, onEdit, onDuplicate, onDelete }) {
  const [term, setTerm] = useState('');
  const [owner, setOwner] = useState('todas');
  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return trainings
      .filter((t) => (owner === 'globais' ? !t.coachId : owner === 'treinadores' ? !!t.coachId : true))
      .filter((t) => !q || String(t.name).toLowerCase().includes(q))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [trainings, term, owner]);

  return (
    <div className="space-y-4" role="tabpanel" id="panel-trainings" aria-labelledby="tab-trainings">
      <div className="surface space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Buscar ficha" placeholder="Buscar ficha" value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputCls} !pl-11`} />
          </div>
          <label className="sr-only" htmlFor="tr-owner">Origem</label>
          <select id="tr-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={`${inputCls} cursor-pointer sm:w-52`}>
            <option value="todas">Todas as fichas</option><option value="globais">Globais</option><option value="treinadores">De treinadores</option>
          </select>
          <button type="button" onClick={onNew} className={btnPrimary}><Plus className="h-4 w-4" aria-hidden="true" /> Nova ficha</button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400" aria-live="polite">{rows.length} de {trainings.length} fichas</p>
      </div>

      {rows.length === 0 ? <EmptyState icon={Layers} title="Nenhuma ficha encontrada" description="Crie uma ficha ou mude o filtro." /> : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((t) => {
            const groups = trainingGroups(t, exerciseMap);
            const issues = trainingIssues(t, exerciseMap);
            const students = usage[t.firestoreId] || 0;
            return (
              <li key={t.firestoreId} className="surface space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-black text-gray-900 dark:text-white">{t.name}</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t.coachId ? `Treinador: ${coachNames[t.coachId] || 'não identificado'}` : 'Ficha global'} · atualizada em {fmtDate(updatedAtOf(t))}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-brand">{t.difficulty || 'Ficha'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-bold">{(t.exercises || []).length} exercícios</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {students} aluno(s) usando</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => <span key={g} className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-700 dark:bg-white/10 dark:text-gray-300">{GROUP_LABEL[g] || g}</span>)}
                </div>
                {issues.length > 0 && (
                  <ul className="space-y-1 rounded-xl bg-amber-500/10 p-2.5" aria-label="Avisos da ficha">
                    {issues.map((i) => <li key={i.id} className="flex items-start gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {i.text}</li>)}
                  </ul>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => onEdit(t)} className={`${actBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100`}><Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> Editar</button>
                  <button type="button" onClick={() => onDuplicate(t)} className={`${actBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100`}><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Duplicar</button>
                  <button type="button" onClick={() => onDelete(t, students)} className={`${actBtn} bg-rose-500/10 text-rose-700 dark:text-rose-400`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
