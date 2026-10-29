import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ANAMNESIS_TEXTS, PARQ_QUESTIONS, parqNeedsClearance } from '../../services/healthRecords';
import { formatDate } from '../../utils/format';
import { btnGhost, btnPrimary, inputCls, labelCls } from '../coach/styles';

export function ClearanceWarning() {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-500/15 p-3 text-sm font-bold text-amber-800 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      Você respondeu "sim" a alguma pergunta do PAR-Q: procure liberação médica antes de começar ou aumentar a intensidade dos treinos.
    </p>
  );
}

// Anamnese com PAR-Q (7 perguntas sim/não). Começa com as respostas da última versão; salvar cria uma versão nova.
export function AnamnesisForm({ initial, onSave, onCancel, saving = false }) {
  const [parq, setParq] = useState(() => PARQ_QUESTIONS.map((_, i) => initial?.parq?.[i] === true));
  const [texts, setTexts] = useState(() => Object.fromEntries(Object.keys(ANAMNESIS_TEXTS).map((k) => [k, initial?.[k] || ''])));
  const setAnswer = (i, value) => setParq((p) => p.map((x, j) => (j === i ? value : x)));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ parq, ...texts }); }} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-1 font-display text-sm font-black text-gray-900 dark:text-white">PAR-Q: prontidão para atividade física</legend>
        {PARQ_QUESTIONS.map((q, i) => (
          <div key={q} role="radiogroup" aria-labelledby={`parq-${i}`} className="rounded-2xl bg-gray-100 p-3 dark:bg-white/5">
            <p id={`parq-${i}`} className="text-sm text-gray-900 dark:text-white">{i + 1}. {q}</p>
            <div className="mt-2 flex gap-4">
              {[[false, 'Não'], [true, 'Sim']].map(([value, label]) => (
                <label key={label} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold">
                  <input type="radio" name={`parq-${i}`} className="h-5 w-5 accent-brand" checked={parq[i] === value} onChange={() => setAnswer(i, value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {parqNeedsClearance(parq) && <ClearanceWarning />}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(ANAMNESIS_TEXTS).map(([k, label]) => (
          <div key={k}>
            <label htmlFor={`an-${k}`} className={labelCls}>{label}</label>
            <textarea id={`an-${k}`} rows={2} maxLength={1000} value={texts[k]} onChange={(e) => setTexts((t) => ({ ...t, [k]: e.target.value }))}
              className={`${inputCls} py-3`} placeholder={k === 'routine' ? 'Trabalho, sono, outras atividades' : 'Se não houver, deixe em branco'} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={btnGhost}>Cancelar</button>}
        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Salvando...' : 'Salvar anamnese'}</button>
      </div>
    </form>
  );
}

export function AnamnesisView({ anamnesis }) {
  if (!anamnesis) return <p className="text-sm text-gray-600 dark:text-gray-400">Nenhuma anamnese preenchida.</p>;
  const yes = PARQ_QUESTIONS.filter((_, i) => anamnesis.parq?.[i] === true);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-gray-600 dark:text-gray-400">Versão {anamnesis.version} · {formatDate(anamnesis.createdAt)}</p>
      {parqNeedsClearance(anamnesis.parq) ? (
        <>
          <ClearanceWarning />
          <ul className="list-disc space-y-1 pl-5">{yes.map((q) => <li key={q}>{q}</li>)}</ul>
        </>
      ) : <p className="font-bold text-emerald-700 dark:text-emerald-400">PAR-Q: "não" para todas as perguntas.</p>}
      <dl className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ANAMNESIS_TEXTS).map(([k, label]) => (
          <div key={k}>
            <dt className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">{label}</dt>
            <dd className="whitespace-pre-wrap text-gray-900 dark:text-white">{anamnesis[k] || '-'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
