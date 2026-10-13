import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Copy, LogOut, Link2, Ban } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import PageSkeleton from '../../components/coach/PageSkeleton';
import ErrorState from '../../components/common/ErrorState';
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls, pageCls } from '../../components/coach/styles';
import { useAuthContext } from '../../hooks/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import usePageMeta from '../../hooks/usePageMeta';
import {
  academyInviteStatus, createAcademy, createAcademyInvite, leaveAcademy, listAcademyInvites, listAcademyMembers,
  listMyMemberships, revokeAcademyInvite, ROLE_LABEL, setAdherenceConsent, listAcademyAssignments, listMyAssignments,
  proposeAssignment, acceptAssignment, endAssignment, updateMember, getMemberName, ASSIGNMENT_LABEL
} from '../../services/academyService';
import { getMyAssignedTraining } from '../../services/academyTrainingService';
import { academyTrainingId } from '../../utils/academyTrainingId';

const STATUS_LABEL = { ok: 'Ativo', revoked: 'Cancelado', expired: 'Expirado', exhausted: 'Esgotado', missing: '-' };
const toDate = (v) => (typeof v?.toDate === 'function' ? v.toDate() : new Date(v));
const linkOf = (id) => `${window.location.origin}/academia/convite/${id}`;
const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); toast.success('Link copiado!'); } catch (e) { toast.error('Não foi possível copiar.'); }
};

function InvitesPanel({ membership, user }) {
  const { academy, role } = membership;
  const [invites, setInvites] = useState(null);
  const [form, setForm] = useState({ role: 'student', days: '7', maxUses: '20' });
  const [busy, setBusy] = useState(false);
  const roles = role === 'owner' ? ['student', 'teacher', 'reception', 'admin'] : ['student', 'teacher', 'reception'];

  const load = useCallback(async () => {
    try { setInvites(await listAcademyInvites(academy.id)); } catch (e) { console.error(e); setInvites([]); }
  }, [academy.id]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createAcademyInvite(user, academy, { role: form.role, days: Number(form.days), maxUses: Number(form.maxUses) });
      await copy(linkOf(id));
      await load();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível criar o convite. Confira validade (1 a 31 dias) e usos (1 a 200; 1 a 5 para administrador).');
    } finally { setBusy(false); }
  };
  const revoke = async (inv) => {
    try { await revokeAcademyInvite(user, inv); toast.success('Convite cancelado.'); await load(); } catch (e) { console.error(e); toast.error('Não foi possível cancelar.'); }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section aria-label="Convites" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Convites</h3>
      <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-4">
        <div><label htmlFor={`ir-${academy.id}`} className={labelCls}>Papel</label>
          <select id={`ir-${academy.id}`} value={form.role} onChange={set('role')} className={inputCls}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
        <div><label htmlFor={`id-${academy.id}`} className={labelCls}>Validade (dias)</label>
          <input id={`id-${academy.id}`} type="number" min="1" max="31" value={form.days} onChange={set('days')} className={inputCls} /></div>
        <div><label htmlFor={`iu-${academy.id}`} className={labelCls}>Usos</label>
          <input id={`iu-${academy.id}`} type="number" min="1" max="200" value={form.maxUses} onChange={set('maxUses')} className={inputCls} /></div>
        <div className="flex items-end"><button type="submit" disabled={busy} className={`${btnPrimary} w-full`}><Link2 className="h-4 w-4" aria-hidden="true" />{busy ? 'Criando...' : 'Criar convite'}</button></div>
      </form>
      <ul className="mt-3 space-y-2">
        {invites === null && <li className="text-sm text-gray-600 dark:text-gray-400">Carregando...</li>}
        {invites?.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-400">Nenhum convite criado.</li>}
        {invites?.map((inv) => {
          const st = academyInviteStatus(inv);
          return (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm dark:bg-white/5">
              <div><p className="font-bold text-gray-900 dark:text-white">{ROLE_LABEL[inv.role]} · {STATUS_LABEL[st]}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{inv.uses || 0} de {inv.maxUses} usos · até {toDate(inv.expiresAt).toLocaleDateString('pt-BR')}</p></div>
              {st === 'ok' && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => copy(linkOf(inv.id))} className={btnGhost}><Copy className="h-4 w-4" aria-hidden="true" />Copiar</button>
                  <button type="button" onClick={() => revoke(inv)} className={btnDanger}><Ban className="h-4 w-4" aria-hidden="true" />Cancelar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ConsentCard({ membership, actor, onChanged }) {
  const on = membership.consent?.adherence === true;
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await setAdherenceConsent(actor, membership.academyId, !on);
      toast.success(on ? 'Compartilhamento revogado.' : 'Compartilhamento ativado.');
      await onChanged();
    } catch (e) { console.error(e); toast.error('Não foi possível alterar o consentimento.'); }
    finally { setBusy(false); }
  };
  return (
    <section aria-label="Consentimento de aderência" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Compartilhar aderência com esta academia</h3>
      <p className="mt-1 text-sm font-semibold" role="status">{on ? 'Ativado: você autorizou o compartilhamento.' : 'Desativado: nada é compartilhado.'}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
        <li>Será compartilhado apenas se você está <strong>em dia</strong>, <strong>atrasado</strong> ou <strong>sem dados</strong>.</li>
        <li>Nunca: horários, datas de treino, cargas, medidas, volume ou histórico.</li>
        <li>Vale só para esta academia e você pode revogar quando quiser; ao revogar, o dado de aderência é apagado na hora.</li>
        <li><strong>A aderência individual ainda não é compartilhada nesta versão.</strong> Esta preferência será aplicada quando o recurso estiver disponível.</li>
        <li>Seus treinos, medidas e histórico continuam só seus. Sair da academia também encerra este consentimento.</li>
      </ul>
      <button type="button" onClick={toggle} disabled={busy} className={`${on ? btnDanger : btnPrimary} mt-3`}>
        {busy ? 'Salvando...' : on ? 'Revogar compartilhamento' : 'Ativar compartilhamento'}
      </button>
    </section>
  );
}

function MembersList({ membership, actor }) {
  const { academyId, role: myRole } = membership;
  const [members, setMembers] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState('');
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([listAcademyMembers(academyId), listAcademyAssignments(academyId)]);
      setMembers(m); setAssignments(a);
    } catch (e) { console.error(e); setMembers([]); }
  }, [academyId]);
  useEffect(() => { load(); }, [load]);

  const teachers = (members || []).filter((m) => m.status === 'active' && ['teacher', 'admin', 'owner'].includes(m.role));
  const asgOf = (uid) => assignments.find((a) => a.studentId === uid);
  const nameOf = (uid) => members?.find((m) => m.userId === uid)?.displayName || 'Professor';
  const manageable = (m) => m.userId !== actor.uid && m.role !== 'owner' && (myRole === 'owner' || m.role !== 'admin');
  const rolesFor = myRole === 'owner' ? ['admin', 'teacher', 'reception', 'student'] : ['teacher', 'reception', 'student'];

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); toast.success(okMsg); await load(); } catch (e) {
      console.error(e);
      toast.error('Não foi possível concluir: o estado pode ter mudado ou você perdeu a permissão. A lista foi atualizada.');
      await load();
    } finally { setBusy(''); }
  };
  const changeRole = async (m, role) => {
    if (role === m.role) return;
    if (!(await confirm({ title: `Mudar ${m.displayName} para ${ROLE_LABEL[role]}?`, message: 'O acesso muda na hora. Se era professor responsável, o acesso aos alunos acaba imediatamente.', confirmLabel: 'Mudar' }))) return;
    await run(`r-${m.userId}`, () => updateMember(actor, m, { role }), 'Papel alterado.');
  };
  const setStatus = async (m, status, label) => {
    if (!(await confirm({ title: `${label} ${m.displayName}?`, message: 'A pessoa perde o acesso à academia na hora. Os dados pessoais dela continuam dela.', confirmLabel: label, danger: true }))) return;
    await run(`s-${m.userId}`, () => updateMember(actor, m, { status }), `${label}: feito.`);
  };

  return (
    <section aria-label="Membros" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      {dialog}
      <h3 className="font-bold text-gray-900 dark:text-white">Membros{members ? ` (${members.length})` : ''}</h3>
      <ul className="mt-3 space-y-2">
        {members?.map((m) => {
          const asg = m.role === 'student' && m.status === 'active' ? asgOf(m.userId) : null;
          const open = asg && asg.status !== 'ended';
          return (
            <li key={m.userId} className="rounded-2xl bg-gray-50 px-4 py-3 text-sm dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate font-semibold text-gray-900 dark:text-white">{m.displayName || 'Membro'}{m.status === 'suspended' ? ' (suspenso)' : ''}</span>
                {manageable(m) ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${m.userId}`}>Papel de {m.displayName}</label>
                    <select id={`role-${m.userId}`} value={m.role} disabled={busy === `r-${m.userId}`} onChange={(e) => changeRole(m, e.target.value)} className="min-h-[44px] rounded-xl bg-white px-3 text-xs font-bold dark:bg-gray-800 dark:text-white">
                      {rolesFor.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    {m.status === 'suspended'
                      ? <button type="button" onClick={() => run(`a-${m.userId}`, () => updateMember(actor, m, { status: 'active' }), 'Membro reativado.')} className={`${btnPrimary} text-xs`}>Reativar</button>
                      : <button type="button" onClick={() => setStatus(m, 'suspended', 'Suspender')} className={`${btnGhost} text-xs`}>Suspender</button>}
                    <button type="button" onClick={() => setStatus(m, 'removed', 'Remover')} className={`${btnDanger} text-xs`}>Remover</button>
                  </span>
                ) : <span className="text-xs text-gray-600 dark:text-gray-400">{ROLE_LABEL[m.role]}</span>}
              </div>
              {m.role === 'student' && m.status === 'active' && (
                <div className="mt-2 border-t border-gray-100 pt-2 dark:border-white/10">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Professor responsável: {asg && asg.status !== 'ended' ? `${nameOf(asg.teacherId)} (${ASSIGNMENT_LABEL[asg.status]})` : 'nenhum'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`tch-${m.userId}`}>Professor para {m.displayName}</label>
                    <select id={`tch-${m.userId}`} value={pick[m.userId] || ''} onChange={(e) => setPick((p) => ({ ...p, [m.userId]: e.target.value }))} className="min-h-[44px] rounded-xl bg-white px-3 text-xs font-bold dark:bg-gray-800 dark:text-white">
                      <option value="">Escolher professor</option>
                      {teachers.filter((t) => t.userId !== asg?.teacherId || asg?.status === 'ended').map((t) => <option key={t.userId} value={t.userId}>{t.displayName}</option>)}
                    </select>
                    <button type="button" disabled={!pick[m.userId] || busy === `p-${m.userId}`} className={`${btnPrimary} text-xs`}
                      onClick={() => run(`p-${m.userId}`, () => proposeAssignment(actor, academyId, m.userId, teachers.find((t) => t.userId === pick[m.userId]), asg), open ? 'Transferência proposta: o professor atual perde o acesso agora e o novo só vê o aluno depois do aceite.' : 'Proposta enviada; o aluno precisa aceitar.')}>
                      {open ? 'Transferir' : 'Propor professor'}
                    </button>
                    {open && <button type="button" className={`${btnDanger} text-xs`} onClick={() => run(`e-${m.userId}`, () => endAssignment(actor, academyId, m.userId), 'Atribuição encerrada.')}>Encerrar</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">A academia não vê aderência individual, treinos nem medidas nesta versão. O professor só vê o aluno depois do aceite dele.</p>
    </section>
  );
}

function StudentAssignmentCard({ membership, actor }) {
  const [asg, setAsg] = useState(undefined);
  const [teacherName, setTeacherName] = useState('');
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const load = useCallback(async () => {
    try {
      const mine = (await listMyAssignments(actor.uid, 'student')).find((a) => a.academyId === membership.academyId) || null;
      setAsg(mine);
      if (mine && mine.status !== 'ended') setTeacherName(mine.teacherName || 'Professor');
    } catch (e) { console.error(e); setAsg(null); }
  }, [actor.uid, membership.academyId]);
  useEffect(() => { load(); }, [load]);
  if (!asg || asg.status === 'ended') return null;
  const act = async (fn, msg) => { setBusy(true); try { await fn(); toast.success(msg); await load(); } catch (e) { console.error(e); toast.error('Não foi possível concluir.'); } finally { setBusy(false); } };
  return (
    <section aria-label="Professor responsável" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      {dialog}
      <h3 className="font-bold text-gray-900 dark:text-white">Professor responsável</h3>
      {asg.status === 'pending' ? (
        <>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300"><strong>{teacherName}</strong> foi indicado como seu professor nesta academia. Até você aceitar, ele não vê nada seu. Se isto é uma troca, o professor anterior já perdeu o acesso e recusar encerra o vínculo.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} className={btnPrimary} onClick={() => act(() => acceptAssignment(actor, membership.academyId), 'Professor aceito.')}>Aceitar</button>
            <button type="button" disabled={busy} className={btnGhost} onClick={() => act(() => endAssignment(actor, membership.academyId, actor.uid), 'Indicação recusada.')}>Recusar</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Seu professor é <strong>{teacherName}</strong>. Você pode encerrar quando quiser; o acesso dele acaba na hora.</p>
          <button type="button" disabled={busy} className={`${btnDanger} mt-3`} onClick={async () => { if (await confirm({ title: 'Encerrar o vínculo com o professor?', message: 'Ele perde o acesso na hora.', confirmLabel: 'Encerrar', danger: true })) act(() => endAssignment(actor, membership.academyId, actor.uid), 'Vínculo encerrado.'); }}>Encerrar vínculo</button>
        </>
      )}
    </section>
  );
}

/** Ficha atribuída ao aluno: sempre a versão exata que lhe foi dada, mesmo que a academia publique versões novas. */
function MyTrainingCard({ membership, actor }) {
  const navigate = useNavigate();
  const [data, setData] = useState(undefined);
  useEffect(() => { getMyAssignedTraining(membership.academyId, actor.uid).then(setData).catch((e) => { console.error(e); setData(null); }); }, [membership.academyId, actor.uid]);
  if (!data) return null;
  return (
    <section aria-label="Minha ficha da academia" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Minha ficha: {data.version.name}</h3>
      <p className="text-xs text-gray-600 dark:text-gray-400">Versão {data.version.version}. Esta é a versão atribuída a você; publicações novas da academia não mudam sua ficha.</p>
      <ol className="mt-2 space-y-1.5">
        {data.version.exercises.map((e, i) => (
          <li key={`${e.name}-${i}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 text-sm dark:bg-white/5">
            <span className="font-semibold text-gray-900 dark:text-white">{i + 1}. {String(e?.name ?? '').slice(0, 120)}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{String(e?.sets ?? '').slice(0, 10)} x {String(e?.reps ?? '').slice(0, 20)} · {Number(e?.rest) || 0}s</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => navigate(`/execution/${academyTrainingId(membership.academyId, data.assignment.versionId)}`)} className={`${btnPrimary} mt-3`}>Iniciar treino</button>
    </section>
  );
}

function TeacherStudents({ membership, actor }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const mine = (await listMyAssignments(actor.uid, 'teacher')).filter((a) => a.academyId === membership.academyId && a.status === 'active');
        const named = await Promise.all(mine.map(async (a) => ({ id: a.studentId, name: await getMemberName(a.academyId, a.studentId) })));
        setList(named.filter((s) => s.name)); // sem leitura permitida (aluno inativo) não aparece com nome falso
      } catch (e) { console.error(e); setList([]); }
    })();
  }, [actor.uid, membership.academyId]);
  return (
    <section aria-label="Meus alunos" className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <h3 className="font-bold text-gray-900 dark:text-white">Alunos sob sua responsabilidade</h3>
      <ul className="mt-2 space-y-1.5">
        {list?.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-400">Nenhum aluno aceitou você como professor ainda.</li>}
        {list?.map((s) => <li key={s.id} className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900 dark:bg-white/5 dark:text-white">{s.name}</li>)}
      </ul>
    </section>
  );
}

export default function AcademyPage() {
  usePageMeta('Academia', 'Sua academia no BohTreinar.', { noindex: true });
  const { user, userProfile } = useAuthContext();
  const { confirm, dialog } = useConfirm();
  const [memberships, setMemberships] = useState(null);
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const actor = { uid: user?.uid, displayName: userProfile?.displayName || user?.displayName || '' };

  const load = useCallback(async () => {
    try { setError(false); setMemberships(await listMyMemberships(user.uid)); } catch (e) { console.error(e); setError(true); }
  }, [user?.uid]);
  useEffect(() => { if (user?.uid) load(); }, [user?.uid, load]);

  const create = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error('Informe o nome da academia (mínimo 2 letras).'); return; }
    setBusy(true);
    try { await createAcademy(actor, name); setName(''); toast.success('Academia criada.'); await load(); }
    catch (err) { console.error(err); toast.error('Não foi possível criar a academia.'); }
    finally { setBusy(false); }
  };
  const leave = async (m) => {
    if (!(await confirm({ title: `Sair de ${m.academy.name}?`, message: 'Você volta ao modo independente. Seus treinos e histórico continuam seus; a academia perde qualquer acesso.', confirmLabel: 'Sair', danger: true }))) return;
    try { await leaveAcademy(actor, m.academyId); toast.success('Você saiu da academia.'); await load(); }
    catch (err) { console.error(err); toast.error('Não foi possível sair.'); }
  };

  if (error) return <div className={pageCls}><ErrorState onRetry={load} /></div>;
  if (!memberships) return <div className={pageCls}><PageSkeleton /></div>;

  return (
    <div className={pageCls}>
      {dialog}
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader eyebrow="Academia" title="Minha academia" subtitle="Participe de uma academia por convite ou crie a sua. Você continua dono dos seus dados." />
        {memberships.length === 0 && (
          <EmptyState icon={Building2} title="Você ainda não está em uma academia" description="Peça o link de convite à sua academia ou crie uma abaixo." />
        )}
        {memberships.map((m) => (
          <article key={m.academyId} className="surface bg-white p-5 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-display text-lg font-black text-gray-900 dark:text-white">{m.academy.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Seu papel: {ROLE_LABEL[m.role]}</p></div>
              {m.role !== 'owner' && <button type="button" onClick={() => leave(m)} className={btnDanger}><LogOut className="h-4 w-4" aria-hidden="true" />Sair da academia</button>}
            </div>
            {m.role === 'student' && <><MyTrainingCard membership={m} actor={actor} /><StudentAssignmentCard membership={m} actor={actor} /><ConsentCard membership={m} actor={actor} onChanged={load} /></>}
            {['teacher', 'admin', 'owner'].includes(m.role) && <Link to={`/academia/${m.academyId}/fichas`} className={`${btnGhost} mt-4`}>Fichas da academia</Link>}
            {['teacher', 'admin', 'owner'].includes(m.role) && <TeacherStudents membership={m} actor={actor} />}
            {['owner', 'admin'].includes(m.role) && <><InvitesPanel membership={m} user={actor} /><MembersList membership={m} actor={actor} /></>}
          </article>
        ))}
        <form onSubmit={create} className="surface bg-white p-5 dark:bg-gray-900">
          <h2 className="font-bold text-gray-900 dark:text-white">Criar uma academia</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Você será o proprietário e poderá convidar equipe e alunos. Sua conta atual não muda.</p>
          <label htmlFor="academy-name" className={`${labelCls} mt-3`}>Nome da academia</label>
          <input id="academy-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} autoComplete="organization" />
          <button type="submit" disabled={busy} className={`${btnPrimary} mt-3`}>{busy ? 'Criando...' : 'Criar academia'}</button>
        </form>
        <p className="text-center text-xs text-gray-600 dark:text-gray-400"><Link to="/privacidade" className="underline">Política de privacidade</Link></p>
      </div>
    </div>
  );
}
