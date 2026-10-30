import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { friendlyError } from '../../api';
import { useApp } from '../../components/AppFrame';
import AssignTrainingModal from '../../components/AssignTrainingModal';
import { ConfirmModal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import TrainingEditor from '../../components/TrainingEditor';
import { EmptyState, ErrorState, Field, PageHeader, TableSkeleton } from '../../components/ui';
import { dateTimeOf, plural } from '../../lib/format';
import { canCreateTrainings } from '../../lib/policy';
import { DIFF_LABELS, FIELD_LABELS, TEMPLATE_STATUS } from '../../lib/trainings';
import { useApi } from '../../session';

const exLine = (e) => `${e.sets} x ${e.reps} · ${e.rest}s${e.muscleGroup ? ` · ${e.muscleGroup}` : ''}`;

function Compare({ detail }) {
  const { api, academyId } = useApp();
  const versions = detail.versions.map((v) => String(v.version));
  const [from, setFrom] = useState(versions[1] || versions[0] || 'draft');
  const [to, setTo] = useState(detail.template.unpublishedChanges ? 'draft' : versions[0] || 'draft');
  const [diff, reload] = useApi(() => (from === to ? Promise.resolve(null) : api.compareTraining(academyId, detail.template.templateId, from, to)), [api, academyId, detail.template.templateId, from, to]);
  const options = [...versions.map((v) => ({ value: v, label: `Versão ${v}` })), { value: 'draft', label: 'Rascunho atual' }];
  const d = diff.data;
  return (
    <section className="panel" aria-labelledby="comparar">
      <h2 id="comparar">Comparar versões</h2>
      <div className="filters">
        <Field id="c-from" label="De"><select id="c-from" value={from} onChange={(e) => setFrom(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <Field id="c-to" label="Para"><select id="c-to" value={to} onChange={(e) => setTo(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
      </div>
      {from === to && <p className="muted" role="status">Escolha duas versões diferentes.</p>}
      {diff.status === 'loading' && from !== to && <TableSkeleton rows={3} />}
      {diff.status === 'error' && <ErrorState error={diff.error} onRetry={reload} />}
      {d && (
        <div aria-live="polite">
          <p className="muted small">{plural(d.summary.added, 'incluído', 'incluídos')}, {plural(d.summary.removed, 'removido', 'removidos')}, {plural(d.summary.changed, 'alterado', 'alterados')}, {d.summary.moved} {d.summary.moved === 1 ? 'mudou' : 'mudaram'} de posição, {plural(d.summary.same, 'igual', 'iguais')}.{d.nameChanged ? ' O nome mudou.' : ''}{d.descriptionChanged ? ' A descrição mudou.' : ''}</p>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Diferenças entre {d.from} e {d.to}</caption>
              <thead><tr><th scope="col">Exercício</th><th scope="col">Situação</th><th scope="col">Antes</th><th scope="col">Depois</th></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={`${r.status}-${r.name}`} className={`diff-${r.status}`}>
                    <td data-label="Exercício">{r.name}</td>
                    <td data-label="Situação"><span className={`badge diff-badge-${r.status}`}>{DIFF_LABELS[r.status]}</span>{r.changes?.length > 0 && <span className="muted small"> ({r.changes.map((c) => FIELD_LABELS[c]).join(', ')})</span>}</td>
                    <td data-label="Antes">{r.before ? exLine(r.before) : <span className="muted">-</span>}</td>
                    <td data-label="Depois">{r.after ? exLine(r.after) : <span className="muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TrainingDetail() {
  const { templateId } = useParams();
  const { api, academyId, role, current } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [state, reload] = useApi(() => api.training(academyId, templateId), [api, academyId, templateId]);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!['owner', 'admin', 'coach'].includes(role)) return <Navigate to="/app" replace />;
  const back = <Link to={`/app/academia/${academyId}/fichas`} className="link">Voltar às fichas</Link>;
  if (state.status === 'loading') return <TableSkeleton rows={4} />;
  if (state.status === 'error') return <><p>{back}</p><ErrorState error={state.error} onRetry={reload} /></>;
  const { template: t, versions } = state.data;
  const active = t.status === 'active';
  const close = () => { setModal(null); setError(''); };

  const run = async (fn, ok, after) => {
    setBusy(true); setError('');
    try { const r = await fn(); toast(ok); close(); if (after) after(r); else reload(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const CONFIRMS = {
    publish: { title: `Publicar uma nova versão de "${t.name}"?`, label: 'Publicar', text: `Cria a versão ${t.currentVersion + 1} com o rascunho atual. Versões publicadas não podem ser alteradas. Quem já tem a ficha continua com a versão que recebeu até você atribuir a nova.`, fn: () => api.publishTraining(academyId, t.templateId), ok: 'Versão publicada.' },
    archive: { title: `Arquivar "${t.name}"?`, label: 'Arquivar', danger: true, text: 'A ficha deixa de aceitar novas atribuições. Quem já tem a ficha continua com ela. Você pode restaurar depois.', fn: () => api.archiveTraining(academyId, t.templateId), ok: 'Ficha arquivada.' },
    restore: { title: `Restaurar "${t.name}"?`, label: 'Restaurar', text: 'A ficha volta a aceitar edição e novas atribuições.', fn: () => api.restoreTraining(academyId, t.templateId), ok: 'Ficha restaurada.' }
  };
  const cfg = CONFIRMS[modal];

  return (
    <>
      <p>{back}</p>
      <PageHeader title={t.name} subtitle={t.description || 'Sem descrição.'}
        actions={(
          <div className="btn-row">
            {active && t.canEdit && <button type="button" className="btn" onClick={() => setModal('edit')}>Editar rascunho</button>}
            {active && t.canEdit && <button type="button" className="btn primary" disabled={!t.unpublishedChanges} onClick={() => setModal('publish')}>Publicar versão</button>}
            {active && t.currentVersion >= 1 && <button type="button" className="btn" onClick={() => setModal('assign')}>Atribuir a alunos</button>}
            {canCreateTrainings(current) && <button type="button" className="btn ghost" onClick={() => setModal('duplicate')}>Duplicar</button>}
            {t.canEdit && (active ? <button type="button" className="btn ghost danger" onClick={() => setModal('archive')}>Arquivar</button> : <button type="button" className="btn" onClick={() => setModal('restore')}>Restaurar</button>)}
          </div>
        )} />
      <p className="meta-line">
        <span className={`badge ${active ? 'status-active' : 'status-removed'}`}>{TEMPLATE_STATUS[t.status]}</span>{' '}
        <span className="muted small">{t.currentVersion === 0 ? 'Ainda sem versão publicada' : `Versão atual: ${t.currentVersion}`}{t.unpublishedChanges && t.currentVersion > 0 ? ' · há alterações não publicadas no rascunho' : ''} · criada por {t.createdByName || 'ex-membro'}</span>
      </p>
      {!t.canEdit && <p className="muted small">Você pode ver e atribuir esta ficha, mas só quem a criou, o dono e os administradores podem editá-la.</p>}

      <section className="panel" aria-labelledby="rascunho">
        <h2 id="rascunho">{t.unpublishedChanges ? 'Rascunho atual' : 'Exercícios (iguais à versão atual)'}</h2>
        <ol className="ex-read">
          {t.exercises.map((e, i) => <li key={`${e.name}-${i}`}><strong>{e.name}</strong><span className="muted">{exLine(e)}</span></li>)}
        </ol>
      </section>

      <section className="panel" aria-labelledby="versoes">
        <h2 id="versoes">Versões publicadas</h2>
        {versions.length === 0 && <EmptyState title="Nenhuma versão publicada">Publique o rascunho para criar a versão 1 e poder atribuir a alunos.</EmptyState>}
        {versions.length > 0 && (
          <ol className="timeline" reversed>
            {versions.map((v) => (
              <li key={v.version}>
                <strong>Versão {v.version}</strong>{v.version === t.currentVersion && <span className="badge status-active">Atual</span>}
                <span className="muted small">{dateTimeOf(v.createdAt)} · {v.createdByName || 'ex-membro'}{v.assignedCount !== undefined ? ` · ${plural(v.assignedCount, 'aluno', 'alunos')}` : ''}</span>
                <code className="hash" title="Impressão digital do conteúdo (SHA-256)">{v.versionHash.slice(0, 12)}</code>
              </li>
            ))}
          </ol>
        )}
      </section>

      {(versions.length >= 2 || (versions.length === 1 && t.unpublishedChanges)) && <Compare detail={state.data} key={`${versions.length}-${t.updatedAt}`} />}

      {modal === 'edit' && <TrainingEditor template={t} onClose={close} onSave={async (payload) => { await api.updateTraining(academyId, t.templateId, payload); toast('Rascunho salvo.'); close(); reload(); }} />}
      {modal === 'assign' && <AssignTrainingModal students={[]} pickStudents template={{ templateId: t.templateId, name: t.name, currentVersion: t.currentVersion }} onClose={close} onDone={() => { close(); reload(); }} />}
      {modal === 'duplicate' && <ConfirmModal title={`Duplicar "${t.name}"?`} confirmLabel="Duplicar" busy={busy} error={error} onClose={close} onConfirm={() => run(() => api.duplicateTraining(academyId, t.templateId), 'Ficha duplicada como rascunho.', (r) => navigate(`/app/academia/${academyId}/fichas/${r.templateId}`))}><p>Cria uma cópia em rascunho (sem versões e sem alunos), com o conteúdo do rascunho atual. Você será a pessoa que criou a cópia.</p></ConfirmModal>}
      {cfg && <ConfirmModal title={cfg.title} confirmLabel={cfg.label} danger={cfg.danger} busy={busy} error={error} onClose={close} onConfirm={() => run(cfg.fn, cfg.ok)}><p>{cfg.text}</p></ConfirmModal>}
    </>
  );
}
