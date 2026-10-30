import React, { useMemo, useState } from 'react';
import { BIO_FIELDS, PERIMETERS } from '../../services/healthRecords';
import { PROTOCOLS, SKINFOLD_SITES, bodyFatPercent, requiredSites } from '../../utils/bodyComposition';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../coach/styles';

// Data local (no Brasil, depois das 21h o UTC já é o dia seguinte).
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function NumField({ id, label, unit, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}{unit ? ` (${unit})` : ''}</label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

// Formulário de avaliação física (aluno: própria ou bioimpedância; professor: avaliação do instrutor).
// Os valores saem como texto; healthRecords.buildAssessment converte, limita e calcula o % de gordura.
export default function AssessmentForm({ kinds, defaults = {}, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState({
    kind: kinds[0], date: today(), sex: defaults.sex || '', age: defaults.age ?? '', weight: defaults.weight ?? '', height: defaults.height ?? '',
    perimeters: {}, skinfolds: { protocol: '' }, bioimpedance: {}, notes: ''
  });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setIn = (group, key, value) => setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));

  const protocol = form.skinfolds.protocol;
  const sites = protocol ? (form.sex ? requiredSites(protocol, form.sex) : PROTOCOLS[protocol].male) : [];
  const fat = useMemo(() => (protocol && form.sex
    ? bodyFatPercent({ protocol, sex: form.sex, age: form.age, skinfolds: form.skinfolds }) : null), [protocol, form.sex, form.age, form.skinfolds]);
  const showBio = form.kind === 'bioimpedance';
  const showFolds = form.kind !== 'bioimpedance';

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, skinfolds: showFolds ? form.skinfolds : {}, bioimpedance: showBio ? form.bioimpedance : {} });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {kinds.length > 1 && (
          <div>
            <label htmlFor="as-kind" className={labelCls}>Tipo</label>
            <select id="as-kind" value={form.kind} onChange={(e) => set('kind', e.target.value)} className={inputCls}>
              {kinds.map((k) => <option key={k} value={k}>{k === 'self' ? 'Avaliação própria (medidas e dobras)' : 'Bioimpedância (balança)'}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="as-date" className={labelCls}>Data</label>
          <input id="as-date" type="date" required max={today()} value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="as-sex" className={labelCls}>Sexo (para o cálculo)</label>
          <select id="as-sex" value={form.sex} onChange={(e) => set('sex', e.target.value)} className={inputCls}>
            <option value="">Não informar</option>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
        <NumField id="as-age" label="Idade" unit="anos" value={form.age} onChange={(v) => set('age', v)} />
        <NumField id="as-weight" label="Peso" unit="kg" value={form.weight} onChange={(v) => set('weight', v)} />
        <NumField id="as-height" label="Altura" unit="cm" value={form.height} onChange={(v) => set('height', v)} />
      </div>

      <fieldset>
        <legend className="mb-2 font-display text-sm font-black text-gray-900 dark:text-white">Perímetros (cm)</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(PERIMETERS).map(([k, label]) => (
            <NumField key={k} id={`as-p-${k}`} label={label} value={form.perimeters[k]} onChange={(v) => setIn('perimeters', k, v)} />
          ))}
        </div>
      </fieldset>

      {showFolds && (
        <fieldset>
          <legend className="mb-2 font-display text-sm font-black text-gray-900 dark:text-white">Dobras cutâneas (mm)</legend>
          <label htmlFor="as-protocol" className={labelCls}>Protocolo</label>
          <select id="as-protocol" value={protocol} onChange={(e) => setIn('skinfolds', 'protocol', e.target.value)} className={inputCls}>
            <option value="">Sem dobras</option>
            {Object.entries(PROTOCOLS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
          {protocol && !form.sex && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Informe o sexo e a idade para calcular o % de gordura.</p>}
          {protocol && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sites.map((k) => (
                <NumField key={k} id={`as-s-${k}`} label={SKINFOLD_SITES[k]} value={form.skinfolds[k]} onChange={(v) => setIn('skinfolds', k, v)} />
              ))}
            </div>
          )}
          {protocol && (
            <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white" aria-live="polite">
              Gordura estimada: {fat !== null ? `${fat}%` : 'preencha as dobras, o sexo e a idade'}
            </p>
          )}
        </fieldset>
      )}

      {showBio && (
        <fieldset>
          <legend className="mb-2 font-display text-sm font-black text-gray-900 dark:text-white">Bioimpedância</legend>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(BIO_FIELDS).map(([k, [label, unit]]) => (
              <NumField key={k} id={`as-b-${k}`} label={label} unit={unit} value={form.bioimpedance[k]} onChange={(v) => setIn('bioimpedance', k, v)} />
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="as-notes" className={labelCls}>Observações</label>
        <textarea id="as-notes" rows={3} maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${inputCls} py-3`} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={btnGhost}>Cancelar</button>}
        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Salvando...' : 'Salvar avaliação'}</button>
      </div>
    </form>
  );
}
