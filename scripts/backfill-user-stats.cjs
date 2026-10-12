// Reconcilia userStats/{uid} (contador de check-ins e consistência semanal) com a contagem real.
// Uso: node scripts/backfill-user-stats.cjs          -> só compara (não grava)
//      node scripts/backfill-user-stats.cjs apply    -> corrige o que estiver diferente e registra no adminLog
// Requer serviceAccountKey.json na raiz (nunca versionado).
const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require(path.resolve('mcp/node_modules/firebase-admin/lib/app/index.js'));
const { getFirestore } = require(path.resolve('mcp/node_modules/firebase-admin/lib/firestore/index.js'));

initializeApp({ credential: cert(JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'))) });
const db = getFirestore();

// Dia e semana ISO no fuso de Brasília (o app é usado lá), iguais a src/utils/consistency.js.
const TZ = 'America/Sao_Paulo';
const parts = (value) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  return f; // AAAA-MM-DD
};
const weekOf = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};
const addDay = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
function weekly(days) { // days: lista de AAAA-MM-DD (com repetição)
  const unique = [...new Set(days)].sort();
  const last = unique[unique.length - 1];
  const wk = weekOf(last);
  const weekDays = unique.filter((d) => weekOf(d) === wk);
  let streak = 1;
  while (unique.includes(addDay(last, -streak))) streak += 1;
  return { weekKey: wk, weekCount: days.filter((d) => weekOf(d) === wk).length, weekDays, streak, lastActiveDay: last };
}

(async () => {
  const apply = process.argv[2] === 'apply';
  const real = {};
  (await db.collection('checkIns').get()).docs.forEach((d) => {
    const c = d.data();
    if (!c.userId) return;
    const entry = real[c.userId] || (real[c.userId] = { count: 0, lastAt: '', lastId: '', days: [] });
    entry.count += 1;
    if (c.date) entry.days.push(parts(c.date));
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
    const w = r ? weekly(real[uid].days) : null;
    const st = stored[uid];
    const weeklyOk = !r || (st && st.weekKey === w.weekKey && st.weekCount === w.weekCount && st.streak === w.streak && JSON.stringify([...(st.weekDays || [])].sort()) === JSON.stringify(w.weekDays));
    const ok = (s === r && weeklyOk) || (r === 0 && s === undefined);
    if (!ok) diffs += 1;
    console.log(uid.slice(0, 28).padEnd(28), String(r).padStart(5), String(s ?? '-').padStart(9), ok ? 'ok' : 'DIFERENTE');
    if (!ok && apply) {
      if (r === 0) await db.doc(`userStats/${uid}`).delete();
      else await db.doc(`userStats/${uid}`).set({ uid, checkInCount: r, lastCheckInAt: real[uid].lastAt, lastCheckInId: real[uid].lastId, ...w });
    }
  }
  console.log(`\n${uids.length} alunos comparados, ${diffs} diferença(s).`);
  if (apply && diffs > 0) {
    await db.collection('adminLog').add({ at: new Date().toISOString(), uid: 'script-backfill', action: 'editar', target: 'userStats', targetId: '', name: 'Reconciliação dos contadores', detail: `${diffs} contador(es) corrigido(s)` });
  }
  if (!apply && diffs > 0) console.log('Rode com "apply" para corrigir.');
})().catch((e) => { console.error(e.message); process.exit(1); });
