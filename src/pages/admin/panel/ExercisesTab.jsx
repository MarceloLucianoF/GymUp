import React, { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Copy, Edit3, Film, Image as ImageIcon, Plus, Search, Trash2, Dumbbell } from 'lucide-react';
import EmptyState from '../../../components/common/EmptyState';
import { btnPrimary, inputCls } from '../../../components/coach/styles';
import { DIFFICULTIES, GROUP_LABEL, MUSCLE_GROUPS, exerciseIssues, filterExercises, hasImage, hasVideo, ISSUE_LABEL, updatedAtOf } from './adminUtils';
import { safeHttpUrl } from '../../../utils/safeUrl';

import { stillSrc } from '../../../utils/exerciseMedia';
import { plural } from '../../../utils/text';
const selectCls = `${inputCls} min-h-[44px] cursor-pointer text-sm`;
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '—');
const DIFF_CLS = {
  iniciante: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  'intermediário': 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'avançado': 'bg-rose-500/15 text-rose-800 dark:text-rose-300'
};

const Thumb = ({ ex }) => {
  const image = stillSrc(safeHttpUrl(ex.machineImage));
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10" aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Dumbbell className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    </span>
  );
};

const MediaBadges = ({ ex, compact = false }) => (
  <span className="inline-flex items-center gap-1.5">
    <span title={hasImage(ex) ? 'Tem imagem' : 'Sem imagem'} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${hasImage(ex) ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-400'}`}>
      <ImageIcon className="h-3 w-3" aria-hidden="true" /><span className={compact ? 'sr-only' : ''}>{hasImage(ex) ? (ex.mediaApprox ? 'Imagem de referência' : 'Imagem') : 'Sem imagem'}</span>
    </span>
    <span title={hasVideo(ex) ? 'Tem vídeo' : 'Sem vídeo'} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${hasVideo(ex) ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-400'}`}>
      <Film className="h-3 w-3" aria-hidden="true" /><span className={compact ? 'sr-only' : ''}>{hasVideo(ex) ? 'Vídeo' : 'Sem vídeo'}</span>
    </span>
  </span>
);

const actBtn = 'pressable inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

function Actions({ ex, onEdit, onDuplicate, onArchive, onDelete, nowrap = false }) {
  return (
    <div className={`flex items-center gap-1.5 ${nowrap ? 'flex-nowrap' : 'flex-wrap'}`}>
      <button type="button" onClick={() => onEdit(ex)} className={`${actBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100`}><Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> Editar</button>
      <button type="button" onClick={() => onDuplicate(ex)} className={`${actBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100`}><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Duplicar</button>
      <button type="button" onClick={() => onArchive(ex)} className={`${actBtn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100`}>
        {ex.archived ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />} {ex.archived ? 'Restaurar' : 'Arquivar'}
      </button>
      <button type="button" onClick={() => onDelete(ex)} className={`${actBtn} bg-rose-500/10 text-rose-700 dark:text-rose-400`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir</button>
    </div>
  );
}

export default function ExercisesTab({ exercises, initialFilters, onNew, onEdit, onDuplicate, onArchive, onDelete }) {
  const [filters, setFilters] = useState({ term: '', group: '', difficulty: '', media: '', status: 'ativos', issue: '', sort: 'nome', ...initialFilters });
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const rows = useMemo(() => filterExercises(exercises, filters), [exercises, filters]);
  const active = Object.entries(filters).filter(([k, v]) => v && !(k === 'status' && v === 'ativos') && !(k === 'sort' && v === 'nome')).length;
  const reset = () => setFilters({ term: '', group: '', difficulty: '', media: '', status: 'ativos', issue: '', sort: 'nome' });

  return (
    <div className="space-y-4" role="tabpanel" id="panel-exercises" aria-labelledby="tab-exercises">
      <div className="surface space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Buscar exercício" placeholder="Buscar por nome, grupo ou nível" value={filters.term} onChange={set('term')} className={`${inputCls} !pl-11`} />
          </div>
          <button type="button" onClick={onNew} className={`${btnPrimary} sm:w-auto`}><Plus className="h-4 w-4" aria-hidden="true" /> Novo exercício</button>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
          <label className="sr-only" htmlFor="f-group">Grupo muscular</label>
          <select id="f-group" value={filters.group} onChange={set('group')} className={selectCls}><option value="">Todos os grupos</option>{MUSCLE_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="sr-only" htmlFor="f-diff">Dificuldade</label>
          <select id="f-diff" value={filters.difficulty} onChange={set('difficulty')} className={selectCls}><option value="">Toda dificuldade</option>{DIFFICULTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="sr-only" htmlFor="f-media">Mídia</label>
          <select id="f-media" value={filters.media} onChange={set('media')} className={selectCls}>
            <option value="">Qualquer mídia</option><option value="com-imagem">Com imagem</option><option value="com-video">Com vídeo</option><option value="nenhuma">Sem mídia</option>
          </select>
          <label className="sr-only" htmlFor="f-issue">Pendência</label>
          <select id="f-issue" value={filters.issue} onChange={set('issue')} className={selectCls}><option value="">Qualquer situação</option>{Object.entries(ISSUE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="sr-only" htmlFor="f-status">Status</label>
          <select id="f-status" value={filters.status} onChange={set('status')} className={selectCls}><option value="ativos">Ativos</option><option value="arquivados">Arquivados</option><option value="todos">Todos</option></select>
          <label className="sr-only" htmlFor="f-sort">Ordenar</label>
          <select id="f-sort" value={filters.sort} onChange={set('sort')} className={selectCls}><option value="nome">Ordem: nome</option><option value="grupo">Ordem: grupo</option><option value="recentes">Ordem: recentes</option></select>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400" aria-live="polite">
          <span>{rows.length} de {exercises.length} {exercises.length === 1 ? 'exercício' : 'exercícios'}</span>
          {active > 0 && <button type="button" onClick={reset} className="min-h-[40px] font-bold text-amber-800 underline dark:text-brand">Limpar filtros ({active})</button>}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Dumbbell} title="Nenhum exercício encontrado" description="Ajuste os filtros ou cadastre um novo exercício." />
      ) : (
        <>
          {/* Tabela: telas médias e grandes */}
          <div className="surface hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Exercícios da biblioteca</caption>
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-white/10 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Exercício</th><th scope="col" className="px-3 py-3">Grupo</th><th scope="col" className="px-3 py-3">Nível</th>
                  <th scope="col" className="px-3 py-3">Mídia</th><th scope="col" className="px-3 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {rows.map((ex) => (
                  <tr key={ex.firestoreId} className={ex.archived ? 'opacity-70' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[190px] items-center gap-3"><Thumb ex={ex} />
                        <div className="min-w-0"><p className="truncate font-bold text-gray-900 dark:text-white">{ex.name}</p>
                          <p className="font-mono text-[11px] text-gray-600 dark:text-gray-400">{ex.sets}x{ex.reps} · {ex.rest}s · atualizado {fmtDate(updatedAtOf(ex))}</p>
                          {ex.archived && <span className="text-[11px] font-bold uppercase text-gray-600 dark:text-gray-400">Arquivado</span>}
                          {!ex.archived && exerciseIssues(ex).length > 0 && <p className="text-[11px] text-amber-800 dark:text-amber-300">{plural(exerciseIssues(ex).length, 'pendência', 'pendências')}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 capitalize text-gray-700 dark:text-gray-300">{GROUP_LABEL[ex.muscleGroup] || ex.muscleGroup}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${DIFF_CLS[ex.difficulty] || 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300'}`}>{ex.difficulty || '—'}</span></td>
                    <td className="px-3 py-3"><MediaBadges ex={ex} compact /></td>
                    <td className="px-3 py-3"><Actions nowrap ex={ex} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista compacta: celular */}
          <ul className="space-y-3 md:hidden">
            {rows.map((ex) => (
              <li key={ex.firestoreId} className={`surface space-y-3 p-4 ${ex.archived ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3"><Thumb ex={ex} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900 dark:text-white">{ex.name}</p>
                    <p className="text-xs capitalize text-gray-600 dark:text-gray-400">{GROUP_LABEL[ex.muscleGroup] || ex.muscleGroup} · {ex.sets}x{ex.reps} · {ex.rest}s{ex.archived ? ' · arquivado' : ''}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${DIFF_CLS[ex.difficulty] || 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300'}`}>{ex.difficulty || '—'}</span>
                </div>
                <MediaBadges ex={ex} />
                <Actions ex={ex} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
