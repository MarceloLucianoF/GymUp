import React, { useState } from 'react';
import { LIMITS } from '../../../shared/academy-contracts/index.js';
import { friendlyError } from '../api';
import { emptyExercise, fromTemplate, emptyDraft, hasErrors, move, toPayload, validateDraft } from '../lib/trainings';
import Modal from './Modal';
import { Field } from './ui';

// Criar ou editar o RASCUNHO de uma ficha. Versões publicadas não mudam; publicar é um passo à parte.
export default function TrainingEditor({ template, onSave, onClose }) {
  const [draft, setDraft] = useState(() => (template ? fromTemplate(template) : emptyDraft()));
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setEx = (i, patch) => setDraft((d) => ({ ...d, exercises: d.exercises.map((e, k) => (k === i ? { ...e, ...patch } : e)) }));
  const view = errors || { name: '', description: '', exercises: {}, list: '' };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true); setServerError('');
    try { await onSave(toPayload(draft)); } catch (err) { setServerError(friendlyError(err)); setBusy(false); }
  };

  return (
    <Modal title={template ? 'Editar rascunho' : 'Nova ficha'} onClose={onClose} busy={busy} wide>
      <form onSubmit={submit} className="stack" noValidate>
        <p className="muted">{template ? 'As versões já publicadas não mudam. Depois de editar, publique uma nova versão.' : 'A ficha nasce como rascunho. Publique para criar a versão 1 e poder atribuir a alunos.'}</p>
        <Field id="t-name" label="Nome da ficha" error={view.name}><input id="t-name" value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!view.name} data-autofocus /></Field>
        <Field id="t-desc" label="Descrição (opcional)" hint={`${draft.description.length}/300`} error={view.description}><textarea id="t-desc" rows={2} maxLength={300} value={draft.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <h3 className="h-small">Exercícios ({draft.exercises.length}/{LIMITS.exercisesMax})</h3>
        {view.list && <p role="alert" className="error">{view.list}</p>}
        <ol className="ex-list">
          {draft.exercises.map((ex, i) => (
            <li key={i}>
              <fieldset className="ex">
                <legend>Exercício {i + 1}</legend>
                <div className="ex-grid">
                  <Field id={`e${i}-name`} label="Nome"><input id={`e${i}-name`} value={ex.name} maxLength={120} onChange={(e) => setEx(i, { name: e.target.value })} aria-invalid={!!view.exercises[i]} /></Field>
                  <Field id={`e${i}-group`} label="Grupo (opcional)"><input id={`e${i}-group`} value={ex.muscleGroup} maxLength={40} onChange={(e) => setEx(i, { muscleGroup: e.target.value })} /></Field>
                  <Field id={`e${i}-sets`} label="Séries"><input id={`e${i}-sets`} value={ex.sets} maxLength={10} onChange={(e) => setEx(i, { sets: e.target.value })} /></Field>
                  <Field id={`e${i}-reps`} label="Repetições"><input id={`e${i}-reps`} value={ex.reps} maxLength={20} onChange={(e) => setEx(i, { reps: e.target.value })} /></Field>
                  <Field id={`e${i}-rest`} label="Descanso (s)"><input id={`e${i}-rest`} type="number" min={0} max={300} inputMode="numeric" value={ex.rest} onChange={(e) => setEx(i, { rest: e.target.value })} /></Field>
                </div>
                {view.exercises[i] && <p role="alert" className="error">{view.exercises[i]}</p>}
                <div className="ex-actions">
                  <button type="button" className="btn ghost" disabled={i === 0} onClick={() => set({ exercises: move(draft.exercises, i, i - 1) })} aria-label={`Subir exercício ${i + 1}`}>Subir</button>
                  <button type="button" className="btn ghost" disabled={i === draft.exercises.length - 1} onClick={() => set({ exercises: move(draft.exercises, i, i + 1) })} aria-label={`Descer exercício ${i + 1}`}>Descer</button>
                  <button type="button" className="btn ghost danger" disabled={draft.exercises.length === 1} onClick={() => set({ exercises: draft.exercises.filter((_, k) => k !== i) })} aria-label={`Remover exercício ${i + 1}`}>Remover</button>
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <button type="button" className="btn" disabled={draft.exercises.length >= LIMITS.exercisesMax} onClick={() => set({ exercises: [...draft.exercises, emptyExercise()] })}>Adicionar exercício</button>
        {serverError && <p role="alert" className="error">{serverError}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Salvando...' : template ? 'Salvar rascunho' : 'Criar ficha'}</button>
        </div>
      </form>
    </Modal>
  );
}
