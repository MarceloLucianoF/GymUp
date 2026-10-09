import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import { useNotifications, shouldShowReminder } from '../../hooks/useNotifications';

const isToday = (v) => {
  if (!v) return false;
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
};

// Lembrete in-app: só é avaliado ao abrir o app (sem agendamento em background).
export default function WorkoutReminder() {
  const { user } = useAuthContext();
  const uid = user?.uid;
  const { prefs } = useNotifications(uid);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!uid || !prefs.reminder) { setShow(false); return undefined; }
    let alive = true;
    getDocs(query(collection(db, 'checkIns'), where('userId', '==', uid), orderBy('date', 'desc'), limit(1)))
      .then((snap) => {
        const last = snap.docs[0]?.data();
        if (alive) setShow(shouldShowReminder(prefs, last ? isToday(last.date) : false));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [uid, prefs]);

  if (!show) return null;
  return (
    <div role="status" className="fixed top-3 inset-x-4 z-[85] mx-auto max-w-md flex items-center gap-3 rounded-2xl bg-brand text-black px-4 py-3 shadow-xl">
      <Bell className="w-5 h-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-bold">Você ainda não treinou hoje. Bora?</p>
      <button type="button" onClick={() => setShow(false)} aria-label="Fechar lembrete" className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
    </div>
  );
}
