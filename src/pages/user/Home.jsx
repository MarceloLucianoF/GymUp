import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate, Link } from 'react-router-dom';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
import { useRole } from '../../hooks/useRole';
import toast from 'react-hot-toast';
import StudentChatWidget from '../../components/chat/StudentChatWidget';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import AICoachModal from '../../components/ai/AICoachModal';
import { Flame, Trophy, Target, Scale, Link2, Wrench, Sparkles, Timer, Weight, CalendarCheck, MessageSquare, ChevronRight, Dumbbell } from 'lucide-react';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ActiveWorkoutBanner from '../../components/dashboard/ActiveWorkoutBanner';
import LinkCoachModal from '../../components/dashboard/LinkCoachModal';
import RecommendedWorkoutCard from '../../components/dashboard/RecommendedWorkoutCard';
import { formatDate, formatTonnage } from '../../utils/format';
import ProgressRing from '../../components/ui/ProgressRing';
import StatCard from '../../components/ui/StatCard';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import Reveal from '../../components/ui/Reveal';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import WeekStrip, { getWeekDays } from '../../components/dashboard/WeekStrip';

const WEEKLY_GOAL = 4;

const HomeSkeleton = () => (
  <div className="min-h-screen bg-gray-50 p-4 pb-32 dark:bg-[#0B0F19] md:p-8" role="status" aria-label="Carregando">
    <div className="mx-auto max-w-6xl space-y-5">
      <Skeleton className="h-44 w-full !rounded-3xl" />
      <Skeleton className="h-48 w-full !rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 !rounded-3xl" />)}
      </div>
      <Skeleton className="h-40 w-full !rounded-3xl" />
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function Home() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { isCoach } = useRole(); 
  
  const [history, setHistory] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLinkCoach, setShowLinkCoach] = useState(false); 
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  // Sessão Ativa de Treino (Persistência)
  const [activeSession, setActiveSession] = useState(null);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  
  const [stats, setStats] = useState({ 
    totalTreinos: 0, 
    maxGlobalLoad: 0, 
    streak: 0,
    level: 'Iniciante',
    nextLevelTreinos: 10,
    progress: 0
  });

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        if (!user) return;

        // 0. Sincroniza check-ins offline pendentes (se houver)
        const synced = await activeWorkoutService.syncPendingCheckIns(user.uid, db, addDoc, collection);
        if (synced > 0) {
          toast.success(`✓ ${synced} treino(s) pendente(s) sincronizado(s)!`);
        }

        // 0.1. Verifica treino em andamento
        const savedSession = activeWorkoutService.getActiveSession(user.uid);
        setActiveSession(savedSession);

        // 1. Perfil
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            setUserProfile(userDoc.data());
        }

        // 2. Histórico
        const qHistory = query(collection(db, 'checkIns'), where('userId', '==', user.uid), orderBy('date', 'desc'));
        const historySnap = await getDocs(qHistory);
        const historyData = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(historyData);
        calculateGamification(historyData);

        // 3. Treinos
        const qTrainings = query(collection(db, 'trainings'), orderBy('name', 'asc')); 
        const trainingSnap = await getDocs(qTrainings);
        const trainingList = trainingSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        setTrainings(trainingList);

      } catch (error) {
        console.error("Erro Home:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();

    const handleWorkoutUpdate = () => {
      if (user) {
        setActiveSession(activeWorkoutService.getActiveSession(user.uid));
      }
    };

    const handleOnline = async () => {
      if (user) {
        const synced = await activeWorkoutService.syncPendingCheckIns(user.uid, db, addDoc, collection);
        if (synced > 0) {
          toast.success(`✓ ${synced} treino(s) pendente(s) sincronizado(s)!`);
          setRefreshTrigger(prev => prev + 1);
        }
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('active-workout-updated', handleWorkoutUpdate);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('active-workout-updated', handleWorkoutUpdate);
    };
  }, [user, refreshTrigger]); 

  const handleDiscardActiveWorkout = () => {
    if (!user) return;
    activeWorkoutService.clearActiveSession(user.uid);
    setActiveSession(null);
    setShowConfirmDiscard(false);
    toast.success("Treino em andamento descartado.");
  }; 

  const calculateGamification = (data) => {
    const totalTreinos = data.length;
    let maxGlobalLoad = 0;
    data.forEach(treino => {
        if (treino.exercises) {
            treino.exercises.forEach(ex => {
                if (ex.sets) ex.sets.forEach(s => {
                    const weight = Number(s.weight) || 0;
                    if (weight > maxGlobalLoad) maxGlobalLoad = weight;
                });
            });
        }
    });
    let level = 'Iniciante';
    let nextLevel = 10;
    if (totalTreinos >= 100) { level = 'Lenda'; nextLevel = 1000; }
    else if (totalTreinos >= 50) { level = 'Monstro'; nextLevel = 100; }
    else if (totalTreinos >= 25) { level = 'Atleta'; nextLevel = 50; }
    else if (totalTreinos >= 10) { level = 'Focado'; nextLevel = 25; }
    let base = 0;
    if (totalTreinos >= 10) base = 10;
    if (totalTreinos >= 25) base = 25;
    if (totalTreinos >= 50) base = 50;
    const progress = Math.min(100, Math.max(0, ((totalTreinos - base) / (nextLevel - base)) * 100));
    
    // Streak
    const uniqueDates = [...new Set(data.map(d => new Date(d.date).toISOString().split('T')[0]))].sort().reverse();
    let streak = 0;
    if (uniqueDates.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
            streak = 1;
            for (let i = 0; i < uniqueDates.length - 1; i++) {
                const curr = new Date(uniqueDates[i]);
                const prev = new Date(uniqueDates[i+1]);
                if (Math.ceil(Math.abs(curr - prev) / 86400000) === 1) streak++; else break;
            }
        }
    }
    setStats({ totalTreinos, maxGlobalLoad, level, nextLevelTreinos: nextLevel, progress, streak });
  };

  const formatVolume = (kg) => kg > 1000 ? formatTonnage(kg) : `${kg}kg`;

  if (loading) return <HomeSkeleton />;

  const firstName = (userProfile?.displayName || user?.displayName || 'Atleta').split(' ')[0];
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const lastWorkoutId = history.length > 0 ? history[0].trainingId : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const weekDays = getWeekDays(history);
  const weekCount = weekDays.filter((d) => d.trained).length;
  const weekPct = Math.min(100, Math.round((weekCount / WEEKLY_GOAL) * 100));

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
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">

        {/* HERO */}
        <section className="surface aurora-bg relative overflow-hidden p-5 sm:p-7 animate-fade-up" aria-label="Resumo da semana">
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
                  {!userProfile?.coachId && (
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
            <div className="flex shrink-0 flex-col items-center rounded-2xl bg-orange-500/10 px-3 py-2" aria-label={`Sequência de ${stats.streak} dias`}>
              <Flame className={`h-6 w-6 fill-orange-500 text-orange-500 ${stats.streak > 0 ? 'animate-float' : 'opacity-50'}`} aria-hidden="true" />
              <p className="font-display text-lg font-black leading-none text-gray-900 dark:text-white"><AnimatedNumber value={stats.streak} /></p>
              <p className="text-[9px] font-bold uppercase text-gray-500 dark:text-gray-400">dias</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-5">
            <ProgressRing value={weekPct} size={96} stroke={9}>
              <div className="text-center leading-none">
                <p className="font-display text-xl font-black text-gray-900 dark:text-white">{weekCount}<span className="text-xs font-bold text-gray-500">/{WEEKLY_GOAL}</span></p>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-black text-gray-900 dark:text-white">Meta semanal</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {weekCount >= WEEKLY_GOAL ? 'Meta batida! Você é imparável.' : `Faltam ${WEEKLY_GOAL - weekCount} treino(s) para fechar a semana.`}
              </p>
            </div>
          </div>
          <div className="mt-5"><WeekStrip days={weekDays} /></div>
        </section>

        {/* TREINO DE HOJE */}
        <Reveal>
          {activeSession ? (
            <ActiveWorkoutBanner
              activeSession={activeSession}
              onContinue={() => navigate(`/execution/${activeSession.trainingId}`)}
              onDiscard={() => setShowConfirmDiscard(true)}
            />
          ) : (
            <RecommendedWorkoutCard
              lastWorkoutId={lastWorkoutId}
              trainings={trainings}
              assignedTrainingId={userProfile?.currentTrainingId}
              onStart={(id) => navigate(`/training/${id}`)}
            />
          )}
        </Reveal>

        {/* MÉTRICAS */}
        <section aria-label="Métricas do mês" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <Reveal delay={0}><StatCard icon={CalendarCheck} label="Treinos no mês" value={monthItems.length} className="h-full" /></Reveal>
          <Reveal delay={80}>
            <StatCard icon={Weight} accent="green" label="Volume no mês" value={Math.round(monthVolume / 100) / 10} decimals={1} suffix=" t" spark={volumeSpark} className="h-full" />
          </Reveal>
          <Reveal delay={160}><StatCard icon={Timer} accent="blue" label="Minutos treinados" value={monthMinutes} suffix=" min" className="h-full" /></Reveal>
          <Reveal delay={240}><StatCard icon={Trophy} label="Maior carga (PR)" value={stats.maxGlobalLoad} suffix=" kg" className="h-full" /></Reveal>
        </section>

        {/* PRÓXIMA META + PESO */}
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

        {/* CARROSSEL DE TREINOS */}
        {carousel.length > 0 && (
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

        {/* CARD DO TREINADOR (COACH) */}
        {isCoach && (
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
          onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        />

        <AICoachModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          userProfile={userProfile}
          user={user}
          customExercises={[]}
          onWorkoutSaved={() => setRefreshTrigger(prev => prev + 1)}
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
