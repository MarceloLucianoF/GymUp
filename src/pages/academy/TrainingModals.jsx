import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../components/coach/styles';
import { diffVersions } from '../../utils/trainingDiff';
import { BATCH_MODES, planBatch, summarizeBatch } from '../../utils/batchPlan';
import { versionIdOf } from '../../services/academyTrainingService';

const closeBtn = 'absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10';
const chip = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold';

function Section({ title, count, tone, children, testId }) {
  if (!count) return null;
  const tones = { add: 'text-emerald-800 dark:text-emerald-300', del: 'text-rose-800 dark:text-rose-300', neutral: 'text-gray-900 dark:text-white' };
  return (
    <section className="mt-4" data-testid={testId}>
      <h3 className={`text-sm font-black ${tones[tone] || tones.neutral}`}>{title} ({count})</h3>
      <ul className="mt-1.5 space-y-1.5">{children}</ul>
    </section>
  );
}

export function CompareModal({ series, versions, assigned, students, seriesNames, onClose }) {
  const options = useMemo(() => {
    const vs = [...versions].sort((a, b) => a.version - b.version).map((v) => ({ id: `v${v.version}`, label: `Versão ${v.version}`, data: v, version: v.version }));
    return [...vs, { id: 'draft', label: 'Rascunho atual', data: series.draft, version: null }];
  }, [versions, series]);
  const [toId, setToId] = useState(options[options.length - 1].id);
  const [fromId, setFromId] = useState((options[options.length - 2] || options[options.length - 1]).id);
  const from = options.find((o) => o.id === fromId);
  const to = options.find((o) => o.id === toId);
  const diff = useMemo(() => diffVersions(from.data, to.data), [from, to]);
  const usage = useMemo(() => {
    const byStudent = new Map((assigned || []).map((a) => [a.studentId, a]));
    return (students || []).map((s) => {
      const a = byStudent.get(s.userId);
      const sameSeries = a && a.seriesId === series.id;
      return { id: s.userId, name: s.displayName, label: a ? `${sameSeries ? '' : `${seriesNames[a.seriesId] || 'Outra ficha'} · `}versão ${a.version}` : 'Sem ficha', onFrom: sameSeries && from.version === a.version, onTo: sameSeries && to.version === a.version };
    });
  }, [assigned, students, series.id, seriesNames, from, to]);

  return (
    <Modal onClose={onClose} label="Comparar versões" className="w-full max-w-2xl">
      <div className="surface relative max-h-[90dvh] overflow-y-auto bg-white p-5 dark:bg-gray-900">
        <button type="button" aria-label="Fechar" onClick={onClose} className={closeBtn}><X className="h-5 w-5" /></button>
        <h2 className="pr-12 font-display text-xl font-black text-gray-900 dark:text-white">Comparar versões de {series.name}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div><label htmlFor="cmp-from" className={labelCls}>De</label>
            <select id="cmp-from" value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputCls}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
          <div><label htmlFor="cmp-to" className={labelCls}>Para</label>
            <select id="cmp-to" value={toId} onChange={(e) => setToId(e.target.value)} className={inputCls}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
        </div>

        <div data-testid="cmp-result">
          {fromId === toId && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Escolha duas versões diferentes para comparar.</p>}
          {fromId !== toId && diff.identical && <p className="mt-4 rounded-2xl bg-gray-50 p-3 text-sm text-gray-800 dark:bg-white/5 dark:text-gray-200">Nenhuma diferença entre {from.label} e {to.label}.</p>}
          {fromId !== toId && !diff.identical && (
            <>
              {diff.nameChange && <p className="mt-4 text-sm text-gray-900 dark:text-white" data-testid="cmp-name"><strong>Nome:</strong> "{diff.nameChange.from}" passou a "{diff.nameChange.to}"</p>}
              {diff.descriptionChange && <p className="mt-2 text-sm text-gray-900 dark:text-white" data-testid="cmp-desc"><strong>Descrição:</strong> {diff.descriptionChange.from ? `"${diff.descriptionChange.from}"` : 'sem descrição'} passou a {diff.descriptionChange.to ? `"${diff.descriptionChange.to}"` : 'sem descrição'}</p>}
              <Section title="Exercícios adicionados" count={diff.added.length} tone="add" testId="cmp-added">
                {diff.added.map((e) => <li key={`a-${e.name}-${e.position}`} className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-gray-900 dark:text-white">{e.name} <span className="text-xs text-gray-700 dark:text-gray-300">({e.sets}x{e.reps}, {e.rest}s) na posição {e.position}</span></li>)}
              </Section>
              <Section title="Exercícios removidos" count={diff.removed.length} tone="del" testId="cmp-removed">
                {diff.removed.map((e) => <li key={`r-${e.name}-${e.position}`} className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-gray-900 dark:text-white">{e.name} <span className="text-xs text-gray-700 dark:text-gray-300">(era a posição {e.position})</span></li>)}
              </Section>
              <Section title="Mudou de posição" count={diff.moved.length} testId="cmp-moved">
                {diff.moved.map((e) => <li key={`m-${e.name}`} className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:bg-white/5 dark:text-white">{e.name} <span className="text-xs text-gray-700 dark:text-gray-300">da posição {e.from} para {e.to}</span></li>)}
              </Section>
              <Section title="Séries, repetições ou descanso" count={diff.changed.length} testId="cmp-changed">
                {diff.changed.map((e) => (
                  <li key={`c-${e.name}`} className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:bg-white/5 dark:text-white">
                    <span className="font-semibold">{e.name}</span>
                    <span className="block text-xs text-gray-700 dark:text-gray-300">{e.changes.map((c) => `${c.label}: ${c.from || '-'} para ${c.to || '-'}`).join(' · ')}</span>
                  </li>
                ))}
              </Section>
            </>
          )}
        </div>

        <section className="mt-5" data-testid="cmp-usage">
          <h3 className="text-sm font-black text-gray-900 dark:text-white">Versão atribuída a cada aluno</h3>
          <ul className="mt-1.5 space-y-1">
            {usage.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-400">Nenhum aluno para mostrar.</li>}
            {usage.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="min-w-0 truncate font-semibold text-gray-900 dark:text-white">{u.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                  {u.label}
                  {u.onFrom && fromId !== toId && <span className={`${chip} bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-200`}>{from.label}</span>}
                  {u.onTo && fromId !== toId && <span className={`${chip} bg-brand/20 text-gray-900 dark:text-brand`}>{to.label}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className={btnGhost}>Fechar</button></div>
      </div>
    </Modal>
  );
}

export function BatchModal({ series, versions, assigned, students, seriesNames, isStaff, onClose, onApply }) {
  const published = useMemo(() => versions.filter((v) => v.seriesId === series.id).sort((a, b) => b.version - a.version), [versions, series.id]);
  const [version, setVersion] = useState(published[0]?.version || 0);
  const [mode, setMode] = useState('new');
  const [picked, setPicked] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const target = { seriesId: series.id, version, versionId: versionIdOf(series.id, version) };
  const rows = useMemo(() => planBatch({ students, assigned, target, mode, selectedIds: picked, seriesNames }), [students, assigned, version, mode, picked, series.id, seriesNames]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = summarizeBatch(rows);
  const needsConfirm = sum.replace > 0 || sum.noTeacher > 0;
  const canRun = sum.total > 0 && !running && (!needsConfirm || confirmed);
  const toggle = (id) => { setConfirmed(false); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };

  const run = async () => {
    setRunning(true);
    try { setResults(await onApply({ version, rows, isStaff, onProgress: (done, total) => setProgress({ done, total }) })); }
    finally { setRunning(false); }
  };
  const count = (s) => (results || []).filter((r) => r.status === s);

  return (
    <Modal onClose={running ? () => {} : onClose} label="Aplicar em lote" className="w-full max-w-2xl">
      <div className="surface relative max-h-[90dvh] overflow-y-auto bg-white p-5 dark:bg-gray-900">
        {!running && <button type="button" aria-label="Fechar" onClick={onClose} className={closeBtn}><X className="h-5 w-5" /></button>}
        <h2 className="pr-12 font-display text-xl font-black text-gray-900 dark:text-white">Aplicar {series.name} em lote</h2>
        {!results && (
          <>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Veja o que muda para cada aluno antes de gravar. Treinos já feitos e o histórico não são alterados; quem está treinando agora termina a ficha que começou.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><label htmlFor="bt-version" className={labelCls}>Versão a aplicar</label>
                <select id="bt-version" value={version} onChange={(e) => { setConfirmed(false); setVersion(Number(e.target.value)); }} className={inputCls}>{published.map((v) => <option key={v.id} value={v.version}>Versão {v.version}</option>)}</select></div>
              <div><label htmlFor="bt-mode" className={labelCls}>Quem recebe</label>
                <select id="bt-mode" value={mode} onChange={(e) => { setConfirmed(false); setMode(e.target.value); }} className={inputCls}>{BATCH_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
            </div>

            <ul className="mt-3 space-y-1.5" aria-label="Prévia por aluno" data-testid="bt-rows">
              {rows.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-400">Nenhum aluno disponível para você aplicar.</li>}
              {rows.map((r) => (
                <li key={r.studentId} className={`rounded-xl px-3 py-2 text-sm ${r.included ? 'bg-brand/10' : 'bg-gray-50 dark:bg-white/5'}`} data-testid={`bt-row-${r.studentId}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {mode === 'selected' && <input type="checkbox" className="h-5 w-5 shrink-0" checked={picked.includes(r.studentId)} onChange={() => toggle(r.studentId)} aria-label={`Selecionar ${r.name}`} />}
                      <span className="truncate font-semibold text-gray-900 dark:text-white">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-gray-800 dark:text-gray-200">{r.note}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">
                    Hoje: {r.current ? r.current.label : 'sem ficha'}{r.included ? ` · Depois: ${series.name} v${version}` : ''}
                  </p>
                  {(r.noTeacher || (r.included && r.otherSeries)) && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {r.noTeacher && <span className={`${chip} bg-amber-500/20 text-gray-900 dark:text-amber-200`}>Sem professor ativo</span>}
                      {r.included && r.otherSeries && <span className={`${chip} bg-rose-500/15 text-gray-900 dark:text-rose-200`}>Conflito: troca outra ficha</span>}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-sm text-gray-900 dark:bg-white/5 dark:text-white" data-testid="bt-summary">
              <strong>{sum.total} {sum.total === 1 ? 'aluno afetado' : 'alunos afetados'}</strong>
              {` · ${sum.assign} recebem a primeira ficha · ${sum.replace} trocam de ficha ou versão`}
              {sum.skipped > 0 && ` · ${sum.skipped} já usam esta versão (nada muda)`}
              {sum.otherSeries > 0 && ` · ${sum.otherSeries} saem de outra ficha`}
              {sum.noTeacher > 0 && ` · ${sum.noTeacher} sem professor ativo`}
            </div>
            {needsConfirm && (
              <label className="mt-3 flex items-start gap-3 text-sm text-gray-900 dark:text-white">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="bt-confirm" />
                <span>Confirmo aplicar a versão {version} a {sum.total} {sum.total === 1 ? 'aluno' : 'alunos'}, substituindo a ficha atual de {sum.replace}. A atribuição é registrada na auditoria.</span>
              </label>
            )}
            {running && progress && <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white" role="status">Gravando {progress.done} de {progress.total}...</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={running} className={btnGhost}>Cancelar</button>
              <button type="button" onClick={run} disabled={!canRun} className={btnPrimary} data-testid="bt-apply">{running ? 'Aplicando...' : `Aplicar a ${sum.total} ${sum.total === 1 ? 'aluno' : 'alunos'}`}</button>
            </div>
          </>
        )}
        {results && (
          <div data-testid="bt-result">
            <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white" role="status">
              {count('ok').length} de {results.length} {results.length === 1 ? 'aluno atualizado' : 'alunos atualizados'}
              {count('failed').length + count('conflict').length > 0 ? `, ${count('failed').length + count('conflict').length} sem alteração` : ''}.
            </p>
            <ul className="mt-3 space-y-1.5">
              {results.map((r) => (
                <li key={r.studentId} className={`rounded-xl px-3 py-2 text-sm ${r.status === 'ok' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`} data-testid={`bt-res-${r.studentId}`}>
                  <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span>
                  <span className="block text-xs text-gray-800 dark:text-gray-200">{r.status === 'ok' ? 'Ficha aplicada' : r.reason}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className={btnPrimary}>Concluir</button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
