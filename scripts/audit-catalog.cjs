#!/usr/bin/env node
// Auditoria do catálogo de exercícios (embutido + Firestore). Só LÊ: não grava nada e não usa credenciais.
// Uso: node scripts/audit-catalog.cjs [--remote exercicios.json] [--out relatorio.md] [--json]
//   --remote  arquivo JSON com os exercícios do Firestore (lista, ou objeto com a chave "ex"). Exporte pelo painel do treinador ou
//             pelo MCP do projeto (list_exercises). Sem ele, audita só a biblioteca embutida.
// Sai com código 1 se houver erro (repetição zero, grupo desconhecido, sem nome), para uso em CI.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');

const root = path.join(__dirname, '..');
const cache = new Map();
// Carrega módulos ESM de src/ transformando com o Babel do projeto (nada é gravado em disco).
function load(file) {
  const abs = file.endsWith('.js') ? file : `${file}.js`;
  if (cache.has(abs)) return cache.get(abs).exports;
  const code = babel.transformFileSync(abs, { presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }]], babelrc: false, configFile: false }).code;
  const mod = new Module(abs); mod.filename = abs; mod.paths = Module._nodeModulePaths(path.dirname(abs));
  mod.require = (req) => (req.startsWith('.') ? load(path.resolve(path.dirname(abs), req)) : require(req));
  cache.set(abs, mod);
  mod._compile(code, abs);
  return mod.exports;
}

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const { auditCatalog, auditTrainings, GROUP_LABELS } = load(path.join(root, 'src/utils/exerciseCatalog'));
const { exercises: embedded } = load(path.join(root, 'src/data/exercises'));

let remote = [];
let trainings = [];
if (opt('--remote')) {
  const raw = JSON.parse(fs.readFileSync(opt('--remote'), 'utf8'));
  remote = Array.isArray(raw) ? raw : (raw.ex || raw.exercises || []);
  trainings = Array.isArray(raw) ? [] : (raw.tr || raw.trainings || []);   // a exportação pode trazer as fichas junto (chave tr/trainings)
}
const { issues, totals, merged } = auditCatalog(embedded, remote);
const trainingIssues = auditTrainings(trainings, merged, remote);
issues.push(...trainingIssues.filter((i) => i.level === 'erro'));

if (args.includes('--json')) { console.log(JSON.stringify({ totals, issues }, null, 2)); process.exit(issues.some((i) => i.level === 'erro') ? 1 : 0); }

const by = (level) => issues.filter((i) => i.level === level);
const group = (list) => list.reduce((o, i) => { (o[i.code] = o[i.code] || []).push(i); return o; }, {});
const table = (o, labels = {}) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${labels[k] || k} | ${v} |`).join('\n');
const lines = [];
lines.push('# Auditoria do catálogo de exercícios', '');
lines.push(`Gerada por \`node scripts/audit-catalog.cjs${opt('--remote') ? ' --remote <exportação do Firestore>' : ''}\`. Só lê; nada é alterado.`, '');
lines.push('## Totais', '', `- Biblioteca embutida: ${totals.embutidos}`, `- Firestore: ${remote.length ? totals.firestore : 'não informado (use --remote)'}`, `- Catálogo final (sem repetir nome): **${totals.unicos}**`);
if (remote.length) lines.push(`- Em ambas as fontes: ${totals.emAmbas}; só no Firestore: ${totals.soNoFirestore}`);
lines.push('', '| Grupo | Exercícios |', '| --- | --- |', table(totals.porGrupo, GROUP_LABELS), '', '| Equipamento principal | Exercícios |', '| --- | --- |', table(totals.porEquipamento), '', '| Tipo | Exercícios |', '| --- | --- |', table(totals.porTipo), '', '| Dificuldade | Exercícios |', '| --- | --- |', table(totals.porDificuldade), '');
for (const [level, title] of [['erro', 'Erros (quebram o uso)'], ['aviso', 'Avisos (corrigir)'], ['info', 'Informações']]) {
  const list = by(level);
  lines.push(`## ${title}: ${list.length}`, '');
  if (!list.length) { lines.push('Nenhum.', ''); continue; }
  for (const [code, items] of Object.entries(group(list))) {
    lines.push(`### ${code} (${items.length})`, '');
    items.slice(0, level === 'info' ? 6 : 40).forEach((i) => lines.push(`- ${i.name} [${i.source}]${i.detail ? `: ${i.detail}` : ''}`));
    if (items.length > (level === 'info' ? 6 : 40)) lines.push(`- ... e mais ${items.length - (level === 'info' ? 6 : 40)}`);
    lines.push('');
  }
}
if (trainings.length) {
  lines.push(`## Fichas na loja: ${trainingIssues.length} achados em ${trainings.length} fichas`, '');
  const g = group(trainingIssues);
  if (!trainingIssues.length) lines.push('Nenhum.', '');
  Object.entries(g).forEach(([code, items]) => { lines.push(`### ${code} (${items.length})`, ''); items.forEach((i) => lines.push(`- ${i.name}${i.detail ? `: ${i.detail}` : ''}`)); lines.push(''); });
}
lines.push('## Catálogo final', '', '| Nome | Grupo | Equipamento | Tipo | Dificuldade | Fontes |', '| --- | --- | --- | --- | --- | --- |');
merged.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)).forEach((e) => lines.push(`| ${e.name} | ${GROUP_LABELS[e.group] || e.group} | ${e.equipment.join('/')} | ${e.kind} | ${e.difficulty || '?'} | ${e.sources.join('+')} |`));
const out = lines.join('\n') + '\n';
if (opt('--out')) { fs.writeFileSync(opt('--out'), out); console.log(`Relatório gravado em ${opt('--out')}: ${by('erro').length} erros, ${by('aviso').length} avisos, ${by('info').length} informações.`); } else console.log(out);
process.exit(by('erro').length ? 1 : 0);
