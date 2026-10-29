import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardList, HeartPulse, Lock, Plus, Printer } from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import ErrorState from '../common/ErrorState';
import AssessmentForm from './AssessmentForm';
import AssessmentTimeline from './AssessmentTimeline';
import { AnamnesisView } from './Anamnesis';
import { HEALTH_PRINT_CSS } from './printStyles';
import { btnGhost, btnPrimary } from '../coach/styles';
import {
  consentCovers, deleteAssessment, getConsent, listAnamneses, listAssessments, saveAssessment
} from '../../services/healthRecords';
import { formatDate } from '../../utils/format';

// Aba "Saúde" do aluno para o professor: só com o consentimento do aluno (healthConsents) em nome deste professor.
export default function CoachHealthPanel({ studentId, coachId, student }) {
  const { confirm, dialog } = useConfirm();
  const [state, setState] = useState('loading');   // loading | blocked | ready | error
  const [assessments, setAssessments] = useState([]);
  const [anamnesis, setAnamnesis] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const consent = await getConsent(studentId);
      if (!consentCovers(consent, coachId)) { setState('blocked'); return; }
      const [a, n] = await Promise.all([listAssessments(studentId), listAnamneses(studentId)]);
      setAssessments(a); setAnamnesis(n[0] || null); setState('ready');
    } catch (e) {
      // Consentimento revogado entre a leitura e a lista: as regras negam, tratamos como "não autorizou".
      if (e?.code === 'permission-denied') { setState('blocked'); return; }
      console.error(e);
      setState('error');
    }
  }, [studentId, coachId]);

  useEffect(() => { if (studentId && coachId) load(); }, [studentId, coachId, load]);

  const save = async (form) => {
    setSaving(true);
    try {
      const saved = await saveAssessment(form, { userId: studentId, authorId: coachId, kind: 'instructor', coachId });
      setAssessments((l) => [saved, ...l].sort((x, y) => String(y.date).localeCompare(String(x.date))));
      setAdding(false);
      toast.success('Avaliação registrada.');
    } catch (e) {
      console.error(e);
      if (e?.code === 'permission-denied') { toast.error('O aluno revogou a autorização.'); setAdding(false); setState('blocked'); }
      else toast.error('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    const ok = await confirm({ title: 'Apagar avaliação?', message: 'A avaliação some também para o aluno.', confirmLabel: 'Apagar', danger: true });
    if (!ok) return;
    try { await deleteAssessment(a.id); setAssessments((l) => l.filter((x) => x.id !== a.id)); toast.success('Avaliação apagada.'); }
    catch (e) { console.error(e); toast.error('Não foi possível apagar.'); }
  };

  if (state === 'loading') return <p className="surface p-5 text-sm text-gray-600 dark:text-gray-400">Carregando...</p>;
  if (state === 'error') return <ErrorState onRetry={load} />;
  if (state === 'blocked') {
    return (
      <section className="surface space-y-2 p-5" aria-labelledby="health-blocked">
        <h2 id="health-blocked" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
          <Lock className="h-5 w-5 text-brand" aria-hidden="true" /> O aluno ainda não autorizou
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Anamnese e avaliações físicas são dados de saúde: só aparecem aqui depois que {student?.displayName || 'o aluno'} autorizar,
          em Evolução › Avaliações e anamnese. Ele pode revogar quando quiser.
        </p>
      </section>
    );
  }

  return (
    <div id="health-print" className="space-y-6">
      <style>{HEALTH_PRINT_CSS}</style>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">{student?.displayName} · {formatDate(new Date())}</p>
        <button type="button" onClick={() => window.print()} className={`${btnGhost} print:hidden`}><Printer className="h-4 w-4" aria-hidden="true" /> Imprimir</button>
      </div>
      <section className="surface space-y-3 p-5" aria-labelledby="coach-anamnesis">
        <h2 id="coach-anamnesis" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
          <ClipboardList className="h-5 w-5 text-brand" aria-hidden="true" /> Anamnese
        </h2>
        <AnamnesisView anamnesis={anamnesis} />
      </section>
      <section className="surface space-y-4 p-5" aria-labelledby="coach-assessments">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="coach-assessments" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
            <HeartPulse className="h-5 w-5 text-brand" aria-hidden="true" /> Avaliações físicas
          </h2>
          <button type="button" onClick={() => setAdding(true)} className={`${btnPrimary} print:hidden`}><Plus className="h-4 w-4" aria-hidden="true" /> Registrar avaliação</button>
        </div>
        <AssessmentTimeline items={assessments} canDelete={(a) => a.kind === 'instructor' && a.coachId === coachId} onDelete={remove} />
      </section>
      {adding && (
        <Modal onClose={() => setAdding(false)} label="Avaliação do instrutor" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 dark:bg-gray-900">
          <h2 className="mb-4 font-display text-lg font-black text-gray-900 dark:text-white">Avaliação do instrutor</h2>
          <AssessmentForm kinds={['instructor']} defaults={{ height: student?.height || '', age: student?.age || '', weight: student?.weight || '' }}
            saving={saving} onSave={save} onCancel={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}
