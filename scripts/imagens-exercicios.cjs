// Baixa imagens de exercícios do Free Exercise DB (domínio público, licença Unlicense) para public/exercicios/
// e liga cada uma ao exercício do Firestore (campo machineImage = caminho do próprio site).
// Uso: node scripts/imagens-exercicios.cjs          -> só baixa e mostra o plano
//      node scripts/imagens-exercicios.cjs apply    -> também grava machineImage/imageAttribution no Firestore
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const ATTRIBUTION = 'Imagem: Free Exercise DB (domínio público) — github.com/yuhonas/free-exercise-db';

// nome no BohTreinar -> id no Free Exercise DB. Só entram equivalentes diretos (mesmo equipamento e movimento).
const MAP = {
  'Supino Máquina': 'Machine_Bench_Press',
  'Chest Press Convergente': 'Leverage_Chest_Press',
  'Supino Inclinado Máquina': 'Leverage_Incline_Chest_Press',
  'Supino Declinado Máquina': 'Leverage_Decline_Chest_Press',
  'Crossover na Polia': 'Cable_Crossover',
  'Crucifixo no Cabo': 'Flat_Bench_Cable_Flyes',
  'Puxada Aberta Máquina': 'Wide-Grip_Lat_Pulldown',
  'Puxada Neutra Máquina': 'Close-Grip_Front_Lat_Pulldown',
  'Remada Articulada': 'Leverage_Iso_Row',
  'Remada Cavalinho Máquina': 'Lying_T-Bar_Row',
  'Remada Neutra Máquina': 'Leverage_High_Row',
  'Face Pull na Polia': 'Face_Pull',
  'Desenvolvimento Máquina': 'Leverage_Shoulder_Press',
  'Crucifixo Inverso Máquina': 'Reverse_Machine_Flyes',
  'Tríceps Máquina': 'Machine_Triceps_Extension',
  'Rosca Scott Máquina': 'Machine_Preacher_Curls',
  'Rosca Martelo na Polia': 'Cable_Hammer_Curls_-_Rope_Attachment',
  'Rosca Alternada Máquina': 'Machine_Bicep_Curl',
  'Hack Squat': 'Hack_Squat',
  'Cadeira Flexora': 'Seated_Leg_Curl',
  'Cadeira Extensora': 'Leg_Extensions',
  'Cadeira Adutora': 'Thigh_Adductor',
  'Cadeira Abdutora': 'Thigh_Abductor',
  'Panturrilha Sentado Máquina': 'Seated_Calf_Raise',
  'Abdominal Máquina': 'Ab_Crunch_Machine',
  'Crunch na Polia': 'Cable_Crunch'
};
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  const apply = process.argv[2] === 'apply';
  const outDir = path.resolve('public/exercicios');
  fs.mkdirSync(outDir, { recursive: true });
  const done = {};
  for (const [name, id] of Object.entries(MAP)) {
    const res = await fetch(`${BASE}/${id}/0.jpg`);
    if (!res.ok) { console.log('FALHOU', name, id, res.status); continue; }
    const file = `${slug(name)}.jpg`;
    fs.writeFileSync(path.join(outDir, file), Buffer.from(await res.arrayBuffer()));
    done[name] = `/exercicios/${file}`;
    console.log('ok', name.padEnd(30), '->', done[name]);
  }
  if (!apply) { console.log(`\n${Object.keys(done).length} imagens baixadas. Rode com "apply" para ligar no Firestore.`); return; }

  const { initializeApp, cert } = require(path.resolve('mcp/node_modules/firebase-admin/lib/app/index.js'));
  const { getFirestore } = require(path.resolve('mcp/node_modules/firebase-admin/lib/firestore/index.js'));
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
  const db = getFirestore();
  const snap = await db.collection('exercises').get();
  let linked = 0;
  for (const d of snap.docs) {
    const url = done[d.data().name];
    if (!url || d.data().machineImage) continue; // não sobrescreve imagem existente
    await d.ref.update({ machineImage: url, imageAttribution: ATTRIBUTION, updatedAt: new Date().toISOString() });
    linked += 1;
  }
  console.log(`\n${linked} exercício(s) ligado(s) a uma imagem.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
