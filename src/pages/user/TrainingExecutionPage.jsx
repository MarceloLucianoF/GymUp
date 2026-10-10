import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useActiveWorkoutAutosave } from '../../hooks/useActiveWorkoutAutosave';
import { activeWorkoutService } from '../../services/activeWorkoutService';
import toast from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import confetti from 'canvas-confetti';
import VideoModal from '../../components/common/VideoModal';
import RestTimer from '../../components/training/RestTimer';
import LoadHistoryModal from '../../components/training/LoadHistoryModal';
import CelebrationModal from '../../components/training/CelebrationModal';
import ExerciseZoomModal from '../../components/training/ExerciseZoomModal';
import ExecutionHeader from '../../components/training/ExecutionHeader';
import ExecutionExerciseCard from '../../components/training/ExecutionExerciseCard';
import { exercises as defaultExercises } from '../../data/exercises';
import { Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWakeLock } from '../../components/training/useWakeLock';
import {
    hydrateExercises, buildLoadMap, buildExerciseLoadLogs, summarizeSession, detectNewPRs,
    adjustValue, getLastSessionSets, buildCopyFromLast, noteKey, NOTE_MAX, formatDuration
} from '../../utils/training';

// --- PÁGINA PRINCIPAL DE EXECUÇÃO ---
export default function TrainingExecutionPage() {
    const { confirm, dialog } = useConfirm();
    const nextExerciseTimeoutRef = useRef(null);
    useEffect(() => () => clearTimeout(nextExerciseTimeoutRef.current), []);

    const { trainingId } = useParams();
    const { user } = useAuthContext();
    const navigate = useNavigate();
    const location = useLocation();

    const [training, setTraining] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Estado da Execução
    const [elapsedTime, setElapsedTime] = useState(0); 
    const [restTimerObj, setRestTimerObj] = useState(null); // { endTime, duration }
    const startedAtRef = useRef(null);
    const lastPayloadRef = useRef(null);

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

    // Mantém a tela acesa durante o treino (some após a celebração)
    useWakeLock(!!training && !showCelebration);

    // Conectividade e Sync Offline
    const { isOnline } = useOfflineSync(user);

    // Auto-Save do Treino em Andamento
    useActiveWorkoutAutosave({ enabled: !showCelebration, user, training, sessionData, activeExerciseIndex, viewMode, elapsedTime, restTimerObj, startedAtRef });

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
                const hydratedExercises = hydrateExercises(rawExercises, combinedLibrary);

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
                const rawDocs = historySnap.docs.map(d => d.data());
                const loadMap = buildLoadMap(rawDocs);
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
                clearTimeout(nextExerciseTimeoutRef.current);
                nextExerciseTimeoutRef.current = setTimeout(() => {
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

    const handleAdjust = (exIndex, setIndex, field, delta, base) => {
        const key = `${exIndex}-${setIndex}`;
        setSessionData(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: adjustValue(prev[key]?.[field], delta, base) }
        }));
    };

    const handleCopyLast = (exIndex, exName, setsCount) => {
        const values = buildCopyFromLast(getLastSessionSets(rawHistoryDocs, exName), setsCount);
        if (values.length === 0) {
            toast.error('Sem histórico deste exercício.');
            return;
        }
        setSessionData(prev => {
            const next = { ...prev };
            values.forEach((v, i) => {
                const key = `${exIndex}-${i}`;
                next[key] = { ...next[key], weight: v.weight, reps: v.reps };
            });
            return next;
        });
        toast.success('Valores da última sessão copiados.', { duration: 1500 });
    };

    const handleNote = (exIndex, value) => {
        setSessionData(prev => ({ ...prev, [noteKey(exIndex)]: { note: String(value).slice(0, NOTE_MAX) } }));
    };

    const handleOpenLoadHistory = (exerciseName) => {
        setSelectedHistoryExercise({ exerciseName, historyLogs: buildExerciseLoadLogs(rawHistoryDocs, exerciseName) });
    };

    // Recomeça o mesmo treino do zero, já considerando o check-in recém-salvo no histórico.
    const handleRepeat = () => {
        const docs = lastPayloadRef.current ? [lastPayloadRef.current, ...rawHistoryDocs] : rawHistoryDocs;
        setRawHistoryDocs(docs);
        setHistoryMap(buildLoadMap(docs));
        setSessionData({});
        setRestTimerObj(null);
        setActiveExerciseIndex(0);
        setElapsedTime(0);
        startedAtRef.current = Date.now();
        setCelebrationStats(null);
        setShowCelebration(false);
    };

    // 3. Finalizar Treino
    const finishWorkout = async () => {
        if (!(await confirm({ title: "Finalizar treino", message: "Finalizar o treino?", confirmLabel: "Finalizar" }))) return;

        const toastId = toast.loading("Salvando...");
        try {
            const { totalVolume, setsCompleted, executedExercises } = summarizeSession(training.exercises, sessionData);

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

            lastPayloadRef.current = checkInPayload;

            // Detector de Novos Recordes (PRs)
            const newPRs = detectNewPRs(training.exercises, sessionData, historyMap);

            try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch(e){}

            setCelebrationStats({
                trainingName: training.name,
                timeStr: formatDuration(elapsedTime),
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

    if (loading || !training) return <div className="h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div></div>;

    // Calcular progresso geral
    const totalSetsInTraining = training.exercises.reduce((acc, ex) => acc + (parseInt(ex.sets) || 3), 0);
    const completedSetsCount = Object.values(sessionData).filter(s => s?.completed).length;
    const progressPercent = totalSetsInTraining > 0 ? Math.round((completedSetsCount / totalSetsInTraining) * 100) : 0;

    const lastExerciseIndex = training.exercises.length - 1;

    const renderExerciseCard = (ex, exIndex, isFocusMode = false) => (
        <ExecutionExerciseCard
            key={exIndex}
            ex={ex}
            exIndex={exIndex}
            isFocusMode={isFocusMode}
            historyMap={historyMap}
            rawHistoryDocs={rawHistoryDocs}
            sessionData={sessionData}
            isLastExercise={activeExerciseIndex >= lastExerciseIndex}
            onInput={handleInput}
            onCheckSet={handleCheckSet}
            onAdjust={handleAdjust}
            onCopyLast={handleCopyLast}
            onNote={handleNote}
            onOpenLoadHistory={handleOpenLoadHistory}
            onZoom={setZoomedImage}
            onShowVideo={() => setShowVideo(true)}
            onNextExercise={() => setActiveExerciseIndex(prev => prev + 1)}
            onFinish={finishWorkout}
        />
    );

    return (
        <div className={`min-h-screen bg-gray-50 dark:bg-[#0B0F19] transition-colors ${viewMode === 'focus' ? 'pb-64' : 'pb-40'}`}>
            {dialog}

            <ExecutionHeader
                trainingName={training.name}
                isOnline={isOnline}
                elapsedTime={elapsedTime}
                completedSetsCount={completedSetsCount}
                totalSetsInTraining={totalSetsInTraining}
                progressPercent={progressPercent}
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
            />

            {/* ÁREA DE CONTEÚDO */}
            <div className="pt-28 sm:pt-24 md:pt-44 px-4 max-w-2xl mx-auto space-y-6">
                
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
                                className="min-h-[44px] px-2 text-sm font-bold text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:text-brand flex items-center gap-1 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" /> Anterior
                            </button>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                {activeExerciseIndex + 1} / {training.exercises.length}
                            </span>
                            <button 
                                onClick={() => setActiveExerciseIndex(i => Math.min(training.exercises.length - 1, i + 1))}
                                disabled={activeExerciseIndex === training.exercises.length - 1}
                                className="min-h-[44px] px-2 text-sm font-bold text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:text-brand flex items-center gap-1 transition-colors"
                            >
                                Próximo <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {renderExerciseCard(training.exercises[activeExerciseIndex], activeExerciseIndex, true)}
                    </div>
                )}

            </div>

            {/* BOTÃO FINALIZAR */}
            <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 z-[60]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <button 
                    onClick={finishWorkout}
                    className={`mx-auto flex min-h-[48px] w-full max-w-2xl items-center justify-center gap-2 rounded-2xl font-black active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 ${viewMode === 'focus' ? 'border-2 border-emerald-500/60 text-emerald-600 dark:text-emerald-400 text-sm' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg py-4 shadow-lg shadow-emerald-600/20'}`}
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
                    onRepeat={handleRepeat}
                />
            )}

            {showVideo && viewMode === 'focus' && training.exercises[activeExerciseIndex].videoUrl && (
                <VideoModal 
                    videoUrl={training.exercises[activeExerciseIndex].videoUrl} 
                    onClose={() => setShowVideo(false)} 
                />
            )}

            <ExerciseZoomModal exercise={zoomedImage} onClose={() => setZoomedImage(null)} />
        </div>
    );
}
