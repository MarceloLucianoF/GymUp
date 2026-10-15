import React, { useEffect, useMemo, useState } from 'react';
import { LIMITS } from '../../../shared/academy-contracts/index.js';
import { friendlyError, newIdempotencyKey } from '../api';
import { OUTCOME_LABELS, SKIP_REASONS } from '../lib/trainings';
import { useApp } from './AppFrame';
import Modal from './Modal';
import { Field, Loading } from './ui';

// Atribuição individual (1 aluno) ou em lote (vários). Sempre mostra a prévia antes de gravar; quem já tem outra ficha só é trocado se a pessoa marcar.
// Tudo é conferido de novo no servidor: a prévia é informação, nunca autorização.
export default function AssignTrainingModal({ students: initial, template, pickStudents = false, onClose, onDone }) {
  const { api, academyId } = useApp();
  const [templates, setTemplates] = useState(template ? { status: 'ready', list: [template] } : { status: 'loading', list: [] });
  const [templateId, setTemplateId] = useState(template?.templateId || '');
  const [version, setVersion] = useState('');
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(newIdempotencyKey);
  const [picked, setPicked] = useState(() => new Map(initial.map((s) => [s.userId, s])));
  const [roster, setRoster] = useState({ status: pickStudents ? 'loading' : 'idle', list: [] });
  const [filter, setFilter] = useState('');
  const students = useMemo(() => [...picked.values()], [picked]);
  const single = students.length === 1;
  useEffect(() => {
    if (!pickStudents) return undefined;
    let live = true;
    api.students(academyId, { status: 'active', pageSize: LIMITS.pageSizeMax }).then((d) => live && setRoster({ status: 'ready', list: d.students, total: d.total })).catch((e) => live && setRoster({ status: 'error', list: [], error: e }));
    return () => { live = false; };
  }, [api, academyId, pickStudents]);
  const togglePick = (s) => { setPicked((m) => { const n = new Map(m); if (n.has(s.userId)) n.delete(s.userId); else if (n.size < LIMITS.batchMax) n.set(s.userId, s); return n; }); setPreview(null); setError(''); };
  const visible = roster.list.filter((s) => (s.displayName || '').toLowerCase().includes(filter.trim().toLowerCase()));

  useEffect(() => {
    if (template) return undefined;
    let live = true;
    api.trainings(academyId, { status: 'active' }).then((d) => {
      if (!live) return;
      const list = d.templates.filter((t) => t.currentVersion >= 1);
      setTemplates({ status: 'ready', list });
      setTemplateId(list[0]?.templateId || '');
    }).catch((e) => live && setTemplates({ status: 'error', list: [], error: e }));
    return () => { live = false; };
  }, [api, academyId, template]);

  const chosen = templates.list.find((t) => t.templateId === templateId);
  const versions = useMemo(() => (chosen ? Array.from({ length: chosen.currentVersion }, (_, i) => chosen.currentVersion - i) : []), [chosen]);
  useEffect(() => { setVersion(chosen ? String(chosen.currentVersion) : ''); setPreview(null); }, [chosen]);
  const body = () => ({ studentUids: students.map((s) => s.userId), version: Number(version), replace });

  const runPreview = async () => {
    setBusy(true); setError('');
    try { setPreview(await api.assignBatch(academyId, templateId, { ...body(), dryRun: true })); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setError('');
    try {
      const doable = preview.results.filter((r) => r.outcome !== 'skip');
      const result = single && doable.length === 1
        ? (await api.assignTraining(academyId, templateId, { studentUid: students[0].userId, version: Number(version) }), { summary: preview.summary })
        : await api.assignBatch(academyId, templateId, body(), attempt);
      setAttempt(newIdempotencyKey());
      onDone(result.summary, preview.templateName);
    } catch (e) { setError(friendlyError(e)); setBusy(false); }
  };
  const doable = preview ? preview.summary.assign + preview.summary.replace : 0;
  const changeInput = (fn) => (e) => { fn(e); setPreview(null); setError(''); };

  return (
    <Modal title={pickStudents ? 'Atribuir ficha a alunos' : single ? `Atribuir ficha a ${students[0].displayName}` : `Atribuir ficha a ${students.length} alunos`} onClose={onClose} busy={busy} wide>
      <div className="stack">
        {pickStudents && (
          <fieldset className="picker">
            <legend>Alunos ({picked.size} de no máximo {LIMITS.batchMax})</legend>
            {roster.status === 'loading' && <Loading text="Carregando alunos..." />}
            {roster.status === 'error' && <p role="alert" className="error">{friendlyError(roster.error)}</p>}
            {roster.status === 'ready' && roster.list.length === 0 && <p className="muted" role="status">Nenhum aluno ativo para atribuir.</p>}
            {roster.status === 'ready' && roster.list.length > 0 && (
              <>
                <Field id="p-filter" label="Filtrar pelo nome"><input id="p-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} maxLength={60} /></Field>
                {roster.total > roster.list.length && <p className="muted small">Mostrando os primeiros {roster.list.length} de {roster.total}. Para os demais, use a lista de Alunos.</p>}
                <ul className="rows picker-list">
                  {visible.map((s) => (
                    <li key={s.userId} className="row"><label className="check"><input type="checkbox" checked={picked.has(s.userId)} onChange={() => togglePick(s)} /> {s.displayName || 'Aluno'}{s.training && <span className="muted small"> · hoje: {s.training.name} v{s.training.version}</span>}</label></li>
                  ))}
                </ul>
              </>
            )}
          </fieldset>
        )}
        {templates.status === 'loading' && <Loading text="Carregando fichas..." />}
        {templates.status === 'error' && <p role="alert" className="error">{friendlyError(templates.error)}</p>}
        {templates.status === 'ready' && templates.list.length === 0 && <p role="status" className="muted">Nenhuma ficha publicada ainda. Publique uma versão na área de Fichas para poder atribuir.</p>}
        {chosen && (
          <>
            {!template && <Field id="a-template" label="Ficha"><select id="a-template" value={templateId} onChange={changeInput((e) => setTemplateId(e.target.value))} data-autofocus>{templates.list.map((t) => <option key={t.templateId} value={t.templateId}>{t.name} (v{t.currentVersion})</option>)}</select></Field>}
            <Field id="a-version" label="Versão" hint="O aluno recebe exatamente esta versão; publicações novas não mudam a ficha dele sozinhas.">
              <select id="a-version" value={version} onChange={changeInput((e) => setVersion(e.target.value))}>{versions.map((v) => <option key={v} value={v}>Versão {v}{v === chosen.currentVersion ? ' (atual)' : ''}</option>)}</select>
            </Field>
            <label className="check"><input type="checkbox" checked={replace} onChange={changeInput((e) => setReplace(e.target.checked))} /> Substituir a ficha atual de quem já tem outra</label>
          </>
        )}
        {preview && (
          <section aria-labelledby="previa" aria-live="polite">
            <h3 id="previa" className="h-small">Prévia</h3>
            <p className="muted small">{preview.summary.assign} {preview.summary.assign === 1 ? 'receberá' : 'receberão'} a ficha, {preview.summary.replace} {preview.summary.replace === 1 ? 'terá' : 'terão'} a ficha trocada e {preview.summary.skip} {preview.summary.skip === 1 ? 'será ignorado' : 'serão ignorados'}.</p>
            <ul className="rows preview">
              {preview.results.map((r) => (
                <li key={r.studentUid} className="row">
                  <span className="row-main"><strong>{r.displayName || 'Aluno'}</strong>
                    {r.current && <span className="muted small">Hoje: {r.current.name || 'ficha'} (v{r.current.version})</span>}
                    {r.reason && <span className="muted small">{SKIP_REASONS[r.reason] || r.reason}</span>}
                  </span>
                  <span className={`badge outcome-${r.outcome}`}>{OUTCOME_LABELS[r.outcome]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          {!preview
            ? <button type="button" className="btn primary" onClick={runPreview} disabled={busy || !chosen || students.length === 0}>{busy ? 'Calculando...' : 'Ver prévia'}</button>
            : <button type="button" className="btn primary" onClick={apply} disabled={busy || doable === 0}>{busy ? 'Aplicando...' : doable === 0 ? 'Nada a atribuir' : `Confirmar atribuição (${doable})`}</button>}
        </div>
      </div>
    </Modal>
  );
}
