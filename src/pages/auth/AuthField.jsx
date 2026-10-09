import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const inputClass = 'w-full px-4 min-h-[52px] rounded-2xl bg-gray-50 dark:bg-white/5 border text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all';

// Campo de formulário acessível: label ligado por htmlFor/id, erro com role="alert",
// aria-invalid/aria-describedby e (opcional) botão de visibilidade com aria-pressed.
const AuthField = forwardRef(function AuthField(
  { label, error, hint, type = 'text', passwordToggle = false, labelAside = null, className = '', ...rest },
  ref
) {
  const uid = useId();
  const id = `${uid}-field`;
  const errId = `${uid}-error`;
  const hintId = `${uid}-hint`;
  const [visible, setVisible] = useState(false);
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2 gap-2">
        <label htmlFor={id} className="text-sm font-bold text-gray-700 dark:text-gray-300">{label}</label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={passwordToggle ? (visible ? 'text' : 'password') : type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${error ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} ${passwordToggle ? 'pr-12' : ''}`}
          {...rest}
        />
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label="Mostrar senha"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {visible ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      <p id={errId} role="alert" aria-live="assertive" className={error ? 'mt-1.5 text-sm font-medium text-red-500' : 'sr-only'}>
        {error || ''}
      </p>
    </div>
  );
});

export default AuthField;
