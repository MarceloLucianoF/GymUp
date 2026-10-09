import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthContext } from './AuthContext';

// Check-ins do próprio aluno (userId == uid), ordem cronológica.
export default function useExerciseHistory() {
  const { user } = useAuthContext();
  const uid = user?.uid;
  const [state, setState] = useState({ checkIns: [], loading: true, error: null });

  useEffect(() => {
    if (!uid) { setState({ checkIns: [], loading: false, error: null }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getDocs(query(collection(db, 'checkIns'), where('userId', '==', uid), orderBy('date', 'asc')))
      .then((snap) => {
        if (!cancelled) setState({ checkIns: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null });
      })
      .catch((error) => {
        console.error('Erro analytics:', error);
        if (!cancelled) setState({ checkIns: [], loading: false, error });
      });
    return () => { cancelled = true; };
  }, [uid]);

  return state;
}
