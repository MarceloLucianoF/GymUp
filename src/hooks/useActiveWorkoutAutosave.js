import { useEffect } from 'react';
import { activeWorkoutService } from '../services/activeWorkoutService';

// Persiste o rascunho do treino em andamento a cada mudança relevante.
export function useActiveWorkoutAutosave({
    enabled = true, user, training, sessionData, activeExerciseIndex, viewMode, elapsedTime, restTimerObj, startedAtRef
}) {
    useEffect(() => {
        if (!enabled || !user || !training) return;
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
    }, [enabled, user, training, sessionData, activeExerciseIndex, viewMode, elapsedTime, restTimerObj, startedAtRef]);
}
