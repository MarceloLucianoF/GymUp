import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Scale, Link2, Wrench, Sparkles, MessageSquare, Dumbbell, RefreshCw, CalendarDays } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useRole } from '../../hooks/useRole';
import { useStudentHome, useWeeklyGoal } from '../../hooks/useStudentHome';
import WeekTodayCard from '../../components/dashboard/WeekTodayCard';
import { listMyWorkouts } from '../../services/myWorkouts';
import { weekStatus } from '../../utils/weekSchedule';
import StudentChatWidget from '../../components/chat/StudentChatWidget';
import AICoachModal from '../../components/ai/AICoachModal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ActiveWorkoutBanner from '../../components/dashboard/ActiveWorkoutBanner';
import CoachLinkModal from '../../components/coach/CoachLinkModal';
import useMyCoach from '../../hooks/useMyCoach';
import RecommendedWorkoutCard from '../../components/dashboard/RecommendedWorkoutCard';
import WeeklyGoalCard from '../../components/dashboard/WeeklyGoalCard';
import FriendsWeekCard from '../../components/dashboard/FriendsWeekCard';
import CoachMessageCard from '../../components/dashboard/CoachMessageCard';
import HomeShortcuts from '../../components/dashboard/HomeShortcuts';
import EvolutionLinkCard from '../../components/dashboard/EvolutionLinkCard';
import { monthNumbers } from '../../components/dashboard/TrainingNumbers';
import { useFriendsPreview, useCoachMessage } from '../../hooks/useHomeExtras';
import { getWeekDays } from '../../components/dashboard/WeekStrip';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

// Home do aluno = "o que eu faço agora?". No máximo 6 blocos, nesta ordem: treino de hoje (ou continuar),
// atalhos, pendências, meta da semana com sequência, amigos e "Ver evolução". Os cartões de números,
// a frequência e as conquistas ficam na Evolução (/measurements); a atividade recente, no Histórico.

const getGreeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
};

const BlockError = ({ label, onRetry }) => (
  <div role="alert" className="surface flex items-center justify-between gap-3 p-4 text-sm text-gray-600 dark:text-gray-300">
    <span>Não foi possível carregar {label}.</span>
    <button type="button" onClick={onRetry} className="pressable min-h-[44px] rounded-xl px-3 text-xs font-bold text-amber-800 dark:text-amber-400 dark:text-brand">Tentar de novo</button>
  </div>
);

export default function Home() {
  const { user, userProfile: ctxProfile } = useAuthContext();
  const navigate = useNavigate();
  const { isCoach } = useRole();
  const { data, loading, error, refresh } = useStudentHome(user, ctxProfile);
  const { profile: userProfile, history, trainings, activeSession, stats, refreshing, errors, discardActiveSession } = data;
  const profileReady = !loading && !errors.profile && !!userProfile;
  const [goal, setGoal] = useWeeklyGoal(user?.uid, userProfile?.weeklyGoal, profileReady);

  const [showLinkCoach, setShowLinkCoach] = useState(false);
  const mine = useMyCoach(user?.uid, userProfile);
  const friends = useFriendsPreview(user?.uid);
  const coachMsg = useCoachMessage(user?.uid, userProfile?.coachId);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [mineWorkouts, setMineWorkouts] = useState([]);
  useEffect(() => {
    if (!user?.uid) return undefined;
    let alive = true;
    listMyWorkouts(user.uid).then((rows) => { if (alive) setMineWorkouts(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [user?.uid]);
  // Semana montada pela IA (treinos "Semana · Seg · ..."): vira o treino de hoje, a não ser que o treinador tenha prescrito uma ficha
  const weekToday = useMemo(() => weekStatus({ mine: mineWorkouts, history }), [mineWorkouts, history]);

  const handleDiscardActiveWorkout = () => {
    discardActiveSession();
    setShowConfirmDiscard(false);
    toast.success('Treino em andamento descartado.');
  };

  const firstName = (userProfile?.displayName || user?.displayName || 'Atleta').split(' ')[0];
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const greeting = getGreeting();

  const weekDays = getWeekDays(history);
  const weekCount = weekDays.filter((d) => d.trained).length;
  const trainedToday = weekDays.some((d) => d.isToday && d.trained);

  const month = useMemo(() => monthNumbers(history), [history]);

  const coachActive = mine.loading || mine.state === 'active';
  const shortcuts = [
    { key: 'medida', label: 'Registrar medida', icon: Scale, to: '/measurements?nova=1' },
    coachActive
      ? { key: 'professor', label: 'Falar com professor', icon: MessageSquare, to: '/chat', badge: !!coachMsg?.unread }
      : { key: 'professor', label: mine.state === 'pending' ? 'Pedido enviado' : 'Vincular professor', icon: Link2, onClick: () => setShowLinkCoach(true) },
    { key: 'historico', label: 'Histórico', icon: CalendarDays, to: '/history' },
    { key: 'ferramentas', label: 'Ferramentas', icon: Wrench, to: '/ferramentas' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-32 transition-colors duration-300 dark:bg-[#0B0F19] md:p-8">
      <div className="mx-auto max-w-3xl space-y-4 md:space-y-5" aria-busy={loading}>

        {/* CABEÇALHO (compacto: a tela começa pelo treino) */}
        <header className="flex items-center justify-between gap-3 animate-fade-up">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Abrir perfil"
              className="pressable h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-brand shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {photoURL ? (
                <img src={photoURL} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-brand-dark text-lg font-bold text-black">{firstName[0]}</span>
              )}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{greeting},</p>
              <h1 className="flex min-w-0 items-center gap-2 font-display text-xl font-black text-gray-900 dark:text-white sm:text-2xl">
                <span className="truncate text-gradient-brand">{firstName}</span>
                <span className="shrink-0 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-brand">{stats.level}</span>
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isCoach && (
              <Link to="/coach/dashboard" className="pressable flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-amber-800 hover:bg-brand/10 dark:text-brand">
                <Wrench className="h-4 w-4" aria-hidden="true" /> Painel
              </Link>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading}
              aria-label="Atualizar dados"
              className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-white/60 text-gray-700 hover:bg-white disabled:opacity-60 dark:bg-white/10 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </header>
        {error?.profile && <p className="-mt-2 text-xs text-gray-600 dark:text-gray-400">Perfil indisponível no momento.</p>}

        {/* 1. TREINO DE HOJE / CONTINUAR TREINO */}
        <div data-home-block="treino">
          {loading ? (
            <Skeleton className="h-64 w-full !rounded-3xl" />
          ) : activeSession ? (
            <ActiveWorkoutBanner
              activeSession={activeSession}
              onContinue={() => navigate(`/execution/${activeSession.trainingId}`)}
              onDiscard={() => setShowConfirmDiscard(true)}
            />
          ) : errors.trainings ? (
            <BlockError label="seus treinos" onRetry={refresh} />
          ) : trainings.length === 0 && !weekToday ? (
            <div className="surface">
              <EmptyState
                icon={Dumbbell}
                title="Nenhum treino disponível"
                description="Explore as fichas ou vincule-se a um treinador para receber a sua."
                action={<button type="button" onClick={() => navigate('/trainings')} className="btn-primary-gradient min-h-[44px] px-5 text-sm">Ver fichas de treino</button>}
              />
            </div>
          ) : weekToday && !userProfile?.currentTrainingId ? (
            <WeekTodayCard status={weekToday} onStart={(id) => navigate(`/training/${id}`)} />
          ) : (
            <RecommendedWorkoutCard
              history={history}
              trainings={trainings}
              assignedTrainingId={userProfile?.currentTrainingId}
              weekCount={weekCount}
              weekGoal={goal}
              trainedToday={trainedToday}
              showWeekProgress={false}
              onStart={(id) => navigate(`/training/${id}`)}
              onBrowse={() => navigate('/trainings')}
            />
          )}
        </div>

        {/* 2. ATALHOS */}
        <div data-home-block="atalhos">
          <HomeShortcuts items={shortcuts} />
        </div>

        {/* 3. PENDÊNCIAS (recado do treinador ainda não lido) */}
        {coachMsg?.unread && (
          <div data-home-block="pendencias">
            <CoachMessageCard message={coachMsg} coachName={mine.coach?.displayName} />
          </div>
        )}

        {/* 4. META DA SEMANA + SEQUÊNCIA */}
        <div data-home-block="meta">
          {loading ? <Skeleton className="h-36 w-full !rounded-3xl" /> : errors.history ? (
            <BlockError label="seu histórico" onRetry={refresh} />
          ) : (
            <WeeklyGoalCard compact days={weekDays} count={weekCount} goal={goal} onGoalChange={setGoal} streak={stats.streak} />
          )}
        </div>

        {/* 5. AMIGOS (uma linha) */}
        <div data-home-block="amigos">
          <FriendsWeekCard compact preview={friends} />
        </div>

        {/* 6. VER EVOLUÇÃO (os cartões de números ficam na Evolução) */}
        <div data-home-block="evolucao">
          <EvolutionLinkCard monthCount={month.count} monthVolume={month.volume} maxLoad={stats.maxGlobalLoad} />
        </div>

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

        {showLinkCoach && (
          <CoachLinkModal user={user} profile={userProfile} mine={mine} onClose={() => setShowLinkCoach(false)} onChanged={refresh} />
        )}

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

        {/* ATALHO FLUTUANTE: Coach IA (o chat com o professor virou atalho) */}
        <div
          className="fixed right-4 z-40 flex flex-col items-end gap-3 md:bottom-24"
          style={{ bottom: `calc(${activeSession ? '8.5rem' : '5.5rem'} + env(safe-area-inset-bottom, 0px))` }}
        >
          <button
            type="button"
            onClick={() => setIsAIModalOpen(true)}
            aria-label="Abrir Coach IA"
            className="pressable motion-safe:animate-float flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-brand to-[#FF9800] px-5 font-black text-black shadow-xl shadow-brand/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm">Coach IA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
