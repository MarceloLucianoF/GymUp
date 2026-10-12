import { useEffect, useState } from 'react';
import { useAuthContext } from './AuthContext';
import { fetchStudentCheckIns } from '../services/checkInsCache';

// Check-ins do próprio aluno (userId == uid), ordem cronológica.
export default function useExerciseHistory() {
  const { user } = useAuthContext();
  const uid = user?.uid;
  const [state, setState] = useState({ checkIns: [], loading: true, error: null });

  useEffect(() => {
    if (!uid) { setState({ checkIns: [], loading: false, error: null }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchStudentCheckIns(uid)
      .then((rows) => {
        if (!cancelled) setState({ checkIns: rows.reverse(), loading: false, error: null });
      })
      .catch((error) => {
        console.error('Erro analytics:', error);
        if (!cancelled) setState({ checkIns: [], loading: false, error });
      });
    return () => { cancelled = true; };
  }, [uid]);

  return state;
}
