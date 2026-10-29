import React, { useId } from 'react';

// Interruptor do app (mesmo desenho do "Alternar tema" do Perfil): trilho arredondado, amarelo quando ligado, alvo de toque >= 44px.
export function SwitchControl({ checked, onChange, disabled = false, label, labelledBy, className = '', children }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out before:absolute before:-inset-2 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0F19] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${checked ? 'bg-brand' : 'bg-gray-300 dark:bg-white/15'} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out motion-reduce:transition-none ${checked ? 'translate-x-6' : 'translate-x-0'}`}
      >
        {children}
      </span>
    </button>
  );
}

// Linha de configuração: texto à esquerda (com dica opcional) e o interruptor à direita.
export default function SwitchRow({ label, hint, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-bold text-gray-800 dark:text-white">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
      </div>
      <SwitchControl checked={checked} onChange={onChange} disabled={disabled} labelledBy={`${id}-label`} />
    </div>
  );
}
