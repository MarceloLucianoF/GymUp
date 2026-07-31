import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti'; 
import VideoModal from '../../components/common/VideoModal';
import { exercises as defaultExercises } from '../../data/exercises';
import { Dumbbell, Video, Award, List, Search, SkipForward, Timer, ChevronLeft, ChevronRight, Check, Circle, Pause, Play, Wifi, WifiOff, History, X, Trophy, Sparkles, ArrowRight } from 'lucide-react';

// ... rest timer components ...

// --- COMPONENTE TIMER DE DESCANSO (TIMESTAMP REAL - RESILIENTE A BACKGROUND) ---
const RestTimer = ({ endTime, duration, onFinish, onClose, onAdjust }) => {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    const [isPaused, setIsPaused] = useState(false);
    const pausedTimeRef = useRef(null);

    const totalDuration = duration || 60;

    const handleFinish = useCallback(() => {
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 300]);
        }
        activeWorkoutService.playRestBeep();
        onFinish();
    }, [onFinish]);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const left = Math.max(0, Math.ceil((endTime - now) / 1000));
            setRemaining(left);

            if (left <= 0) {
                clearInterval(interval);
                handleFinish();
            }
        }, 250);

        return () => clearInterval(interval);
    }, [endTime, isPaused, handleFinish]);

    const togglePause = () => {
        if (isPaused) {
            // Retomar: recalcular endTime baseado no tempo pausado
            const pausedDuration = Date.now() - pausedTimeRef.current;
            onAdjust(pausedDuration);
            setIsPaused(false);
        } else {
            // Pausar
            pausedTimeRef.current = Date.now();
            setIsPaused(true);
        }
    };

    // Calcular progresso do SVG
    const circumference = 2 * Math.PI * 120;
    const progress = totalDuration > 0 ? (remaining / totalDuration) : 0;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in p-6">
            <div className="text-center text-white w-full max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-6">
                    <Timer className="w-5 h-5 text-[#FFC107] animate-spin" style={{ animationDuration: '3s' }} />
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-gray-300">
                        Descanso Ativo {isPaused && '(Pausado)'}
                    </p>
                </div>
                
                <div className="relative w-64 h-64 mx-auto flex items-center justify-center mb-8">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle cx="128" cy="128" r="120" stroke="#222" strokeWidth="8" fill="transparent" />
                        <circle 
                            cx="128" cy="128" r="120" stroke={isPaused ? "#888" : "#FFC107"} strokeWidth="8" fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-300 ease-linear"
                        />
                    </svg>
                    <div className="text-7xl font-black font-mono tracking-tighter">
                        {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                    <button onClick={() => onAdjust(-15000)} className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-colors">-15s</button>
                    <button onClick={() => onAdjust(30000)} className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-colors">+30s</button>
                    <button onClick={() => onAdjust(60000)} className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-colors">+60s</button>
                    <button onClick={togglePause} className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1">
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                </div>

                <button onClick={onClose} className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-black transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 text-sm active:scale-95">
                    <SkipForward className="w-4 h-4" /> Pular Descanso
                </button>
            </div>
        </div>
    );
};

// --- MODAL DE HISTÓRICO DE CARGAS DO EXERCÍCIO ---
const LoadHistoryModal = ({ exerciseName, historyLogs, onClose }) => {
    if (!exerciseName) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-[#1F2937] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <span className="text-[10px] font-bold text-[#FFC107] uppercase tracking-wider">Histórico de Cargas</span>
                        <h3 className="text-lg font-black text-gray-800 dark:text-white leading-tight">{exerciseName}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full bg-gray-100 dark:bg-gray-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {historyLogs && historyLogs.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {historyLogs.map((item, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{item.date}</p>
                                    <p className="text-[10px] text-gray-400">{item.setsCount} séries efetuadas</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-base font-black text-[#FFC107]">{item.maxWeight}kg</span>
                                    <p className="text-[10px] text-gray-400">Máxima</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-gray-400">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-50 text-[#FFC107]" />
                        <p className="text-xs font-medium">Nenhum registro anterior encontrado para este exercício.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MODAL DE CELEBRAÇÃO / TREINO CONCLUÍDO ---
const CelebrationModal = ({ stats, onFinish }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#1F2937] border border-[#FFC107]/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden animate-fade-in-up">
                <div className="w-20 h-20 bg-gradient-to-br from-[#FFC107] to-[#FF9800] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#FFC107]/20">
                    <Trophy className="w-10 h-10 text-black fill-current animate-bounce" />
                </div>

                <span className="bg-[#FFC107]/10 text-[#FFC107] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-[#FFC107]/20 inline-block mb-2">
                    Sensacional! 🔥
                </span>

                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">TREINO CONCLUÍDO!</h2>
                <p className="text-gray-400 text-xs mb-6">Excelente trabalho! Mais um passo em direção ao seu objetivo.</p>

                {stats.newPRs && stats.newPRs.length > 0 && (
                    <div className="mb-6 p-3.5 bg-[#FFC107]/10 border border-[#FFC107]/30 rounded-2xl text-left">
                        <div className="flex items-center gap-1.5 text-xs font-black text-[#FFC107] uppercase tracking-wider mb-1">
                            <Trophy className="w-4 h-4 fill-current" /> Novo Recorde Pessoal!
                        </div>
                        <p className="text-xs text-gray-300">
                            Superou sua marca anterior em <span className="font-bold text-white">{stats.newPRs.join(', ')}</span>! 🚀
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Tempo Total</p>
                        <p className="text-xl font-black text-[#FFC107] font-mono mt-0.5">{stats.timeStr}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Volume Total</p>
                        <p className="text-xl font-black text-white font-mono mt-0.5">{stats.volumeKg}kg</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Séries Concluídas</p>
                        <p className="text-xl font-black text-white font-mono mt-0.5">{stats.completedSetsCount}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Exercícios</p>
                        <p className="text-xl font-black text-white font-mono mt-0.5">{stats.executedExercisesCount}</p>
                    </div>
                </div>

                <button 
                    onClick={onFinish}
                    className="w-full btn-primary-gradient py-4 text-base rounded-2xl touch-target"
                >
                    VOLTAR AO PAINEL
                </button>
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
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    
    // Estado da Execução
    const [elapsedTime, setElapsedTime] = useState(0); 
    const [restTimerObj, setRestTimerObj] = useState(null); // { endTime, duration }
    const startedAtRef = useRef(null);

    // Modos de Visualização
    const [viewMode, setViewMode] = useState('list'); 
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(0); 

    // Histórico de Cargas e Inputs
    const [historyMap, setHistoryMap] = useState({});
    const [rawHistoryDocs, setRawHistoryDocs] = useState([]);
    const [sessionData, setSessionData] = useState({});
    
    // Modais e UI
    const [showVideo, setShowVideo] = useState(false);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [selectedHistoryExercise, setSelectedHistoryExercise] = useState(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationStats, setCelebrationStats] = useState(null);

    const syncPendingOfflineCheckIns = useCallback(async () => {
        if (!user) return;
        const pending = activeWorkoutService.getOfflineCheckIns(user.uid);
        if (pending.length === 0) return;
        try {
            for (const payload of pending) {
                await addDoc(collection(db, 'checkIns'), payload);
            }
            activeWorkoutService.clearOfflineCheckIns(user.uid);
            toast.success("✓ Treinos offline sincronizados com sucesso!");
        } catch (err) {
            console.error("Erro ao sincronizar treinos offline:", err);
        }
    }, [user]);

    // Conectividade e Sync Offline
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Conexão reestabelecida. Sincronizando...", { id: 'online-status' });
            syncPendingOfflineCheckIns();
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast.error("Você está offline. Seu treino continua salvo no celular.", { id: 'offline-status', duration: 4000 });
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [user, syncPendingOfflineCheckIns]);

    // Auto-Save do Treino em Andamento
    useEffect(() => {
        if (!user || !training) return;
        activeWorkoutService.saveActiveSession(user.uid, {
            trainingId: training.id,
            trainingName: training.name,
            hydratedExercises: training.exercises,
            sessionData,
            activeExerciseIndex,
            viewMode,
            elapsedTime,
            startedAt: startedAtRef.current,
            restTimerObj,
            currentExerciseName: training.exercises[activeExerciseIndex]?.name || ''
        });
    }, [user, training, sessionData, activeExerciseIndex, viewMode, elapsedTime, restTimerObj]);

    // 1. Inicialização e Detecção de Dispositivo
    useEffect(() => {
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

                // Busca biblioteca do Firestore para resolver IDs de documentos (ex: amtIl9nD3xmjp1nZ65vt)
                let firestoreLib = [];
                try {
                    const exercisesSnap = await getDocs(collection(db, 'exercises'));
                    firestoreLib = exercisesSnap.docs.map(d => ({ firestoreId: d.id, id: d.id, ...d.data() }));
                } catch (e) {
                    console.warn("Erro ao buscar biblioteca do Firestore:", e);
                }

                const combinedLibrary = [
                    ...firestoreLib,
                    ...defaultExercises.filter(d => !firestoreLib.some(f => f.name?.toLowerCase() === d.name?.toLowerCase()))
                ];

                let rawExercises = [];
                if (location.state?.customExerciseList) {
                    rawExercises = location.state.customExerciseList;
                } else {
                    rawExercises = trainingData.exercises || [];
                }

                // Normalização e hidratação completa dos exercícios cruzando Firestore + Defaults
                const hydratedExercises = rawExercises.map((ex, idx) => {
                    if (!ex) return {
                        firestoreId: `ex-${idx}`,
                        name: `Exercício ${idx + 1}`,
                        muscleGroup: 'Geral',
                        sets: '3',
                        reps: '10',
                        rest: 60
                    };

                    let idToFind = null;
                    let nameToFind = null;

                    if (typeof ex === 'string') {
                        idToFind = ex;
                    } else if (typeof ex === 'object') {
                        idToFind = ex.firestoreId || ex.id || ex.exerciseId;
                        nameToFind = ex.name || ex.title || ex.exerciseName;
                    }

                    const libEx = combinedLibrary.find(e => 
                        (idToFind && (String(e.firestoreId) === String(idToFind) || String(e.id) === String(idToFind))) ||
                        (nameToFind && e.name?.toLowerCase() === String(nameToFind).toLowerCase())
                    );

                    const exObj = typeof ex === 'object' ? ex : {};
                    const name = exObj.name || exObj.title || exObj.exerciseName || libEx?.name || `Exercício ${idx + 1}`;
                    const muscleGroup = exObj.muscleGroup || libEx?.muscleGroup || 'Geral';
                    
                    let sets = exObj.sets || exObj.series || libEx?.sets || 3;
                    if (!sets || String(sets) === 'undefined') sets = 3;
                    
                    let reps = exObj.reps || exObj.repeticoes || libEx?.reps || '10';
                    if (!reps || String(reps) === 'undefined') reps = '10';

                    let rest = exObj.rest || exObj.restSeconds || libEx?.rest || 60;
                    if (!rest || String(rest) === 'undefined') rest = 60;

                    return {
                        ...libEx,
                        ...exObj,
                        firestoreId: idToFind || libEx?.firestoreId || `ex-${idx}`,
                        name,
                        muscleGroup,
                        sets: String(sets),
                        reps: String(reps),
                        rest: Number(rest) || 60,
                        machineImage: exObj.machineImage || libEx?.machineImage || libEx?.demoUrl || null,
                        videoUrl: exObj.videoUrl || libEx?.videoUrl || null,
                        description: exObj.description || libEx?.description || '',
                        execution: exObj.execution || libEx?.execution || ''
                    };
                });

                const loadedTraining = { 
                    id: trainingDocId, 
                    ...trainingData, 
                    exercises: hydratedExercises 
                };

                // Restauração de sessão ativa salva
                const savedSession = activeWorkoutService.getActiveSession(user.uid);
                if (savedSession && savedSession.trainingId === trainingDocId) {
                    if (savedSession.sessionData) setSessionData(savedSession.sessionData);
                    if (typeof savedSession.activeExerciseIndex === 'number') setActiveExerciseIndex(savedSession.activeExerciseIndex);
                    if (savedSession.viewMode) setViewMode(savedSession.viewMode);
                    if (savedSession.startedAt) {
                        startedAtRef.current = savedSession.startedAt;
                    } else if (typeof savedSession.elapsedTime === 'number') {
                        startedAtRef.current = Date.now() - (savedSession.elapsedTime * 1000);
                    }
                    if (savedSession.restTimerObj && savedSession.restTimerObj.endTime > Date.now()) {
                        setRestTimerObj(savedSession.restTimerObj);
                    }
                    if (savedSession.hydratedExercises && savedSession.hydratedExercises.length > 0) {
                        loadedTraining.exercises = savedSession.hydratedExercises;
                    }
                    toast.success("🏋️ Treino em andamento restaurado!", { id: 'restore-session-toast' });
                } else {
                    startedAtRef.current = Date.now();
                }

                setTraining(loadedTraining);

                // Busca histórico para placeholder de carga
                const qHistory = query(
                    collection(db, 'checkIns'), 
                    where('userId', '==', user.uid),
                    orderBy('date', 'desc'),
                    limit(15)
                );
                const historySnap = await getDocs(qHistory);
                const loadMap = {};
                const rawDocs = [];

                historySnap.docs.forEach(d => {
                    const data = d.data();
                    rawDocs.push(data);
                    if (data.exercises) {
                        data.exercises.forEach(ex => {
                            if (!loadMap[ex.name]) {
                                const max = Math.max(...(ex.sets?.map(s => Number(s.weight)||0) || [0]));
                                if (max > 0) loadMap[ex.name] = max;
                            }
                        });
                    }
                });
                setHistoryMap(loadMap);
                setRawHistoryDocs(rawDocs);

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

        const globalTimer = setInterval(() => {
            if (startedAtRef.current) {
                const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
                setElapsedTime(Math.max(0, elapsed));
            }
        }, 500);

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
                for (let s = setIndex - 1; s >= 0; s--) {
                    const prevVal = sessionData[`${exIndex}-${s}`]?.weight;
                    if (prevVal) {
                        finalWeight = prevVal;
                        break;
                    }
                }
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
            const restTime = restSeconds || 60;
            const endTime = Date.now() + restTime * 1000;
            
            if (!isLastSetOfExercise) {
                setRestTimerObj({ endTime, duration: restTime }); 
            } else if (viewMode === 'focus' && isLastSetOfExercise) {
                toast.success("Exercício concluído! Próximo...", { duration: 2000 });
                setTimeout(() => {
                    if (activeExerciseIndex < training.exercises.length - 1) {
                        setActiveExerciseIndex(prev => prev + 1);
                        setRestTimerObj({ endTime, duration: restTime }); 
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

    const handleOpenLoadHistory = (exerciseName) => {
        const logs = [];
        rawHistoryDocs.forEach(d => {
            if (d.exercises) {
                const found = d.exercises.find(e => e.name === exerciseName);
                if (found && found.sets && found.sets.length > 0) {
                    const weights = found.sets.map(s => Number(s.weight) || 0);
                    const maxWeight = Math.max(...weights);
                    const dateStr = d.date ? new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Recente';
                    logs.push({
                        date: dateStr,
                        maxWeight,
                        setsCount: found.sets.length
                    });
                }
            }
        });
        setSelectedHistoryExercise({ exerciseName, historyLogs: logs });
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
                createdAt: new Date().toISOString()
            };

            if (navigator.onLine) {
                try {
                    await addDoc(collection(db, 'checkIns'), checkInPayload);
                    await updateDoc(doc(db, 'users', user.uid), { lastWorkoutDate: new Date().toISOString() });
                } catch (err) {
                    console.warn("Sem rede no Firestore, enfileirando offline:", err);
                    activeWorkoutService.saveOfflineCheckIn(user.uid, checkInPayload);
                }
            } else {
                activeWorkoutService.saveOfflineCheckIn(user.uid, checkInPayload);
            }

            // Limpa o rascunho de sessão
            activeWorkoutService.clearActiveSession(user.uid);

            // Detector de Novos Recordes (PRs)
            const newPRs = [];
            training.exercises.forEach((ex, exIndex) => {
                const numSets = Number(ex.sets) || 3;
                let maxWeight = 0;
                for (let i = 0; i < numSets; i++) {
                    const data = sessionData[`${exIndex}-${i}`];
                    if (data?.completed) {
                        const w = parseFloat(data.weight) || 0;
                        if (w > maxWeight) maxWeight = w;
                    }
                }
                const prevMax = historyMap[ex.name] || 0;
                if (maxWeight > 0 && prevMax > 0 && maxWeight > prevMax) {
                    newPRs.push(ex.name);
                }
            });

            try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch(e){}

            const timeMinutes = Math.floor(elapsedTime / 60);
            const timeSecs = elapsedTime % 60;

            setCelebrationStats({
                timeStr: `${timeMinutes}m ${(timeSecs).toString().padStart(2, '0')}s`,
                volumeKg: totalVolume,
                completedSetsCount: setsCompleted,
                executedExercisesCount: executedExercises.length,
                newPRs
            });
            
            toast.dismiss(toastId);
            setShowCelebration(true);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.", { id: toastId });
        }
    };

    if (loading || !training) return <div className="h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFC107]"></div></div>;

    // Calcular progresso geral
    const totalSetsInTraining = training.exercises.reduce((acc, ex) => acc + (parseInt(ex.sets) || 3), 0);
    const completedSetsCount = Object.values(sessionData).filter(s => s?.completed).length;
    const progressPercent = totalSetsInTraining > 0 ? Math.round((completedSetsCount / totalSetsInTraining) * 100) : 0;

    // Helper para renderizar um card de exercício
    const renderExerciseCard = (ex, exIndex, isFocusMode = false) => {
        if (!ex) return null;

        const setsCount = parseInt(ex.sets, 10) || 3;
        const setsArray = Array.from({ length: setsCount });
        const exName = ex.name || `Exercício ${exIndex + 1}`;
        const lastLoad = historyMap[exName];
        const restSeconds = ex.rest || 60;

        const repsRaw = (ex.reps && String(ex.reps) !== 'undefined') ? String(ex.reps) : '10';
        const repsPlaceholder = repsRaw.includes('-') ? repsRaw.split('-')[0] : (repsRaw !== 'undefined' ? repsRaw : '10');

        // Inteligência de Progressão de Carga + Repetições
        let lastReps = null;
        rawHistoryDocs.forEach(d => {
            if (d.exercises && !lastReps) {
                const found = d.exercises.find(e => e.name === exName);
                if (found && found.sets && found.sets.length > 0) {
                    const highestSet = found.sets.reduce((max, s) => (Number(s.weight) || 0) >= (Number(max.weight) || 0) ? s : max, found.sets[0]);
                    lastReps = Number(highestSet.reps) || null;
                }
            }
        });

        const targetRepsNum = parseInt(repsPlaceholder, 10) || 10;
        let smartTip = 'Defina sua primeira carga de referência para este exercício.';
        if (lastLoad) {
            if (lastReps && lastReps >= targetRepsNum) {
                smartTip = `💡 Meta de Hoje: Subir para ${lastLoad + 2}kg (Progresso de Carga)!`;
            } else if (lastReps && lastReps < targetRepsNum) {
                smartTip = `💡 Meta de Hoje: Buscar ${lastReps + 1}-${targetRepsNum} reps com ${lastLoad}kg (Progresso de Repetições)!`;
            } else {
                smartTip = `💡 Última Carga: ${lastLoad}kg. Tente manter a constância hoje!`;
            }
        }

        return (
            <div key={exIndex} className={`bg-white dark:bg-[#1F2937]/50 dark:backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-[#FFC107]/10 hover:border-[#FFC107]/25 transition-all duration-300 overflow-hidden ${isFocusMode ? 'min-h-[60vh] flex flex-col' : ''}`}>
                {/* Card Header */}
                <div className="p-4 flex gap-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-850 relative">
                    <div className={`${isFocusMode ? 'w-24 h-24' : 'w-16 h-16'} bg-gray-250 dark:bg-gray-900 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-800 transition-all cursor-zoom-in group`}>
                        {ex.machineImage ? 
                            <img 
                                src={ex.machineImage} 
                                className="w-full h-full object-cover group-hover:scale-115 transition-transform duration-300" 
                                alt={exName} 
                                onClick={() => setZoomedImage({
                                    image: ex.machineImage,
                                    name: exName,
                                    muscleGroup: ex.muscleGroup || 'Geral',
                                    description: ex.description || '',
                                    execution: ex.execution || ''
                                })}
                            /> : 
                            <div className="h-full flex items-center justify-center">
                                <Dumbbell className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                            </div>
                        }
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className={`${isFocusMode ? 'text-xl' : 'text-lg'} font-black text-gray-800 dark:text-white leading-tight truncate`}>{exName}</h3>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold">{ex.muscleGroup || 'Geral'}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-[#FFC107]/10 text-[#FFC107] border border-[#FFC107]/20 px-2 py-0.5 rounded font-bold">Meta: {setsCount}x {repsRaw}</span>
                            {lastLoad ? (
                                <button 
                                    onClick={() => handleOpenLoadHistory(exName)} 
                                    className="text-[10px] bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
                                    title="Ver histórico de cargas deste exercício"
                                >
                                    <History className="w-3 h-3" /> ↺ {lastLoad}kg
                                </button>
                            ) : null}
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

                {/* Dica Inteligente de Progresso de Cargas */}
                <div className="bg-[#FFC107]/10 border-y border-[#FFC107]/20 px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 text-[#FFC107] shrink-0 animate-pulse" />
                        <span className="font-bold text-[#FFC107] truncate">
                            {smartTip}
                        </span>
                    </div>
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
                                            type="number" inputMode="numeric" placeholder={repsPlaceholder}
                                            value={data.reps || ''}
                                            onChange={(e) => handleInput(exIndex, setIndex, 'reps', e.target.value)}
                                            className={`w-full bg-gray-100 dark:bg-gray-700/50 rounded-xl px-3 py-3 text-center font-bold text-xl text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFC107] transition-all ${isFocusMode ? 'h-14' : ''}`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">REPS</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleCheckSet(exIndex, setIndex, repsPlaceholder, setsCount, restSeconds, exName)}
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

                {/* BARRA DE AÇÃO RÁPIDA 1-TOQUE (ERGONOMIA DE MÃO ÚNICA) */}
                {isFocusMode && (
                    <div className="p-4 bg-gray-50/80 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2 mt-auto">
                        {setsArray.every((_, sIdx) => sessionData[`${exIndex}-${sIdx}`]?.completed) ? (
                            <button
                                onClick={() => {
                                    if (activeExerciseIndex < training.exercises.length - 1) {
                                        setActiveExerciseIndex(prev => prev + 1);
                                    } else {
                                        finishWorkout();
                                    }
                                }}
                                className="w-full btn-primary-gradient py-4 text-sm font-black rounded-2xl touch-target shadow-xl flex items-center justify-center gap-2"
                            >
                                {activeExerciseIndex < training.exercises.length - 1 ? (
                                    <>PRÓXIMO EXERCÍCIO <ArrowRight className="w-5 h-5" /></>
                                ) : (
                                    <>FINALIZAR TREINO <Trophy className="w-5 h-5 text-black" /></>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    const nextUndoneIndex = setsArray.findIndex((_, sIdx) => !sessionData[`${exIndex}-${sIdx}`]?.completed);
                                    if (nextUndoneIndex !== -1) {
                                        handleCheckSet(exIndex, nextUndoneIndex, repsPlaceholder, setsCount, restSeconds, exName);
                                    }
                                }}
                                className="w-full bg-[#FFC107]/20 hover:bg-[#FFC107]/30 text-[#FFC107] border border-[#FFC107]/40 py-4 text-sm font-black rounded-2xl touch-target flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Check className="w-5 h-5" /> CONCLUIR SÉRIE #{setsArray.findIndex((_, sIdx) => !sessionData[`${exIndex}-${sIdx}`]?.completed) + 1} & DESCANSAR
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-40 transition-colors">
            
            {/* HEADER FIXO */}
            <div className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-40 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-800 dark:text-white text-sm leading-tight truncate">{training.name}</h2>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${isOnline ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'}`}>
                                {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                                {isOnline ? 'Sincronizado' : 'Offline'}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="font-mono font-bold text-[#FFC107]">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
                            <span>•</span>
                            <span className="font-bold">{completedSetsCount}/{totalSetsInTraining} séries</span>
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
            {restTimerObj && (
                <RestTimer 
                    endTime={restTimerObj.endTime}
                    duration={restTimerObj.duration} 
                    onFinish={() => { setRestTimerObj(null); toast.success("Bora pra próxima!", { duration: 2000 }); }} 
                    onClose={() => setRestTimerObj(null)} 
                    onAdjust={(ms) => setRestTimerObj(prev => prev ? ({ ...prev, endTime: prev.endTime + ms }) : null)}
                />
            )}

            {selectedHistoryExercise && (
                <LoadHistoryModal 
                    exerciseName={selectedHistoryExercise.exerciseName}
                    historyLogs={selectedHistoryExercise.historyLogs}
                    onClose={() => setSelectedHistoryExercise(null)}
                />
            )}

            {showCelebration && celebrationStats && (
                <CelebrationModal 
                    stats={celebrationStats}
                    onFinish={() => {
                        setShowCelebration(false);
                        navigate('/home');
                    }}
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