import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ROLES, ROLE_LABELS, STATUS_LABELS } from '../../../../shared/academy-contracts/index.js';
import { friendlyError, newIdempotencyKey } from '../../api';
import ActionMenu from '../../components/ActionMenu';
import { useApp } from '../../components/AppFrame';
import Modal, { ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AssignmentBadge, Avatar, EmptyState, ErrorState, Field, PageHeader, Pagination, RoleBadge, StatusBadge, TableSkeleton } from '../../components/ui';
import { dateOf } from '../../lib/format';
import { canAssignCoach, memberActions } from '../../lib/policy';
import { useApi } from '../../session';

const PAGE_SIZE = 20;

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function ProposeModal({ member, coaches, transfer, onClose, onDone }) {
  const { api, academyId } = useApp();
  const options = coaches.filter((c) => c.userId !== member.coach?.userId);
  const [coachUid, setCoachUid] = useState(options[0]?.userId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt] = useState(newIdempotencyKey);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.proposeCoach(academyId, { studentUid: member.userId, coachUid }, attempt); onDone(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={transfer ? `Transferir professor de ${member.displayName}` : `Propor professor para ${member.displayName}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <p className="muted">{transfer ? `O professor atual (${member.coach.displayName}) continua até o aluno aceitar o novo; no aceite o acesso dele termina.` : 'O aluno precisa aceitar. O professor só passa a ver o aluno depois do aceite.'}</p>
        {options.length === 0 ? <p className="error" role="alert">Não há outro professor ativo. Convide um professor primeiro.</p> : (
          <Field id="coach-select" label="Professor"><select id="coach-select" value={coachUid} onChange={(e) => setCoachUid(e.target.value)} data-autofocus>{options.map((c) => <option key={c.userId} value={c.userId}>{c.displayName}</option>)}</select></Field>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy || !coachUid}>{busy ? 'Enviando...' : transfer ? 'Propor transferência' : 'Propor professor'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RoleModal({ member, roles, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [role, setRole] = useState(roles[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.changeRole(academyId, member.userId, role); onDone(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Alterar papel de ${member.displayName}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <p className="muted">Papel atual: {ROLE_LABELS[member.role]}. O novo papel vale na hora. Quem deixa de ser professor perde os vínculos com alunos.</p>
        <Field id="role-select" label="Novo papel"><select id="role-select" value={role} onChange={(e) => setRole(e.target.value)} data-autofocus>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Aplicando...' : 'Alterar papel'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Pending({ list, onAct }) {
  if (list.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="aguardando">
      <h2 id="aguardando">Vínculos aguardando</h2>
      <ul className="rows">
        {list.map((a) => (
          <li key={a.assignmentId} className="row">
            <div className="row-main"><strong>{a.studentName}</strong><span className="muted">com {a.coachName}</span><AssignmentBadge status={a.status} /></div>
            <div className="row-actions">
              {a.status === 'proposed' && <button type="button" className="btn primary" onClick={() => onAct('approve', a)}>Aprovar</button>}
              <button type="button" className="btn ghost danger" onClick={() => onAct('reject', a)}>{a.status === 'proposed' ? 'Recusar' : 'Retirar proposta'}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Members() {
  const { api, academyId, role, user } = useApp();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q);
  const f = { role: params.get('role') || '', status: params.get('status') || '', coach: params.get('coach') || '' };
  const [page, setPage] = useState(1);
  const staff = canAssignCoach(role);
  const me = { userId: user.uid, role };

  const [list, reload] = useApi(() => api.members(academyId, { ...f, q: dq, page, pageSize: PAGE_SIZE }), [api, academyId, f.role, f.status, f.coach, dq, page]);
  const [coaches] = useApi(() => (staff ? api.members(academyId, { role: 'coach', status: 'active', pageSize: 50 }) : Promise.resolve({ members: [] })), [api, academyId, staff]);
  const [pending, reloadPending] = useApi(() => (staff ? api.assignments(academyId) : Promise.resolve({ assignments: [] })), [api, academyId, staff]);
  const refresh = () => { reload(); reloadPending(); };

  const [action, setAction] = useState(null);   // { kind, member?, assignment? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { setAction(null); setError(''); };
  useEffect(() => { setPage(1); }, [f.role, f.status, f.coach, dq]);

  const setFilter = (k) => (e) => { const next = new URLSearchParams(params); if (e.target.value) next.set(k, e.target.value); else next.delete(k); setParams(next, { replace: true }); };
  const run = async (fn, okMsg) => {
    setBusy(true); setError('');
    try { await fn(); toast(okMsg); close(); refresh(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  const confirmCfg = useMemo(() => {
    if (!action) return null;
    const { kind, member: m, assignment: a } = action;
    const name = m?.displayName || a?.studentName;
    return {
      suspend: { title: `Suspender ${name}?`, label: 'Suspender', danger: true, text: 'A pessoa perde o acesso até ser reativada. Os dados e o histórico ficam preservados.', fn: () => api.suspend(academyId, m.userId), ok: 'Membro suspenso.' },
      reactivate: { title: `Reativar ${name}?`, label: 'Reativar', text: 'A pessoa volta a ter acesso com o mesmo papel.', fn: () => api.reactivate(academyId, m.userId), ok: 'Membro reativado.' },
      remove: { title: `Remover ${name}?`, label: 'Remover', danger: true, text: 'A pessoa sai da academia. Vínculos com professor e consentimento são encerrados. Só o proprietário pode reativá-la, e ela não volta por convite.', fn: () => api.remove(academyId, m.userId), ok: 'Membro removido.' },
      revokeCoach: { title: `Encerrar o vínculo de ${name} com o professor?`, label: 'Encerrar vínculo', danger: true, text: 'O professor perde o acesso ao aluno na hora.', fn: () => api.revokeAssignment(m.coach.assignmentId), ok: 'Vínculo encerrado.' },
      approve: { title: 'Aprovar proposta?', label: 'Aprovar', text: `${a?.coachName} passa a aguardar o aceite de ${a?.studentName}. O professor só vê o aluno depois do aceite.`, fn: () => api.approveAssignment(a.assignmentId), ok: 'Proposta aprovada. Aguardando o aluno.' },
      reject: { title: a?.status === 'proposed' ? 'Recusar proposta?' : 'Retirar proposta?', label: a?.status === 'proposed' ? 'Recusar' : 'Retirar', danger: true, text: 'A proposta é encerrada e não pode ser reaberta (uma nova proposta pode ser feita).', fn: () => api.rejectAssignment(a.assignmentId), ok: 'Proposta encerrada.' },
      withdraw: { title: 'Retirar proposta?', label: 'Retirar', danger: true, text: 'A proposta é encerrada.', fn: () => api.rejectAssignment(m.openAssignment.assignmentId), ok: 'Proposta encerrada.' },
      approveOpen: { title: 'Aprovar proposta?', label: 'Aprovar', text: 'O aluno passa a poder aceitar o professor.', fn: () => api.approveAssignment(m.openAssignment.assignmentId), ok: 'Proposta aprovada.' }
    }[kind];
  }, [action, api, academyId]);

  const d = list.data;
  const coachList = coaches.data?.members || [];
  const roleOptions = role === 'reception' ? ['student'] : ROLES;

  return (
    <>
      <PageHeader title="Membros" subtitle={role === 'reception' ? 'Alunos da academia (visão operacional).' : 'Pessoas da academia, seus papéis e vínculos. Nenhum dado de treino ou saúde aparece aqui.'} />
      <form className="filters" role="search" aria-label="Filtros de membros" onSubmit={(e) => e.preventDefault()}>
        <Field id="f-q" label="Buscar por nome"><input id="f-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome" maxLength={60} /></Field>
        <Field id="f-role" label="Papel"><select id="f-role" value={f.role} onChange={setFilter('role')}><option value="">Todos</option>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
        <Field id="f-status" label="Status"><select id="f-status" value={f.status} onChange={setFilter('status')}><option value="">Todos</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field id="f-coach" label="Professor">
          <select id="f-coach" value={f.coach} onChange={setFilter('coach')}><option value="">Todos</option><option value="none">Alunos sem professor</option>{coachList.map((c) => <option key={c.userId} value={c.userId}>{c.displayName}</option>)}</select>
        </Field>
      </form>
      {staff && <Pending list={(pending.data?.assignments || []).filter((a) => a.status !== 'active')} onAct={(kind, assignment) => setAction({ kind, assignment })} />}
      {list.status === 'loading' && <TableSkeleton />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={reload} />}
      {d && d.members.length === 0 && <EmptyState title="Nenhum membro encontrado">Ajuste os filtros ou convide pessoas na área de convites.</EmptyState>}
      {d && d.members.length > 0 && (
        <>
          <p className="muted small" aria-live="polite">{d.total} {d.total === 1 ? 'membro' : 'membros'}</p>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Membros da academia</caption>
              <thead><tr><th scope="col">Nome</th><th scope="col">Papel</th><th scope="col">Status</th><th scope="col">Entrada</th><th scope="col">Professor responsável</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
              <tbody>
                {d.members.map((m) => {
                  const act = memberActions(me, m);
                  const isStudent = m.role === 'student' && m.status === 'active';
                  const items = [
                    act.suspend && { label: 'Suspender', danger: true, onClick: () => setAction({ kind: 'suspend', member: m }) },
                    act.reactivate && { label: 'Reativar', onClick: () => setAction({ kind: 'reactivate', member: m }) },
                    act.roles.length > 0 && { label: 'Alterar papel', onClick: () => setAction({ kind: 'role', member: m }) },
                    act.remove && { label: 'Remover', danger: true, onClick: () => setAction({ kind: 'remove', member: m }) },
                    staff && isStudent && !m.openAssignment && !m.coach && { label: 'Propor professor', onClick: () => setAction({ kind: 'propose', member: m }) },
                    staff && isStudent && !m.openAssignment && m.coach && { label: 'Transferir professor', onClick: () => setAction({ kind: 'transfer', member: m }) },
                    staff && isStudent && m.coach && { label: 'Encerrar vínculo', danger: true, onClick: () => setAction({ kind: 'revokeCoach', member: m }) },
                    staff && isStudent && m.openAssignment?.status === 'proposed' && { label: 'Aprovar proposta', onClick: () => setAction({ kind: 'approveOpen', member: m }) },
                    staff && isStudent && m.openAssignment && { label: 'Retirar proposta', danger: true, onClick: () => setAction({ kind: 'withdraw', member: m }) }
                  ];
                  return (
                    <tr key={m.userId}>
                      <td data-label="Nome"><span className="person"><Avatar name={m.displayName} /><span>{m.displayName || 'Sem nome'}{m.userId === user.uid && <span className="muted"> (você)</span>}</span></span></td>
                      <td data-label="Papel"><RoleBadge role={m.role} /></td>
                      <td data-label="Status"><StatusBadge status={m.status} /></td>
                      <td data-label="Entrada">{dateOf(m.joinedAt)}</td>
                      <td data-label="Professor">
                        {m.role !== 'student' ? <span className="muted">-</span> : (
                          <span className="stack-tight">
                            {m.coach ? <span>{m.coach.displayName}</span> : <span className="muted">Sem professor</span>}
                            {m.openAssignment && <AssignmentBadge status={m.openAssignment.status} />}
                          </span>
                        )}
                      </td>
                      <td className="actions"><ActionMenu label={`Ações para ${m.displayName || 'membro'}`} items={items} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
        </>
      )}
      {confirmCfg && (
        <ConfirmModal title={confirmCfg.title} confirmLabel={confirmCfg.label} danger={confirmCfg.danger} busy={busy} error={error} onClose={close} onConfirm={() => run(confirmCfg.fn, confirmCfg.ok)}>
          <p>{confirmCfg.text}</p>
        </ConfirmModal>
      )}
      {action?.kind === 'role' && <RoleModal member={action.member} roles={memberActions(me, action.member).roles} onClose={close} onDone={() => { toast('Papel alterado.'); close(); refresh(); }} />}
      {['propose', 'transfer'].includes(action?.kind) && <ProposeModal member={action.member} coaches={coachList} transfer={action.kind === 'transfer'} onClose={close} onDone={() => { toast('Proposta enviada ao aluno.'); close(); refresh(); }} />}
    </>
  );
}
