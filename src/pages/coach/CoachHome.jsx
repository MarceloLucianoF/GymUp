import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Activity, Target, AlertTriangle, Wallet, PiggyBank, MessageSquare, Eye, Plus, UserPlus, DollarSign, Trophy, Flame, ArrowRight, Smile } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useCoachDashboard } from '../../hooks/useCoachDashboard';
import { formatTonnage } from '../../utils/format';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Reveal from '../../components/ui/Reveal';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/coach/Avatar';
import BarChart from '../../components/coach/BarChart';
import InviteModal from '../../components/coach/InviteModal';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { chatState, timeAgo } from '../../components/coach/helpers';
import { btnPrimary, btnGhost, pageCls } from '../../components/coach/styles';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

const SectionTitle = ({ icon: Icon, children, action }) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <h2 className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
      {Icon && <Icon className="h-5 w-5 text-brand" aria-hidden="true" />}{children}
    </h2>
    {action}
  </div>
);

export default function CoachHome() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { stats, weekly, ranking, studentsAtRisk, recentActivity, loading, error, reload } = useCoachDashboard(user);
  const [showInvite, setShowInvite] = useState(false);

  const firstName = (user?.displayName || '').split(' ')[0];
  const activeNow = Math.max(0, stats.active - stats.risk);
  const weekTotal = weekly.reduce((a, d) => a + d.value, 0);

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-7xl"><PageSkeleton cards={6} /></div></div>;
  if (error) return <div className={pageCls}><ErrorState message="Não foi possível carregar o painel." onRetry={reload} /></div>;

  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="aurora-bg">
          <PageHeader
            eyebrow="Painel do treinador"
            title={<>{greeting()}{firstName ? ', ' : ''}<span className="text-gradient-brand">{firstName}</span></>}
            subtitle={stats.risk > 0 ? `${stats.risk} aluno${stats.risk > 1 ? 's' : ''} precisa${stats.risk > 1 ? 'm' : ''} de atenção hoje.` : 'Sua carteira está em dia. Bom trabalho!'}
            actions={(
              <div className="hidden gap-2 sm:flex">
                <button type="button" onClick={() => navigate('/admin/trainings')} className={btnPrimary}><Plus className="h-4 w-4" /> Nova ficha</button>
                <button type="button" onClick={() => setShowInvite(true)} className={btnGhost}><UserPlus className="h-4 w-4" /> Novo aluno</button>
              </div>
            )}
          />
        </section>

        {/* Atalhos (mobile: rolagem horizontal) */}
        <nav aria-label="Atalhos" className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 scroll-snap-x">
          {[
            { label: 'Nova ficha', icon: Plus, onClick: () => navigate('/admin/trainings') },
            { label: 'Novo aluno', icon: UserPlus, onClick: () => setShowInvite(true) },
            { label: 'Financeiro', icon: DollarSign, onClick: () => navigate('/coach/financial') },
            { label: 'Mensagens', icon: MessageSquare, onClick: () => navigate('/coach/chat') }
          ].map(({ label, icon: Icon, onClick }, i) => (
            <button key={label} type="button" onClick={onClick} style={{ animationDelay: `${i * 70}ms` }}
              className="surface surface-hover pressable animate-fade-up flex min-h-[64px] min-w-[140px] shrink-0 items-center gap-3 px-4 text-left sm:min-w-0">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/15 text-brand"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{label}</span>
            </button>
          ))}
        </nav>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Users} label="Alunos ativos" value={activeNow} accent="green" />
          <StatCard icon={Activity} label="Check-ins hoje" value={stats.checkIns} accent="brand" />
          <StatCard icon={Target} label="Retenção" value={stats.retention} suffix="%" accent="blue" />
          <StatCard icon={AlertTriangle} label="Em risco" value={stats.risk} accent="red" />
          <StatCard icon={Wallet} label="Receita prevista" value={stats.revenue} prefix="R$ " accent="brand" />
          <StatCard icon={PiggyBank} label="Recebido no mês" value={stats.received} prefix="R$ " accent="green" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <section className="surface h-full p-5">
              <SectionTitle icon={Activity} action={<span className="text-xs font-bold text-gray-500">{weekTotal} treinos / 7 dias</span>}>Check-ins da semana</SectionTitle>
              <BarChart data={weekly} ariaLabel="Check-ins por dia na última semana" />
            </section>
          </Reveal>
          <Reveal delay={80}>
            <section className="surface h-full p-5">
              <SectionTitle icon={Trophy}>Mais consistentes</SectionTitle>
              {ranking.length === 0 ? (
                <EmptyState icon={Trophy} title="Sem treinos nos últimos 30 dias" />
              ) : (
                <ol className="space-y-3">
                  {ranking.map((s, i) => (
                    <li key={s.uid} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                      <button type="button" onClick={() => navigate(`/coach/students/${s.uid}`)} className="pressable flex min-h-[48px] w-full items-center gap-3 rounded-2xl text-left hover:bg-black/5 dark:hover:bg-white/5">
                        <span className={`w-5 text-center font-display text-lg font-black ${i === 0 ? 'text-brand' : 'text-gray-400'}`}>{i + 1}</span>
                        <Avatar name={s.displayName} src={s.photoURL} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</span>
                        <span className="text-xs font-bold text-gray-500">{s.workouts30} treinos</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </Reveal>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <section className={`surface h-full p-5 ${studentsAtRisk.length ? 'border-rose-500/30' : ''}`}>
              <SectionTitle icon={AlertTriangle} action={<span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-500">{stats.risk}</span>}>Alunos em risco</SectionTitle>
              {studentsAtRisk.length === 0 ? (
                <EmptyState icon={Smile} title="Tudo tranquilo!" description="Nenhum aluno parado há mais de 7 dias." />
              ) : (
                <ul className="space-y-2">
                  {studentsAtRisk.map((s) => (
                    <li key={s.uid} className="flex items-center gap-3 rounded-2xl bg-rose-500/5 p-3">
                      <Avatar name={s.displayName} src={s.photoURL} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</p>
                        <p className="text-xs font-medium text-rose-500">{typeof s.daysInactive === 'number' ? `${s.daysInactive} dias sem treinar` : 'Ainda não treinou'}</p>
                      </div>
                      <button type="button" aria-label={`Abrir chat com ${s.displayName || 'aluno'}`} onClick={() => navigate('/coach/chat', { state: chatState(s) })} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600"><MessageSquare className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Ver ${s.displayName || 'aluno'}`} onClick={() => navigate(`/coach/students/${s.uid}`)} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600"><Eye className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>

          <Reveal delay={80}>
            <section className="surface h-full p-5">
              <SectionTitle icon={Flame} action={<button type="button" onClick={() => navigate('/coach/students')} className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-brand">Ver alunos <ArrowRight className="h-3 w-3" /></button>}>Atividade recente</SectionTitle>
              {recentActivity.length === 0 ? (
                <EmptyState icon={Activity} title="Nenhum treino registrado ainda." />
              ) : (
                <ul className="space-y-1">
                  {recentActivity.map((c, i) => (
                    <li key={c.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                      <button type="button" onClick={() => navigate(`/coach/students/${c.userId}`)} className="pressable flex min-h-[56px] w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/5">
                        <Avatar name={c.student?.displayName || c.userEmail} src={c.student?.photoURL} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{c.student?.displayName || c.userEmail || 'Aluno'}</p>
                          <p className="truncate text-xs text-gray-500">Finalizou <span className="font-semibold text-brand">{c.trainingName || 'treino'}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{c.totalVolume > 0 ? formatTonnage(c.totalVolume) : '-'}</p>
                          <p className="text-[11px] text-gray-400">{timeAgo(c.date)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        </div>
      </div>
      {showInvite && <InviteModal coachCode={user.uid} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
