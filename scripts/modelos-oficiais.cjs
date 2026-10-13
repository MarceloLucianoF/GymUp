// Cria/atualiza os MODELOS OFICIAIS globais (scope "official") em trainingTemplates, a partir de src/data/officialTemplates.json.
// Só a conta admin da plataforma mantém os modelos (as regras negam escrita a todos os outros).
// Uso: node scripts/modelos-oficiais.cjs          -> valida e mostra o plano
//      node scripts/modelos-oficiais.cjs apply    -> grava em trainingTemplates/{id}
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require(path.resolve('mcp/node_modules/firebase-admin/lib/app/index.js'));
const { getFirestore } = require(path.resolve('mcp/node_modules/firebase-admin/lib/firestore/index.js'));
initializeApp({ credential: cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = getFirestore();
const apply = process.argv[2] === 'apply';

// exercícios padrão embutidos no app (literais JS): lidos do arquivo, sem executar o app
const defaultsSrc = fs.readFileSync('src/data/exercises.js', 'utf8').replace(/export const exercises\s*=/, 'return ');
const defaults = new Function(defaultsSrc)();
const norm = (s) => String(s || '').trim().toLowerCase();

(async () => {
  const templates = JSON.parse(fs.readFileSync('src/data/officialTemplates.json', 'utf8'));
  const snap = await db.collection('exercises').get();
  const lib = [...snap.docs.map((d) => d.data()), ...defaults.filter((d) => !snap.docs.some((x) => norm(x.data().name) === norm(d.name)))];
  const byName = new Map(lib.map((e) => [norm(e.name), e]));
  const faltando = [];
  const docs = templates.map((t) => ({
    id: t.id,
    data: {
      scope: 'official', order: t.order, focus: t.focus, name: t.name, description: t.description,
      exercises: t.exercises.map((e) => {
        const base = byName.get(norm(e.name));
        if (!base) { faltando.push(`${t.name}: ${e.name}`); return null; }
        return { name: base.name, muscleGroup: String(base.muscleGroup || ''), sets: String(e.sets), reps: String(e.reps), rest: Math.round(Number(e.rest) || 0), machineImage: String(base.machineImage || '') };
      }),
      updatedAt: new Date().toISOString(), updatedBy: 'script:modelos-oficiais'
    }
  }));
  if (faltando.length) { console.error('Exercícios que não existem na biblioteca:\n - ' + faltando.join('\n - ')); process.exit(1); }
  for (const d of docs) {
    console.log(`${apply ? 'gravando' : 'plano'}: ${d.id} (${d.data.exercises.length} exercícios): ${d.data.exercises.map((e) => e.name).join(' | ')}`);
    if (apply) await db.doc(`trainingTemplates/${d.id}`).set(d.data);
  }
  console.log(apply ? 'modelos gravados' : 'nada gravado (use apply)');
  process.exit(0);
})();
