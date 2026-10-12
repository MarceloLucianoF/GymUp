import React, { useState } from 'react';
import { FileJson } from 'lucide-react';
import Drawer from './Drawer';
import { btnGhost, btnPrimary } from '../../../components/coach/styles';
import { parseImport } from './adminUtils';

const Count = ({ label, value, tone }) => (
  <div className={`rounded-2xl p-3 text-center ${tone}`}><p className="font-display text-2xl font-black">{value}</p><p className="text-xs font-bold uppercase">{label}</p></div>
);

// Importação em etapas: escolher arquivo → conferir (novos, duplicados, inválidos) → confirmar.
export default function ImportModal({ kind, existing, onConfirm, onClose }) {
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setReport(null); setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) { setError('Arquivo grande demais (máximo 2 MB).'); return; }
    try {
      const json = JSON.parse(await file.text());
      const parsed = parseImport(json, kind, existing);
      if (parsed.total === 0) setError('O arquivo não tem itens para importar.');
      else setReport(parsed);
    } catch (_) {
      setError('Não consegui ler o arquivo. Confira se é um JSON válido.');
    }
  };

  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(report); } finally { setBusy(false); }
  };

  const label = kind === 'exercises' ? 'exercícios' : 'fichas';
  return (
    <Drawer
      title={`Importar ${label} (JSON)`}
      subtitle="Nada é gravado até você confirmar a prévia."
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="button" onClick={confirm} disabled={!report || report.novos.length === 0 || busy} className={btnPrimary}>
            {busy ? 'Importando...' : report ? `Importar ${report.novos.length} novo(s)` : 'Importar'}
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <label className="pressable flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-4 text-center focus-within:ring-2 focus-within:ring-brand dark:border-white/20">
          <FileJson className="h-6 w-6 text-gray-600 dark:text-gray-400" aria-hidden="true" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{fileName || 'Escolher arquivo .json'}</span>
          <input type="file" accept=".json,application/json" onChange={onFile} className="sr-only" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-800 dark:text-rose-300">{error}</p>}
        {report && (
          <div className="space-y-4" aria-live="polite">
            <div className="grid grid-cols-3 gap-2">
              <Count label="Novos" value={report.novos.length} tone="bg-emerald-500/15 text-emerald-900 dark:text-emerald-200" />
              <Count label="Duplicados" value={report.duplicados.length} tone="bg-amber-500/15 text-amber-900 dark:text-amber-200" />
              <Count label="Inválidos" value={report.invalidos.length} tone="bg-rose-500/15 text-rose-900 dark:text-rose-200" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{report.total} item(ns) no arquivo. Duplicados (mesmo nome) e inválidos são ignorados.</p>
            {report.invalidos.length > 0 && (
              <details className="rounded-xl bg-gray-100 p-3 text-sm dark:bg-white/5">
                <summary className="cursor-pointer font-bold">Ver inválidos</summary>
                <ul className="mt-2 space-y-1">{report.invalidos.slice(0, 20).map((i) => <li key={i.index}>#{i.index + 1} {i.name || '(sem nome)'}: {i.reason}</li>)}</ul>
              </details>
            )}
            {report.duplicados.length > 0 && (
              <details className="rounded-xl bg-gray-100 p-3 text-sm dark:bg-white/5">
                <summary className="cursor-pointer font-bold">Ver duplicados</summary>
                <ul className="mt-2 space-y-1">{report.duplicados.slice(0, 20).map((i) => <li key={i.index}>#{i.index + 1} {i.name}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
