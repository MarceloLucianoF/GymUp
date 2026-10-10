import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Wallet, PiggyBank, Clock, AlertOctagon, Pencil, Check, Undo2, Users, TriangleAlert, Download, MessageCircle, History } from 'lucide-react';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../hooks/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import ProgressRing from '../../components/ui/ProgressRing';
import Reveal from '../../components/ui/Reveal';
import Modal from '../../components/common/Modal';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/coach/Avatar';
import BarChart from '../../components/coach/BarChart';
import PageSkeleton from '../../components/coach/PageSkeleton';
import { brl, toDate, MONTHS_SHORT } from '../../components/coach/helpers';
import { financeCsv, downloadCsv } from '../../utils/coachCsv';
import { loadTemplates, fillTemplate, firstName, whatsappLink } from '../../utils/coachTemplates';
import { DEFAULT_FEE } from '../../hooks/useCoachRoster';
import { btnPrimary, btnGhost, inputCls, labelCls, pageCls } from '../../components/coach/styles';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'overdue', label: 'Atrasados' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'paid', label: 'Pagos' }
];

const PAY_META = {
  paid: { label: 'Pago', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  pending: { label: 'Pendente', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  overdue: { label: 'Atrasado', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' }
};

const computeStats = (list) => {
  const sum = (arr) => arr.reduce((acc, s) => acc + s.monthlyFee, 0);
  const total = sum(list);
  const received = sum(list.filter((s) => s.paymentStatus === 'paid'));
  const overdue = list.filter((s) => s.paymentStatus === 'overdue');
  return { total, received, pending: total - received, overdueCount: overdue.length, overdueTotal: sum(overdue), pct: total ? Math.round((received / total) * 100) : 0 };
};

// Receita dos últimos 6 meses a partir da data do último pagamento de cada aluno pago.
// Não há histórico de pagamentos no banco: meses antigos refletem só o que ainda está marcado como pago.
const monthlyRevenue = (list, months = 6) => {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: MONTHS_SHORT[d.getMonth()], value: 0 };
  });
  list.filter((s) => s.paymentStatus === 'paid').forEach((s) => {
    const d = toDate(s.paymentDate || s.lastPaymentUpdate);
    const bucket = d && buckets.find((b) => b.y === d.getFullYear() && b.m === d.getMonth());
    if (bucket) bucket.value += s.monthlyFee;
  });
  return buckets;
};

const statusTotals = (list) => ['paid', 'pending', 'overdue'].map((id) => {
  const items = list.filter((s) => s.paymentStatus === id);
  return { id, count: items.length, total: items.reduce((acc, s) => acc + s.monthlyFee, 0) };
});

// Movimentações do mês corrente a partir de lastPaymentUpdate (só a última alteração de cada aluno é guardada).
const monthHistory = (list, now = new Date()) => list
  .map((s) => ({ s, date: toDate(s.lastPaymentUpdate) }))
  .filter(({ date }) => date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth())
  .sort((a, b) => b.date - a.date);

export default function FinancialPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null); // { student, value }
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const fetchFinancials = useCallback(async () => {
    setError(false);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'user'), where('coachId', '==', user.uid)));
      setStudents(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          monthlyFee: Number(data.monthlyFee) || DEFAULT_FEE,
          paymentStatus: data.paymentStatus || 'pending',
          paymentDate: data.paymentDate || null
        };
      }).sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), 'pt-BR')));
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Erro ao carregar financeiro.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  const stats = useMemo(() => computeStats(students), [students]);
  const revenue = useMemo(() => monthlyRevenue(students), [students]);
  const overdue = useMemo(() => students.filter((s) => s.paymentStatus === 'overdue'), [students]);
  const visible = useMemo(() => students.filter((s) => filter === 'all' || s.paymentStatus === filter), [students, filter]);
  const totals = useMemo(() => statusTotals(students), [students]);
  const history = useMemo(() => monthHistory(students), [students]);
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Campos permitidos pelas regras ao treinador vinculado: paymentStatus, paymentDate, lastPaymentUpdate, monthlyFee.
  const handleStatusChange = async (student, newStatus) => {
    const now = new Date().toISOString();
    const update = { paymentStatus: newStatus, lastPaymentUpdate: now, ...(newStatus === 'paid' ? { paymentDate: now } : {}) };
    const previous = students;
    setBusyId(student.id);
    setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, ...update } : s)));
    try {
      await updateDoc(doc(db, 'users', student.id), update);
      if (newStatus === 'paid') toast.success('Pagamento confirmado!');
    } catch (err) {
      console.error(err);
      setStudents(previous);
      toast.error('Erro ao atualizar.');
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    const rows = visible.map((s) => ({ ...s, paymentDateObj: s.paymentStatus === 'paid' ? toDate(s.paymentDate) : null }));
    const stamp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    downloadCsv(`financeiro-${stamp}.csv`, financeCsv(rows, monthName, { delimiter: ';' }));
  };

  // Lembrete de cobrança: abre o WhatsApp se o perfil tiver telefone; senão copia a mensagem.
  const remind = async (student) => {
    const tpl = loadTemplates().find((t) => t.id === 'billing');
    const text = fillTemplate(tpl?.text || 'Oi, {nome}! Passando para lembrar da mensalidade{valor}.', { nome: firstName(student.displayName), valor: ` de ${brl(student.monthlyFee)}` });
    const link = whatsappLink(student.phone, text);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Sem telefone no perfil: mensagem copiada.');
    } catch {
      toast.error('Não foi possível copiar a mensagem.');
    }
  };

  const handleSaveValue = async (e) => {
    e.preventDefault();
    const { student, value } = editing;
    const fee = Number(String(value).replace(',', '.'));
    if (value === '' || Number.isNaN(fee) || fee < 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', student.id), { monthlyFee: fee });
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, monthlyFee: fee } : s)));
      setEditing(null);
      toast.success('Valor atualizado.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar valor.');
    }
  };

  if (loading) return <div className={pageCls}><div className="mx-auto max-w-5xl"><PageSkeleton cards={4} /></div></div>;
  if (error) return <div className={pageCls}><ErrorState message="Não foi possível carregar o financeiro." onRetry={() => { setLoading(true); fetchFinancials(); }} /></div>;

  const renderActions = (s) => {
    const busy = busyId === s.id;
    const small = 'pressable inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl px-4 text-sm font-bold disabled:opacity-50';
    return (
      <div className="flex flex-wrap gap-2">
        {s.paymentStatus === 'paid' ? (
          <button type="button" disabled={busy} onClick={() => handleStatusChange(s, 'pending')} className={`${small} bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300`}><Undo2 className="h-4 w-4" /> Desfazer</button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => handleStatusChange(s, 'paid')} className={`${small} bg-emerald-500 text-white`}><Check className="h-4 w-4" /> Marcar pago</button>
            <button type="button" onClick={() => remind(s)} aria-label={`Lembrar ${s.displayName || 'aluno'} por WhatsApp`} className={`${small} bg-emerald-500/10 text-emerald-600`}><MessageCircle className="h-4 w-4" /> Cobrar</button>
            {s.paymentStatus === 'pending' && <button type="button" disabled={busy} onClick={() => handleStatusChange(s, 'overdue')} className={`${small} bg-rose-500/10 text-rose-600`}><TriangleAlert className="h-4 w-4" /> Atrasado</button>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={pageCls}>
      <div className="mx-auto max-w-5xl space-y-5">
        <PageHeader eyebrow="Financeiro" title="Mensalidades" subtitle={`Resumo de ${monthName}`} />

        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <Reveal>
            <div className="surface flex items-center gap-5 p-5">
              <ProgressRing value={stats.pct} size={96} stroke={9}><span className="font-display text-xl font-black text-gray-900 dark:text-white">{stats.pct}%</span></ProgressRing>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Recebido do previsto</p>
                <p className="font-display text-xl font-black text-gray-900 dark:text-white">{brl(stats.received)} <span className="text-sm font-medium text-gray-400">de {brl(stats.total)}</span></p>
              </div>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard icon={Wallet} label="Previsto" value={stats.total} prefix="R$ " accent="brand" />
            <StatCard icon={PiggyBank} label="Recebido" value={stats.received} prefix="R$ " accent="green" />
            <StatCard icon={Clock} label="A receber" value={stats.pending} prefix="R$ " accent="blue" className="col-span-2 md:col-span-1" />
          </div>
        </div>

        {overdue.length > 0 && (
          <Reveal>
            <section className="surface border-rose-500/40 bg-rose-500/5 p-5" aria-label="Inadimplentes">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-black text-rose-600 dark:text-rose-400">
                <AlertOctagon className="h-5 w-5" aria-hidden="true" /> {overdue.length} inadimplente{overdue.length > 1 ? 's' : ''} · {brl(stats.overdueTotal)}
              </h2>
              <ul className="space-y-2">
                {overdue.map((s) => (
                  <li key={s.id} className="flex flex-col gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={s.displayName} src={s.photoURL} size="sm" />
                      <div className="min-w-0"><p className="truncate font-bold text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</p><p className="text-xs font-semibold text-rose-500">{brl(s.monthlyFee)} em atraso</p></div>
                    </div>
                    {renderActions(s)}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}

        <section className="grid grid-cols-3 gap-3" aria-label="Total por status">
          {totals.map((t) => (
            <div key={t.id} className="surface p-3 text-center">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PAY_META[t.id].cls}`}>{PAY_META[t.id].label}</span>
              <p className="mt-2 font-display text-lg font-black text-gray-900 dark:text-white">{brl(t.total)}</p>
              <p className="text-xs text-gray-500">{t.count} aluno{t.count === 1 ? '' : 's'}</p>
            </div>
          ))}
        </section>

        <Reveal>
          <section className="surface p-5">
            <h2 className="mb-1 font-display text-base font-black text-gray-900 dark:text-white">Receita dos últimos 6 meses</h2>
            <p className="mb-4 text-xs text-gray-500">Baseada na data do último pagamento de cada aluno marcado como pago (não há histórico mensal armazenado).</p>
            <BarChart data={revenue} formatValue={brl} ariaLabel="Receita por mês" />
          </section>
        </Reveal>

        <section className="space-y-3">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filtrar mensalidades">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                className={`pressable min-h-[44px] shrink-0 rounded-2xl px-4 text-sm font-bold ${filter === f.id ? 'bg-brand text-black' : 'bg-white/70 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>{f.label}</button>
            ))}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={exportCsv} disabled={visible.length === 0} className={btnGhost}><Download className="h-4 w-4" /> Exportar CSV ({visible.length})</button>
          </div>

          {students.length === 0 ? (
            <div className="surface"><EmptyState icon={Users} title="Nenhum aluno vinculado" description="Quando um aluno usar seu código de convite, ele aparecerá aqui." action={<button type="button" onClick={() => navigate('/coach/dashboard')} className={btnPrimary}>Ir ao painel</button>} /></div>
          ) : visible.length === 0 ? (
            <div className="surface"><EmptyState title="Nada neste filtro." /></div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((s, i) => (
                <li key={s.id} className="surface animate-fade-up p-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.displayName} src={s.photoURL} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</p>
                      <p className="text-xs text-gray-500">{s.paymentStatus === 'paid' && s.paymentDate ? `Pago em ${toDate(s.paymentDate)?.toLocaleDateString('pt-BR')}` : s.email}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${(PAY_META[s.paymentStatus] || PAY_META.pending).cls}`}>{(PAY_META[s.paymentStatus] || PAY_META.pending).label}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => setEditing({ student: s, value: String(s.monthlyFee) })} aria-label={`Editar mensalidade de ${s.displayName || 'aluno'}`} className={`${btnGhost} font-mono`}>
                      {brl(s.monthlyFee)} <Pencil className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    {renderActions(s)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Reveal>
          <section className="surface p-5" aria-label="Histórico do mês">
            <h2 className="mb-1 flex items-center gap-2 font-display text-base font-black text-gray-900 dark:text-white"><History className="h-5 w-5 text-brand" aria-hidden="true" /> Histórico de {monthName}</h2>
            <p className="mb-3 text-xs text-gray-500">Última alteração de pagamento de cada aluno neste mês (o banco não guarda o histórico completo).</p>
            {history.length === 0 ? <p className="text-sm text-gray-500">Nenhuma movimentação neste mês.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {history.map(({ s, date }) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-24 shrink-0 text-xs text-gray-500">{date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-white">{s.displayName || 'Aluno'}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${(PAY_META[s.paymentStatus] || PAY_META.pending).cls}`}>{(PAY_META[s.paymentStatus] || PAY_META.pending).label}</span>
                    <span className="w-20 shrink-0 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{brl(s.monthlyFee)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} label="Editar mensalidade" className="w-full max-w-sm">
          <form onSubmit={handleSaveValue} className="surface space-y-4 bg-white p-6 dark:bg-gray-900 animate-scale-in">
            <h3 className="font-display text-lg font-black text-gray-900 dark:text-white">Mensalidade de {editing.student.displayName}</h3>
            <div>
              <label htmlFor="monthlyFee" className={labelCls}>Valor (R$)</label>
              <input id="monthlyFee" type="number" min="0" step="0.01" inputMode="decimal" autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancelar</button>
              <button type="submit" className={btnPrimary}>Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
