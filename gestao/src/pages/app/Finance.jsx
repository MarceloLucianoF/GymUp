import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PAYMENT_LABELS } from '../../../../shared/academy-contracts/index.js';
import { friendlyError } from '../../api';
import ActionMenu from '../../components/ActionMenu';
import { useApp } from '../../components/AppFrame';
import { AdjustModal, GenerateModal, PayModal } from '../../components/finance/ChargeModals';
import { ContractModal, PlanModal } from '../../components/finance/PlanModals';
import { ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Avatar, EmptyState, ErrorState, Field, PageHeader, Pagination, TableSkeleton } from '../../components/ui';
import { CHARGE_LABELS, CONTRACT_LABELS, chargesToCsv, dateBR, formatBRL, monthLabel, monthShort, shiftMonth } from '../../lib/money';
import { canManageFinance, canSeeFinance } from '../../lib/policy';
import { plural } from '../../lib/format';
import { useApi } from '../../session';

const nowMonth = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);
const ChargeBadge = ({ status }) => <span className={`badge pay-${status}`}>{CHARGE_LABELS[status] || status}</span>;

function MonthNav({ month, onChange }) {
  return (
    <div className="month-nav" role="group" aria-label="Mês de referência">
      <button type="button" className="btn ghost" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">Anterior</button>
      <span className="month-label" aria-live="polite">{monthLabel(month)}</span>
      <button type="button" className="btn ghost" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Próximo mês">Próximo</button>
    </div>
  );
}

function Stat({ label, value, hint, tone }) {
  return <div className={`stat ${tone ? `tone-${tone}` : ''}`}><span className="stat-value">{value}</span><span className="stat-label">{label}</span>{hint && <span className="muted small">{hint}</span>}</div>;
}

// ---------- resumo ----------
function SummaryTab({ month, setMonth, onPay }) {
  const { api, academyId } = useApp();
  const [state, reload] = useApi(() => api.financeSummary(academyId, { month }), [api, academyId, month]);
  const d = state.data;
  const max = useMemo(() => Math.max(1, ...(d?.series || []).map((s) => Math.max(s.expectedCents, s.receivedCents))), [d]);
  return (
    <>
      <MonthNav month={month} onChange={setMonth} />
      {state.status === 'loading' && <TableSkeleton rows={3} />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={reload} />}
      {d && (
        <>
          <section className="stats" aria-label="Indicadores do mês">
            <Stat label="Previsto no mês" value={formatBRL(d.month_totals.expectedCents)} hint="cobranças válidas" />
            <Stat label="Recebido" value={formatBRL(d.month_totals.receivedCents)} hint={`${plural(d.month_totals.counts.paid, 'pagamento', 'pagamentos')}`} tone="ok" />
            <Stat label="A vencer" value={formatBRL(d.month_totals.pendingCents)} hint={`${plural(d.month_totals.counts.pending, 'cobrança', 'cobranças')}`} />
            <Stat label="Em atraso (mês)" value={formatBRL(d.month_totals.overdueCents)} hint={`inadimplência ${d.month_totals.delinquencyPercent.toLocaleString('pt-BR')}%`} tone={d.month_totals.overdueCents > 0 ? 'bad' : undefined} />
          </section>
          <section className="stats" aria-label="Contratos">
            <Stat label="Contratos ativos" value={d.contracts.active} hint={d.contracts.paused ? `${d.contracts.paused} pausado(s)` : undefined} />
            <Stat label="Receita recorrente mensal" value={formatBRL(d.contracts.monthlyRecurringCents)} hint="soma dos contratos ativos" />
            <Stat label="Ticket médio" value={formatBRL(d.contracts.averageTicketCents)} />
            <Stat label="Últimos 30 dias" value={`+${d.contracts.started30d} / -${d.contracts.ended30d}`} hint="entradas e saídas de contrato" />
          </section>
          <section className="panel" aria-labelledby="serie">
            <h2 id="serie">Previsto e recebido, últimos 6 meses</h2>
            <div className="bars" role="img" aria-label={d.series.map((s) => `${monthLabel(s.month)}: previsto ${formatBRL(s.expectedCents)}, recebido ${formatBRL(s.receivedCents)}`).join('. ')}>
              {d.series.map((s) => (
                <div key={s.month} className="bar-col">
                  <div className="bar-pair"><span className="bar exp" style={{ height: `${(s.expectedCents / max) * 100}%` }} /><span className="bar rec" style={{ height: `${(s.receivedCents / max) * 100}%` }} /></div>
                  <span className="bar-label">{monthShort(s.month)}</span>
                </div>
              ))}
            </div>
            <p className="legend"><span className="dot exp" /> Previsto <span className="dot rec" /> Recebido</p>
            {d.byPlan.length > 0 && (
              <ul className="rows" aria-label="Por plano">
                {d.byPlan.map((p) => <li key={p.planId} className="row"><span>{p.name} <span className="muted small">({plural(p.charges, 'cobrança', 'cobranças')})</span></span><span>{formatBRL(p.receivedCents)} de {formatBRL(p.expectedCents)}</span></li>)}
              </ul>
            )}
          </section>
          <section className="panel" aria-labelledby="atrasos">
            <h2 id="atrasos">Em atraso (todos os meses): {formatBRL(d.overdueAllMonths.cents)}</h2>
            {d.overdueTop.length === 0 ? <p className="muted">Nenhuma cobrança em atraso.</p> : (
              <ul className="rows">
                {d.overdueTop.map((c) => (
                  <li key={c.id} className="row">
                    <span className="person"><Avatar name={c.studentName} /><span>{c.studentName}<span className="muted small"> · {c.description || c.planName} · venceu em {dateBR(c.dueDate)} ({plural(c.daysLate, 'dia', 'dias')})</span></span></span>
                    <span className="row-actions"><strong>{formatBRL(c.netCents)}</strong><button type="button" className="btn" onClick={() => onPay(c, reload)}>Registrar pagamento</button></span>
                  </li>
                ))}
              </ul>
            )}
            {d.overdueAllMonths.count > d.overdueTop.length && <p className="muted small">Mostrando as {d.overdueTop.length} mais antigas de {d.overdueAllMonths.count}. Veja todas em Cobranças, filtrando por "Em atraso".</p>}
          </section>
          {d.recentPayments.length > 0 && (
            <section className="panel" aria-labelledby="recentes">
              <h2 id="recentes">Últimos pagamentos</h2>
              <ul className="rows">{d.recentPayments.map((r, i) => <li key={i} className="row"><span>{r.studentName}</span><span className="muted">{dateBR(r.paidAt)} · {PAYMENT_LABELS[r.method] || r.method} · <strong>{formatBRL(r.paidAmountCents)}</strong></span></li>)}</ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

// ---------- cobranças ----------
function ChargesTab({ month, setMonth, manage, openPay }) {
  const { api, academyId } = useApp();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [month, status, dq]);
  const [list, reload] = useApi(() => api.charges(academyId, { month, status, q: dq, page, pageSize: 20 }), [api, academyId, month, status, dq, page]);
  const d = list.data;
  const close = () => { setModal(null); setError(''); };
  const run = async (fn, ok) => { setBusy(true); setError(''); try { await fn(); toast(ok); close(); reload(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } };
  const exportCsv = async () => {
    setBusy(true);
    try {
      const data = await api.exportFinance(academyId, { fromMonth: month, toMonth: month });
      const blob = new Blob([chargesToCsv(data.charges)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `cobrancas-${month}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(data.truncated ? 'Planilha gerada, mas cortada em 5000 linhas.' : 'Planilha gerada. Verifique seus downloads.');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };
  const confirms = {
    revert: (c) => ({ title: `Desfazer o pagamento de ${c.studentName}?`, label: 'Desfazer pagamento', danger: true, text: 'A cobrança volta a ficar em aberto e o registro do pagamento é apagado (a auditoria guarda quem desfez).', fn: () => api.chargeAction(academyId, c.id, 'revert'), ok: 'Pagamento desfeito.' }),
    exempt: (c) => ({ title: `Isentar a cobrança de ${c.studentName}?`, label: 'Isentar', text: 'A cobrança deixa de contar como previsto e como atraso. Não pode ser reaberta.', fn: () => api.chargeAction(academyId, c.id, 'exempt'), ok: 'Cobrança isenta.' }),
    cancel: (c) => ({ title: `Cancelar a cobrança de ${c.studentName}?`, label: 'Cancelar cobrança', danger: true, text: 'A cobrança é cancelada e deixa de contar. Não pode ser reaberta.', fn: () => api.chargeAction(academyId, c.id, 'cancel'), ok: 'Cobrança cancelada.' })
  };
  const cfg = modal && confirms[modal.kind]?.(modal.charge);
  return (
    <>
      <MonthNav month={month} onChange={setMonth} />
      <form className="filters" role="search" aria-label="Filtros de cobranças" onSubmit={(e) => e.preventDefault()}>
        <Field id="c-q" label="Buscar por aluno"><input id="c-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} /></Field>
        <Field id="c-status" label="Situação"><select id="c-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option><option value="open">Em aberto (a vencer e em atraso)</option><option value="overdue">Em atraso</option><option value="pending">A vencer</option><option value="paid">Pagas</option><option value="exempt">Isentas</option><option value="canceled">Canceladas</option></select></Field>
      </form>
      {manage && (
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => setModal({ kind: 'generate' })}>Gerar cobranças de {monthLabel(month)}</button>
          <button type="button" className="btn" onClick={exportCsv} disabled={busy}>Exportar planilha do mês</button>
        </div>
      )}
      {list.status === 'loading' && <TableSkeleton />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={reload} />}
      {d && d.charges.length === 0 && <EmptyState title="Nenhuma cobrança encontrada">{manage ? 'Gere as cobranças do mês depois de matricular os alunos em um plano, na aba Planos e contratos.' : 'Não há cobranças neste filtro.'}</EmptyState>}
      {d && d.charges.length > 0 && (
        <>
          <p className="muted small" aria-live="polite">{plural(d.total, 'cobrança', 'cobranças')} · {formatBRL(d.totalNetCents)} no total do filtro</p>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Cobranças de {monthLabel(month)}</caption>
              <thead><tr><th scope="col">Aluno</th><th scope="col">Vencimento</th><th scope="col">Valor</th><th scope="col">Situação</th><th scope="col">Pagamento</th><th scope="col"><span className="visually-hidden">Ações</span></th></tr></thead>
              <tbody>
                {d.charges.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Aluno"><span className="person"><Avatar name={c.studentName} /><span>{c.studentName || 'Sem nome'}<span className="muted small block">{c.description || c.planName}</span></span></span></td>
                    <td data-label="Vencimento">{dateBR(c.dueDate)}{c.daysLate > 0 && <span className="muted small block">{plural(c.daysLate, 'dia', 'dias')} de atraso</span>}</td>
                    <td data-label="Valor">{formatBRL(c.netCents)}{c.discountCents > 0 && <span className="muted small block">desconto {formatBRL(c.discountCents)}</span>}</td>
                    <td data-label="Situação"><ChargeBadge status={c.status} /></td>
                    <td data-label="Pagamento">{c.status === 'paid' ? <span>{dateBR(c.paidAt)}<span className="muted small block">{PAYMENT_LABELS[c.paymentMethod]} · {formatBRL(c.paidAmountCents)}</span></span> : <span className="muted">-</span>}</td>
                    <td className="actions">
                      <ActionMenu label={`Ações para a cobrança de ${c.studentName || 'aluno'}`} items={[
                        ['pending', 'overdue'].includes(c.status) && { label: 'Registrar pagamento', onClick: () => openPay(c, reload) },
                        manage && ['pending', 'overdue'].includes(c.status) && { label: 'Ajustar desconto ou vencimento', onClick: () => setModal({ kind: 'adjust', charge: c }) },
                        manage && ['pending', 'overdue'].includes(c.status) && { label: 'Isentar', onClick: () => setModal({ kind: 'exempt', charge: c }) },
                        manage && ['pending', 'overdue'].includes(c.status) && { label: 'Cancelar cobrança', danger: true, onClick: () => setModal({ kind: 'cancel', charge: c }) },
                        manage && c.status === 'paid' && { label: 'Desfazer pagamento', danger: true, onClick: () => setModal({ kind: 'revert', charge: c }) }
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
        </>
      )}
      {modal?.kind === 'generate' && <GenerateModal month={month} label={monthLabel(month)} onClose={close} onDone={(r) => { toast(r.created ? `${plural(r.created, 'cobrança criada', 'cobranças criadas')}.` : 'Nada novo a gerar.'); close(); reload(); }} />}
      {modal?.kind === 'adjust' && <AdjustModal charge={modal.charge} onClose={close} onDone={() => { toast('Cobrança ajustada.'); close(); reload(); }} />}
      {cfg && <ConfirmModal title={cfg.title} confirmLabel={cfg.label} danger={cfg.danger} busy={busy} error={error} onClose={close} onConfirm={() => run(cfg.fn, cfg.ok)}><p>{cfg.text}</p></ConfirmModal>}
    </>
  );
}

// ---------- planos e contratos ----------
function PlansTab({ manage }) {
  const { api, academyId } = useApp();
  const toast = useToast();
  const [plans, reloadPlans] = useApi(() => api.plans(academyId), [api, academyId]);
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status]);
  const [contracts, reloadContracts] = useApi(() => api.contracts(academyId, { status, page, pageSize: 20 }), [api, academyId, status, page]);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const planList = plans.data?.plans || [];
  const close = () => { setModal(null); setError(''); };
  const refresh = () => { reloadPlans(); reloadContracts(); };
  const change = async (c, body, ok) => { setBusy(true); setError(''); try { await api.updateContract(academyId, c.contractId, body); toast(ok); close(); refresh(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } };
  const d = contracts.data;
  return (
    <>
      <section className="panel" aria-labelledby="planos">
        <div className="panel-head"><h2 id="planos">Planos</h2>{manage && <button type="button" className="btn primary" onClick={() => setModal({ kind: 'plan' })}>Novo plano</button>}</div>
        {plans.status === 'loading' && <TableSkeleton rows={2} />}
        {plans.status === 'error' && <ErrorState error={plans.error} onRetry={reloadPlans} />}
        {plans.data && planList.length === 0 && <EmptyState title="Nenhum plano ainda">{manage ? 'Crie um plano (por exemplo, Mensal) para depois matricular os alunos.' : 'O dono ou um administrador cria os planos.'}</EmptyState>}
        {planList.length > 0 && (
          <ul className="rows">
            {planList.map((p) => (
              <li key={p.planId} className="row">
                <span className="row-main"><strong>{p.name}</strong><span>{formatBRL(p.monthlyFeeCents)} por mês</span><span className="muted small">{plural(p.openContracts, 'contrato aberto', 'contratos abertos')}{p.description ? ` · ${p.description}` : ''}</span></span>
                <span className="row-actions">{!p.active && <span className="badge status-removed">Inativo</span>}{manage && <button type="button" className="btn ghost" onClick={() => setModal({ kind: 'plan', plan: p })}>Editar</button>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel" aria-labelledby="contratos">
        <div className="panel-head"><h2 id="contratos">Contratos dos alunos</h2>{manage && <button type="button" className="btn primary" onClick={() => setModal({ kind: 'contract' })} disabled={planList.filter((p) => p.active).length === 0}>Matricular aluno</button>}</div>
        <form className="filters" role="search" aria-label="Filtro de contratos" onSubmit={(e) => e.preventDefault()}>
          <Field id="ct-status" label="Situação"><select id="ct-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Ativos</option><option value="paused">Pausados</option><option value="ended">Encerrados</option><option value="">Todos</option></select></Field>
        </form>
        {contracts.status === 'loading' && <TableSkeleton />}
        {contracts.status === 'error' && <ErrorState error={contracts.error} onRetry={reloadContracts} />}
        {d && d.contracts.length === 0 && <EmptyState title="Nenhum contrato neste filtro">{manage ? 'Use "Matricular aluno" para ligar um aluno a um plano e começar a gerar cobranças.' : 'Ainda não há contratos.'}</EmptyState>}
        {d && d.contracts.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Contratos dos alunos</caption>
                <thead><tr><th scope="col">Aluno</th><th scope="col">Plano</th><th scope="col">Valor</th><th scope="col">Vencimento</th><th scope="col">Início</th><th scope="col">Situação</th>{manage && <th scope="col"><span className="visually-hidden">Ações</span></th>}</tr></thead>
                <tbody>
                  {d.contracts.map((c) => (
                    <tr key={c.contractId}>
                      <td data-label="Aluno"><span className="person"><Avatar name={c.studentName} /><span>{c.studentName || 'Sem nome'}</span></span></td>
                      <td data-label="Plano">{c.planName}</td>
                      <td data-label="Valor">{formatBRL(c.feeCents)}</td>
                      <td data-label="Vencimento">dia {c.dueDay}</td>
                      <td data-label="Início">{dateBR(c.startDate)}{c.endDate && <span className="muted small block">até {dateBR(c.endDate)}</span>}</td>
                      <td data-label="Situação"><span className={`badge contract-${c.status}`}>{CONTRACT_LABELS[c.status]}</span></td>
                      {manage && <td className="actions"><ActionMenu label={`Ações para o contrato de ${c.studentName || 'aluno'}`} items={[
                        c.status !== 'ended' && { label: 'Editar valor, plano ou vencimento', onClick: () => setModal({ kind: 'edit', contract: c }) },
                        c.status === 'active' && { label: 'Pausar (sem novas cobranças)', onClick: () => change(c, { status: 'paused' }, 'Contrato pausado.') },
                        c.status === 'paused' && { label: 'Reativar', onClick: () => change(c, { status: 'active' }, 'Contrato reativado.') },
                        c.status !== 'ended' && { label: 'Encerrar contrato', danger: true, onClick: () => setModal({ kind: 'end', contract: c }) }
                      ]} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </section>
      {modal?.kind === 'plan' && <PlanModal plan={modal.plan} onClose={close} onDone={() => { toast(modal.plan ? 'Plano salvo.' : 'Plano criado.'); close(); refresh(); }} />}
      {modal?.kind === 'contract' && <ContractModal plans={planList} onClose={close} onDone={() => { toast('Aluno matriculado.'); close(); refresh(); }} />}
      {modal?.kind === 'edit' && <ContractModal contract={modal.contract} plans={planList} onClose={close} onDone={() => { toast('Contrato salvo.'); close(); refresh(); }} />}
      {modal?.kind === 'end' && <ConfirmModal title={`Encerrar o contrato de ${modal.contract.studentName}?`} confirmLabel="Encerrar contrato" danger busy={busy} error={error} onClose={close} onConfirm={() => change(modal.contract, { status: 'ended' }, 'Contrato encerrado.')}><p>Não são geradas novas cobranças e as pendentes que vencem depois de hoje são canceladas. As cobranças já vencidas e as pagas permanecem. Não dá para reabrir; para voltar, crie um novo contrato.</p></ConfirmModal>}
    </>
  );
}

export default function Finance() {
  const { role } = useApp();
  const manage = canManageFinance(role);
  const [tab, setTab] = useState(manage ? 'resumo' : 'cobrancas');
  const [month, setMonth] = useState(nowMonth);
  const [pay, setPay] = useState(null);
  const toast = useToast();
  if (!canSeeFinance(role)) return <Navigate to="/app" replace />;
  const tabs = [manage && ['resumo', 'Resumo'], ['cobrancas', 'Cobranças'], ['planos', 'Planos e contratos']].filter(Boolean);
  const openPay = (charge, reload) => setPay({ charge, reload });
  return (
    <>
      <PageHeader title="Financeiro" subtitle="Planos, contratos, cobranças mensais e pagamentos da academia. O registro é manual; nenhum dado de cartão passa por aqui." />
      <div className="tabs" role="tablist" aria-label="Seções do financeiro">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="painel-fin" className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div id="painel-fin" role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack">
        {tab === 'resumo' && manage && <SummaryTab month={month} setMonth={setMonth} onPay={openPay} />}
        {tab === 'cobrancas' && <ChargesTab month={month} setMonth={setMonth} manage={manage} openPay={openPay} />}
        {tab === 'planos' && <PlansTab manage={manage} />}
      </div>
      {pay && <PayModal charge={pay.charge} onClose={() => setPay(null)} onDone={() => { toast('Pagamento registrado.'); setPay(null); pay.reload?.(); }} />}
    </>
  );
}
