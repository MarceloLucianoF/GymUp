import { formatDate } from './format';

// Normaliza/hidrata os exercícios de um treino cruzando a biblioteca (Firestore + defaults).
export const hydrateExercises = (rawExercises, combinedLibrary) => rawExercises.map((ex, idx) => {
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

// Carga máxima mais recente por exercício, a partir dos check-ins (mais novos primeiro).
export const buildLoadMap = (historyDocs) => {
    const loadMap = {};
    historyDocs.forEach(data => {
        if (data.exercises) {
            data.exercises.forEach(ex => {
                if (!loadMap[ex.name]) {
                    const max = Math.max(...(ex.sets?.map(s => Number(s.weight) || 0) || [0]));
                    if (max > 0) loadMap[ex.name] = max;
                }
            });
        }
    });
    return loadMap;
};

// Linhas do modal de histórico de cargas de um exercício.
export const buildExerciseLoadLogs = (historyDocs, exerciseName) => {
    const logs = [];
    historyDocs.forEach(d => {
        if (d.exercises) {
            const found = d.exercises.find(e => e.name === exerciseName);
            if (found && found.sets && found.sets.length > 0) {
                const weights = found.sets.map(s => Number(s.weight) || 0);
                logs.push({
                    date: formatDate(d.date, { day: '2-digit', month: '2-digit', year: '2-digit' }, 'Recente'),
                    maxWeight: Math.max(...weights),
                    setsCount: found.sets.length
                });
            }
        }
    });
    return logs;
};

// Repetições da série mais pesada do último treino em que o exercício apareceu.
export const getLastReps = (historyDocs, exName) => {
    let lastReps = null;
    historyDocs.forEach(d => {
        if (d.exercises && !lastReps) {
            const found = d.exercises.find(e => e.name === exName);
            if (found && found.sets && found.sets.length > 0) {
                const highestSet = found.sets.reduce((max, s) => (Number(s.weight) || 0) >= (Number(max.weight) || 0) ? s : max, found.sets[0]);
                lastReps = Number(highestSet.reps) || null;
            }
        }
    });
    return lastReps;
};

// Dica de progressão de carga/repetições.
export const getSmartTip = (lastLoad, lastReps, targetRepsNum) => {
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
    return smartTip;
};

// Resumo da sessão: log por exercício, volume total e séries concluídas.
export const summarizeSession = (exercises, sessionData) => {
    let totalVolume = 0;
    let setsCompleted = 0;

    const exercisesLog = exercises.map((ex, exIndex) => {
        const exSets = [];
        const numSets = Number(ex.sets) || 3;
        for (let i = 0; i < numSets; i++) {
            const data = sessionData[`${exIndex}-${i}`];
            if (data?.completed) {
                setsCompleted++;
                const w = parseFloat(data.weight) || 0;
                const r = parseFloat(data.reps) || 0;
                totalVolume += w * r;
                const set = { weight: w, reps: r, completed: true };
                const rpe = normalizeRpe(data.rpe);
                if (rpe) set.rpe = rpe;
                exSets.push(set);
            }
        }
        const entry = { name: ex.name, muscleGroup: ex.muscleGroup, sets: exSets };
        const note = normalizeNote(sessionData[noteKey(exIndex)]?.note);
        if (note) entry.note = note;
        return entry;
    });

    return {
        totalVolume,
        setsCompleted,
        executedExercises: exercisesLog.filter(e => e.sets.length > 0)
    };
};

// Exercícios cuja carga máxima superou o recorde anterior.
export const detectNewPRs = (exercises, sessionData, historyMap) => {
    const newPRs = [];
    exercises.forEach((ex, exIndex) => {
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
    return newPRs;
};

// ---- Utilidades de execução (carga rápida, cópia da última sessão, RPE, notas, compartilhamento) ----

export const NOTE_MAX = 300;
export const noteKey = (exIndex) => `note-${exIndex}`;

const roundStep = (n) => Math.round(n * 100) / 100;

// Soma delta a um valor de input (string/numero). Nunca fica abaixo de 0. Vazio parte de `base`.
export const adjustValue = (current, delta, base = 0) => {
    const parsed = parseFloat(String(current ?? '').replace(',', '.'));
    const start = Number.isFinite(parsed) ? parsed : (Number(base) || 0);
    const next = Math.max(0, roundStep(start + delta));
    return next === 0 ? '' : String(next);
};

// Séries (peso/reps) do treino mais recente em que o exercício apareceu.
export const getLastSessionSets = (historyDocs, exName) => {
    for (const d of historyDocs || []) {
        const found = d?.exercises?.find(e => e.name === exName);
        if (found?.sets?.length > 0) {
            return found.sets.map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }));
        }
    }
    return [];
};

// Última nota registrada para o exercício (histórico mais recente primeiro).
export const getLastNote = (historyDocs, exName) => {
    for (const d of historyDocs || []) {
        const found = d?.exercises?.find(e => e.name === exName);
        if (found && typeof found.note === 'string' && found.note.trim()) return found.note.trim();
    }
    return '';
};

// Valores para preencher cada série com a última sessão; séries além das anteriores repetem a última.
export const buildCopyFromLast = (lastSets, setsCount) => {
    if (!lastSets || lastSets.length === 0) return [];
    return Array.from({ length: setsCount }, (_, i) => {
        const s = lastSets[Math.min(i, lastSets.length - 1)];
        return {
            weight: s.weight > 0 ? String(s.weight) : '',
            reps: s.reps > 0 ? String(s.reps) : ''
        };
    });
};

// Série é recorde quando a carga supera o melhor anterior (precisa existir histórico).
export const isPRSet = (weight, prevMax) => {
    const w = parseFloat(weight) || 0;
    return w > 0 && Number(prevMax) > 0 && w > Number(prevMax);
};

export const normalizeRpe = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
};

export const normalizeNote = (v) => (typeof v === 'string' ? v.trim().slice(0, NOTE_MAX) : '');

// Texto para Web Share / área de transferência.
export const buildShareText = ({ trainingName, timeStr, volumeKg, completedSetsCount, newPRs = [] }) => {
    const lines = [
        `Treino concluído: ${trainingName || 'Treino'} 💪`,
        `⏱ ${timeStr} | 🏋️ ${Math.round(volumeKg || 0)} kg de volume | ✅ ${completedSetsCount || 0} séries`
    ];
    if (newPRs.length > 0) lines.push(`🏆 Recordes: ${newPRs.join(', ')}`);
    lines.push('Feito com BohTreinar');
    return lines.join('\n');
};

export const formatDuration = (seconds) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};
