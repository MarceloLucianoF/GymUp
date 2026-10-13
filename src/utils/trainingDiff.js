// Comparação entre duas versões de uma ficha (ou versão x rascunho). Função pura: não lê nada do banco.
// Os exercícios são casados pelo nome normalizado; a ordem só é avaliada entre os exercícios que existem nos dois lados.

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const FIELDS = [['sets', 'Séries'], ['reps', 'Repetições'], ['rest', 'Descanso (s)']];

// Casa por nome; nomes repetidos recebem um sufixo de ocorrência para não colidirem.
function keyed(list) {
  const seen = {};
  return (list || []).map((e, i) => {
    const base = norm(e?.name);
    seen[base] = (seen[base] || 0) + 1;
    return { key: `${base}#${seen[base]}`, ex: e || {}, pos: i + 1 };
  });
}

// Maior subsequência comum: os exercícios fora dela são os que mudaram de lugar (o mínimo de movimentos explicáveis).
function lcsKeys(a, b) {
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const keep = new Set();
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { keep.add(a[i]); i += 1; j += 1; } else if (t[i + 1][j] >= t[i][j + 1]) i += 1; else j += 1;
  }
  return keep;
}

export function diffVersions(from, to) {
  const A = keyed(from?.exercises);
  const B = keyed(to?.exercises);
  const inA = new Map(A.map((x) => [x.key, x]));
  const inB = new Map(B.map((x) => [x.key, x]));
  const added = B.filter((x) => !inA.has(x.key)).map((x) => ({ name: x.ex.name, position: x.pos, sets: x.ex.sets, reps: x.ex.reps, rest: x.ex.rest }));
  const removed = A.filter((x) => !inB.has(x.key)).map((x) => ({ name: x.ex.name, position: x.pos }));
  const commonA = A.filter((x) => inB.has(x.key)).map((x) => x.key);
  const commonB = B.filter((x) => inA.has(x.key)).map((x) => x.key);
  const stay = lcsKeys(commonA, commonB);
  const moved = commonA.filter((k) => !stay.has(k)).map((k) => ({ name: inA.get(k).ex.name, from: inA.get(k).pos, to: inB.get(k).pos }));
  const changed = [];
  for (const k of commonA) {
    const x = inA.get(k).ex; const y = inB.get(k).ex;
    const changes = FIELDS.filter(([f]) => String(x[f] ?? '') !== String(y[f] ?? '')).map(([f, label]) => ({ field: f, label, from: String(x[f] ?? ''), to: String(y[f] ?? '') }));
    if (changes.length) changed.push({ name: y.name, changes });
  }
  const nameChange = String(from?.name || '') !== String(to?.name || '') ? { from: from?.name || '', to: to?.name || '' } : null;
  const descriptionChange = String(from?.description || '') !== String(to?.description || '') ? { from: from?.description || '', to: to?.description || '' } : null;
  return { nameChange, descriptionChange, added, removed, moved, changed, identical: !nameChange && !descriptionChange && !added.length && !removed.length && !moved.length && !changed.length };
}
