// Confere se os modelos permitidos no proxy ainda existem no catálogo público da NVIDIA.
// Uso: node scripts/check-nvidia-models.mjs   (não precisa de chave)
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../worker/src/nvidiaProxy.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('const DEFAULT_MODEL'), source.indexOf(']);', source.indexOf('const ALLOWED_MODELS')));
const wanted = [...block.matchAll(/'([^']+\/[^']+)'/g)].map((m) => m[1]);
const unique = [...new Set(wanted)];

const response = await fetch('https://integrate.api.nvidia.com/v1/models');
if (!response.ok) { console.error(`Catálogo indisponível (HTTP ${response.status})`); process.exit(2); }
const available = new Set((await response.json()).data.map((m) => m.id));

let missing = 0;
for (const id of unique) {
  const ok = available.has(id);
  if (!ok) missing += 1;
  console.log(`${ok ? 'OK    ' : 'AUSENTE'} ${id}`);
}
process.exit(missing ? 1 : 0);
