import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import WeeklyChart from '../../components/dashboard/WeeklyChart';
import { useRole } from '../../hooks/useRole';
import toast from 'react-hot-toast';
import StudentChatWidget from '../../components/chat/StudentChatWidget'; // ✅ Importação do Widget
import { Flame, Trophy, Target, Scale, Link2, Wrench, Clock, ClipboardList, Sparkles, Smile, Play, Calendar, AlertCircle } from 'lucide-react';

// --- MODAL PARA VINCULAR TREINADOR ---
const LinkCoachModal = ({ isOpen, onClose, currentUserId, onSuccess }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLink = async () => {
        const cleanCode = code.trim();
        if (!cleanCode) return toast.error("Digite o código do treinador.");
        
        setLoading(true);
        try {
            // 1. Verifica se o coach existe
            const coachRef = doc(db, 'users', cleanCode);
            const coachSnap = await getDoc(coachRef);

            if (!coachSnap.exists()) {
                throw new Error("Treinador não encontrado.");
            }

            const coachData = coachSnap.data();
            if (coachData.role !== 'coach' && coachData.role !== 'admin') {
                throw new Error("Este código não pertence a um treinador.");
            }

            // 2. Atualiza o perfil do aluno
            await updateDoc(doc(db, 'users', currentUserId), {
                coachId: cleanCode
            });

            toast.success(`Vinculado a ${coachData.displayName}!`);
            onSuccess(); // Recarrega a home
            onClose();

        } catch (error) {
            console.error(error);
            toast.error(error.message || "Erro ao vincular.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Vincular Treinador</h3>
                <p className="text-sm text-gray-500 mb-4">Peça o "Código de Convite" (UID) para seu coach e digite abaixo.</p>
                
                <input 
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Cole o código aqui..."
                    className="w-full bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono text-center tracking-widest text-sm"
                />

                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">Cancelar</button>
                    <button 
                        onClick={handleLink} 
                        disabled={loading}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                        {loading ? 'Vinculando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- CARD DE TREINO RECOMENDADO ---
const RecommendedWorkoutCard = ({ lastWorkoutId, trainings, onStart, assignedTrainingId }) => {
  let nextTraining = null;
  let isAssigned = false;

  if (assignedTrainingId) {
      nextTraining = trainings.find(t => t.firestoreId === assignedTrainingId);
      if (nextTraining) isAssigned = true;
  }

  if (!nextTraining && trainings.length > 0) {
      if (lastWorkoutId) {
          const lastIndex = trainings.findIndex(t => t.firestoreId === lastWorkoutId);
          if (lastIndex !== -1 && lastIndex < trainings.length - 1) {
              nextTraining = trainings[lastIndex + 1];
          } else {
              nextTraining = trainings[0];
          }
      } else {
          nextTraining = trainings[0];
      }
  }

  if (!nextTraining) return (
      <div className="p-8 bg-gray-100 dark:bg-gray-800 rounded-3xl text-center border-2 border-dashed border-gray-300 dark:border-gray-700 mb-8">
          <p className="text-gray-500 font-medium">Nenhum treino disponível.</p>
          <p className="text-xs text-gray-400 mt-1">Aguarde seu treinador criar uma ficha ou vincule-se a um coach.</p>
      </div>
  );

  return (
    <div className={`rounded-3xl p-6 shadow-xl text-white relative overflow-hidden mb-8 group transition-all transform hover:scale-[1.01] duration-300 ${
        isAssigned 
        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-purple-600/30' 
        : 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-blue-600/30'
    }`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-4 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
            {isAssigned ? <Target className="w-32 h-32 text-white" /> : <Flame className="w-32 h-32 text-white" />}
        </div>
        
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1.5 ${isAssigned ? 'bg-white/20 backdrop-blur-md text-white' : 'bg-black/20 text-white/90'}`}>
                    {isAssigned ? (
                        <><Sparkles className="w-3 h-3" /> Prescrito pelo Coach</>
                    ) : (
                        'Sugestão do Dia'
                    )}
                </span>
                <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider bg-black/10 px-2 py-1 rounded">
                    {nextTraining.difficulty}
                </span>
            </div>
            
            <h2 className="text-3xl font-black mb-2 leading-tight">{nextTraining.name}</h2>
            <p className="text-white/80 text-sm mb-6 max-w-lg line-clamp-2">
                {nextTraining.description || "Foco total no progresso e consistência."}
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button 
                    onClick={() => onStart(nextTraining.firestoreId)}
                    className="bg-white text-gray-900 px-8 py-3.5 rounded-xl font-black shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-gray-50"
                >
                    <Play className="w-4 h-4 fill-current" /> INICIAR TREINO
                </button>
                <div className="flex items-center gap-4 text-xs font-bold text-white/90 bg-black/10 px-4 py-2 rounded-lg w-fit">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ~45 min</span>
                    <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                    <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> {nextTraining.exercises?.length || 0} Exercícios</span>
                </div>
            </div>
        </div>
    </div>
  );
};

// --- CARD DE CONSISTÊNCIA ---
const ConsistencyCard = ({ history }) => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentWorkouts = history.filter(h => new Date(h.date) >= twoWeeksAgo).length;
    let status = "Iniciando";
    let color = "text-blue-500 bg-blue-50 dark:bg-blue-900/20";
    if(recentWorkouts >= 8) { status = "Imparável"; color = "text-orange-500 bg-orange-50 dark:bg-orange-900/20"; }
    else if(recentWorkouts >= 4) { status = "Constante"; color = "text-green-500 bg-green-50 dark:bg-green-900/20"; }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2 gap-2">
                <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider leading-tight">Frequência (14d)</h3>
                <span className={`text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap ${color}`}>{status}</span>
            </div>
            <div>
                <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-gray-800 dark:text-white">{recentWorkouts}</span>
                    <span className="text-sm text-gray-400 font-bold mb-1">treinos</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Nos últimos 14 dias.</p>
            </div>
        </div>
    );
};

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
  }, [user, refreshTrigger]); 

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
    let level = 'Iniciante 🌱';
    let nextLevel = 10;
    if (totalTreinos >= 100) { level = 'Lenda 👑'; nextLevel = 1000; }
    else if (totalTreinos >= 50) { level = 'Monstro 🦍'; nextLevel = 100; }
    else if (totalTreinos >= 25) { level = 'Atleta 🏃'; nextLevel = 50; }
    else if (totalTreinos >= 10) { level = 'Focado 🧠'; nextLevel = 25; }
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

  const formatVolume = (kg) => kg > 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`;

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>;

  const firstName = (userProfile?.displayName || user?.displayName || 'Atleta').split(' ')[0];
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const lastWorkoutId = history.length > 0 ? history[0].trainingId : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 pb-32 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
            <div className="flex items-center gap-3">
                <div onClick={() => navigate('/profile')} className="w-14 h-14 rounded-full overflow-hidden shadow-md border-2 border-white dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity">
                    {photoURL ? (
                        <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                            {firstName[0]}
                        </div>
                    )}
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Olá, {firstName}!</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-800">{stats.level}</span>
                        
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
            <div className="text-center bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3 self-end sm:self-auto">
                <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-bounce" />
                <div className="text-left">
                    <p className="text-xs text-gray-400 font-bold uppercase">Sequência</p>
                    <p className="text-lg font-black text-gray-800 dark:text-gray-200 leading-none">{stats.streak} dias</p>
                </div>
            </div>
        </div>

        {/* --- CARD DO TREINADOR (ADMIN/COACH) --- */}
        {isCoach && (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-center relative overflow-hidden group border border-gray-700 gap-4">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-white/5 skew-x-12 transform translate-x-10"></div>
                <div className="relative z-10 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                        <span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Modo Coach</span>
                    </div>
                    <h3 className="text-lg font-bold">Painel do Treinador</h3>
                    <p className="text-gray-400 text-xs max-w-xs">Gerencie seus alunos e prescreva treinos.</p>
                </div>
                <button 
                    onClick={() => navigate('/coach/dashboard')}
                    className="relative z-10 bg-white text-gray-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-100 active:scale-95 transition-all flex items-center gap-2 text-sm w-full sm:w-auto justify-center"
                >
                    <Wrench className="w-4 h-4 text-gray-800" /> Acessar Painel
                </button>
            </div>
        )}

        {/* CARD DE TREINO */}
        <RecommendedWorkoutCard 
            lastWorkoutId={lastWorkoutId} 
            trainings={trainings} 
            assignedTrainingId={userProfile?.currentTrainingId} 
            onStart={(id) => navigate(`/training/${id}`)}
        />

        {/* METRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:border-blue-200 transition-colors flex flex-col justify-between h-full">
                <div>
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">Próxima Meta <Target className="w-3 h-3 text-blue-500" /></h3>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black text-gray-800 dark:text-white">{stats.nextLevelTreinos}</span>
                        <span className="text-xs font-bold text-gray-400 mb-1">treinos</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${stats.progress}%` }}></div>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-right">Faltam {stats.nextLevelTreinos - stats.totalTreinos}</p>
            </div>

            <ConsistencyCard history={history} />

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-full">
                <div>
                    <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Maior Carga (PR)</h3>
                    <div className="flex items-end gap-1">
                        <span className="text-3xl font-black text-gray-800 dark:text-white">{stats.maxGlobalLoad}</span>
                        <span className="text-sm font-bold text-gray-400 mb-1">kg</span>
                    </div>
                </div>
                <p className="text-[10px] text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded w-fit mt-2 font-bold flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-purple-500 fill-purple-500" /> Seu recorde pessoal
                </p>
            </div>

            <div onClick={() => navigate('/measurements')} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-blue-300 transition-colors group flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Peso Corporal</h3>
                        <span className="text-3xl font-black text-gray-800 dark:text-white">{userProfile?.weight || '--'}kg</span>
                    </div>
                    <Scale className="w-6 h-6 text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-300" />
                </div>
                <p className="text-[10px] text-blue-500 mt-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Atualizar medidas →</p>
            </div>
        </div>

        {/* GRAFICO E HISTÓRICO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <div className="mb-4 flex items-center justify-between px-1">
                    <h3 className="font-bold text-gray-700 dark:text-white text-lg">Frequência Semanal</h3>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Mantenha o foco! 🚀</span>
                </div>
                <WeeklyChart history={history} />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">Última Conquista</h3>
                {history.length > 0 ? (
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center shadow-sm">
                                <Trophy className="w-7 h-7 text-yellow-500 fill-yellow-500 animate-bounce" />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-gray-800 dark:text-white leading-tight line-clamp-1">{history[0].trainingName}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">{new Date(history[0].date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
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
                        <button onClick={() => navigate('/trainings')} className="text-blue-500 font-bold text-xs mt-2 hover:underline">Começar Jornada</button>
                    </div>
                )}
            </div>
        </div>

        {/* MODAL DE VINCULAR */}
        <LinkCoachModal 
            isOpen={showLinkCoach} 
            onClose={() => setShowLinkCoach(false)} 
            currentUserId={user.uid}
            onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
        />

        {/* ✅ WIDGET DE CHAT (Aparece sozinho se tiver coach) */}
        <StudentChatWidget />

      </div>
    </div>
  );
}