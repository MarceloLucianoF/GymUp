import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/ThemeContext';
import SwitchRow, { SwitchControl } from '../ui/Switch';
import { TEXT_SIZES, loadA11y, saveA11y } from '../../utils/a11yPrefs';

// Aparência e acessibilidade: tema, tamanho do texto, menos animação e mais contraste (valem neste aparelho).
export default function AccessibilitySettings() {
  const { theme, toggleTheme } = useTheme();
  const [prefs, setPrefs] = useState(loadA11y);
  const update = (patch) => setPrefs((p) => { const next = { ...p, ...patch }; saveA11y(next); return next; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">Tema escuro</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{theme === 'dark' ? 'Ligado: ideal para usar na academia.' : 'Desligado: visual claro.'}</p>
        </div>
        <SwitchControl label="Tema escuro" checked={theme === 'dark'} onChange={toggleTheme}>
          {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> : <Sun className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />}
        </SwitchControl>
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-gray-900 dark:text-white">Tamanho do texto</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {Object.entries(TEXT_SIZES).map(([key, label], i) => (
            <label key={key} className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-center font-bold transition ${prefs.textSize === key ? 'border-brand bg-brand/10 text-gray-900 dark:text-white' : 'border-transparent bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-gray-300'}`}>
              <input type="radio" name="text-size" value={key} checked={prefs.textSize === key} onChange={() => update({ textSize: key })} className="sr-only" />
              <span className={['text-xs', 'text-sm', 'text-base'][i]}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <SwitchRow label="Reduzir animações" hint="Tira transições e movimentos da tela." checked={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
      <SwitchRow label="Mais contraste" hint="Textos secundários mais escuros (ou mais claros no tema escuro)." checked={prefs.highContrast} onChange={(v) => update({ highContrast: v })} />
      <p className="text-xs text-gray-600 dark:text-gray-400">Estas opções valem neste aparelho.</p>
    </div>
  );
}
