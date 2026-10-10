import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Calculator, Disc, ArrowLeftRight, Timer, HeartPulse } from 'lucide-react';
import PlatesVisual from '../../components/tools/PlatesVisual';
import { useRestTimer } from '../../hooks/useRestTimer';
import {
    epley1RM, brzycki1RM, percentTable, calcPlates, PLATES, kgToLb, lbToKg,
    calcBMI, bmiCategory, dailyWaterMl, formatClock
} from '../../utils/tools';

const fieldClass = 'w-full rounded-xl bg-gray-100 dark:bg-white/5 px-3 py-3 text-lg font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand min-h-[48px]';
const labelClass = 'block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1';
const cardClass = 'surface p-4 space-y-4';

const Field = ({ label, value, onChange, placeholder, step }) => (
    <label className="block">
        <span className={labelClass}>{label}</span>
        <input type="number" inputMode="decimal" min="0" step={step || 'any'} value={value} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
);

const Result = ({ children }) => (
    <div className="rounded-2xl bg-brand/10 border border-brand/30 p-4 text-center text-gray-900 dark:text-white">{children}</div>
);

const OneRm = () => {
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const ep = epley1RM(weight, reps);
    const br = brzycki1RM(weight, reps);
    const base = ep && br ? (ep + br) / 2 : ep || br;
    const table = percentTable(base);
    return (
        <div className={cardClass}>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Carga (kg)" value={weight} onChange={setWeight} placeholder="ex.: 80" />
                <Field label="Repetições" value={reps} onChange={setReps} step="1" placeholder="ex.: 8" />
            </div>
            {base > 0 ? (
                <>
                    <Result>
                        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">1RM estimado</p>
                        <p className="text-3xl font-black text-brand">{(Math.round(base * 10) / 10).toString().replace('.', ',')} kg</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Epley {ep} kg | Brzycki {br || '-'} kg</p>
                    </Result>
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400"><th className="py-1">% do 1RM</th><th className="py-1 text-right">Carga</th></tr></thead>
                        <tbody>
                            {table.map(r => (
                                <tr key={r.pct} className="border-t border-gray-100 dark:border-white/10 text-gray-900 dark:text-white">
                                    <td className="py-2 font-bold">{r.pct}%</td>
                                    <td className="py-2 text-right font-mono">{r.weight} kg</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ) : <p className="text-sm text-gray-500 dark:text-gray-400">Informe carga e repetições (use séries de até 36 repetições).</p>}
        </div>
    );
};

const Plates = () => {
    const [target, setTarget] = useState('');
    const [bar, setBar] = useState('20');
    const res = calcPlates(target, bar);
    return (
        <div className={cardClass}>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Carga total (kg)" value={target} onChange={setTarget} placeholder="ex.: 100" />
                <Field label="Barra (kg)" value={bar} onChange={setBar} />
            </div>
            {res.valid ? (
                <>
                    <Result>
                        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Por lado</p>
                        <p className="text-xl font-black text-brand">{res.perSide.length ? res.perSide.join(' + ') + ' kg' : 'Só a barra'}</p>
                        {res.remainder > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Não fecha exato: faltam {res.remainder} kg por lado. Carga montada: {res.total} kg.
                            </p>
                        )}
                    </Result>
                    <PlatesVisual perSide={res.perSide} />
                </>
            ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {res.reason === 'below-bar' ? `A carga é menor que a barra (${bar} kg).` : 'Informe a carga total.'}
                </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">Anilhas: {PLATES.join(' / ')} kg.</p>
        </div>
    );
};

const Converter = () => {
    const [kg, setKg] = useState('');
    const [lb, setLb] = useState('');
    return (
        <div className={cardClass}>
            <Field label="Quilos (kg)" value={kg} onChange={(v) => { setKg(v); setLb(v === '' ? '' : String(kgToLb(v))); }} />
            <Field label="Libras (lb)" value={lb} onChange={(v) => { setLb(v); setKg(v === '' ? '' : String(lbToKg(v))); }} />
        </div>
    );
};

const RunningTimer = ({ endTime, duration, onStop, onAdjust }) => {
    const { remaining, isPaused, togglePause } = useRestTimer({
        endTime, onAdjust, onFinish: () => { toast.success('Descanso concluído!'); onStop(); }
    });
    return (
        <Result>
            <p className="text-5xl font-black font-mono text-brand" aria-live="off">{formatClock(remaining)}</p>
            <div className="mt-3 flex justify-center gap-3">
                <button type="button" onClick={togglePause} className="min-h-[44px] px-5 rounded-xl border border-brand/40 text-brand font-black">{isPaused ? 'Retomar' : 'Pausar'}</button>
                <button type="button" onClick={onStop} className="min-h-[44px] px-5 rounded-xl bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 font-black">Parar</button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">de {formatClock(duration)}</p>
        </Result>
    );
};

const FreeTimer = () => {
    const [timer, setTimer] = useState(null);
    const [custom, setCustom] = useState('');
    const start = (sec) => {
        if (sec > 0) setTimer({ endTime: Date.now() + sec * 1000, duration: sec });
    };
    return (
        <div className={cardClass}>
            {timer ? (
                <RunningTimer {...timer} onStop={() => setTimer(null)}
                    onAdjust={(ms) => setTimer(t => (t ? { ...t, endTime: t.endTime + ms } : t))} />
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-2">
                        {[30, 60, 90, 120].map(s => (
                            <button key={s} type="button" onClick={() => start(s)} className="min-h-[56px] rounded-2xl bg-brand/10 border border-brand/30 text-brand font-black active:scale-95 transition-all">{s}s</button>
                        ))}
                    </div>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1"><Field label="Personalizado (segundos)" value={custom} onChange={setCustom} step="1" /></div>
                        <button type="button" onClick={() => start(Math.floor(Number(custom)))} disabled={!(Number(custom) > 0)}
                            className="min-h-[48px] px-5 rounded-xl bg-brand text-black font-black disabled:opacity-40">Iniciar</button>
                    </div>
                </>
            )}
        </div>
    );
};

const Health = () => {
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const bmi = calcBMI(weight, height);
    const water = dailyWaterMl(weight);
    return (
        <div className={cardClass}>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Peso (kg)" value={weight} onChange={setWeight} />
                <Field label="Altura (cm)" value={height} onChange={setHeight} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Result>
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">IMC</p>
                    <p className="text-2xl font-black text-brand">{bmi ? String(bmi).replace('.', ',') : '-'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{bmiCategory(bmi)}</p>
                </Result>
                <Result>
                    <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Água/dia</p>
                    <p className="text-2xl font-black text-brand">{water ? `${(water / 1000).toFixed(2).replace('.', ',')} L` : '-'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">35 ml por kg</p>
                </Result>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Estimativas gerais; não substituem orientação profissional.</p>
        </div>
    );
};

const TABS = [
    { id: '1rm', label: '1RM', icon: Calculator, Component: OneRm },
    { id: 'plates', label: 'Anilhas', icon: Disc, Component: Plates },
    { id: 'convert', label: 'kg/lb', icon: ArrowLeftRight, Component: Converter },
    { id: 'timer', label: 'Timer', icon: Timer, Component: FreeTimer },
    { id: 'health', label: 'Saúde', icon: HeartPulse, Component: Health },
];

export default function Tools() {
    const [tab, setTab] = useState('1rm');
    const Active = TABS.find(t => t.id === tab).Component;
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] pb-28">
            <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Ferramentas</h1>
                <div role="tablist" aria-label="Ferramentas" className="flex gap-2 overflow-x-auto pb-1">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                            className={`min-h-[44px] shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 text-sm font-black transition-all ${tab === id ? 'bg-brand text-black' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
                            <Icon className="w-4 h-4" aria-hidden="true" /> {label}
                        </button>
                    ))}
                </div>
                <div role="tabpanel"><Active /></div>
            </div>
        </div>
    );
}
