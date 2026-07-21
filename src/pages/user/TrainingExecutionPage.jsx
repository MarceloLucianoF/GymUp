import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti'; 
import VideoModal from '../../components/common/VideoModal';
import { Dumbbell, Video, Award, List, Search, SkipForward, Timer, ChevronLeft, ChevronRight, Check, Circle } from 'lucide-react';

// --- COMPONENTE TIMER DE DESCANSO ---
const RestTimer = ({ initialSeconds, onFinish, onClose }) => {
    const parsedInitial = parseInt(initialSeconds, 10) || 60;
    const [seconds, setSeconds] = useState(parsedInitial);
    const totalRef = useRef(parsedInitial);

    const handleFinish = useCallback(() => {
        // Vibra no mobile ao terminar
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 300]);
        }
        onFinish();
    }, [onFinish]);

    useEffect(() => {
        const timer = setInterval(() => {
            setSeconds(s => {
                if (s <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (seconds === 0) {
            handleFinish();
        }
    }, [seconds, handleFinish]);

    const adjustSeconds = (amount) => {
        setSeconds(s => {
            const next = s + amount;
            if (next <= 0) return 0;
            if (next > totalRef.current) {
                totalRef.current = next;
            }
            return next;
        });
    };

    // Calcular progresso do SVG
    const circumference = 2 * Math.PI * 120;
    const progress = totalRef.current > 0 ? (seconds / totalRef.current) : 0;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in p-6">
            <div className="text-center text-white w-full max-w-sm">
                <p className="text-sm font-bold uppercase tracking-[0.2em] mb-6 text-gray-400">
                    <Timer className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                    Recuperando
                </p>
                
                <div className="relative w-64 h-64 mx-auto flex items-center justify-center mb-8">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle cx="128" cy="128" r="120" stroke="#333" strokeWidth="8" fill="transparent" />
                        <circle 
                            cx="128" cy="128" r="120" stroke="#FFC107" strokeWidth="8" fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                        />
                    </svg>
                    <div className="text-7xl font-black font-mono tracking-tighter">
                        {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => adjustSeconds(-15)} className="py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-colors text-sm">-15s</button>
                    <button onClick={() => adjustSeconds(30)} className="py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-colors text-sm">+30s</button>
                    <button onClick={onClose} className="py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 text-sm">
                        <SkipForward className="w-4 h-4" /> Pular
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL DE EXECUÇÃO ---
export default function TrainingExecutionPage() {
    const { trainingId } = useParams();
    const { user } = useAuthContext();
    const navigate = useNavigate();
    const location = useLocation();

    const [training, setTraining] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Estado da Execução
    const [elapsedTime, setElapsedTime] = useState(0); 
    const [restTimer, setRestTimer] = useState(null); 
    
    // Modos de Visualização
    const [viewMode, setViewMode] = useState('list'); 
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(0); 

    // Histórico de Cargas e Inputs
    const [historyMap, setHistoryMap] = useState({});
    const [sessionData, setSessionData] = useState({});
    
    const [showVideo, setShowVideo] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null); // ✅ Estado de Zoom da Imagem/GIF

    // 1. Inicialização e Detecção de Dispositivo
    useEffect(() => {
        // Detecta se é mobile (largura < 768px) para definir o modo padrão
        const isMobile = window.innerWidth < 768;
        setViewMode(isMobile ? 'focus' : 'list');

        const initTraining = async () => {
            try {
                let docSnap = await getDoc(doc(db, 'trainings', trainingId));
                let trainingData = null;
                let trainingDocId = null;

                if (docSnap.exists()) {
                    trainingData = docSnap.data();
                    trainingDocId = docSnap.id;
                } else {
                    const q = query(collection(db, 'trainings'), where('firestoreId', '==', trainingId));
                    const qSnap = await getDocs(q);
                    if (!qSnap.empty) {
                        trainingData = qSnap.docs[0].data();
                        trainingDocId = qSnap.docs[0].id;
                    } else {
                        toast.error("Treino não encontrado.");
                        navigate('/home');
                        return;
                    }
                }

                let finalExercises = [];
                if (location.state?.customExerciseList) {
                    finalExercises = location.state.customExerciseList;
                } else {
                    finalExercises = trainingData.exercises || [];
                }

                setTraining({ 
                    id: trainingDocId, 
                    ...trainingData, 
                    exercises: finalExercises 
                });

                // Busca histórico para placeholder de carga
                const qHistory = query(
                    collection(db, 'checkIns'), 
                    where('userId', '==', user.uid),
                    orderBy('date', 'desc'),
                    limit(10)
                );
                const historySnap = await getDocs(qHistory);
                const loadMap = {};
                historySnap.docs.forEach(doc => {
                    const d = doc.data();
                    if (d.exercises) {
                        d.exercises.forEach(ex => {
                            if (!loadMap[ex.name]) {
                                const max = Math.max(...(ex.sets?.map(s => Number(s.weight)||0) || [0]));
                                if (max > 0) loadMap[ex.name] = max;
                            }
                        });
                    }
                });
                setHistoryMap(loadMap);

            } catch (error) {
                console.error("Erro ao iniciar execução:", error);
                toast.error("Erro ao carregar treino.");
            } finally {
                setLoading(false);
            }
        };

        if (user && trainingId) {
            initTraining();
        }

        const globalTimer = setInterval(() => setElapsedTime(t => t + 1), 1000);
        return () => clearInterval(globalTimer);
    }, [trainingId, user, navigate, location.state]);

    // 2. Lógica Avançada de Inputs
    const handleCheckSet = (exIndex, setIndex, targetReps, totalSets, restSeconds, exName) => {
        const key = `${exIndex}-${setIndex}`;
        const current = sessionData[key] || {};
        const isCompleting = !current.completed;

        let finalReps = current.reps;
        let finalWeight = current.weight;

        if (isCompleting) {
            // Reps auto-fill
            if (!finalReps) {
                // Check if any previous set of this exercise has reps
                for (let s = setIndex - 1; s >= 0; s--) {
                    const prevVal = sessionData[`${exIndex}-${s}`]?.reps;
                    if (prevVal) {
                        finalReps = prevVal;
                        break;
                    }
                }
                if (!finalReps) finalReps = targetReps;
            }

            // Weight auto-fill
            if (!finalWeight) {
                // Check if any previous set of this exercise has weight
                for (let s = setIndex - 1; s >= 0; s--) {
                    const prevVal = sessionData[`${exIndex}-${s}`]?.weight;
                    if (prevVal) {
                        finalWeight = prevVal;
                        break;
                    }
                }
                // Fallback to last session's PR / load
                if (!finalWeight) {
                    finalWeight = historyMap[exName] || '';
                }
            }
        }

        setSessionData(prev => ({
            ...prev,
            [key]: {
                ...current,
                completed: isCompleting,
                reps: finalReps,
                weight: finalWeight
            }
        }));

        // Se completou a série
        if (isCompleting) {
            const isLastSetOfExercise = setIndex === totalSets - 1;
            // Usa o tempo de descanso do exercício, ou fallback de 60s
            const restTime = restSeconds || 60;
            
            if (!isLastSetOfExercise) {
                setRestTimer(restTime); 
            } else if (viewMode === 'focus' && isLastSetOfExercise) {
                toast.success("Exercício concluído! Próximo...", { duration: 2000 });
                setTimeout(() => {
                    if (activeExerciseIndex < training.exercises.length - 1) {
                        setActiveExerciseIndex(prev => prev + 1);
                        setRestTimer(restTime); 
                    } else {
                        toast.success("Treino finalizado! Clique em terminar.", { duration: 3000 });
                    }
                }, 500);
            }
        }
    };

    const handleInput = (exIndex, setIndex, field, value) => {
        const key = `${exIndex}-${setIndex}`;
        setSessionData(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
    };

    // 3. Finalizar Treino
    const finishWorkout = async () => {
        if (!window.confirm("Finalizar o treino?")) return;

        const toastId = toast.loading("Salvando...");
        try {
            let totalVolume = 0;
            let setsCompleted = 0;
            
            const exercisesLog = training.exercises.map((ex, exIndex) => {
                const exSets = [];
                const numSets = Number(ex.sets) || 3;
                for(let i=0; i<numSets; i++) {
                    const key = `${exIndex}-${i}`;
                    const data = sessionData[key];
                    if (data?.completed) {
                        setsCompleted++;
                        const w = parseFloat(data.weight) || 0;
                        const r = parseFloat(data.reps) || 0;
                        totalVolume += w * r;
                        exSets.push({ weight: w, reps: r, completed: true });
                    }
                }
                return { name: ex.name, muscleGroup: ex.muscleGroup, sets: exSets };
            });

            const executedExercises = exercisesLog.filter(e => e.sets.length > 0);

            const checkInPayload = {
                userId: user.uid,
                userEmail: user.email,
                userPhoto: user.photoURL || null,
                trainingId: training.id, 
                trainingName: training.name,
                coachId: training.coachId || '',
                date: new Date().toISOString(),
                duration: elapsedTime,
                totalVolume,
                setsCompleted,
                exercises: executedExercises,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'checkIns'), checkInPayload);
            await updateDoc(doc(db, 'users', user.uid), { lastWorkoutDate: new Date().toISOString() });

            try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch(e){}
            
            toast.success("Treino salvo com sucesso!", { id: toastId });
            navigate('/home');

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.", { id: toastId });
        }
    };

    if (loading || !training) return <div className="h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFC107]"></div></div>;

    // Calcular progresso geral
    const totalSetsInTraining = training.exercises.reduce((acc, ex) => acc + (parseInt(ex.sets) || 3), 0);
    const completedSetsCount = Object.values(sessionData).filter(s => s.completed).length;
    const progressPercent = totalSetsInTraining > 0 ? Math.round((completedSetsCount / totalSetsInTraining) * 100) : 0;

    // Helper para renderizar um card de exercício
    const renderExerciseCard = (ex, exIndex, isFocusMode = false) => {
        const setsCount = parseInt(ex.sets) || 3;
        const setsArray = Array.from({ length: setsCount });
        const lastLoad = historyMap[ex.name];
        const restSeconds = ex.rest || 60;

        return (
            <div key={exIndex} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden ${isFocusMode ? 'min-h-[60vh] flex flex-col' : ''}`}>
                {/* Card Header */}
                <div className="p-4 flex gap-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-850 relative">
                    <div className={`${isFocusMode ? 'w-24 h-24' : 'w-16 h-16'} bg-gray-250 dark:bg-gray-900 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-800 transition-all cursor-zoom-in group`}>
                        {ex.machineImage ? 
                            <img 
                                src={ex.machineImage} 
                                className="w-full h-full object-cover group-hover:scale-115 transition-transform duration-300" 
                                alt={ex.name} 
                                onClick={() => setZoomedImage({
                                    image: ex.machineImage,
                                    name: ex.name,
                                    muscleGroup: ex.muscleGroup,
                                    description: ex.description,
                                    execution: ex.execution
                                })}
                            /> : 
                            <div className="h-full flex items-center justify-center">
                                <Dumbbell className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                            </div>
                        }
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className={`${isFocusMode ? 'text-xl' : 'text-lg'} font-black text-gray-800 dark:text-white leading-tight truncate`}>{ex.name}</h3>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold">{ex.muscleGroup}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-[#FFC107]/10 text-[#FFC107] border border-[#FFC107]/20 px-2 py-0.5 rounded font-bold">Meta: {ex.sets}x {ex.reps}</span>
                            {lastLoad && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">↺ {lastLoad}kg</span>}
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                <Timer className="w-3 h-3" /> {restSeconds}s
                            </span>
                        </div>
                    </div>
                    {/* Botão de Dica/Vídeo no header */}
                    {isFocusMode && ex.videoUrl && (
                        <button onClick={() => setShowVideo(true)} className="absolute top-4 right-4 text-xl opacity-50 hover:opacity-100 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <Video className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Séries */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 flex-1 overflow-y-auto">
                    {setsArray.map((_, setIndex) => {
                        const key = `${exIndex}-${setIndex}`;
                        const data = sessionData[key] || {};
                        const isDone = data.completed;

                        return (
                            <div key={setIndex} className={`flex items-center gap-3 p-4 transition-colors ${isDone ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                                <span className="w-8 text-center text-sm font-bold text-gray-400">#{setIndex + 1}</span>
                                
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <input 
                                            type="number" inputMode="decimal" placeholder={lastLoad || '-'}
                                            value={data.weight || ''}
                                            onChange={(e) => handleInput(exIndex, setIndex, 'weight', e.target.value)}
                                            className={`w-full bg-gray-100 dark:bg-gray-700/50 rounded-xl px-3 py-3 text-center font-bold text-xl text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFC107] transition-all ${isFocusMode ? 'h-14' : ''}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">KG</span>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="number" inputMode="numeric" placeholder={String(ex.reps).split('-')[0]}
                                            value={data.reps || ''}
                                            onChange={(e) => handleInput(exIndex, setIndex, 'reps', e.target.value)}
                                            className={`w-full bg-gray-100 dark:bg-gray-700/50 rounded-xl px-3 py-3 text-center font-bold text-xl text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFC107] transition-all ${isFocusMode ? 'h-14' : ''}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">REPS</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleCheckSet(exIndex, setIndex, String(ex.reps).split('-')[0], setsCount, restSeconds, ex.name)}
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm ${
                                        isDone ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                    }`}
                                >
                                    {isDone ? <Check className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-40 transition-colors">
            
            {/* HEADER FIXO */}
            <div className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-40 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-800 dark:text-white text-sm leading-tight truncate">{training.name}</h2>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="font-mono font-bold text-[#FFC107]">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                            <span>•</span>
                            <span className="font-bold">{training.exercises.length} Ex</span>
                        </p>
                    </div>
                    
                    {/* Barra de Progresso */}
                    <div className="hidden sm:flex items-center gap-2 mx-4">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">{progressPercent}%</span>
                    </div>
                    
                    {/* Toggle de Modo */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-transparent dark:border-gray-750">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white dark:bg-gray-750 shadow-sm text-[#FFC107]' : 'text-gray-400'}`}
                        >
                            <List className="w-3.5 h-3.5" /> Lista
                        </button>
                        <button 
                            onClick={() => setViewMode('focus')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'focus' ? 'bg-white dark:bg-gray-750 shadow-sm text-[#FFC107]' : 'text-gray-400'}`}
                        >
                            <Search className="w-3.5 h-3.5" /> Foco
                        </button>
                    </div>
                </div>
                
                {/* Barra de Progresso Mobile */}
                <div className="sm:hidden mt-2">
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ÁREA DE CONTEÚDO */}
            <div className="pt-28 sm:pt-24 px-4 max-w-2xl mx-auto space-y-6">
                
                {viewMode === 'list' ? (
                    // MODO LISTA: Renderiza todos
                    training.exercises.map((ex, i) => renderExerciseCard(ex, i, false))
                ) : (
                    // MODO FOCO: Renderiza apenas o ativo + controles
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <button 
                                onClick={() => setActiveExerciseIndex(i => Math.max(0, i - 1))}
                                disabled={activeExerciseIndex === 0}
                                className="text-sm font-bold text-gray-450 disabled:opacity-30 hover:text-[#FFC107] flex items-center gap-1 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" /> Anterior
                            </button>
                            <span className="text-xs font-bold text-gray-300">
                                {activeExerciseIndex + 1} / {training.exercises.length}
                            </span>
                            <button 
                                onClick={() => setActiveExerciseIndex(i => Math.min(training.exercises.length - 1, i + 1))}
                                disabled={activeExerciseIndex === training.exercises.length - 1}
                                className="text-sm font-bold text-gray-450 disabled:opacity-30 hover:text-[#FFC107] flex items-center gap-1 transition-colors"
                            >
                                Próximo <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {renderExerciseCard(training.exercises[activeExerciseIndex], activeExerciseIndex, true)}
                    </div>
                )}

            </div>

            {/* BOTÃO FINALIZAR */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-10 md:pb-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 z-[60] shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)]">
                <button 
                    onClick={finishWorkout}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                >
                    <Award className="w-5 h-5 text-white" /> FINALIZAR TREINO
                </button>
            </div>

            {/* MODAIS */}
            {restTimer && (
                <RestTimer 
                    initialSeconds={restTimer} 
                    onFinish={() => { setRestTimer(null); toast.success("Bora pra próxima!", { duration: 2000 }); }} 
                    onClose={() => setRestTimer(null)} 
                />
            )}

            {showVideo && viewMode === 'focus' && training.exercises[activeExerciseIndex].videoUrl && (
                <VideoModal 
                    videoUrl={training.exercises[activeExerciseIndex].videoUrl} 
                    onClose={() => setShowVideo(false)} 
                />
            )}

            {/* MODAL DE ZOOM E ANÁLISE DO EXERCÍCIO */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4"
                    onClick={() => setZoomedImage(null)}
                >
                    <div 
                        className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden animate-fade-in-up text-gray-800 dark:text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setZoomedImage(null)}
                            className="absolute top-4 right-4 w-9 h-9 bg-gray-150 dark:bg-black/40 hover:bg-gray-200 dark:hover:bg-black/60 rounded-full flex items-center justify-center text-gray-600 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
                        >
                            ✕
                        </button>

                        <h3 className="text-xl font-black mb-1 text-[#FFC107] pr-8 leading-tight">{zoomedImage.name}</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-4">{zoomedImage.muscleGroup}</p>

                        {/* Zoomable Image Container */}
                        <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 flex items-center justify-center mb-6 group cursor-zoom-in">
                            <img 
                                src={zoomedImage.image} 
                                alt={zoomedImage.name} 
                                className="w-full h-full object-contain transition-transform duration-300 hover:scale-125"
                            />
                            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-gray-300 font-bold uppercase tracking-wider pointer-events-none opacity-85 group-hover:opacity-0 transition-opacity">
                                Passe o cursor para dar zoom
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
                            {zoomedImage.description && (
                                <div>
                                    <h4 className="text-xs font-bold text-[#FFC107] uppercase mb-1">Sobre</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{zoomedImage.description}</p>
                                </div>
                            )}
                            {zoomedImage.execution && (
                                <div>
                                    <h4 className="text-xs font-bold text-[#FFC107] uppercase mb-1">Como Executar</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{zoomedImage.execution}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}