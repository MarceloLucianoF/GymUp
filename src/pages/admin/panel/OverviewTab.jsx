import React from 'react';
import { Activity, AlertTriangle, ChevronRight, Dumbbell, Film, ImageOff, Layers, Plus, UserCheck, Users } from 'lucide-react';
import { btnGhost, btnPrimary } from '../../../components/coach/styles';
import { ACTION_LABEL, TARGET_LABEL } from './adminLog';
import { ISSUE_LABEL } from './adminUtils';
import { plural } from '../../../utils/text';

const Kpi = ({ icon: Icon, label, value, hint, tone = 'brand' }) => {
  const tones = { brand: 'bg-brand/15 text-amber-800 dark:text-brand', blue: 'bg-sky-500/15 text-sky-800 dark:text-sky-300', green: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300', rose: 'bg-rose-500/15 text-rose-800 dark:text-rose-300' };
  return (
    <div className="surface p-4">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <p className="mt-3 font-display text-3xl font-black text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>
      {hint && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
    </div>
  );
};

const fmt = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function OverviewTab({ stats, issues, trainingAlerts, log, logError, adminNames, onGo, onNewExercise, onNewTraining }) {
  const issueRows = [
    ['sem-imagem', ImageOff], ['sem-video', Film], ['sem-execucao', Dumbbell], ['sem-descricao', Dumbbell]
  ];
  return (
    <div className="space-y-6" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onNewExercise} className={btnPrimary}><Plus className="h-4 w-4" aria-hidden="true" /> Novo exercício</button>
        <button type="button" onClick={onNewTraining} className={btnGhost}><Layers className="h-4 w-4" aria-hidden="true" /> Nova ficha</button>
      </div>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Dumbbell} label="Exercícios" value={stats.exercises} hint={stats.archived ? plural(stats.archived, 'arquivado', 'arquivados') : 'Todos ativos'} />
        <Kpi icon={Layers} label="Fichas" value={stats.trainings} hint={`${stats.globalTrainings} globais`} tone="blue" />
        <Kpi icon={Users} label="Alunos" value={stats.students} tone="green" />
        <Kpi icon={UserCheck} label="Treinadores" value={stats.coaches} tone="green" />
        <Kpi icon={Activity} label="Alunos ativos (7 dias)" value={stats.activeStudents7 ?? '—'} hint={stats.checkinsTotal == null ? '' : `${plural(stats.checkinsTotal, 'treino registrado', 'treinos registrados')} no total`} tone="rose" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5" aria-labelledby="pend-title">
          <h2 id="pend-title" className="mb-3 flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden="true" /> Pendências de conteúdo</h2>
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {issueRows.map(([key, Icon]) => (
              <li key={key}>
                <button type="button" onClick={() => onGo('exercises', { issue: key })} className="pressable flex min-h-[48px] w-full items-center gap-3 py-2 text-left">
                  <Icon className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{ISSUE_LABEL[key]}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${issues[key] ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200' : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'}`}>{issues[key]}</span>
                  <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-5 text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Fichas com aviso</h3>
          {trainingAlerts.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Nenhuma ficha com aviso.</p> : (
            <ul className="space-y-1.5">
              {trainingAlerts.slice(0, 5).map(({ training, issue }) => (
                <li key={training.firestoreId + issue.id}>
                  <button type="button" onClick={() => onGo('trainings')} className="pressable w-full rounded-xl bg-amber-500/10 px-3 py-2 text-left text-xs">
                    <span className="block font-bold text-gray-900 dark:text-white">{training.name}</span>
                    <span className="font-semibold text-amber-900 dark:text-amber-200">{issue.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-5" aria-labelledby="log-title">
          <h2 id="log-title" className="mb-3 flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><Activity className="h-5 w-5 text-amber-700 dark:text-brand" aria-hidden="true" /> Atividade recente</h2>
          {logError ? <p className="text-sm text-gray-600 dark:text-gray-400">Não foi possível carregar o histórico.</p>
            : log.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Nada registrado ainda. As próximas alterações feitas aqui aparecem nesta lista.</p> : (
              <ol className="space-y-3">
                {log.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="text-gray-900 dark:text-white"><b>{adminNames[entry.uid] || 'Admin'}</b> {ACTION_LABEL[entry.action] || entry.action} {TARGET_LABEL[entry.target] || entry.target} <b>{entry.name}</b></p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{fmt(entry.at)}{entry.detail ? ` · ${entry.detail}` : ''}</p>
                  </li>
                ))}
              </ol>
            )}
        </section>
      </div>
    </div>
  );
}
