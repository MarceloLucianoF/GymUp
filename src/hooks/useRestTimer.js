import { useState, useEffect, useCallback, useRef } from 'react';
import { activeWorkoutService } from '../services/activeWorkoutService';

// Contagem regressiva baseada em timestamp real (resiliente a aba em background).
// onAdjust(ms) recebe o tempo pausado ao retomar, para o chamador deslocar o endTime.
export function useRestTimer({ endTime, onFinish, onAdjust }) {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    const [isPaused, setIsPaused] = useState(false);
    const pausedTimeRef = useRef(null);

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

    return { remaining, isPaused, togglePause };
}
