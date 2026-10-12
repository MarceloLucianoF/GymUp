// Reconcilia userStats/{uid} (contador de check-ins) com a contagem real.
// Uso: node scripts/backfill-user-stats.cjs          -> só compara (não grava)
//      node scripts/backfill-user-stats.cjs apply    -> corrige o que estiver diferente e registra no adminLog
// Requer serviceAccountKey.json na raiz (nunca versionado).
const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require(path.resolve('mcp/node_modules/firebase-admin/lib/app/index.js'));
const { getFirestore } = require(path.resolve('mcp/node_modules/firebase-admin/lib/firestore/index.js'));

initializeApp({ credential: cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = getFirestore();

(async () => {
  const apply = process.argv[2] === 'apply';
  const real = {};
  (await db.collection('checkIns').get()).docs.forEach((d) => {
    const c = d.data();
    if (!c.userId) return;
    const entry = real[c.userId] || (real[c.userId] = { count: 0, lastAt: '', lastId: '' });
    entry.count += 1;
    const at = String(c.date || c.createdAt || '');
    if (at >= entry.lastAt) { entry.lastAt = at; entry.lastId = d.id; }
  });
  const statsSnap = await db.collection('userStats').get();
  const stored = {};
  statsSnap.docs.forEach((d) => { stored[d.id] = d.data(); });

  const uids = [...new Set([...Object.keys(real), ...Object.keys(stored)])].sort();
  let diffs = 0;
  console.log('uid'.padEnd(28), 'real'.padStart(5), 'contador'.padStart(9), 'situação');
  for (const uid of uids) {
    const r = real[uid]?.count || 0;
    const s = stored[uid]?.checkInCount;
    const ok = s === r || (r === 0 && s === undefined);
    if (!ok) diffs += 1;
    console.log(uid.slice(0, 28).padEnd(28), String(r).padStart(5), String(s ?? '-').padStart(9), ok ? 'ok' : 'DIFERENTE');
    if (!ok && apply) {
      if (r === 0) await db.doc(`userStats/${uid}`).delete();
      else await db.doc(`userStats/${uid}`).set({ uid, checkInCount: r, lastCheckInAt: real[uid].lastAt, lastCheckInId: real[uid].lastId });
    }
  }
  console.log(`\n${uids.length} alunos comparados, ${diffs} diferença(s).`);
  if (apply && diffs > 0) {
    await db.collection('adminLog').add({ at: new Date().toISOString(), uid: 'script-backfill', action: 'editar', target: 'userStats', targetId: '', name: 'Reconciliação dos contadores', detail: `${diffs} contador(es) corrigido(s)` });
  }
  if (!apply && diffs > 0) console.log('Rode com "apply" para corrigir.');
})().catch((e) => { console.error(e.message); process.exit(1); });
