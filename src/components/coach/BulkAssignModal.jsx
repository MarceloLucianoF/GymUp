import React, { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ClipboardList, X, Check, AlertTriangle } from 'lucide-react';
import { db } from '../../firebase/config';
import Modal from '../common/Modal';
import EmptyState from '../common/EmptyState';
import { runInChunks, planBulkAssign } from '../../utils/coachBatch';
import { btnGhost, btnPrimary } from './styles';

// Lote pequeno: cada gravação consulta a ficha nas regras (limite de get() por requisição).
const CHUNK = 10;

// Atribui uma ficha a vários alunos: escolha -> confirmação com prévia -> resumo do que mudou.
export default function BulkAssignModal({ students, trainings, onClose, onDone, onCreateTraining }) {
  const [trainingId, setTrainingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const plan = useMemo(() => (trainingId ? planBulkAssign(students, trainingId, trainings) : null), [students, trainingId, trainings]);
  const training = trainings.find((t) => t.id === trainingId);

  const apply = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const targets = plan.change.map((c) => c.student);
    const { ok, failed } = await runInChunks(targets, CHUNK, (s) => updateDoc(doc(db, 'users', s.id), { currentTrainingId: trainingId, updatedAt: now }));
    if (failed.length) console.error('Atribuição em lote: falhas', failed.map((f) => f.item.id));
    onDone?.(ok.map((s) => s.id), trainingId);
    setResult({ ok, failed: failed.map((f) => f.item), same: plan.same });
    setSaving(false);
  };

  return (
    <Modal onClose={onClose} label="Atribuir ficha a vários alunos" className="w-full max-w-lg">
      <div className="surface flex max-h-[85vh] flex-col bg-white dark:bg-gray-900 animate-scale-in">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-black text-gray-900 dark:text-white">Atribuir ficha a vários</h3>
            <p className="text-sm text-gray-500">{students.length} aluno{students.length === 1 ? '' : 's'} selecionado{students.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {result ? (
            <div role="status" className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-bold text-emerald-600"><Check className="h-4 w-4" /> {result.ok.length} aluno{result.ok.length === 1 ? '' : 's'} atualizado{result.ok.length === 1 ? '' : 's'} para "{training?.name}".</p>
              {result.same.length > 0 && <p className="text-gray-500">{result.same.length} já tinha{result.same.length === 1 ? '' : 'm'} esta ficha (sem alteração).</p>}
              {result.failed.length > 0 && (
                <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-600">
                  <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> {result.failed.length} falharam:</p>
                  <ul className="mt-1 list-disc pl-5">{result.failed.map((s) => <li key={s.id}>{s.displayName || s.email || 'Aluno'}</li>)}</ul>
                </div>
              )}
            </div>
          ) : !plan ? (
            trainings.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Você ainda não criou fichas." action={onCreateTraining && <button type="button" onClick={onCreateTraining} className={btnPrimary}>Criar ficha</button>} />
            ) : trainings.map((t) => (
              <button key={t.id} type="button" onClick={() => setTrainingId(t.id)} className="pressable flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-gray-200 p-3 text-left transition hover:border-brand dark:border-white/10">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"><ClipboardList className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold text-gray-900 dark:text-white">{t.name}</span><span className="text-xs text-gray-500">{t.difficulty || 'Ficha'} · {t.exercises?.length || 0} exercícios</span></span>
              </button>
            ))
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-bold text-gray-900 dark:text-white">Confirmar ficha "{training?.name}"</p>
              {plan.change.length === 0 ? <p className="text-gray-500">Todos já têm esta ficha. Nada a alterar.</p> : (
                <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
                  {plan.change.map(({ student, from }) => (
                    <li key={student.id} className="flex items-center justify-between gap-2 p-3">
                      <span className="min-w-0 truncate font-semibold text-gray-900 dark:text-white">{student.displayName || 'Aluno'}</span>
                      <span className="shrink-0 text-xs text-gray-500">{from ? `de "${from}"` : 'sem ficha'}</span>
                    </li>
                  ))}
                </ul>
              )}
              {plan.same.length > 0 && <p className="text-xs text-gray-500">{plan.same.length} já tem esta ficha e será ignorado: {plan.same.map((s) => s.displayName || 'Aluno').join(', ')}.</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-4 dark:border-white/10">
          {result ? (
            <button type="button" onClick={onClose} className={`${btnPrimary} col-span-2`}>Concluir</button>
          ) : plan ? (
            <>
              <button type="button" disabled={saving} onClick={() => setTrainingId(null)} className={btnGhost}>Voltar</button>
              <button type="button" disabled={saving || plan.change.length === 0} onClick={apply} className={btnPrimary}>{saving ? 'Atribuindo...' : `Atribuir a ${plan.change.length}`}</button>
            </>
          ) : (
            <button type="button" onClick={onClose} className={`${btnGhost} col-span-2`}>Cancelar</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
