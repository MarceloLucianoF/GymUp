import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { TOTAL_STEPS } from '../../utils/onboarding';

export function ProgressBar({ step }) {
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={step + 1}
      aria-label={`Passo ${step + 1} de ${TOTAL_STEPS}`}
      className="h-2 w-full rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden"
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ErrorAlert({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-4 py-3">
      {message}
    </p>
  );
}

// Grupo de opções com radio nativo (setas do teclado funcionam sem JS extra).
export function OptionGroup({ name, legend, value, options, onChange, columns = 'grid-cols-1' }) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={`grid gap-3 ${columns}`}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={`relative cursor-pointer rounded-2xl border-2 p-4 min-h-[56px] flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 dark:focus-within:ring-offset-brand-darkBg ${
                checked
                  ? 'border-brand bg-brand/10 shadow-sm'
                  : 'border-gray-200 dark:border-white/10 hover:border-brand/50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.emoji && <span aria-hidden="true" className="text-2xl">{o.emoji}</span>}
              <span className="flex-1">
                <span className="block font-semibold text-gray-900 dark:text-white">{o.label}</span>
                {o.hint && <span className="block text-sm text-gray-500 dark:text-gray-400">{o.hint}</span>}
              </span>
              {checked && <Check aria-hidden="true" className="w-5 h-5 text-brand" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function NumberField({ id, label, unit, value, onChange, inputMode = 'numeric', placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      <div className="flex items-center rounded-2xl border-2 border-gray-200 dark:border-white/10 focus-within:border-brand bg-white dark:bg-white/5 px-4">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          enterKeyHint="next"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(inputMode === 'decimal' ? /[^0-9.,]/g : /[^0-9]/g, '').slice(0, 5))}
          className="w-full bg-transparent py-3 text-xl font-semibold text-gray-900 dark:text-white outline-none"
        />
        <span className="text-gray-500 text-sm">{unit}</span>
      </div>
    </div>
  );
}

// Rodapé fixo em portal no body: não é afetado por transform dos passos animados.
export function FooterBar({ step, saving, onBack, onNext, nextLabel, children }) {
  const node = (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-brand-darkBg/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 0 || saving}
          className="min-h-[48px] px-5 rounded-2xl font-semibold border-2 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-40 flex items-center gap-2"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" /> Voltar
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="flex-1 min-h-[48px] rounded-2xl font-bold bg-brand text-black hover:brightness-95 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : null}
          {nextLabel}
          {!saving && <ArrowRight aria-hidden="true" className="w-4 h-4" />}
        </button>
      </div>
      {children}
    </div>
  );
  return createPortal(node, document.body);
}
