import React, { useMemo, useState } from 'react';
import { ImageOff, Dumbbell } from 'lucide-react';
import Drawer from './Drawer';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../../../components/coach/styles';
import { DIFFICULTIES, MUSCLE_GROUPS, validateExerciseForm, hasNameConflict } from './adminUtils';
import { safeHttpUrl } from '../../../utils/safeUrl';

export const EMPTY_EXERCISE = {
  name: '', muscleGroup: '', difficulty: 'iniciante', sets: 3, reps: '10', rest: 60,
  description: '', execution: '', machineImage: '', videoUrl: ''
};

const Section = ({ title, hint, children }) => (
  <section className="space-y-3">
    <div>
      <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">{title}</h3>
      {hint && <p className="text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
    </div>
    {children}
  </section>
);

const Field = ({ id, label, error, children }) => (
  <div>
    <label htmlFor={id} className={labelCls}>{label}</label>
    {children}
    {error && <p role="alert" className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-400">{error}</p>}
  </div>
);

// Prévia de como o aluno vê o exercício (lista da ficha).
function StudentPreview({ form }) {
  const image = safeHttpUrl(form.machineImage);
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5" aria-label="Prévia para o aluno">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Prévia para o aluno</p>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-white/10">
          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Dumbbell className="h-7 w-7 text-gray-500" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-gray-900 dark:text-white">{form.name || 'Nome do exercício'}</p>
          <p className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">{form.muscleGroup || 'grupo'} · {form.sets || 0}x{form.reps || '-'} · {form.rest || 0}s</p>
        </div>
      </div>
    </div>
  );
}

export default function ExerciseEditor({ initial, existing, editingId, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_EXERCISE, ...initial });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const image = safeHttpUrl(form.machineImage);
  const duplicate = useMemo(() => form.name.trim() && hasNameConflict(existing, form.name, editingId), [existing, form.name, editingId]);

  const submit = async (e) => {
    e.preventDefault();
    const found = validateExerciseForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try { await onSave({ ...form, name: form.name.trim(), sets: Number(form.sets), rest: Number(form.rest) }); }
    finally { setSaving(false); }
  };

  return (
    <Drawer
      title={editingId ? 'Editar exercício' : 'Novo exercício'}
      subtitle="Preencha por blocos. A prévia mostra como o aluno verá."
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" form="exercise-form" disabled={saving} className={btnPrimary}>{saving ? 'Salvando...' : 'Salvar exercício'}</button>
        </div>
      )}
    >
      <form id="exercise-form" onSubmit={submit} noValidate className="space-y-7">
        <StudentPreview form={form} />

        <Section title="Informações básicas">
          <Field id="ex-name" label="Nome" error={errors.name}>
            <input id="ex-name" value={form.name} onChange={set('name')} className={inputCls} placeholder="Ex.: Supino Máquina" autoFocus />
          </Field>
          {duplicate && <p role="status" className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">Já existe um exercício com esse nome. Confirme se não é duplicado.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ex-group" label="Grupo muscular" error={errors.muscleGroup}>
              <select id="ex-group" value={form.muscleGroup} onChange={set('muscleGroup')} className={`${inputCls} cursor-pointer`}>
                <option value="">Selecione...</option>
                {MUSCLE_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field id="ex-diff" label="Dificuldade">
              <select id="ex-diff" value={form.difficulty} onChange={set('difficulty')} className={`${inputCls} cursor-pointer`}>
                {DIFFICULTIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Prescrição padrão" hint="Valores sugeridos quando o exercício entra numa ficha.">
          <div className="grid grid-cols-3 gap-3">
            <Field id="ex-sets" label="Séries" error={errors.sets}><input id="ex-sets" type="number" inputMode="numeric" value={form.sets} onChange={set('sets')} className={inputCls} /></Field>
            <Field id="ex-reps" label="Repetições" error={errors.reps}><input id="ex-reps" value={form.reps} onChange={set('reps')} className={inputCls} placeholder="10 ou 8-12" /></Field>
            <Field id="ex-rest" label="Descanso (s)" error={errors.rest}><input id="ex-rest" type="number" inputMode="numeric" value={form.rest} onChange={set('rest')} className={inputCls} /></Field>
          </div>
        </Section>

        <Section title="Mídia" hint="Links http(s). O vídeo abre no botão 'Ver vídeo de execução' do aluno.">
          <Field id="ex-image" label="Imagem ou GIF" error={errors.machineImage}>
            <input id="ex-image" value={form.machineImage} onChange={set('machineImage')} className={inputCls} placeholder="https://..." inputMode="url" />
          </Field>
          {form.machineImage && (
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
              {image ? <img src={image} alt="Prévia da imagem" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <ImageOff className="h-6 w-6 text-gray-500" aria-hidden="true" />}
            </div>
          )}
          <Field id="ex-video" label="Vídeo (opcional)" error={errors.videoUrl}>
            <input id="ex-video" value={form.videoUrl} onChange={set('videoUrl')} className={inputCls} placeholder="https://www.youtube.com/watch?v=..." inputMode="url" />
          </Field>
        </Section>

        <Section title="Execução">
          <Field id="ex-desc" label="Descrição"><textarea id="ex-desc" rows={2} value={form.description} onChange={set('description')} className={`${inputCls} py-3`} placeholder="O que o exercício trabalha" /></Field>
          <Field id="ex-exec" label="Passo a passo e cuidados"><textarea id="ex-exec" rows={5} value={form.execution} onChange={set('execution')} className={`${inputCls} py-3`} placeholder="Como executar, erros comuns e cuidados" /></Field>
        </Section>
      </form>
    </Drawer>
  );
}
