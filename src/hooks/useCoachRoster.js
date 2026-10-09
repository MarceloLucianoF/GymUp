import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

const BATCH = 30; // limite de valores em "in"
export const DEFAULT_FEE = 120;

// Carrega alunos vinculados, fichas do treinador e check-ins recentes dos alunos.
// As regras só permitem ler check-ins por userId de alunos vinculados, por isso o lote "in".
export const useCoachRoster = (user, { checkInLimit = 150 } = {}) => {
    const [state, setState] = useState({ students: [], trainings: [], checkIns: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const uid = user?.uid;

    useEffect(() => {
        if (!uid) return undefined;
        let cancelled = false;
        const load = async () => {
            setError(false);
            try {
                const [studentsSnap, trainingsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'users'), where('role', '==', 'user'), where('coachId', '==', uid))),
                    // Sem orderBy: evita exigir índice composto; ordenamos no cliente.
                    getDocs(query(collection(db, 'trainings'), where('coachId', '==', uid)))
                ]);
                const students = studentsSnap.docs.map(d => ({ ...d.data(), id: d.id, uid: d.id }));
                const trainings = trainingsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

                const ids = students.map(s => s.uid);
                const batches = [];
                for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
                const snaps = await Promise.all(batches.map(b => getDocs(query(
                    collection(db, 'checkIns'),
                    where('userId', 'in', b),
                    orderBy('date', 'desc'),
                    limit(checkInLimit)
                ))));
                const checkIns = snaps
                    .flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (!cancelled) setState({ students, trainings, checkIns });
            } catch (err) {
                console.error('Erro useCoachRoster:', err);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [uid, reloadKey, checkInLimit]);

    const reload = useCallback(() => { setLoading(true); setReloadKey(k => k + 1); }, []);
    const setStudents = useCallback((updater) => setState(prev => ({
        ...prev,
        students: typeof updater === 'function' ? updater(prev.students) : updater
    })), []);

    return { ...state, loading, error, reload, setStudents };
};

// Último treino por aluno (maior entre check-ins carregados e users.lastWorkoutDate).
export const lastWorkoutMap = (students, checkIns) => {
    const map = {};
    checkIns.forEach(c => {
        const d = new Date(c.date);
        if (!Number.isNaN(d.getTime()) && (!map[c.userId] || d > map[c.userId])) map[c.userId] = d;
    });
    students.forEach(s => {
        const d = s.lastWorkoutDate ? new Date(s.lastWorkoutDate) : null;
        if (d && !Number.isNaN(d.getTime()) && (!map[s.uid] || d > map[s.uid])) map[s.uid] = d;
    });
    return map;
};
