import React, { useMemo } from 'react';
import { Activity, Users } from 'lucide-react';
import EmptyState from '../../../components/common/EmptyState';
import { socialOverview } from './adminUtils';
import ReportsSection from './ReportsSection';

const ACTION = { pedir: 'pediu amizade a', aceitar: 'aceitou o pedido de', recusar: 'recusou o pedido de', cancelar: 'cancelou o pedido a', remover: 'removeu', bloquear: 'bloqueou', desbloquear: 'desbloqueou', 'entrar-ranking': 'entrou no ranking', 'sair-ranking': 'saiu do ranking' };
const fmt = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const Kpi = ({ label, value }) => <div className="surface p-4"><p className="font-display text-3xl font-black text-gray-900 dark:text-white">{value}</p><p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">{label}</p></div>;

// Visão administrativa do social: só contagens e o registro de ações. Nenhum dado de saúde.
export default function SocialTab({ users, profiles, friendships, log, error }) {
  const names = useMemo(() => Object.fromEntries([...users.map((u) => [u.uid, u.displayName || u.email || u.uid]), ...profiles.map((p) => [p.uid, `@${p.handle}`])]), [users, profiles]);
  const o = useMemo(() => socialOverview(profiles, friendships), [profiles, friendships]);
  return (
    <div className="space-y-5" role="tabpanel" id="panel-social" aria-labelledby="tab-social">
      <section aria-label="Resumo social" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Perfis sociais" value={o.profiles} />
        <Kpi label="Nome visível" value={o.discoverable} />
        <Kpi label="No ranking" value={o.ranking} />
        <Kpi label="Amizades ativas" value={o.friends} />
        <Kpi label="Pedidos pendentes" value={o.pending} />
        <Kpi label="Bloqueios" value={o.blocked} />
      </section>
      <ReportsSection names={names} />
      <section className="surface p-5" aria-labelledby="soc-log">
        <h2 id="soc-log" className="mb-3 flex items-center gap-2 font-display text-lg font-black text-gray-900 dark:text-white"><Activity className="h-5 w-5 text-amber-800 dark:text-brand" aria-hidden="true" /> Ações recentes</h2>
        {error ? <p className="text-sm text-gray-600 dark:text-gray-400">Não foi possível carregar o registro.</p>
          : log.length === 0 ? <EmptyState icon={Users} title="Nada registrado ainda" description="Pedidos, aceites, remoções, bloqueios e entradas no ranking aparecem aqui." /> : (
            <ol className="space-y-2">
              {log.map((e) => (
                <li key={e.id} className="text-sm"><b>{names[e.uid] || 'Usuário'}</b> {ACTION[e.action] || e.action} {e.other ? <b>{names[e.other] || 'usuário'}</b> : null}
                  <span className="block text-xs text-gray-600 dark:text-gray-400">{fmt(e.at)}</span></li>
              ))}
            </ol>
          )}
      </section>
    </div>
  );
}
