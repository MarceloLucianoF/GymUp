import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
import { useRole } from '../../hooks/useRole';
import toast from 'react-hot-toast';
import StudentChatWidget from '../../components/chat/StudentChatWidget';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import AICoachModal from '../../components/ai/AICoachModal';
import { Flame, Trophy, Target, Scale, Link2, Wrench, Sparkles, Smile } from 'lucide-react';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ActiveWorkoutBanner from '../../components/dashboard/ActiveWorkoutBanner';
import LinkCoachModal from '../../components/dashboard/LinkCoachModal';
import RecommendedWorkoutCard from '../../components/dashboard/RecommendedWorkoutCard';
import ConsistencyCard from '../../components/dashboard/ConsistencyCard';
import { formatDate, formatTonnage } from '../../utils/format';

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
        const historyData = historySnap.docs.map(d => d.data());
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

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand"></div></div>;

  const firstName = (userProfile?.displayName || user?.displayName || 'Atleta').split(' ')[0];
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const lastWorkoutId = history.length > 0 ? history[0].trainingId : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 pb-32 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-row justify-between items-center px-1 sm:px-2 gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div onClick={() => navigate('/profile')} className="w-14 h-14 rounded-full overflow-hidden shadow-md border-2 border-white dark:border-gray-850 cursor-pointer hover:opacity-90 transition-opacity shrink-0">
                    {photoURL ? (
                        <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-black font-bold text-xl">
                            {firstName[0]}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white tracking-tight truncate">Olá, {firstName}!</h1>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="bg-brand/10 text-brand px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-brand/20">{stats.level}</span>
                        
                        {/* BOTÃO VINCULAR (Só aparece se não tiver coach) */}
                        {!userProfile?.coachId && (
                            <button 
                                onClick={() => setShowLinkCoach(true)} 
                                className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
                            >
                                <Link2 className="w-3 h-3" /> Vincular Treinador
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-gray-100 dark:border-gray-750 shadow-sm flex items-center gap-2 sm:gap-3 shrink-0">
                <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 fill-orange-500" />
                <div className="text-left">
                    <p className="text-[9px] sm:text-xs text-gray-400 font-bold uppercase">Racha</p>
                    <p className="text-sm sm:text-lg font-black text-gray-800 dark:text-gray-200 leading-none">{stats.streak} dias</p>
                </div>
            </div>
        </div>

        {/* CARD PRINCIPAL DE TREINO (EXIBE EM ANDAMENTO OU RECOMENDADO) */}
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

        {/* CARD DE ASSISTENTE DE IA: COACH & NUTRIÇÃO */}
        <div className="card-premium-glass p-5 rounded-3xl border border-brand/30 bg-gradient-to-r from-gray-900 via-[#1F2937] to-gray-900 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-[#FF9800] flex items-center justify-center text-black font-black shadow-lg shadow-brand/25 shrink-0">
                    <Sparkles className="w-6 h-6 fill-current animate-pulse" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">Coach IA & Guia de Nutrição</h3>
                        <span className="bg-brand/10 text-brand text-[9px] font-black px-2.5 py-0.5 rounded-full border border-brand/20 uppercase">Novo</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">Gere treinos sob medida, consulte macros e tire dúvidas nutricionais.</p>
                </div>
            </div>
            <button
                onClick={() => setIsAIModalOpen(true)}
                className="w-full sm:w-auto btn-primary-gradient px-5 py-3 rounded-2xl touch-target text-xs font-black shrink-0 flex items-center justify-center gap-2"
            >
                Acessar Coach IA →
            </button>
        </div>

        {/* --- CARD DO TREINADOR (ADMIN/COACH) --- */}
        {isCoach && (
            <div className="bg-[#1F2937]/50 backdrop-blur-md rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-center relative overflow-hidden group border border-brand/20 gap-4 hover:border-brand/40 transition-all">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-white/5 skew-x-12 transform translate-x-10"></div>
                <div className="relative z-10 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                        <span className="bg-brand text-black text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Modo Coach</span>
                    </div>
                    <h3 className="text-xl font-black tracking-tight">Painel do Treinador</h3>
                    <p className="text-gray-400 text-xs max-w-xs mt-1">Gerencie seus alunos e prescreva treinos com controle total.</p>
                </div>
                <button 
                    onClick={() => navigate('/coach/dashboard')}
                    className="relative z-10 btn-primary-gradient px-6 py-3 text-sm w-full sm:w-auto justify-center"
                >
                    <Wrench className="w-4 h-4 text-black" /> Acessar Painel
                </button>
            </div>
        )}

        {/* METRICAS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-brand/10 relative overflow-hidden group hover:border-brand/45 transition-all hover:-translate-y-1 hover:scale-[1.01] duration-300 flex flex-col justify-between h-full hover-glow-brand">
                <div>
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand"></div>
                    <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">Próxima Meta <Target className="w-3 h-3 text-brand" /></h3>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black text-gray-800 dark:text-white">{stats.nextLevelTreinos}</span>
                        <span className="text-xs font-bold text-gray-400 mb-1">treinos</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-brand h-full transition-all duration-1000" style={{ width: `${stats.progress}%` }}></div>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-right">Faltam {stats.nextLevelTreinos - stats.totalTreinos}</p>
            </div>

            <div className="hover:border-brand/45 transition-all hover:-translate-y-1 hover:scale-[1.01] duration-300 flex flex-col justify-between h-full hover-glow-brand">
                <ConsistencyCard history={history} />
            </div>

            <div className="bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-brand/10 hover:border-brand/45 transition-all hover:-translate-y-1 hover:scale-[1.01] duration-300 flex flex-col justify-between h-full hover-glow-brand">
                <div>
                    <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Maior Carga (PR)</h3>
                    <div className="flex items-end gap-1">
                        <span className="text-3xl font-black text-gray-800 dark:text-white">{stats.maxGlobalLoad}</span>
                        <span className="text-sm font-bold text-gray-400 mb-1">kg</span>
                    </div>
                </div>
                <p className="text-[10px] text-brand bg-brand/10 px-2 py-1 rounded w-fit mt-2 font-bold flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-brand fill-brand" /> Seu recorde pessoal
                </p>
            </div>

            <div onClick={() => navigate('/measurements')} className="bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-brand/10 cursor-pointer hover:border-brand/45 transition-all hover:-translate-y-1 hover:scale-[1.01] duration-300 group flex flex-col justify-between h-full hover-glow-brand">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Peso Corporal</h3>
                        <span className="text-3xl font-black text-gray-800 dark:text-white">{userProfile?.weight || '--'}kg</span>
                    </div>
                    <Scale className="w-6 h-6 text-gray-400 group-hover:text-brand group-hover:scale-110 transition-all duration-300" />
                </div>
                <p className="text-[10px] text-brand mt-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Atualizar medidas →</p>
            </div>
        </div>

        {/* GRAFICO E HISTÓRICO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <div className="mb-4 flex items-center justify-between px-1">
                    <h3 className="font-bold text-gray-700 dark:text-white text-lg">Frequência Semanal</h3>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Mantenha o foco!</span>
                </div>
                <WeeklyChart history={history} />
            </div>

            <div className="bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-brand/10 flex flex-col h-full hover:border-brand/20 transition-all duration-300">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">Última Conquista</h3>
                {history.length > 0 ? (
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center shadow-sm">
                                <Trophy className="w-7 h-7 text-yellow-500 fill-yellow-500 animate-bounce" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-gray-800 dark:text-white leading-tight line-clamp-1">{history[0].trainingName}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">{formatDate(history[0].date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                <p className="text-[9px] text-gray-400 uppercase font-bold">Tempo</p>
                                <p className="font-mono font-bold text-gray-800 dark:text-white text-lg">{Math.floor(history[0].duration / 60)}<span className="text-xs ml-0.5">min</span></p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                <p className="text-[9px] text-gray-400 uppercase font-bold">Volume</p>
                                <p className="font-mono font-bold text-gray-800 dark:text-white text-lg">{formatVolume(history[0].totalVolume)}</p>
                            </div>
                        </div>
                        <button onClick={() => navigate('/history')} className="w-full mt-auto py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs uppercase tracking-wide">Ver Histórico Completo</button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center py-8 text-gray-400">
                        <Smile className="w-10 h-10 text-gray-400 mb-2 opacity-50" />
                        <p className="text-sm font-medium">Nenhum treino ainda.</p>
                        <button onClick={() => navigate('/trainings')} className="text-brand font-bold text-xs mt-2 hover:underline">Começar Jornada</button>
                    </div>
                )}
            </div>
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

        {/* MODAL DE VINCULAR */}
        <LinkCoachModal 
            isOpen={showLinkCoach} 
            onClose={() => setShowLinkCoach(false)} 
            currentUserId={user.uid}
            onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
        />

        {/* MODAL DO COACH IA & NUTRIÇÃO */}
        <AICoachModal 
            isOpen={isAIModalOpen} 
            onClose={() => setIsAIModalOpen(false)} 
            userProfile={userProfile}
            user={user}
            customExercises={[]}
            onWorkoutSaved={() => setRefreshTrigger(prev => prev + 1)}
        />

        {/* WIDGET DE CHAT (Aparece sozinho se tiver coach) */}
        <StudentChatWidget />

      </div>
    </div>
  );
}