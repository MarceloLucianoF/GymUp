import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { inputCls } from '../coach/styles';

// Etapa opcional "Personalizar" do Gerador: perguntas objetivas em chips + texto livre. As respostas vão no pedido à IA
// (e o gerador local também usa ênfase, quantidade, evitar e incluir). Fechado por padrão para não alongar a tela.
export const EMPTY_PREFS = { emphasis: '', count: 0, experience: '', daysPerWeek: 0, avoid: '', include: '', notes: '' };

const EMPHASIS_BY_FOCUS = {
  'Peito e Tríceps': [['peito_superior', 'Peito superior'], ['peito_medio', 'Peito médio'], ['peito_inferior', 'Peito inferior']],
  'Costas e Bíceps': [['costas_largura', 'Largura (puxadas)'], ['costas_espessura', 'Espessura (remadas)']],
  'Ombros e ABS': [['ombro_lateral', 'Deltoide lateral'], ['ombro_posterior', 'Deltoide posterior'], ['ombro_anterior', 'Deltoide anterior']],
  'Pernas Completo': [['quadriceps', 'Quadríceps'], ['posterior', 'Posterior de coxa'], ['gluteos', 'Glúteos']]
};
const COUNTS = [[0, 'Automático'], [5, '5'], [6, '6'], [7, '7'], [8, '8']];
const LEVELS = [['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']];
const DAYS = [2, 3, 4, 5, 6].map((n) => [n, `${n} dias`]);

export const emphasisOptions = (focus) => EMPHASIS_BY_FOCUS[focus] || [];

/** Quantas respostas foram preenchidas (aparece no botão fechado para lembrar que há personalização ativa). */
export const filledCount = (v = {}) => ['emphasis', 'count', 'experience', 'daysPerWeek', 'avoid', 'include', 'notes'].filter((k) => (typeof v[k] === 'string' ? v[k].trim() : v[k])).length;

const fieldLabel = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400';
const chip = (on) => `pressable min-h-[44px] rounded-2xl px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${on ? 'bg-gradient-to-r from-brand to-[#FF9800] text-black' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100'}`;

function ChipGroup({ id, label, options, value, onPick }) {
  return (
    <div>
      <p className={fieldLabel} id={id}>{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={chip(value === v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export default function WorkoutCustomizer({ focus, value = EMPTY_PREFS, onChange, defaultExperience = '', defaultDays = 0 }) {
  const [open, setOpen] = useState(false);
  const set = (key, v) => onChange({ ...value, [key]: v });
  // Tocar de novo na opção marcada desmarca (volta ao automático / ao perfil).
  const toggle = (key) => (v) => set(key, value[key] === v ? EMPTY_PREFS[key] : v);
  const emphases = emphasisOptions(focus);
  const filled = filledCount(value);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800">
      <button type="button" aria-expanded={open} aria-controls="gen-customize" onClick={() => setOpen((o) => !o)}
        className="pressable flex min-h-[48px] w-full items-center justify-between gap-2 rounded-2xl px-4 text-left text-sm font-black text-gray-900 dark:text-white">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-amber-800 dark:text-brand" aria-hidden="true" />
          Personalizar (opcional){filled ? ` · ${filled} ${filled === 1 ? 'escolha' : 'escolhas'}` : ''}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div id="gen-customize" className="space-y-4 px-4 pb-4">
          <p className="text-xs text-gray-600 dark:text-gray-300">Responda só o que quiser: o resto o Coach decide pelo guia de treino.</p>
          {emphases.length > 0 && (
            <ChipGroup id="gen-emph" label="Ênfase" options={[['', 'Equilibrado'], ...emphases]} value={value.emphasis} onPick={(v) => set('emphasis', v)} />
          )}
          <ChipGroup id="gen-count" label="Quantos exercícios" options={COUNTS} value={value.count} onPick={(v) => set('count', v)} />
          <ChipGroup id="gen-level" label="Experiência" options={LEVELS} value={value.experience || defaultExperience} onPick={toggle('experience')} />
          <ChipGroup id="gen-days" label="Dias de treino por semana" options={DAYS} value={value.daysPerWeek || Number(defaultDays) || 0} onPick={toggle('daysPerWeek')} />
          <div>
            <label htmlFor="gen-avoid" className={fieldLabel}>Evitar exercícios</label>
            <input id="gen-avoid" type="text" maxLength={120} value={value.avoid} onChange={(e) => set('avoid', e.target.value)} placeholder="Ex.: agachamento livre, supino reto" className={inputCls} />
          </div>
          <div>
            <label htmlFor="gen-include" className={fieldLabel}>Incluir exercícios</label>
            <input id="gen-include" type="text" maxLength={120} value={value.include} onChange={(e) => set('include', e.target.value)} placeholder="Ex.: barra fixa, crossover" className={inputCls} />
          </div>
          <div>
            <label htmlFor="gen-notes" className={fieldLabel}>Algo mais para o Coach saber</label>
            <textarea id="gen-notes" rows={2} maxLength={300} value={value.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: dor no ombro direito, quero focar na parte de cima do peito" className={`${inputCls} py-3`} />
          </div>
          {filled > 0 && (
            <button type="button" onClick={() => onChange(EMPTY_PREFS)} className="min-h-[44px] text-sm font-bold text-gray-700 underline dark:text-gray-200">Limpar personalização</button>
          )}
        </div>
      )}
    </div>
  );
}
