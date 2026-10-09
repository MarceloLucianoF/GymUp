import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from './AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query,
  orderBy
} from 'firebase/firestore';

export function useAdmin() {
  const { user } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [trainingsError, setTrainingsError] = useState(null);

  // 1. VERIFICAÇÃO DE SEGURANÇA (O Crachá)
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        // Verifica se o campo 'role' é 'admin'
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Erro ao verificar admin:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // 2. Busca de treinos (usada pela TrainingsPage); independe de ser admin.
  const refreshData = useCallback(async () => {
    setTrainingsLoading(true);
    setTrainingsError(null);
    try {
      const q = query(collection(db, 'trainings'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setTrainings(snapshot.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    } catch (err) {
      console.error("Erro ao buscar treinos no hook:", err);
      setTrainingsError('Não foi possível carregar os treinos.');
    } finally {
      setTrainingsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return { 
    isAdmin, 
    loading, 
    trainings, // Exporta a lista de treinos
    trainingsLoading,
    trainingsError,
    refreshData,
    error
  };
}