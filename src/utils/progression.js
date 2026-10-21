// Carga sugerida por dupla progressão. A faixa de repetições da ficha ("8-12") é a régua: enquanto alguma série fica abaixo do teto, a
// meta é repetir a carga e ganhar repetições; quando TODAS as séries de trabalho com a carga mais alta batem o teto, sobe a carga e volta
// ao piso da faixa. Aquecimento e drop-set não entram na conta (carga reduzida distorceria a comparação). Só sugere: o aluno decide.
import { equipmentOf } from './equipment';

const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const fmtKg = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

/** "8-12" -> {lo:8, hi:12}; "10" -> {lo:10, hi:10}; vazio ou texto -> 8 a 12. */
export function parseRepRange(spec) {
  const s = String(spec ?? '');
  const m = s.match(/(\d+)\s*[-–a]\s*(\d+)/i);
  if (m) { const a = Number(m[1]); const b = Number(m[2]); return { lo: Math.min(a, b), hi: Math.max(a, b) }; }
  const n = parseInt(s, 10);
  return n > 0 ? { lo: n, hi: n } : { lo: 8, hi: 12 };
}

/** Salto de carga: halteres sobem de 1 em 1 kg (até 20 kg) ou 2 em 2; os demais, de 2,5 em 2,5 kg. */
export function loadStep(ex, load) {
  const eq = equipmentOf(ex);
  if (eq === 'halter') return load < 20 ? 1 : 2;
  return 2.5;
}

const roundHalf = (n) => Math.round(n * 2) / 2;

/** Carga do drop-set: cerca de 70% da carga de trabalho, em passos de 0,5 kg. */
export const dropLoad = (load) => (load > 0 ? Math.max(0.5, roundHalf(load * 0.7)) : 0);

/**
 * `historyDocs` (check-ins, do mais novo ao mais antigo), `exName`, `reps` (faixa da ficha) e `exercise` (para o equipamento).
 * Devolve null sem histórico; senão { kind: 'increase' | 'reps' | 'hold' | 'start', load, reps, text, last }.
 */
export function suggestNext({ historyDocs = [], exName, reps, exercise = {} }) {
  const doc = historyDocs.find((d) => Array.isArray(d?.exercises) && d.exercises.some((e) => e?.name === exName && Array.isArray(e.sets) && e.sets.length));
  if (!doc) return null;
  const done = doc.exercises.find((e) => e?.name === exName).sets.filter((s) => s && s.completed !== false);
  const work = done.filter((s) => s.type !== 'warmup' && s.type !== 'drop');
  const sets = work.length ? work : done.filter((s) => s.type !== 'warmup');
  if (!sets.length) return null;
  const range = parseRepRange(reps);
  const top = Math.max(...sets.map((s) => num(s.weight)));
  const atTop = sets.filter((s) => num(s.weight) === top);
  const repsAtTop = atTop.map((s) => num(s.reps));
  const minReps = Math.min(...repsAtTop);
  const maxReps = Math.max(...repsAtTop);
  const last = { load: top, minReps, maxReps, date: doc.date || null };
  if (top <= 0) return { kind: 'start', load: 0, reps: range.lo, last, text: `Sem carga registrada na última vez: defina uma carga e busque ${range.lo} a ${range.hi} repetições.` };
  if (minReps >= range.hi) {
    const next = roundHalf(top + loadStep(exercise, top));
    return { kind: 'increase', load: next, reps: range.lo, last, text: `Subir para ${fmtKg(next)} kg: na última vez você fez ${minReps} repetições ou mais em todas as séries com ${fmtKg(top)} kg. Busque ${range.lo}.` };
  }
  if (minReps >= range.lo) {
    const target = Math.min(range.hi, minReps + 1);
    return { kind: 'reps', load: top, reps: target, last, text: `Mantenha ${fmtKg(top)} kg e busque ${target} repetições em todas as séries (última vez: ${minReps}${maxReps > minReps ? ` a ${maxReps}` : ''}).` };
  }
  return { kind: 'hold', load: top, reps: range.lo, last, text: `Repita ${fmtKg(top)} kg até chegar a ${range.lo} repetições em todas as séries (última vez: ${minReps}).` };
}
