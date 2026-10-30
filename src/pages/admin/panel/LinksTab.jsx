import React, { useMemo } from 'react';
import { Link2, UserX, Users } from 'lucide-react';
import EmptyState from '../../../components/common/EmptyState';
import { linkOverview } from './adminUtils';
import { plural } from '../../../utils/text';

const STATUS = {
  pending: ['Pendente', 'bg-amber-500/15 text-amber-900 dark:text-amber-200'],
  active: ['Ativo', 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'],
  rejected: ['Recusado', 'bg-rose-500/15 text-rose-800 dark:text-rose-300'],
  revoked: ['Encerrado', 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300']
};
const fmt = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR'); };

const Kpi = ({ label, value, hint }) => (
  <div className="surface p-4"><p className="font-display text-3xl font-black text-gray-900 dark:text-white">{value}</p><p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p>{hint && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{hint}</p>}</div>
);

// Visão administrativa dos vínculos: só leitura (o aluno pede, o treinador aceita; o admin acompanha).
export default function LinksTab({ users, links, error }) {
  const names = useMemo(() => Object.fromEntries(users.map((u) => [u.uid, u.displayName || u.email || u.uid])), [users]);
  const o = useMemo(() => linkOverview(users, links), [users, links]);
  const rows = useMemo(() => [...links].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [links]);
  const orphans = useMemo(() => users.filter((u) => u.role === 'user' && !u.coachId), [users]);

  return (
    <div className="space-y-5" role="tabpanel" id="panel-links" aria-labelledby="tab-links">
      <section aria-label="Resumo dos vínculos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vínculos ativos" value={o.active} hint={`${plural(o.students, 'aluno', 'alunos')} no total`} />
        <Kpi label="Alunos sem treinador" value={o.withoutCoach} />
        <Kpi label="Treinadores sem alunos" value={o.coachesWithoutStudents} hint={plural(o.coaches, 'treinador', 'treinadores')} />
        <Kpi label="Solicitações pendentes" value={o.pending} hint={`${o.rejected} recusadas · ${o.revoked} encerradas`} />
      </section>

      <section className="surface p-4" aria-labelledby="links-title">
        <h2 id="links-title" className="mb-3 flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><Link2 className="h-5 w-5 text-amber-800 dark:text-brand" aria-hidden="true" /> Solicitações e vínculos</h2>
        {error ? <p className="text-sm text-gray-600 dark:text-gray-400">Não foi possível carregar os vínculos.</p>
          : rows.length === 0 ? <EmptyState icon={Users} title="Nenhuma solicitação ainda" description="Os pedidos de alunos aparecem aqui. Vínculos antigos (feitos no cadastro) não têm solicitação registrada." /> : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((l) => (
                <li key={l.studentId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{l.studentName || names[l.studentId] || 'Aluno'} <span className="font-normal text-gray-600 dark:text-gray-400">→ {names[l.coachId] || 'Treinador'}</span></p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Iniciado pelo aluno em {fmt(l.createdAt)} · atualizado em {fmt(l.updatedAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${(STATUS[l.status] || STATUS.revoked)[1]}`}>{(STATUS[l.status] || [l.status])[0]}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="surface p-4" aria-labelledby="orph-title">
        <h2 id="orph-title" className="mb-3 flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><UserX className="h-5 w-5 text-amber-800 dark:text-brand" aria-hidden="true" /> Alunos sem treinador ({orphans.length})</h2>
        {orphans.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Todos os alunos têm treinador.</p> : (
          <ul className="flex flex-wrap gap-2">{orphans.map((u) => <li key={u.uid} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-800 dark:bg-white/10 dark:text-gray-200">{u.displayName || u.email}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
