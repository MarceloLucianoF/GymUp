import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ClipboardList, Check, X } from 'lucide-react';
import { db } from '../../firebase/config';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import Avatar from './Avatar';
import { btnGhost, btnPrimary } from './styles';

// Atribui uma ficha do treinador ao aluno (users/{id}.currentTrainingId).
// As regras permitem ao treinador vinculado alterar currentTrainingId para fichas que ele possui (ou null).
export default function AssignTrainingModal({ student, trainings, onClose, onAssigned, onCreateTraining }) {
  const [savingId, setSavingId] = useState(null);

  const assign = async (trainingId) => {
    setSavingId(trainingId ?? 'none');
    const toastId = toast.loading(trainingId ? 'Atribuindo ficha...' : 'Removendo ficha...');
    try {
      await updateDoc(doc(db, 'users', student.id), { currentTrainingId: trainingId, updatedAt: new Date().toISOString() });
      toast.success(trainingId ? 'Ficha atribuída!' : 'Ficha removida.', { id: toastId });
      onAssigned?.(trainingId);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atribuir a ficha.', { id: toastId });
      setSavingId(null);
    }
  };

  return (
    <Modal onClose={onClose} label="Atribuir ficha" className="w-full max-w-lg">
      <div className="surface flex max-h-[85vh] flex-col bg-white dark:bg-gray-900 animate-scale-in">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <Avatar name={student.displayName} src={student.photoURL} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-black text-gray-900 dark:text-white">Atribuir ficha</h3>
            <p className="truncate text-sm text-gray-500">Para {student.displayName || 'aluno'}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {trainings.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Você ainda não criou fichas." description="Crie uma ficha para poder atribuir ao aluno."
              action={onCreateTraining && <button type="button" onClick={onCreateTraining} className={btnPrimary}>Criar ficha</button>} />
          ) : trainings.map((t) => {
            const current = student.currentTrainingId === t.id;
            return (
              <button key={t.id} type="button" disabled={current || savingId !== null} onClick={() => assign(t.id)}
                className={`pressable flex min-h-[64px] w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${current ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-gray-200 hover:border-brand dark:border-white/10'} disabled:opacity-70`}>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"><ClipboardList className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-gray-900 dark:text-white">{t.name}</span>
                  <span className="text-xs text-gray-500">{t.difficulty || 'Ficha'} · {t.exercises?.length || 0} exercícios</span>
                </span>
                {current && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-600"><Check className="h-3 w-3" /> Atual</span>}
              </button>
            );
          })}
        </div>
        {student.currentTrainingId && (
          <div className="border-t border-gray-100 p-4 dark:border-white/10">
            <button type="button" disabled={savingId !== null} onClick={() => assign(null)} className={`${btnGhost} w-full`}>Remover ficha atual</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
