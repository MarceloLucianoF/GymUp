import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ASSESSMENT_KINDS, BIO_FIELDS, PERIMETERS, compareAssessments } from '../../services/healthRecords';
import { PROTOCOLS } from '../../utils/bodyComposition';
import { formatDate } from '../../utils/format';

const fmt = (v, unit) => (typeof v === 'number' ? `${String(v).replace('.', ',')}${unit ? ` ${unit}` : ''}` : '-');
const asDate = (iso) => formatDate(`${String(iso).slice(0, 10)}T12:00:00`);

function Summary({ a }) {
  const bits = [];
  if (a.weight) bits.push(fmt(a.weight, 'kg'));
  if (a.bodyFat) bits.push(`${fmt(a.bodyFat)}% gordura`);
  if (a.bioimpedance?.bodyFat) bits.push(`${fmt(a.bioimpedance.bodyFat)}% (bioimp.)`);
  if (a.perimeters?.waist) bits.push(`cintura ${fmt(a.perimeters.waist, 'cm')}`);
  return <span className="block text-xs text-gray-600 dark:text-gray-400">{bits.join(' · ') || 'Sem números'}</span>;
}

// Linha do tempo das avaliações com seleção de duas para comparar lado a lado.
export default function AssessmentTimeline({ items, canDelete, onDelete }) {
  const [picked, setPicked] = useState([]);
  const [open, setOpen] = useState(null);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  const chosen = picked.map((id) => items.find((i) => i.id === id)).filter(Boolean)
    .sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const rows = chosen.length === 2 ? compareAssessments(chosen[0], chosen[1]) : [];

  if (!items.length) return <p className="text-sm text-gray-600 dark:text-gray-400">Nenhuma avaliação registrada ainda.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-gray-400 print:hidden">Marque duas avaliações para comparar.</p>
      <ol className="divide-y divide-gray-100 dark:divide-white/10">
        {items.map((a) => (
          <li key={a.id} className="py-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-brand print:hidden" checked={picked.includes(a.id)} onChange={() => toggle(a.id)}
                aria-label={`Comparar avaliação de ${asDate(a.date)}`} />
              <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="min-w-0 flex-1 text-left" aria-expanded={open === a.id}>
                <span className="block font-bold text-gray-900 dark:text-white">{asDate(a.date)} · {ASSESSMENT_KINDS[a.kind] || a.kind}</span>
                <Summary a={a} />
              </button>
              {canDelete?.(a) && (
                <button type="button" onClick={() => onDelete(a)} aria-label="Apagar avaliação"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:text-red-500 dark:text-gray-400 print:hidden">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {open === a.id && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {a.height && <><dt className="text-gray-600 dark:text-gray-400">Altura</dt><dd>{fmt(a.height, 'cm')}</dd></>}
                {a.age && <><dt className="text-gray-600 dark:text-gray-400">Idade</dt><dd>{a.age} anos</dd></>}
                {Object.entries(PERIMETERS).filter(([k]) => a.perimeters?.[k]).map(([k, label]) => (
                  <React.Fragment key={k}><dt className="text-gray-600 dark:text-gray-400">{label}</dt><dd>{fmt(a.perimeters[k], 'cm')}</dd></React.Fragment>
                ))}
                {a.skinfolds?.protocol && <><dt className="text-gray-600 dark:text-gray-400">Protocolo</dt><dd>{PROTOCOLS[a.skinfolds.protocol]?.label}</dd></>}
                {Object.entries(BIO_FIELDS).filter(([k]) => a.bioimpedance?.[k] !== undefined).map(([k, [label, unit]]) => (
                  <React.Fragment key={k}><dt className="text-gray-600 dark:text-gray-400">{label}</dt><dd>{fmt(a.bioimpedance[k], unit)}</dd></React.Fragment>
                ))}
                {a.notes && <><dt className="col-span-full text-gray-600 dark:text-gray-400">Observações</dt><dd className="col-span-full whitespace-pre-wrap">{a.notes}</dd></>}
              </dl>
            )}
          </li>
        ))}
      </ol>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="mb-2 text-left font-display text-sm font-black text-gray-900 dark:text-white">Comparação</caption>
            <thead>
              <tr className="text-left text-xs uppercase text-gray-600 dark:text-gray-400">
                <th scope="col" className="py-1 pr-2">Medida</th>
                <th scope="col" className="py-1 pr-2">{asDate(chosen[0].date)}</th>
                <th scope="col" className="py-1 pr-2">{asDate(chosen[1].date)}</th>
                <th scope="col" className="py-1">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium">{r.label}</th>
                  <td className="py-1.5 pr-2">{fmt(r.a, r.unit)}</td>
                  <td className="py-1.5 pr-2">{fmt(r.b, r.unit)}</td>
                  <td className="py-1.5 font-bold">{r.delta === null ? '-' : `${r.delta > 0 ? '+' : ''}${fmt(r.delta, r.unit)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
