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
                exSets.push({ weight: w, reps: r, completed: true });
            }
        }
        return { name: ex.name, muscleGroup: ex.muscleGroup, sets: exSets };
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
