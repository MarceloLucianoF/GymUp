import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Flame, Trophy, Target, Scale, Link2, Wrench, Sparkles, Timer, Weight, CalendarCheck, MessageSquare, ChevronRight, Dumbbell, RefreshCw } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useRole } from '../../hooks/useRole';
import { useStudentHome, useWeeklyGoal } from '../../hooks/useStudentHome';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
import StudentChatWidget from '../../components/chat/StudentChatWidget';
import AICoachModal from '../../components/ai/AICoachModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ActiveWorkoutBanner from '../../components/dashboard/ActiveWorkoutBanner';
import LinkCoachModal from '../../components/dashboard/LinkCoachModal';
import RecommendedWorkoutCard from '../../components/dashboard/RecommendedWorkoutCard';
import WeeklyGoalCard from '../../components/dashboard/WeeklyGoalCard';
import VolumeTrend from '../../components/dashboard/VolumeTrend';
import AchievementBadges from '../../components/dashboard/AchievementBadges';
import { getWeekDays } from '../../components/dashboard/WeekStrip';
import { formatDate, formatTonnage } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import Reveal from '../../components/ui/Reveal';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const formatVolume = (kg) => (kg > 1000 ? formatTonnage(kg) : `${kg}kg`);

const getGreeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
};

const BlockError = ({ label, onRetry }) => (
  <div role="alert" className="surface flex items-center justify-between gap-3 p-4 text-sm text-gray-600 dark:text-gray-300">
    <span>Não foi possível carregar {label}.</span>
    <button type="button" onClick={onRetry} className="pressable min-h-[44px] rounded-xl px-3 text-xs font-bold text-amber-700 dark:text-brand">Tentar de novo</button>
  </div>
);

export default function Home() {
  const { user, userProfile: ctxProfile } = useAuthContext();
  const navigate = useNavigate();
  const { isCoach } = useRole();
  const { data, loading, error, refresh } = useStudentHome(user, ctxProfile);
  const { profile: userProfile, history, trainings, activeSession, stats, achievements, refreshing, errors, discardActiveSession } = data;
  const [goal, setGoal] = useWeeklyGoal(user?.uid);

  const [showLinkCoach, setShowLinkCoach] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const handleDiscardActiveWorkout = () => {
    discardActiveSession();
    setShowConfirmDiscard(false);
    toast.success('Treino em andamento descartado.');
  };

  const firstName = (userProfile?.displayName || user?.displayName || 'Atleta').split(' ')[0];
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const lastWorkoutId = history.length > 0 ? history[0].trainingId : null;
  const greeting = getGreeting();

  const weekDays = getWeekDays(history);
  const weekCount = weekDays.filter((d) => d.trained).length;
  const trainedToday = weekDays.some((d) => d.isToday && d.trained);

  const now = new Date();
  const monthItems = history.filter((h) => {
    const d = new Date(h.date);
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthVolume = monthItems.reduce((acc, h) => acc + (Number(h.totalVolume) || 0), 0);
  const monthMinutes = Math.round(monthItems.reduce((acc, h) => acc + (Number(h.duration) || 0), 0) / 60);
  const volumeSpark = history.slice(0, 8).map((h) => Number(h.totalVolume) || 0).reverse();
  const recent = history.slice(0, 4);
  const carousel = trainings.slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-32 transition-colors duration-300 dark:bg-[#0B0F19] md:p-8">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6" aria-busy={loading}>

        {/* CABEÇALHO */}
        <section className="surface aurora-bg relative overflow-hidden p-5 sm:p-7 animate-fade-up" aria-label="Resumo">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                aria-label="Abrir perfil"
                className="pressable h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-brand shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {photoURL ? (
                  <img src={photoURL} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-brand-dark text-xl font-bold text-black">{firstName[0]}</span>
                )}
              </button>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{greeting},</p>
                <h1 className="truncate font-display text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                  <span className="text-gradient-brand">{firstName}</span>
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-brand">{stats.level}</span>
                  {!loading && !userProfile?.coachId && (
                    <button
                      type="button"
                      onClick={() => setShowLinkCoach(true)}
                      className="pressable flex min-h-[28px] items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-300"
                    >
                      <Link2 className="h-3 w-3" aria-hidden="true" /> Vincular Treinador
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing || loading}
                aria-label="Atualizar dados"
                className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-white/60 text-gray-700 hover:bg-white disabled:opacity-60 dark:bg-white/10 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              </button>
              <div className="flex flex-col items-center rounded-2xl bg-orange-500/10 px-3 py-2" aria-label={`Sequência de ${stats.streak} dias`}>
                <Flame className={`h-6 w-6 fill-orange-500 text-orange-500 ${stats.streak > 0 ? 'motion-safe:animate-float' : 'opacity-50'}`} aria-hidden="true" />
                <p className="font-display text-lg font-black leading-none text-gray-900 dark:text-white"><AnimatedNumber value={stats.streak} /></p>
                <p className="text-[9px] font-bold uppercase text-gray-500 dark:text-gray-400">dias</p>
              </div>
            </div>
          </div>
          {error?.profile && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Perfil indisponível no momento.</p>}
        </section>

        {/* TREINO DE HOJE */}
        {loading ? (
          <Skeleton className="h-52 w-full !rounded-3xl" />
        ) : (
          <Reveal>
            {activeSession ? (
              <ActiveWorkoutBanner
                activeSession={activeSession}
                onContinue={() => navigate(`/execution/${activeSession.trainingId}`)}
                onDiscard={() => setShowConfirmDiscard(true)}
              />
            ) : errors.trainings ? (
              <BlockError label="seus treinos" onRetry={refresh} />
            ) : trainings.length === 0 ? (
              <div className="surface">
                <EmptyState
                  icon={Dumbbell}
                  title="Nenhum treino disponível"
                  description="Explore as fichas ou vincule-se a um treinador para receber a sua."
                  action={<button type="button" onClick={() => navigate('/trainings')} className="btn-primary-gradient min-h-[44px] px-5 text-sm">Ver fichas de treino</button>}
                />
              </div>
            ) : (
              <RecommendedWorkoutCard
                lastWorkoutId={lastWorkoutId}
                trainings={trainings}
                assignedTrainingId={userProfile?.currentTrainingId}
                weekCount={weekCount}
                weekGoal={goal}
                trainedToday={trainedToday}
                onStart={(id) => navigate(`/training/${id}`)}
                onBrowse={() => navigate('/trainings')}
              />
            )}
          </Reveal>
        )}

        {/* META SEMANAL */}
        {loading ? <Skeleton className="h-44 w-full !rounded-3xl" /> : errors.history ? (
          <BlockError label="seu histórico" onRetry={refresh} />
        ) : (
          <Reveal><WeeklyGoalCard days={weekDays} count={weekCount} goal={goal} onGoalChange={setGoal} /></Reveal>
        )}

        {/* MÉTRICAS */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 !rounded-3xl" />)}</div>
        ) : !errors.history && (
          <section aria-label="Métricas do mês" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <Reveal delay={0}><StatCard icon={CalendarCheck} label="Treinos no mês" value={monthItems.length} className="h-full" /></Reveal>
            <Reveal delay={80}>
              <StatCard icon={Weight} accent="green" label="Volume no mês" value={Math.round(monthVolume / 100) / 10} decimals={1} suffix=" t" spark={volumeSpark} className="h-full" />
            </Reveal>
            <Reveal delay={160}><StatCard icon={Timer} accent="blue" label="Minutos treinados" value={monthMinutes} suffix=" min" className="h-full" /></Reveal>
            <Reveal delay={240}><StatCard icon={Trophy} label="Maior carga (PR)" value={stats.maxGlobalLoad} suffix=" kg" className="h-full" /></Reveal>
          </section>
        )}

        {/* VOLUME + CONQUISTAS */}
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-36 !rounded-3xl" /><Skeleton className="h-36 !rounded-3xl" /></div>
        ) : !errors.history && (
          <Reveal>
            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              <VolumeTrend history={history} />
              <AchievementBadges achievements={achievements} />
            </div>
          </Reveal>
        )}

        {/* PRÓXIMO NÍVEL + PESO */}
        {!loading && (
        <Reveal>
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <div className="surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"><Target className="h-4 w-4 text-brand" aria-hidden="true" /> Próximo nível</h2>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{stats.totalTreinos}/{stats.nextLevelTreinos}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(stats.progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso para o próximo nível">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#FF9800] transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Faltam {Math.max(0, stats.nextLevelTreinos - stats.totalTreinos)} treinos.</p>
            </div>
            <button type="button" onClick={() => navigate('/measurements')} className="surface surface-hover pressable group flex min-h-[44px] items-center justify-between p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Peso corporal</h2>
                <p className="font-display text-3xl font-black text-gray-900 dark:text-white">{userProfile?.weight || '--'}<span className="ml-0.5 text-base text-gray-500">kg</span></p>
                <p className="mt-1 text-xs font-bold text-amber-700 dark:text-brand">Atualizar medidas →</p>
              </div>
              <Scale className="h-8 w-8 text-gray-400 transition-all group-hover:scale-110 group-hover:text-brand" aria-hidden="true" />
            </button>
          </div>
        </Reveal>
        )}

        {/* CARROSSEL DE TREINOS */}
        {!loading && carousel.length > 0 && (
          <section aria-label="Treinos disponíveis">
            <div className="mb-3 flex items-end justify-between px-1">
              <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Treinos para você</h2>
              <Link to="/trainings" className="flex min-h-[44px] items-center text-xs font-bold text-amber-700 dark:text-brand">Ver todos <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <div className="no-scrollbar scroll-snap-x scroll-px-4 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {carousel.map((t, i) => (
                <Link
                  key={t.firestoreId}
                  to={`/training/${t.firestoreId}`}
                  className="surface surface-hover pressable animate-fade-up w-60 shrink-0 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-64"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand"><Dumbbell className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-3 line-clamp-1 font-display text-base font-black text-gray-900 dark:text-white">{t.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.exercises?.length || 0} exercícios{t.difficulty ? ` • ${t.difficulty}` : ''}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FREQUÊNCIA + ATIVIDADE RECENTE */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><Skeleton className="h-56 !rounded-3xl lg:col-span-2" /><Skeleton className="h-56 !rounded-3xl" /></div>
        ) : errors.history ? null : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-black text-gray-900 dark:text-white">Frequência semanal</h2>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Mantenha o foco!</span>
            </div>
            <WeeklyChart history={history} />
          </Reveal>

          <Reveal delay={100}>
            <div className="surface flex h-full flex-col p-5">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Atividade recente</h2>
              {recent.length > 0 ? (
                <ul className="flex-1 space-y-2">
                  {recent.map((h, i) => (
                    <li key={h.id || i} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                      <Link
                        to={h.id ? `/history/${h.id}` : '/history'}
                        className="pressable flex min-h-[56px] items-center gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15"><Trophy className="h-5 w-5 text-brand" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{h.trainingName}</span>
                          <span className="block text-xs capitalize text-gray-500 dark:text-gray-400">
                            {formatDate(h.date, { weekday: 'short', day: 'numeric', month: 'short' })} • {Math.floor((h.duration || 0) / 60)} min • {formatVolume(h.totalVolume || 0)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Dumbbell}
                  title="Nenhum treino ainda"
                  description="Inicie seu primeiro treino e acompanhe sua jornada aqui."
                  action={<button type="button" onClick={() => navigate('/trainings')} className="btn-primary-gradient min-h-[44px] px-5 text-sm">Começar jornada</button>}
                />
              )}
              {recent.length > 0 && (
                <button type="button" onClick={() => navigate('/history')} className="pressable mt-3 min-h-[44px] w-full rounded-2xl border border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/5">
                  Ver histórico completo
                </button>
              )}
            </div>
          </Reveal>
        </div>
        )}

        {/* CARD DO TREINADOR (COACH) */}
        {!loading && isCoach && (
          <Reveal>
            <div className="surface flex flex-col items-center justify-between gap-4 p-5 sm:flex-row">
              <div className="text-center sm:text-left">
                <span className="rounded-full bg-brand px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">Modo Coach</span>
                <h2 className="mt-2 font-display text-xl font-black text-gray-900 dark:text-white">Painel do Treinador</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Gerencie seus alunos e prescreva treinos.</p>
              </div>
              <button type="button" onClick={() => navigate('/coach/dashboard')} className="btn-primary-gradient min-h-[48px] w-full px-6 text-sm sm:w-auto">
                <Wrench className="h-4 w-4" aria-hidden="true" /> Acessar painel
              </button>
            </div>
          </Reveal>
        )}

        {/* MODAL DE CONFIRMAÇÃO DE DESCARTE DE TREINO */}
        <ConfirmDialog
          open={showConfirmDiscard}
          title="Descartar treino em andamento?"
          message="As séries registradas neste rascunho serão perdidas. Deseja realmente descartar?"
          confirmLabel="Descartar"
          danger
          onCancel={() => setShowConfirmDiscard(false)}
          onConfirm={handleDiscardActiveWorkout}
        />

        <LinkCoachModal
          isOpen={showLinkCoach}
          onClose={() => setShowLinkCoach(false)}
          currentUserId={user.uid}
          onSuccess={refresh}
        />

        <AICoachModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          userProfile={userProfile}
          user={user}
          customExercises={[]}
          onWorkoutSaved={refresh}
        />

        {/* WIDGET DE CHAT (desktop; só aparece se tiver coach) */}
        <StudentChatWidget />

        {/* ATALHOS FLUTUANTES (mobile): Chat e Coach IA */}
        <div
          className="fixed right-4 z-40 flex flex-col items-end gap-3 md:bottom-24"
          style={{ bottom: `calc(${activeSession ? '8.5rem' : '5.5rem'} + env(safe-area-inset-bottom, 0px))` }}
        >
          <Link to="/chat" aria-label="Abrir chat com o treinador" className="pressable flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:text-white md:hidden">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setIsAIModalOpen(true)}
            aria-label="Abrir Coach IA"
            className="pressable animate-float flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-brand to-[#FF9800] px-5 font-black text-black shadow-xl shadow-brand/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm">Coach IA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
