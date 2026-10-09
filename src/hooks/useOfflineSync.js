import { useState, useEffect, useCallback } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { activeWorkoutService } from '../services/activeWorkoutService';

// Acompanha a conectividade e sincroniza check-ins enfileirados offline ao voltar a rede.
export function useOfflineSync(user) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const syncPendingOfflineCheckIns = useCallback(async () => {
        if (!user) return;
        const pending = activeWorkoutService.getOfflineCheckIns(user.uid);
        if (pending.length === 0) return;
        try {
            for (const payload of pending) {
                await addDoc(collection(db, 'checkIns'), payload);
            }
            activeWorkoutService.clearOfflineCheckIns(user.uid);
            toast.success("✓ Treinos offline sincronizados com sucesso!");
        } catch (err) {
            console.error("Erro ao sincronizar treinos offline:", err);
        }
    }, [user]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Conexão reestabelecida. Sincronizando...", { id: 'online-status' });
            syncPendingOfflineCheckIns();
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast.error("Você está offline. Seu treino continua salvo no celular.", { id: 'offline-status', duration: 4000 });
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [user, syncPendingOfflineCheckIns]);

    return { isOnline, syncPendingOfflineCheckIns };
}
