// Liga a mídia local (gerada por scripts/midia-exercicios.py) aos exercícios da biblioteca no Firestore.
// Uso: node scripts/midia-exercicios-aplicar.cjs          -> só mostra o plano
//      node scripts/midia-exercicios-aplicar.cjs apply    -> grava machineImage (GIF), imageStill (foto) e imageAttribution
// Antes de gravar salva um backup dos campos antigos em scripts/midia-exercicios-backup.json.
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require(path.resolve('mcp/node_modules/firebase-admin/lib/app/index.js'));
const { getFirestore } = require(path.resolve('mcp/node_modules/firebase-admin/lib/firestore/index.js'));
initializeApp({ credential: cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = getFirestore();
const ATTRIBUTION = 'Imagens: Free Exercise DB (domínio público) — github.com/yuhonas/free-exercise-db. GIF montado a partir das duas fotos do exercício.';
const apply = process.argv[2] === 'apply';

(async () => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'midia-exercicios.json'), 'utf8'));
  const snap = await db.collection('exercises').get();
  const backup = {}; let ok = 0; const faltando = [];
  for (const doc of snap.docs) {
    const d = doc.data(); const item = plan[d.name];
    if (!item) { faltando.push(d.name); continue; }
    const gif = path.join('public/exercises', `${item.slug}.gif`); const jpg = path.join('public/exercicios', `${item.slug}.jpg`);
    if (!fs.existsSync(gif) || !fs.existsSync(jpg)) { faltando.push(`${d.name} (arquivo)`); continue; }
    backup[doc.id] = { machineImage: d.machineImage || null, imageStill: d.imageStill || null, imageAttribution: d.imageAttribution || null };
    if (apply) await doc.ref.update({ machineImage: `/exercises/${item.slug}.gif`, imageStill: `/exercicios/${item.slug}.jpg`, imageAttribution: ATTRIBUTION, updatedAt: new Date().toISOString() });
    ok += 1;
  }
  if (apply) fs.writeFileSync(path.join(__dirname, 'midia-exercicios-backup.json'), JSON.stringify(backup, null, 1));
  console.log(`${apply ? 'gravados' : 'plano'}: ${ok} de ${snap.size}; sem mídia: ${faltando.length ? faltando.join(', ') : 'nenhum'}`);
  process.exit(0);
})();
