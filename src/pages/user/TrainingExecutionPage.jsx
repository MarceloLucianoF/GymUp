import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
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
import { syncScoresAfterWorkout } from '../../services/challengeService';
import { fetchStudentCheckIns, invalidateCheckIns } from '../../services/checkInsCache';
import { saveCheckIn } from '../../services/checkInService';
import { fromMyTrainingId, isMyTrainingId, replaceExerciseInMyWorkout } from '../../services/myWorkouts';
import { afterSetAction, supersetRole } from '../../utils/setTypes';
import SwapExerciseModal from '../../components/training/SwapExerciseModal';
import WarmupStretchStep from '../../components/training/WarmupStretchStep';
import { buildWarmupStretch, needsWarmupStep } from '../../utils/stretchWorkout';
import { buildSwapped } from '../../utils/exerciseSwap';
import { useWorkoutNotification, workoutNotifSupported } from '../../hooks/useWorkoutNotification';
import { suggestNext } from '../../utils/progression';
import { prescriptionLabel } from '../../utils/exerciseKind';
import { stillSrc } from '../../utils/exerciseMedia';
import { buildSessionFacts, localSummaryText, summaryAiMessages, summaryMatchesFacts } from '../../utils/sessionSummary';
import { aiService } from '../../services/aiService';
import { listMyExercises, myExerciseToLibrary } from '../../services/myExercises';
import { loadAssignedTraining } from '../../services/academyTrainingSource';
import { getSocialProfile } from '../../services/socialService';
import { publishPost } from '../../services/feedService';
import { buildPostPayload, weekCountOf } from '../../utils/feed';
import { disablePush, enablePush, pushEnabled, scheduleRestPush } from '../../services/pushService';
import { isNativeApp } from '../../services/nativeApp';
import { onWorkoutTimerAction, stopWorkoutTimer, updateWorkoutTimer } from '../../services/workoutTimerNative';
import { parseAcademyTrainingId } from '../../utils/academyTrainingId';

// --- PÁGINA PRINCIPAL DE EXECUÇÃO ---
export default function TrainingExecutionPage() {
    const { confirm, dialog } = useConfirm();
    const nextExerciseTimeoutRef = useRef(null);
    useEffect(() => () => clearTimeout(nextExerciseTimeoutRef.current), []);

    const { trainingId } = useParams();
    const { user, userProfile } = useAuthContext();
    const [swapIndex, setSwapIndex] = useState(null);
    const mediaHandlersRef = useRef({});
    const notifHandlersRef = useRef({});
    // No app Android não há notificação do navegador: o sino liga os avisos nativos (FCM), que trazem o fim do descanso.
    const nativeApp = isNativeApp();
    const notifSupported = workoutNotifSupported() || nativeApp;
    const [notifEnabled, setNotifEnabled] = useState(() => { if (isNativeApp()) return pushEnabled(); try { return window.localStorage.getItem('bt_workout_notif') === '1'; } catch (e) { return false; } });
    const [notifOfferGone, setNotifOfferGone] = useState(() => { try { return window.localStorage.getItem('bt_workout_notif') !== null; } catch (e) { return true; } });
    const [notifPerm, setNotifPerm] = useState(() => (isNativeApp() ? 'granted' : typeof Notification === 'undefined' ? 'denied' : Notification.permission));
    const swapLibraryRef = useRef([]);
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
    const [sessionSummary, setSessionSummary] = useState(null);
    // Etapa opcional de alongamento geral antes do 1º exercício (ficha com warmupStretch: true); null = sem etapa.
    const [warmupSteps, setWarmupSteps] = useState(null);

    // Mantém a tela acesa durante o treino (some após a celebração)
    useWakeLock(!!training && !showCelebration);

    // Conectividade e Sync Offline
    const isOnline = useOnlineStatus();

    // Auto-Save do Treino em Andamento
    useActiveWorkoutAutosave({ enabled: !showCelebration, user, training, sessionData, activeExerciseIndex, viewMode, elapsedTime, restTimerObj, startedAtRef });

    // 1. Inicialização e Detecção de Dispositivo
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        setViewMode(isMobile ? 'focus' : 'list');

        const initTraining = async () => {
            try {
                const academyRef = parseAcademyTrainingId(trainingId);
                const isMine = isMyTrainingId(trainingId);
                let docSnap = (academyRef || isMine) ? null : await getDoc(doc(db, 'trainings', trainingId));
                if (isMine) docSnap = await getDoc(doc(db, 'users', user.uid, 'myWorkouts', fromMyTrainingId(trainingId)));
                let trainingData = null;
                let trainingDocId = null;

                if (academyRef) {
                    // Ficha da academia: lê SÓ a versão atribuída a este aluno (as regras negam o rascunho e versões de outros).
                    const mine = await loadAssignedTraining(academyRef.academyId, user.uid).catch(() => null);
                    const saved = activeWorkoutService.getActiveSession(user.uid);
                    if (mine && mine.assignment.versionId === academyRef.versionId) {
                        trainingData = { name: mine.version.name, exercises: mine.version.exercises, coachId: '', academyId: academyRef.academyId, versionId: academyRef.versionId };
                    } else if (saved && saved.trainingId === trainingId && saved.hydratedExercises?.length) {
                        // a ficha foi trocada no meio do treino: quem já começou termina a versão que começou
                        trainingData = { name: saved.trainingName || 'Treino da academia', exercises: saved.hydratedExercises, coachId: '', academyId: academyRef.academyId, versionId: academyRef.versionId };
                    } else {
                        toast.error('Esta ficha não está mais atribuída a você.');
                        navigate('/academia');
                        return;
                    }
                    trainingDocId = trainingId;
                } else if (docSnap.exists()) {
                    trainingData = docSnap.data();
                    trainingDocId = isMine ? trainingId : docSnap.id;
                } else if (!isMine) {
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
                } else {
                    toast.error('Treino não encontrado.');
                    navigate('/trainings');
                    return;
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
                // Biblioteca para "Trocar exercício": a do app mais os exercícios que o aluno criou (os dele vêm primeiro)
                let mineLib = [];
                try { mineLib = (await listMyExercises(user.uid)).map(myExerciseToLibrary); } catch (e) { /* sem exercícios próprios */ }
                swapLibraryRef.current = [...mineLib, ...combinedLibrary];

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
                    toast.success("Treino em andamento restaurado!", { id: 'restore-session-toast' });
                } else {
                    startedAtRef.current = Date.now();
                    // Só no começo do treino (retomada não repete). Mesma sequência do botão dos editores; não registra séries.
                    const warmupFromLib = buildWarmupStretch(combinedLibrary);
                    const warmupDefault = buildWarmupStretch(defaultExercises);
                    if (needsWarmupStep(loadedTraining, [warmupFromLib, warmupDefault])) setWarmupSteps(warmupFromLib.length ? warmupFromLib : warmupDefault);
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
    const handleCheckSet = (exIndex, setIndex, targetReps, totalSets, restSeconds, exName, weightHint = null) => {
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
                    finalWeight = weightHint ? String(weightHint) : (historyMap[exName] || '');
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
            // Superset: sem descanso até o último exercício do grupo; depois descansa e volta ao primeiro.
            const action = afterSetAction(training.exercises, exIndex, setIndex, totalSets);
            if (!action.rest) {
                toast(`Sem descanso: agora ${training.exercises[action.goTo]?.name || 'o próximo exercício do grupo'}.`, { duration: 2500 });
                if (viewMode === 'focus' && action.goTo != null) setActiveExerciseIndex(action.goTo);
                return;
            }
            if (action.goTo != null && viewMode === 'focus') {
                clearTimeout(nextExerciseTimeoutRef.current);
                nextExerciseTimeoutRef.current = setTimeout(() => setActiveExerciseIndex(action.goTo), 400);
            }
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

            const clientId = activeWorkoutService.newCheckInId();
            const checkInPayload = {
                clientId,
                userId: user.uid,
                userEmail: user.email,
                userPhoto: user.photoURL || null,
                trainingId: training.id, 
                trainingName: training.name,
                coachId: training.coachId || '',
                ...(training.academyId ? { academyId: training.academyId, versionId: training.versionId, source: 'academy' } : {}),
                date: new Date().toISOString(),
                duration: elapsedTime,
                totalVolume,
                setsCompleted,
                exercises: executedExercises,
                createdAt: new Date().toISOString()
            };

            // Um treino concluído vira no máximo um check-in: o ID é fixo, então qualquer reenvio (fila, outra aba) é ignorado.
            let saved = false;
            if (navigator.onLine) {
                try {
                    await saveCheckIn(db, user.uid, clientId, checkInPayload);
                    saved = true;
                    invalidateCheckIns(user.uid);
                } catch (err) {
                    console.warn("Sem rede no Firestore, enfileirando offline:", err);
                }
            }
            if (saved) {
                // Só um detalhe de conveniência: se falhar, o check-in já está salvo e não vai para a fila.
                updateDoc(doc(db, 'users', user.uid), { lastWorkoutDate: new Date().toISOString() }).catch(() => {});
            } else {
                activeWorkoutService.saveOfflineCheckIn(user.uid, checkInPayload);
            }

            // Limpa o rascunho de sessão
            activeWorkoutService.clearActiveSession(user.uid);

            lastPayloadRef.current = checkInPayload;


            // Detector de Novos Recordes (PRs)
            const newPRs = detectNewPRs(training.exercises, sessionData, historyMap);

            // Atividade para amigos: só com opt-in no perfil social e depois do check-in salvo. Falha aqui nunca atrapalha o treino.
            if (saved) {
                getSocialProfile(user.uid).then(async (social) => {
                    if (!social?.shareWorkouts) return null;
                    let weekCount = 0;
                    try { weekCount = weekCountOf(await fetchStudentCheckIns(user.uid)); } catch (e) { /* sem histórico: o post sai sem a contagem */ }
                    return publishPost(clientId, buildPostPayload(user.uid, { trainingName: training.name, durationSeconds: elapsedTime, setsCompleted, exercisesCount: executedExercises.length, newRecords: newPRs.length, weekCount }));
                }).then((id) => { if (id) toast.success('Publicado para seus amigos.'); }).catch(() => {});
            }
            // Placar dos desafios em grupo: sobe na hora (antes só ao abrir a aba). Falha aqui não atrapalha o treino.
            if (saved) syncScoresAfterWorkout(user.uid, fetchStudentCheckIns).catch((e) => console.warn('Placar dos desafios não atualizado:', e?.code || e));

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

            // Resumo pós-treino: o texto local aparece na hora; a IA reescreve em segundo plano (e só vale se os números baterem)
            try {
                const facts = buildSessionFacts({ training, executedExercises, totalVolume, setsCompleted, duration: elapsedTime, history: rawHistoryDocs, newPRs, weeklyGoal: userProfile?.weeklyGoal });
                const localText = localSummaryText(facts);
                const ai = navigator.onLine;
                setSessionSummary({ facts, text: localText, source: 'local', loading: ai });
                (async () => {
                    let text = localText; let source = 'local';
                    if (ai) {
                        try {
                            const reply = await aiService.summarizeFacts(summaryAiMessages(facts));
                            const clean = String(reply || '').replace(/\s+/g, ' ').trim();
                            if (clean && summaryMatchesFacts(clean, facts)) { text = clean; source = 'ai'; }
                        } catch (e) { /* fica o texto local */ }
                    }
                    setSessionSummary((s) => (s ? { ...s, text, source, loading: false } : s));
                    if (saved) updateDoc(doc(db, 'checkIns', clientId), { summary: { text, source } }).catch(() => {});
                })();
            } catch (e) { console.warn('Resumo do treino indisponível:', e); }

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.", { id: toastId });
        }
    };

    const trainingExercises = training?.exercises || [];
    // ---- controles na tela de bloqueio / notificação de mídia (e relógio pareado) ----
    const pendingIndex = () => trainingExercises.findIndex((e, i) => Array.from({ length: Math.max(1, parseInt(e.sets, 10) || 3) }).some((_, s) => !sessionData[`${i}-${s}`]?.completed));
    const mediaIndex = viewMode === 'focus' ? activeExerciseIndex : Math.max(0, pendingIndex());
    mediaHandlersRef.current = {
        nexttrack: () => {   // concluir a próxima série
            const idx = viewMode === 'focus' ? activeExerciseIndex : pendingIndex();
            const ex = trainingExercises[idx];
            if (!ex) { toast('Todas as séries concluídas. Finalize o treino.'); return; }
            const total = Math.max(1, parseInt(ex.sets, 10) || 3);
            const s = Array.from({ length: total }).findIndex((_, k) => !sessionData[`${idx}-${k}`]?.completed);
            if (s < 0) { toast('Este exercício já está completo.'); return; }
            const sug = suggestNext({ historyDocs: rawHistoryDocs, exName: ex.name, reps: ex.reps, exercise: ex });
            handleCheckSet(idx, s, String(sug ? sug.reps : (parseInt(ex.reps, 10) || 10)), total, ex.rest, ex.name, sug && sug.load > 0 ? sug.load : null);
        },
        previoustrack: () => {   // voltar a última série concluída
            for (let i = trainingExercises.length - 1; i >= 0; i -= 1) {
                const total = Math.max(1, parseInt(trainingExercises[i].sets, 10) || 3);
                for (let s = total - 1; s >= 0; s -= 1) {
                    if (sessionData[`${i}-${s}`]?.completed) { handleCheckSet(i, s, String(parseInt(trainingExercises[i].reps, 10) || 10), total, trainingExercises[i].rest, trainingExercises[i].name, null); toast(`Série ${s + 1} de ${trainingExercises[i].name} desfeita.`); return; }
                }
            }
            toast('Ainda não há série para voltar.');
        },
        play: () => { if (restTimerObj) { setRestTimerObj(null); toast('Descanso pulado.'); } },
        pause: () => { if (restTimerObj) { setRestTimerObj(null); toast('Descanso pulado.'); } },
        seekforward: () => setActiveExerciseIndex((i) => Math.min(trainingExercises.length - 1, i + 1)),
        seekbackward: () => setActiveExerciseIndex((i) => Math.max(0, i - 1))
    };
    const mediaEx = trainingExercises[mediaIndex];
    const mediaDone = mediaEx ? Array.from({ length: Math.max(1, parseInt(mediaEx.sets, 10) || 3) }).filter((_, k) => sessionData[`${mediaIndex}-${k}`]?.completed).length : 0;
    notifHandlersRef.current = {
        done: mediaHandlersRef.current.nexttrack,
        undo: mediaHandlersRef.current.previoustrack,
        rest: mediaHandlersRef.current.play,
        add30: () => setRestTimerObj((prev) => (prev ? { ...prev, endTime: prev.endTime + 30000 } : prev))
    };
    const notifTotal = trainingExercises.reduce((acc, ex) => acc + (Math.max(1, parseInt(ex.sets, 10) || 3)), 0);
    const notifSug = mediaEx ? suggestNext({ historyDocs: rawHistoryDocs, exName: mediaEx.name, reps: mediaEx.reps, exercise: mediaEx }) : null;
    const { alertRestOver } = useWorkoutNotification({
        enabled: notifEnabled && notifPerm === 'granted',
        handlersRef: notifHandlersRef,
        meta: mediaEx ? {
            title: `${mediaEx.name} · ${training?.name || 'Treino'}`,
            setLabel: `Série ${Math.min(mediaDone + 1, Math.max(1, parseInt(mediaEx.sets, 10) || 3))} de ${Math.max(1, parseInt(mediaEx.sets, 10) || 3)} · Meta ${prescriptionLabel(mediaEx)}${notifSug && notifSug.load > 0 ? ` · ${String(notifSug.load).replace('.', ',')} kg` : ''}`,
            progress: `${Object.values(sessionData).filter((x) => x?.completed).length} de ${notifTotal} ${notifTotal === 1 ? 'série concluída' : 'séries concluídas'}`,
            resting: !!restTimerObj,
            restEndsAt: restTimerObj?.endTime || null,
            image: typeof mediaEx.machineImage === 'string' && mediaEx.machineImage.startsWith('/') ? `${window.location.origin}${stillSrc(mediaEx.machineImage)}` : null
        } : null
    });
    // Fim do descanso com o app fechado: o servidor avisa na hora certa (Web Push). Cancela ao pular ou sair da tela.
    const restEndsAt = restTimerObj?.endTime || null;
    const restPushText = mediaEx ? { title: `Descanso acabou · ${mediaEx.name}`.slice(0, 80), body: `Série ${Math.min(mediaDone + 1, Math.max(1, parseInt(mediaEx.sets, 10) || 3))} de ${Math.max(1, parseInt(mediaEx.sets, 10) || 3)} · Meta ${prescriptionLabel(mediaEx)}` } : {};
    const restPushRef = useRef(restPushText);
    restPushRef.current = restPushText;
    useEffect(() => {
        if (!notifEnabled || nativeApp) return undefined;   // no app o próprio aparelho avisa (WorkoutTimer)
        scheduleRestPush(restEndsAt, restPushRef.current);
        return () => { if (restEndsAt) scheduleRestPush(null); };
    }, [restEndsAt, notifEnabled, nativeApp]);
    // App Android: notificação nativa com o cronômetro do descanso correndo e botões que agem no treino.
    const nativeTitle = mediaEx ? `${mediaEx.name} · ${training?.name || 'Treino'}` : '';
    const nativeBody = mediaEx ? `Série ${Math.min(mediaDone + 1, Math.max(1, parseInt(mediaEx.sets, 10) || 3))} de ${Math.max(1, parseInt(mediaEx.sets, 10) || 3)} · Meta ${prescriptionLabel(mediaEx)}\n${Object.values(sessionData).filter((x) => x?.completed).length} de ${notifTotal} ${notifTotal === 1 ? 'série concluída' : 'séries concluídas'}` : '';
    useEffect(() => {
        if (!nativeApp || !notifEnabled || !nativeTitle) return;
        updateWorkoutTimer({ title: nativeTitle, body: nativeBody, endsAt: restEndsAt || 0, alertTitle: `Descanso acabou · ${mediaEx?.name || ''}`.slice(0, 80) });
    }, [nativeApp, notifEnabled, nativeTitle, nativeBody, restEndsAt]);   // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!nativeApp || !notifEnabled) return undefined;
        const off = onWorkoutTimerAction((action) => {
            if (action === 'restOver') { setRestTimerObj(null); return; }
            notifHandlersRef.current?.[action]?.();
        });
        return () => { off(); stopWorkoutTimer(); };   // sair do treino (ou desligar) tira a notificação
    }, [nativeApp, notifEnabled]);
    const goHome = () => { toast('Treino salvo. Para voltar, toque em Continuar no início.', { id: 'workout-left-toast' }); navigate('/dashboard'); };
    const setNotif = async (on) => {
        if (nativeApp) {
            try { window.localStorage.setItem('bt_workout_notif', on ? '1' : '0'); } catch (e) { /* sem storage */ }
            setNotifOfferGone(true);
            if (!on) { await disablePush(); setNotifEnabled(false); toast('Avisos do treino desligados.'); return; }
            const okNative = await enablePush().catch(() => false);
            setNotifEnabled(okNative);
            if (okNative) toast.success('Pronto: o fim do descanso chega como aviso, mesmo com a tela bloqueada.');
            else toast.error('Sem permissão de notificação. Libere nas configurações do app.');
            return;
        }
        try { window.localStorage.setItem('bt_workout_notif', on ? '1' : '0'); } catch (e) { /* sem storage */ }
        setNotifOfferGone(true);
        if (!on) { setNotifEnabled(false); toast('Notificação do treino desativada.'); return; }
        let perm = typeof Notification === 'undefined' ? 'denied' : Notification.permission;
        if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; } }
        setNotifPerm(perm);
        if (perm === 'granted') { setNotifEnabled(true); toast.success('O treino aparece na notificação.'); enablePush().catch(() => {}); }
        else { setNotifEnabled(false); toast.error('Permissão de notificação negada. Libere nas configurações do navegador.'); }
    };

    if (loading || !training) return <div className="h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div></div>;

    // Calcular progresso geral
    const totalSetsInTraining = training.exercises.reduce((acc, ex) => acc + (parseInt(ex.sets) || 3), 0);
    const completedSetsCount = Object.values(sessionData).filter(s => s?.completed).length;
    const progressPercent = totalSetsInTraining > 0 ? Math.round((completedSetsCount / totalSetsInTraining) * 100) : 0;

    const lastExerciseIndex = training.exercises.length - 1;

    // Trocar exercício: só nesta sessão, ou também no treino pessoal salvo
    const doSwap = async (idx, ref, scope) => {
        const original = training.exercises[idx];
        setSwapIndex(null);   // fecha a lista antes da confirmação, para a pergunta não ficar atrás dela
        const done = Array.from({ length: parseInt(original.sets, 10) || 3 }).some((_, i) => sessionData[`${idx}-${i}`]?.completed);
        if (done && !(await confirm({ title: 'Trocar exercício', message: 'Você já concluiu séries deste exercício. Elas serão registradas com o exercício novo. Trocar mesmo assim?', confirmLabel: 'Trocar' }))) return;
        const swapped = buildSwapped(original, ref);
        setTraining((t) => ({ ...t, exercises: t.exercises.map((e, i) => (i === idx ? swapped : e)) }));
        if (scope === 'ficha' && isMyTrainingId(trainingId)) {
            try { await replaceExerciseInMyWorkout(user.uid, fromMyTrainingId(trainingId), original.name, swapped); toast.success(`Trocado por ${swapped.name} nesta sessão e na sua ficha.`); } catch (e) { console.error(e); toast.error('Troquei só hoje: não consegui salvar na sua ficha.'); }
        } else toast.success(`Trocado por ${swapped.name} (só hoje).`);
    };

    const renderExerciseCard = (ex, exIndex, isFocusMode = false) => (
        <ExecutionExerciseCard
            key={exIndex}
            ex={ex}
            exIndex={exIndex}
            isFocusMode={isFocusMode}
            historyMap={historyMap}
            rawHistoryDocs={rawHistoryDocs}
            sessionData={sessionData}
            onSwap={(i) => setSwapIndex(i)}
            superset={(() => { const r = supersetRole(training.exercises, exIndex); return r ? { ...r, goToName: training.exercises[r.nextIndex ?? r.firstIndex]?.name } : null; })()}
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
            <SwapExerciseModal
                isOpen={swapIndex !== null}
                onClose={() => setSwapIndex(null)}
                exercise={swapIndex !== null ? training.exercises[swapIndex] : null}
                library={swapLibraryRef.current}
                owned={userProfile?.gymEquipment}
                excludeNames={training.exercises.map((e) => e.name)}
                canPersist={isMyTrainingId(trainingId)}
                onPick={(ref, scope) => doSwap(swapIndex, ref, scope)}
            />

            <ExecutionHeader
                onGoHome={goHome}
                trainingName={training.name}
                isOnline={isOnline}
                elapsedTime={elapsedTime}
                completedSetsCount={completedSetsCount}
                totalSetsInTraining={totalSetsInTraining}
                progressPercent={progressPercent}
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
                notifSupported={notifSupported}
                notifEnabled={notifEnabled && notifPerm === 'granted'}
                onToggleNotif={() => setNotif(!(notifEnabled && notifPerm === 'granted'))}
            />

            {/* ÁREA DE CONTEÚDO */}
            <div className="pt-28 sm:pt-24 md:pt-44 px-4 max-w-2xl mx-auto space-y-6">
                {notifSupported && !notifOfferGone && notifPerm !== 'denied' && (
                    <div className="surface p-4 flex flex-col gap-3" role="region" aria-label="Notificação do treino">
                        <p className="text-sm text-gray-800 dark:text-gray-200"><b>Mostrar o treino na notificação?</b> Você vê o exercício e a série atual com a tela bloqueada e conclui a série ou pula o descanso pelos botões. Não pausa a sua música.</p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setNotif(true)} className="pressable min-h-[44px] rounded-xl bg-brand px-4 text-sm font-bold text-black">Ativar</button>
                            <button type="button" onClick={() => setNotif(false)} className="pressable min-h-[44px] rounded-xl bg-gray-100 px-4 text-sm font-bold text-gray-800 dark:bg-white/10 dark:text-gray-200">Agora não</button>
                        </div>
                    </div>
                )}
                
                {warmupSteps ? (
                    <WarmupStretchStep
                        exercises={warmupSteps}
                        onDone={(how) => { setWarmupSteps(null); if (how === 'done') toast.success('Alongamento feito. Bora para o treino!', { duration: 2000 }); }}
                    />
                ) : viewMode === 'list' ? (
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
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
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
                    className={`mx-auto flex min-h-[48px] w-full max-w-2xl items-center justify-center gap-2 rounded-2xl font-black active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/50 ${viewMode === 'focus' ? 'border-2 border-gray-300 text-gray-800 dark:border-white/15 dark:text-gray-100 text-sm' : 'bg-gradient-to-r from-brand to-[#FF9800] text-black text-lg py-4 shadow-lg shadow-brand/25'}`}
                >
                    <Award className="w-5 h-5" aria-hidden="true" /> FINALIZAR TREINO
                </button>
            </div>

            {/* MODAIS */}
            {restTimerObj && (
                <RestTimer 
                    endTime={restTimerObj.endTime}
                    duration={restTimerObj.duration} 
                    onFinish={() => { setRestTimerObj(null); alertRestOver(); toast.success("Bora pra próxima!", { duration: 2000 }); }} 
                    onClose={() => setRestTimerObj(null)} 
                    onAdjust={(ms) => setRestTimerObj(prev => prev ? ({ ...prev, endTime: prev.endTime + ms }) : null)}
                    onGoHome={goHome}
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
                    summary={sessionSummary}
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
