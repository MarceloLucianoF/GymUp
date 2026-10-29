import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardList, HeartPulse, Plus, Printer, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/common/Modal';
import ErrorState from '../../components/common/ErrorState';
import { SkeletonList } from '../../components/common/Skeleton';
import AssessmentForm from '../../components/health/AssessmentForm';
import AssessmentTimeline from '../../components/health/AssessmentTimeline';
import { AnamnesisForm, AnamnesisView } from '../../components/health/Anamnesis';
import { HEALTH_PRINT_CSS } from '../../components/health/printStyles';
import { btnDanger, btnGhost, btnPrimary } from '../../components/coach/styles';
import { getPublicCoach } from '../../services/coachProfile';
import {
  consentCovers, deleteAnamnesis, deleteAssessment, getConsent, grantConsent, listAnamneses, listAssessments,
  revokeConsent, saveAnamnesis, saveAssessment
} from '../../services/healthRecords';
import { formatDate } from '../../utils/format';

function Sheet({ label, onClose, children }) {
  return (
    <Modal onClose={onClose} label={label} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 dark:bg-gray-900">
      <h2 className="mb-4 font-display text-lg font-black text-gray-900 dark:text-white">{label}</h2>
      {children}
    </Modal>
  );
}

// Consentimento (LGPD art. 11): explica o que o professor vê e permite revogar a qualquer momento.
function ConsentCard({ coachId, coachName, consent, busy, onGrant, onRevoke }) {
  const covered = consentCovers(consent, coachId);
  return (
    <section className="surface space-y-3 p-5 print:hidden" aria-labelledby="consent-title">
      <h2 id="consent-title" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
        <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" /> Compartilhar com o professor
      </h2>
      {!coachId ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Você não tem professor vinculado. Suas avaliações e anamneses ficam visíveis só para você.</p>
      ) : (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Dados de saúde são sensíveis. Com a sua autorização, <strong>{coachName || 'seu professor'}</strong> poderá:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>ver suas anamneses (PAR-Q, lesões, cirurgias, medicamentos, doenças, objetivos e rotina);</li>
            <li>ver suas avaliações físicas e bioimpedâncias;</li>
            <li>registrar avaliações físicas feitas por ele.</li>
          </ul>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Ninguém mais vê esses dados, nem a administração do app. Você pode revogar a qualquer momento: o acesso acaba na hora.
            Trocar ou encerrar o vínculo também encerra a autorização.
          </p>
          {covered ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Autorizado em {formatDate(consent.acceptedAt)}</span>
              <button type="button" disabled={busy} onClick={onRevoke} className={btnDanger}>Revogar autorização</button>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={onGrant} className={btnPrimary}>Autorizar {coachName || 'meu professor'}</button>
          )}
        </>
      )}
      {consent && !covered && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Há uma autorização antiga para outro professor, que não vale mais. <button type="button" className="underline" onClick={onRevoke}>Apagar</button>
        </p>
      )}
    </section>
  );
}

export default function HealthRecordsPage() {
  const { user, userProfile } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const uid = user?.uid;
  const coachId = userProfile?.coachId || null;

  const [assessments, setAssessments] = useState([]);
  const [anamneses, setAnamneses] = useState([]);
  const [consent, setConsent] = useState(null);
  const [coachName, setCoachName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);   // 'assessment' | 'anamnesis' | null

  const load = useCallback(async () => {
    if (!uid) return;
    setError(false);
    try {
      const [a, n, c] = await Promise.all([listAssessments(uid), listAnamneses(uid), getConsent(uid)]);
      setAssessments(a); setAnamneses(n); setConsent(c);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!coachId) return;
    getPublicCoach(coachId).then((c) => setCoachName(c?.displayName || '')).catch(() => {});
  }, [coachId]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); return true; }
    catch (e) { console.error(e); toast.error('Não foi possível concluir. Tente de novo.'); return false; }
    finally { setBusy(false); }
  };

  const grant = () => run(async () => setConsent(await grantConsent(uid, coachId)), 'Autorização registrada.');
  const revoke = async () => {
    const ok = await confirm({ title: 'Revogar autorização?', message: 'O professor deixa de ver suas avaliações e anamneses na hora. Nada é apagado.', confirmLabel: 'Revogar', danger: true });
    if (ok) await run(async () => { await revokeConsent(uid); setConsent(null); }, 'Autorização revogada.');
  };

  const addAssessment = async (form) => {
    const done = await run(async () => {
      const saved = await saveAssessment(form, { userId: uid, authorId: uid, kind: form.kind });
      setAssessments((list) => [saved, ...list].sort((x, y) => String(y.date).localeCompare(String(x.date))));
    }, 'Avaliação salva.');
    if (done) setSheet(null);
  };
  const removeAssessment = async (a) => {
    const ok = await confirm({ title: 'Apagar avaliação?', message: 'Esta avaliação some para você e para o professor.', confirmLabel: 'Apagar', danger: true });
    if (ok) await run(async () => { await deleteAssessment(a.id); setAssessments((l) => l.filter((x) => x.id !== a.id)); }, 'Avaliação apagada.');
  };
  const addAnamnesis = async (form) => {
    const done = await run(async () => {
      const saved = await saveAnamnesis(form, { userId: uid, previous: anamneses });
      setAnamneses((l) => [saved, ...l]);
    }, 'Anamnese salva.');
    if (done) setSheet(null);
  };
  const removeAnamnesis = async (n) => {
    const ok = await confirm({ title: `Apagar a versão ${n.version}?`, message: 'Esta versão da anamnese some para você e para o professor.', confirmLabel: 'Apagar', danger: true });
    if (ok) await run(async () => { await deleteAnamnesis(n.id); setAnamneses((l) => l.filter((x) => x.id !== n.id)); }, 'Versão apagada.');
  };

  const latest = anamneses[0] || null;
  const defaults = { height: userProfile?.height || '', age: userProfile?.age || '', weight: userProfile?.weight || '' };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-32 transition-colors duration-300 dark:bg-[#0B0F19] md:p-8">
      <style>{HEALTH_PRINT_CSS}</style>
      {dialog}
      <div id="health-print" className="mx-auto max-w-4xl space-y-6">
        <Link to="/measurements" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 print:hidden">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Peso e medidas
        </Link>
        <PageHeader
          eyebrow="Evolução"
          title="Avaliações e anamnese"
          subtitle={`${userProfile?.displayName || ''}${userProfile?.displayName ? ' · ' : ''}gerado em ${formatDate(new Date())}`}
          actions={<button type="button" onClick={() => window.print()} className={`${btnGhost} print:hidden`}><Printer className="h-4 w-4" aria-hidden="true" /> Imprimir</button>}
        />

        {loading ? <SkeletonList /> : error ? <ErrorState onRetry={() => { setLoading(true); load(); }} /> : (
          <>
            <ConsentCard coachId={coachId} coachName={coachName} consent={consent} busy={busy} onGrant={grant} onRevoke={revoke} />

            <section className="surface space-y-4 p-5" aria-labelledby="anamnesis-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="anamnesis-title" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
                  <ClipboardList className="h-5 w-5 text-brand" aria-hidden="true" /> Anamnese
                </h2>
                <button type="button" onClick={() => setSheet('anamnesis')} className={`${btnPrimary} print:hidden`}>
                  {latest ? 'Atualizar anamnese' : 'Preencher anamnese'}
                </button>
              </div>
              <AnamnesisView anamnesis={latest} />
              {anamneses.length > 0 && (
                <details className="print:hidden">
                  <summary className="cursor-pointer text-sm font-bold text-gray-700 dark:text-gray-300">Versões ({anamneses.length})</summary>
                  <ul className="mt-2 divide-y divide-gray-100 dark:divide-white/10">
                    {anamneses.map((n) => (
                      <li key={n.id} className="flex items-center justify-between py-1 text-sm">
                        <span>Versão {n.version} · {formatDate(n.createdAt)}</span>
                        <button type="button" onClick={() => removeAnamnesis(n)} aria-label={`Apagar versão ${n.version}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:text-red-500 dark:text-gray-400">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>

            <section className="surface space-y-4 p-5" aria-labelledby="assessments-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="assessments-title" className="flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white">
                  <HeartPulse className="h-5 w-5 text-brand" aria-hidden="true" /> Avaliações físicas
                </h2>
                <button type="button" onClick={() => setSheet('assessment')} className={`${btnPrimary} print:hidden`}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Lançar avaliação
                </button>
              </div>
              <AssessmentTimeline items={assessments} canDelete={() => true} onDelete={removeAssessment} />
            </section>
          </>
        )}
      </div>

      {sheet === 'assessment' && (
        <Sheet label="Nova avaliação" onClose={() => setSheet(null)}>
          <AssessmentForm kinds={['self', 'bioimpedance']} defaults={defaults} saving={busy} onSave={addAssessment} onCancel={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'anamnesis' && (
        <Sheet label="Anamnese" onClose={() => setSheet(null)}>
          <AnamnesisForm initial={latest} saving={busy} onSave={addAnamnesis} onCancel={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  );
}
