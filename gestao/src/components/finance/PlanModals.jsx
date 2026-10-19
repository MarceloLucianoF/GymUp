import React, { useEffect, useMemo, useState } from 'react';
import { friendlyError } from '../../api';
import { centsToInput, formatBRL, parseBRL } from '../../lib/money';
import { useApp } from '../AppFrame';
import Modal from '../Modal';
import { Field, Loading } from '../ui';

const todayLocal = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export function PlanModal({ plan, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [name, setName] = useState(plan?.name || '');
  const [fee, setFee] = useState(plan ? centsToInput(plan.monthlyFeeCents) : '');
  const [description, setDescription] = useState(plan?.description || '');
  const [active, setActive] = useState(plan ? plan.active : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const cents = parseBRL(fee);
    if (cents === null) { setError('Informe a mensalidade, como 99,90.'); return; }
    setBusy(true); setError('');
    try {
      if (plan) await api.updatePlan(academyId, plan.planId, { name: name.trim(), monthlyFeeCents: cents, description: description.trim(), active });
      else await api.createPlan(academyId, { name: name.trim(), monthlyFeeCents: cents, description: description.trim() });
      onDone();
    } catch (err) { setError(friendlyError(err)); setBusy(false); }
  };
  return (
    <Modal title={plan ? 'Editar plano' : 'Novo plano'} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <Field id="plan-name" label="Nome do plano"><input id="plan-name" value={name} minLength={2} maxLength={60} onChange={(e) => setName(e.target.value)} required data-autofocus /></Field>
        <Field id="plan-fee" label="Mensalidade" hint={plan ? 'Mudar o valor não altera contratos já combinados nem cobranças já geradas.' : undefined}><input id="plan-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="99,90" required /></Field>
        <Field id="plan-desc" label="Descrição (opcional)"><input id="plan-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} /></Field>
        {plan && <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Plano ativo (novos contratos só em planos ativos)</label>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Salvando...' : plan ? 'Salvar plano' : 'Criar plano'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Matricular um aluno em um plano (cria o contrato) ou editar um contrato existente.
export function ContractModal({ contract, plans, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [students, setStudents] = useState(contract ? { status: 'ready', list: [] } : { status: 'loading', list: [] });
  const activePlans = useMemo(() => plans.filter((p) => p.active || p.planId === contract?.planId), [plans, contract]);
  const [studentUid, setStudentUid] = useState(contract?.studentUid || '');
  const [planId, setPlanId] = useState(contract?.planId || activePlans[0]?.planId || '');
  const plan = plans.find((p) => p.planId === planId);
  const [fee, setFee] = useState(contract ? centsToInput(contract.feeCents) : plan ? centsToInput(plan.monthlyFeeCents) : '');
  const [dueDay, setDueDay] = useState(String(contract?.dueDay || 5));
  const [startDate, setStartDate] = useState(contract?.startDate || todayLocal());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (contract) return undefined;
    let live = true;
    Promise.all([api.students(academyId, { status: 'active', pageSize: 50 }), api.contracts(academyId, { pageSize: 50 })])
      .then(([s, c]) => { if (!live) return; const open = new Set(c.contracts.filter((x) => x.status !== 'ended').map((x) => x.studentUid)); const list = s.students.filter((x) => !open.has(x.userId)); setStudents({ status: 'ready', list }); setStudentUid(list[0]?.userId || ''); })
      .catch((e) => live && setStudents({ status: 'error', list: [], error: e }));
    return () => { live = false; };
  }, [api, academyId, contract]);
  const pickPlan = (id) => { setPlanId(id); const p = plans.find((x) => x.planId === id); if (p && !contract) setFee(centsToInput(p.monthlyFeeCents)); };
  const submit = async (e) => {
    e.preventDefault();
    const cents = parseBRL(fee);
    if (cents === null) { setError('Informe o valor combinado, como 99,90.'); return; }
    setBusy(true); setError('');
    try {
      if (contract) await api.updateContract(academyId, contract.contractId, { planId, feeCents: cents, dueDay: Number(dueDay) });
      else await api.createContract(academyId, { studentUid, planId, feeCents: cents, dueDay: Number(dueDay), startDate });
      onDone();
    } catch (err) { setError(friendlyError(err)); setBusy(false); }
  };
  return (
    <Modal title={contract ? `Contrato de ${contract.studentName}` : 'Matricular aluno em um plano'} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        {!contract && (
          <>
            {students.status === 'loading' && <Loading text="Carregando alunos..." />}
            {students.status === 'error' && <p role="alert" className="error">{friendlyError(students.error)}</p>}
            {students.status === 'ready' && students.list.length === 0 && <p role="status" className="muted">Todos os alunos ativos já têm contrato (ou ainda não há alunos).</p>}
            {students.list.length > 0 && <Field id="ct-student" label="Aluno"><select id="ct-student" value={studentUid} onChange={(e) => setStudentUid(e.target.value)} data-autofocus>{students.list.map((s) => <option key={s.userId} value={s.userId}>{s.displayName}</option>)}</select></Field>}
          </>
        )}
        <Field id="ct-plan" label="Plano"><select id="ct-plan" value={planId} onChange={(e) => pickPlan(e.target.value)}>{activePlans.map((p) => <option key={p.planId} value={p.planId}>{p.name} ({formatBRL(p.monthlyFeeCents)})</option>)}</select></Field>
        <Field id="ct-fee" label="Valor combinado" hint="Pode ser menor ou maior que o plano (desconto ou acordo)."><input id="ct-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} required /></Field>
        <Field id="ct-day" label="Dia do vencimento" hint="De 1 a 28."><input id="ct-day" type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} required /></Field>
        {!contract && <Field id="ct-start" label="Início"><input id="ct-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy || (!contract && !studentUid) || !planId}>{busy ? 'Salvando...' : contract ? 'Salvar contrato' : 'Matricular'}</button>
        </div>
      </form>
    </Modal>
  );
}
