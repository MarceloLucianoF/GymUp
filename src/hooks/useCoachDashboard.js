import { useMemo } from 'react';
import { useCoachRoster, lastWorkoutMap, DEFAULT_FEE } from './useCoachRoster';
import { buildActionQueue } from '../utils/coachInsights';
import { countByDay, daysSince, studentStatus, startOfDay, DAY_MS } from '../components/coach/helpers';

// Métricas do painel do treinador, derivadas de useCoachRoster (consulta por alunos vinculados).
export const useCoachDashboard = (user) => {
    const { students, trainings, checkIns, loading, error, reload, setStudents } = useCoachRoster(user);

    const data = useMemo(() => {
        const now = new Date();
        const today = startOfDay(now);
        const last = lastWorkoutMap(students, checkIns);
        const nameOf = Object.fromEntries(students.map(s => [s.uid, s]));

        const withStatus = students.map(s => ({
            ...s,
            lastWorkout: last[s.uid] || null,
            status: studentStatus(last[s.uid], now),
            daysInactive: last[s.uid] ? daysSince(last[s.uid], now) : 'Novo'
        }));
        const studentsAtRisk = withStatus
            .filter(s => s.status !== 'active')
            .sort((a, b) => (b.lastWorkout ? now - b.lastWorkout : Infinity) - (a.lastWorkout ? now - a.lastWorkout : Infinity));
        const activeCount = withStatus.length - studentsAtRisk.length;

        const todayCheckIns = checkIns.filter(c => new Date(c.date) >= today);
        const monthAgo = now.getTime() - 30 * DAY_MS;
        const perStudent = {};
        checkIns.forEach(c => {
            if (new Date(c.date).getTime() >= monthAgo) perStudent[c.userId] = (perStudent[c.userId] || 0) + 1;
        });
        const ranking = withStatus
            .map(s => ({ ...s, workouts30: perStudent[s.uid] || 0 }))
            .filter(s => s.workouts30 > 0)
            .sort((a, b) => b.workouts30 - a.workouts30)
            .slice(0, 5);

        const fee = (s) => Number(s.monthlyFee) || DEFAULT_FEE;
        const expected = students.reduce((acc, s) => acc + fee(s), 0);
        const received = students.filter(s => s.paymentStatus === 'paid').reduce((acc, s) => acc + fee(s), 0);

        return {
            stats: {
                active: students.length,
                revenue: expected,
                received,
                checkIns: todayCheckIns.length,
                risk: studentsAtRisk.length,
                retention: students.length ? Math.round((activeCount / students.length) * 100) : 0,
                noTraining: students.filter(s => !s.currentTrainingId).length
            },
            weekly: countByDay(checkIns, 7, now),
            ranking,
            studentsAtRisk: studentsAtRisk.slice(0, 5),
            recentActivity: checkIns.slice(0, 8).map(c => ({ ...c, student: nameOf[c.userId] || null })),
            todayCheckIns,
            students: withStatus,
            trainings,
            actionQueue: buildActionQueue({ students, lastWorkouts: last, checkIns, now })
        };
    }, [students, trainings, checkIns]);

    return { ...data, checkIns, loading, error, reload, setStudents };
};
