import React, { useState } from 'react';
import { PAYMENT_LABELS, PAYMENT_METHODS } from '../../../../shared/academy-contracts/index.js';
import { friendlyError, newIdempotencyKey } from '../../api';
import { centsToInput, dateBR, formatBRL, parseBRL } from '../../lib/money';
import { useApp } from '../AppFrame';
import Modal from '../Modal';
import { Field } from '../ui';

const todayLocal = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);   // dia de Brasília, como no servidor

// Registrar pagamento (recepção, administrador e dono). Valor padrão = valor líquido; a data não pode ser futura.
export function PayModal({ charge, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [method, setMethod] = useState('pix');
  const [amount, setAmount] = useState(centsToInput(charge.netCents));
  const [paidAt, setPaidAt] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (cents === null) { setError('Informe um valor válido, como 99,90.'); return; }
    setBusy(true); setError('');
    try { await api.payCharge(academyId, charge.id, { method, paidAmountCents: cents, paidAt, ...(note.trim() ? { note: note.trim() } : {}) }); onDone(); } catch (err) { setError(friendlyError(err)); setBusy(false); }
  };
  return (
    <Modal title={`Registrar pagamento de ${charge.studentName || 'aluno'}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <p className="muted">{charge.description || charge.planName}, vencimento {dateBR(charge.dueDate)}, valor {formatBRL(charge.netCents)}.</p>
        <Field id="pay-method" label="Forma de pagamento"><select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} data-autofocus>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}</select></Field>
        <Field id="pay-amount" label="Valor recebido" hint="Se for diferente do valor da cobrança, anote o motivo."><input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field id="pay-date" label="Data do pagamento"><input id="pay-date" type="date" value={paidAt} max={todayLocal()} onChange={(e) => setPaidAt(e.target.value)} required /></Field>
        <Field id="pay-note" label="Observação (opcional)"><input id="pay-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Salvando...' : 'Registrar pagamento'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Ajustar desconto e vencimento de uma cobrança em aberto (dono e administrador).
export function AdjustModal({ charge, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [discount, setDiscount] = useState(centsToInput(charge.discountCents));
  const [dueDate, setDueDate] = useState(charge.dueDate);
  const [note, setNote] = useState(charge.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const cents = parseBRL(discount || '0');
    if (cents === null || cents > charge.amountCents) { setError(`O desconto vai de R$ 0,00 até ${formatBRL(charge.amountCents)}.`); return; }
    setBusy(true); setError('');
    try { await api.adjustCharge(academyId, charge.id, { discountCents: cents, dueDate, note: note.trim() }); onDone(); } catch (err) { setError(friendlyError(err)); setBusy(false); }
  };
  return (
    <Modal title={`Ajustar cobrança de ${charge.studentName || 'aluno'}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="stack">
        <p className="muted">Valor cheio: {formatBRL(charge.amountCents)}. O ajuste vale só para esta cobrança.</p>
        <Field id="adj-discount" label="Desconto"><input id="adj-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} data-autofocus /></Field>
        <Field id="adj-due" label="Novo vencimento"><input id="adj-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></Field>
        <Field id="adj-note" label="Observação (opcional)"><input id="adj-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar ajuste'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Gerar as cobranças de um mês: sempre mostra a prévia (quantas serão criadas) antes de gravar.
export function GenerateModal({ month, label, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt] = useState(newIdempotencyKey);
  React.useEffect(() => {
    let live = true;
    api.generateCharges(academyId, { month, dryRun: true }).then((r) => live && setPreview(r)).catch((e) => live && setError(friendlyError(e)));
    return () => { live = false; };
  }, [api, academyId, month]);
  const apply = async () => {
    setBusy(true); setError('');
    try { const r = await api.generateCharges(academyId, { month }, attempt); onDone(r); } catch (err) { setError(friendlyError(err)); setBusy(false); }
  };
  return (
    <Modal title={`Gerar cobranças de ${label}`} onClose={onClose} busy={busy}>
      <div className="stack">
        {!preview && !error && <p role="status" className="muted">Calculando...</p>}
        {preview && (
          <>
            <p><strong>{preview.toCreate}</strong> {preview.toCreate === 1 ? 'cobrança será criada' : 'cobranças serão criadas'} para os contratos ativos{preview.alreadyGenerated > 0 ? `; ${preview.alreadyGenerated} já existiam e não mudam` : ''}.</p>
            <p className="muted">Cada contrato recebe uma cobrança por mês, com o valor combinado e o dia de vencimento do contrato. Contratos pausados ou encerrados antes do mês ficam de fora. Repetir é seguro.</p>
          </>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="btn primary" onClick={apply} disabled={busy || !preview || preview.toCreate === 0}>{busy ? 'Gerando...' : preview?.toCreate === 0 ? 'Nada a gerar' : 'Gerar cobranças'}</button>
        </div>
      </div>
    </Modal>
  );
}
