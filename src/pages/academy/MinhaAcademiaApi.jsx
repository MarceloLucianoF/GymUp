import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, LogOut } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import PageSkeleton from '../../components/coach/PageSkeleton';
import ErrorState from '../../components/common/ErrorState';
import { btnDanger, btnGhost, btnPrimary, pageCls } from '../../components/coach/styles';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import usePageMeta from '../../hooks/usePageMeta';
import { GESTAO_URL, academyApi, academyApiMessage } from '../../services/academyApi';
import { loadAssignedTraining } from '../../services/academyTrainingSource';
import { clearSnapshot } from '../../services/academySnapshot';
import { academyTrainingId } from '../../utils/academyTrainingId';

const ROLE = { owner: 'Proprietário', admin: 'Administrador', coach: 'Professor', reception: 'Recepção', student: 'Aluno' };
const fail = (e) => toast.error(academyApiMessage(e));

/** Ficha atribuída: a versão EXATA entregue ao aluno. Funciona offline pelo snapshot local (que nunca vale como autorização). */
function TrainingCard({ academyId, uid }) {
  const navigate = useNavigate();
  const [data, setData] = useState(undefined);
  useEffect(() => { loadAssignedTraining(academyId, uid).then(setData).catch((e) => { console.error(e); setData(null); }); }, [academyId, uid]);
  if (!data) return null;
  return (
    <section aria-label="Minha ficha da academia" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Minha ficha: {data.version.name}</h3>
      <p className="text-xs text-gray-600 dark:text-gray-400">Versão {data.version.version}. Esta é a versão atribuída a você; publicações novas da academia não mudam a sua.{data.source === 'snapshot' ? ' Você está offline: mostrando a cópia salva neste aparelho.' : ''}</p>
      <ol className="mt-2 space-y-1.5">
        {data.version.exercises.map((e, i) => (
          <li key={`${e.name}-${i}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 text-sm dark:bg-white/5">
            <span className="font-semibold text-gray-900 dark:text-white">{i + 1}. {String(e?.name ?? '').slice(0, 120)}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{String(e?.sets ?? '').slice(0, 10)} x {String(e?.reps ?? '').slice(0, 20)} · {Number(e?.rest) || 0}s</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => navigate(`/execution/${academyTrainingId(academyId, data.assignment.versionId)}`)} className={`${btnPrimary} mt-3`}>Iniciar treino</button>
    </section>
  );
}

/** Professor: pendente (o aluno aceita ou recusa; antes do aceite o professor não vê nada) ou ativo (o aluno pode encerrar). */
function CoachCard({ assignment, onChanged }) {
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  if (!assignment) return null;
  const act = async (fn, msg) => { setBusy(true); try { await fn(); toast.success(msg); await onChanged(); } catch (e) { console.error(e); fail(e); } finally { setBusy(false); } };
  return (
    <section aria-label="Professor responsável" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      {dialog}
      <h3 className="font-bold text-gray-900 dark:text-white">Professor responsável</h3>
      {assignment.status === 'pending_student' ? (
        <>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300"><strong>{assignment.coachName}</strong> quer acompanhar você nesta academia. Até você aceitar, ele não vê nada seu; ao aceitar, ele passa a ver só o seu nome e a data do vínculo. Se isto é uma troca, o professor atual continua até o seu aceite.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} className={btnPrimary} onClick={() => act(() => academyApi.acceptAssignment(assignment.assignmentId), 'Professor aceito.')}>Aceitar</button>
            <button type="button" disabled={busy} className={btnGhost} onClick={() => act(() => academyApi.rejectAssignment(assignment.assignmentId), 'Indicação recusada.')}>Recusar</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Seu professor é <strong>{assignment.coachName}</strong>. Você pode encerrar quando quiser; o acesso dele acaba na hora.</p>
          <button type="button" disabled={busy} className={`${btnDanger} mt-3`} onClick={async () => { if (await confirm({ title: 'Encerrar o vínculo com o professor?', message: 'Ele perde o acesso na hora.', confirmLabel: 'Encerrar', danger: true })) act(() => academyApi.revokeAssignment(assignment.assignmentId), 'Vínculo encerrado.'); }}>Encerrar vínculo</button>
        </>
      )}
    </section>
  );
}

/** Consentimento da aderência: separado do vínculo, revogável na hora. A Gestão não exibe aderência individual nesta versão. */
function ConsentCard({ academyId }) {
  const [state, setState] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => academyApi.consent(academyId).then(setState).catch((e) => { console.error(e); setState(null); }), [academyId]);
  useEffect(() => { load(); }, [load]);
  if (state === undefined) return null;
  const on = state?.shareAdherence === true;
  const toggle = async () => {
    setBusy(true);
    try { await academyApi.setConsent(academyId, !on); toast.success(on ? 'Compartilhamento revogado.' : 'Compartilhamento ativado.'); await load(); } catch (e) { console.error(e); fail(e); } finally { setBusy(false); }
  };
  return (
    <section aria-label="Consentimento de aderência" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Compartilhar aderência com esta academia</h3>
      <p className="mt-1 text-sm font-semibold" role="status">{on ? 'Ativado: você autorizou o compartilhamento.' : 'Desativado: nada é compartilhado.'}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
        <li>Só valeria para o resumo de se você está <strong>em dia</strong>, <strong>atrasado</strong> ou <strong>sem dados</strong>; nunca horários, cargas, medidas ou histórico.</li>
        <li>Vale só para esta academia e você pode revogar quando quiser. Sair da academia também encerra este consentimento.</li>
        <li><strong>A aderência individual ainda não é exibida nesta versão.</strong> A preferência fica registrada para quando o recurso existir.</li>
      </ul>
      <button type="button" onClick={toggle} disabled={busy} className={`${on ? btnDanger : btnPrimary} mt-3`}>{busy ? 'Salvando...' : on ? 'Revogar compartilhamento' : 'Ativar compartilhamento'}</button>
    </section>
  );
}

export default function MinhaAcademiaApi() {
  usePageMeta('Academia', 'Sua academia no BohTreinar.', { noindex: true });
  const { user } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const [data, setData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [a, c] = await Promise.all([academyApi.academies(), academyApi.myAssignments()]);
      setData(a.academies); setAssignments(c.assignments);
    } catch (e) { console.error(e); setError(true); }
  }, []);
  useEffect(() => { if (user?.uid) load(); }, [user?.uid, load]);

  const leave = async (a) => {
    if (!(await confirm({ title: `Sair de ${a.name}?`, message: 'Você volta ao modo independente. Seus treinos e histórico continuam seus; o professor e a academia perdem qualquer acesso.', confirmLabel: 'Sair', danger: true }))) return;
    try { await academyApi.leave(a.academyId); clearSnapshot(user.uid, a.academyId); toast.success('Você saiu da academia.'); await load(); } catch (e) { console.error(e); fail(e); }
  };

  if (error) return <div className={pageCls}><ErrorState onRetry={load} /></div>;
  if (!data) return <div className={pageCls}><PageSkeleton /></div>;
  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader eyebrow="Academia" title="Minha academia" subtitle="Sua academia, seu professor e sua ficha. Você continua dono dos seus dados." />
        {data.length === 0 && <EmptyState icon={Building2} title="Você ainda não está em uma academia" description="Peça o link de convite à sua academia. Para criar e gerir uma academia, use o BohTreinar Gestão." />}
        {data.map((a) => (
          <article key={a.academyId} className="surface bg-white p-5 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-display text-lg font-black text-gray-900 dark:text-white">{a.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Seu papel: {ROLE[a.myRole] || a.myRole}{a.myStatus !== 'active' ? ` · ${a.myStatus === 'suspended' ? 'suspenso' : 'inativo'}` : ''}</p></div>
              {a.myRole !== 'owner' && a.myStatus === 'active' && <button type="button" onClick={() => leave(a)} className={btnDanger}><LogOut className="h-4 w-4" aria-hidden="true" />Sair da academia</button>}
            </div>
            {a.myRole === 'student' && a.myStatus === 'active' && a.status === 'active' && (
              <>
                <TrainingCard academyId={a.academyId} uid={user.uid} />
                <CoachCard assignment={assignments.find((x) => x.academyId === a.academyId)} onChanged={load} />
                <ConsentCard academyId={a.academyId} />
              </>
            )}
            {a.myRole !== 'student' && (
              <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">A gestão desta academia é feita no BohTreinar Gestão{GESTAO_URL ? <>: <a href={GESTAO_URL} className="font-bold underline" rel="noopener noreferrer">abrir a Gestão</a></> : '.'}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
