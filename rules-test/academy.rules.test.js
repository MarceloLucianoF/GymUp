// V2.0 academias: isolamento entre duas academias e fluxos básicos. Rode: make test-rules (requer Java 11+).
const { test, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch, serverTimestamp, Timestamp, increment } = require('firebase/firestore');

const A = 'academiaaaaaaaaaaaa';
const B = 'academiabbbbbbbbbbbb';
const NOW = '2026-10-13T00:00:00.000Z';
const days = (n) => Timestamp.fromMillis(Date.now() + n * 86400000);

let env;
const cache = new Map();
const db = (uid) => {
  if (!cache.has(uid)) cache.set(uid, env.authenticatedContext(uid).firestore());
  return cache.get(uid);
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bohtreinar-academias',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
});
after(async () => { await env.cleanup(); });

const member = (aid, uid, role, extra = {}) => ({
  academyId: aid, userId: uid, role, status: 'active', displayName: uid,
  consent: { adherence: true }, createdAt: NOW, updatedAt: NOW, ...extra
});

const invId = (p) => `ai_${p}`.padEnd(23, 'X');
const invA = invId('a');

// Semeia uma academia completa sem passar pelas regras: dono, admin, professor, recepção, aluno com professor ativo.
async function seedAcademy(d, aid, p) {
  await setDoc(doc(d, `academies/${aid}`), { name: `Academia ${p}`, ownerId: `${p}owner`, status: 'active', createdAt: NOW, updatedAt: NOW, auditId: `${aid}_0` });
  for (const [r, role] of [['owner', 'owner'], ['admin', 'admin'], ['teacher', 'teacher'], ['recep', 'reception'], ['stu', 'student']]) {
    await setDoc(doc(d, `academyMembers/${aid}_${p}${r}`), member(aid, `${p}${r}`, role));
    await setDoc(doc(d, `users/${p}${r}`), { uid: `${p}${r}`, role: 'user', displayName: `${p}${r}` });
  }
  await setDoc(doc(d, `academyAssignments/${aid}_${p}stu`), { academyId: aid, studentId: `${p}stu`, teacherId: `${p}teacher`, status: 'active', requestedBy: `${p}owner`, createdAt: NOW, updatedAt: NOW });
  await setDoc(doc(d, `academyMemberStats/${aid}_${p}stu`), { academyId: aid, userId: `${p}stu`, validUntil: days(3), lastCheckInId: 'c0', updatedAt: NOW });
  await setDoc(doc(d, `userStats/${p}stu`), { lastCheckInId: 'c1' });
  await setDoc(doc(d, `academyInvites/${invId(p)}`), { academyId: aid, academyName: `Academia ${p}`, role: 'student', expiresAt: days(5), maxUses: 10, uses: 0, revoked: false, createdBy: `${p}owner`, createdAt: NOW });
  await setDoc(doc(d, `academyAuditLog/${aid}_log`), { academyId: aid, actorId: `${p}owner`, action: 'academy.created', targetType: 'academy', targetId: aid, at: new Date() });
  await setDoc(doc(d, `trainingSeries/s_${p}`), { academyId: aid, name: 'Série', currentVersion: 1, status: 'active', createdBy: `${p}owner`, createdAt: NOW, updatedAt: NOW });
  await setDoc(doc(d, `trainingVersions/s_${p}_1`), { academyId: aid, seriesId: `s_${p}`, version: 1, name: 'Série', exercises: [], createdBy: `${p}owner`, createdAt: NOW });
  await setDoc(doc(d, `academyAssigned/${aid}_${p}stu`), { academyId: aid, studentId: `${p}stu`, seriesId: `s_${p}`, version: 1, teacherId: `${p}teacher`, assignedBy: `${p}teacher`, updatedAt: NOW });
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'users/admin1'), { uid: 'admin1', role: 'admin', displayName: 'Admin' });
    await seedAcademy(d, A, 'a');
    await seedAcademy(d, B, 'b');
  });
});

const ROLES = ['owner', 'admin', 'teacher', 'recep', 'stu'];
const docsOfA = [
  `academies/${A}`, `academyMembers/${A}_astu`, `academyMembers/${A}_ateacher`, `academyAssignments/${A}_astu`,
  `academyMemberStats/${A}_astu`, `academyAuditLog/${A}_log`, `trainingSeries/s_a`, `trainingVersions/s_a_1`, `academyAssigned/${A}_astu`
];

// ---------- ISOLAMENTO: nenhum papel da academia B alcança a academia A ----------
for (const r of ROLES) {
  test(`isolamento: ${r} da academia B não lê nenhum documento da academia A`, async () => {
    for (const p of docsOfA) await assertFails(getDoc(doc(db(`b${r}`), p)));
  });
  test(`isolamento: ${r} da academia B não lista dados da academia A`, async () => {
    const d = db(`b${r}`);
    for (const c of ['academyMembers', 'academyAssignments', 'academyMemberStats', 'academyAuditLog', 'trainingSeries', 'trainingVersions', 'academyAssigned']) {
      await assertFails(getDocs(query(collection(d, c), where('academyId', '==', A))));
    }
    await assertFails(getDocs(collection(d, 'academies')));
  });
  test(`isolamento: ${r} da academia B não escreve na academia A`, async () => {
    const d = db(`b${r}`);
    await assertFails(updateDoc(doc(d, `academies/${A}`), { name: 'Invadida', updatedAt: NOW, auditId: 'x' }));
    await assertFails(updateDoc(doc(d, `academyMembers/${A}_astu`), { status: 'removed', updatedAt: NOW, auditId: 'x' }));
    await assertFails(setDoc(doc(d, `academyMembers/${A}_b${r}`), member(A, `b${r}`, 'owner')));
    await assertFails(setDoc(doc(d, `academyAssignments/${A}_astu`), { academyId: A, studentId: 'astu', teacherId: `b${r}`, status: 'active', requestedBy: `b${r}`, createdAt: NOW, updatedAt: NOW }));
    await assertFails(updateDoc(doc(d, `academyAssigned/${A}_astu`), { version: 2 }));
    await assertFails(deleteDoc(doc(d, `academyAssigned/${A}_astu`)));
    await assertFails(deleteDoc(doc(d, `academyMemberStats/${A}_astu`)));
    await assertFails(updateDoc(doc(d, `trainingSeries/s_a`), { name: 'X' }));
    await assertFails(setDoc(doc(d, `academyAuditLog/forjado${r}`), { academyId: A, actorId: `b${r}`, action: 'member.left', targetType: 'member', targetId: 'x', at: serverTimestamp() }));
  });
}

test('isolamento: convite da academia A não serve para entrar como papel de outra academia nem sem uso somado', async () => {
  const d = db('intruso');
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/intruso'), { uid: 'intruso', role: 'user' }); });
  const b = writeBatch(d);
  b.set(doc(d, `academyMembers/${B}_intruso`), { ...member(B, 'intruso', 'student'), inviteId: invA, auditId: 'l1' });
  b.set(doc(d, 'academyAuditLog/l1'), { academyId: B, actorId: 'intruso', action: 'member.joined', targetType: 'member', targetId: 'intruso', at: serverTimestamp() });
  b.update(doc(d, `academyInvites/${invA}`), { uses: increment(1) });
  await assertFails(b.commit());
});

test('isolamento: admin global lê, mas usuário comum fora de academia não', async () => {
  await assertSucceeds(getDoc(doc(db('admin1'), `academies/${A}`)));
  await assertFails(getDoc(doc(db('ninguem'), `academies/${A}`)));
});

// ---------- PAPÉIS DENTRO DA MESMA ACADEMIA ----------
test('papéis: dono/admin leem membros; recepção e aluno não leem de terceiros', async () => {
  await assertSucceeds(getDoc(doc(db('aowner'), `academyMembers/${A}_astu`)));
  await assertSucceeds(getDoc(doc(db('aadmin'), `academyMembers/${A}_astu`)));
  await assertSucceeds(getDocs(query(collection(db('aowner'), 'academyMembers'), where('academyId', '==', A))));
  await assertFails(getDoc(doc(db('arecep'), `academyMembers/${A}_astu`)));
  await assertFails(getDoc(doc(db('astu'), `academyMembers/${A}_arecep`)));
  await assertSucceeds(getDoc(doc(db('astu'), `academyMembers/${A}_astu`)));
});

test('papéis: professor responsável (atribuição ativa) lê o membro; outro professor não', async () => {
  await assertSucceeds(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `academyMembers/${A}_ateacher2`), member(A, 'ateacher2', 'teacher'));
  });
  await assertFails(getDoc(doc(db('ateacher2'), `academyMembers/${A}_astu`)));
});

test('papéis: professor com atribuição pendente ou encerrada não lê o aluno', async () => {
  for (const status of ['pending', 'ended']) {
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyAssignments/${A}_astu`), { status }); });
    await assertFails(getDoc(doc(db('ateacher'), `academyMemberStats/${A}_astu`)));
    await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
  }
});

test('papéis: aderência (validUntil) só o próprio aluno lê; equipe e professor não, mesmo com consentimento', async () => {
  await assertSucceeds(getDoc(doc(db('astu'), `academyMemberStats/${A}_astu`)));
  for (const u of ['aowner', 'aadmin', 'ateacher', 'arecep']) {
    await assertFails(getDoc(doc(db(u), `academyMemberStats/${A}_astu`)));
  }
});

test('papéis: aluno não promove a si mesmo nem muda papel de outro', async () => {
  await assertFails(updateDoc(doc(db('astu'), `academyMembers/${A}_astu`), { role: 'admin', updatedAt: NOW, auditId: 'x' }));
  await assertFails(updateDoc(doc(db('ateacher'), `academyMembers/${A}_astu`), { role: 'admin', updatedAt: NOW, auditId: 'x' }));
  await assertFails(updateDoc(doc(db('aadmin'), `academyMembers/${A}_aowner`), { status: 'removed', updatedAt: NOW, auditId: 'x' }));
});

// ---------- FLUXOS ----------
test('fluxo: criar academia (lote com dono + auditoria) e sem auditoria falha', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/novo'), { uid: 'novo', role: 'user' }); });
  const d = db('novo');
  const aid = 'novaacademia000001';
  const mk = (withLog) => {
    const b = writeBatch(d);
    b.set(doc(d, `academies/${aid}`), { name: 'Nova', ownerId: 'novo', status: 'active', createdAt: NOW, updatedAt: NOW, auditId: 'n1' });
    b.set(doc(d, `academyMembers/${aid}_novo`), { ...member(aid, 'novo', 'owner'), auditId: 'n1' });
    if (withLog) b.set(doc(d, 'academyAuditLog/n1'), { academyId: aid, actorId: 'novo', action: 'academy.created', targetType: 'academy', targetId: aid, at: serverTimestamp() });
    return b;
  };
  await assertFails(mk(false).commit());
  await assertSucceeds(mk(true).commit());
});

test('fluxo: dono cria convite; admin não cria convite de admin acima do teto; convite entra uma vez com uso somado', async () => {
  const o = db('aowner');
  const inv = 'ai_novoConviteAAAAAAAAA';
  const b = writeBatch(o);
  b.set(doc(o, `academyInvites/${inv}`), { academyId: A, academyName: 'Academia a', role: 'student', expiresAt: days(7), maxUses: 5, uses: 0, revoked: false, createdBy: 'aowner', createdAt: NOW, auditId: 'i1' });
  b.set(doc(o, 'academyAuditLog/i1'), { academyId: A, actorId: 'aowner', action: 'invite.created', targetType: 'invite', targetId: inv, at: serverTimestamp() });
  await assertSucceeds(b.commit());

  const ba = writeBatch(db('aadmin'));
  const inv2 = 'ai_conviteAdminAAAAAAAA';
  ba.set(doc(db('aadmin'), `academyInvites/${inv2}`), { academyId: A, academyName: 'Academia a', role: 'admin', expiresAt: days(7), maxUses: 1, uses: 0, revoked: false, createdBy: 'aadmin', createdAt: NOW, auditId: 'i2' });
  ba.set(doc(db('aadmin'), 'academyAuditLog/i2'), { academyId: A, actorId: 'aadmin', action: 'invite.created', targetType: 'invite', targetId: inv2, at: serverTimestamp() });
  await assertFails(ba.commit());

  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/entra'), { uid: 'entra', role: 'user' }); });
  const e = db('entra');
  const join = (logId, plus = 1) => {
    const j = writeBatch(e);
    j.set(doc(e, `academyMembers/${A}_entra`), { ...member(A, 'entra', 'student'), inviteId: inv, auditId: logId });
    j.set(doc(e, `academyAuditLog/${logId}`), { academyId: A, actorId: 'entra', action: 'member.joined', targetType: 'member', targetId: 'entra', at: serverTimestamp() });
    j.update(doc(e, `academyInvites/${inv}`), { uses: increment(plus) });
    return j;
  };
  await assertFails(join('j0', 0).commit());
  await assertFails(join('j9', 2).commit());
  await assertSucceeds(join('j1').commit());
});

test('fluxo: convite revogado ou expirado não admite entrada', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'users/entra'), { uid: 'entra', role: 'user' });
    await updateDoc(doc(d, `academyInvites/${invA}`), { revoked: true });
  });
  const e = db('entra');
  const j = writeBatch(e);
  j.set(doc(e, `academyMembers/${A}_entra`), { ...member(A, 'entra', 'student'), inviteId: invA, auditId: 'j1' });
  j.set(doc(e, 'academyAuditLog/j1'), { academyId: A, actorId: 'entra', action: 'member.joined', targetType: 'member', targetId: 'entra', at: serverTimestamp() });
  j.update(doc(e, `academyInvites/${invA}`), { uses: increment(1) });
  await assertFails(j.commit());
});

test('fluxo: atribuição - equipe propõe, aluno aceita, professor passa a ler; transferência volta a pendente e corta o acesso', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, `academyMembers/${A}_ateacher2`), member(A, 'ateacher2', 'teacher'));
    await updateDoc(doc(d, `academyAssignments/${A}_astu`), { status: 'ended' });
  });
  const o = db('aowner');
  const propose = writeBatch(o);
  propose.update(doc(o, `academyAssignments/${A}_astu`), { teacherId: 'ateacher', status: 'pending', requestedBy: 'aowner', previousTeacherId: 'ateacher', teacherName: 'prof', updatedAt: NOW, auditId: 'p1' });
  propose.set(doc(o, 'academyAuditLog/p1'), { academyId: A, actorId: 'aowner', action: 'assignment.proposed', targetType: 'assignment', targetId: 'astu', at: serverTimestamp() });
  await assertSucceeds(propose.commit());
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));

  const s = db('astu');
  const accept = writeBatch(s);
  accept.update(doc(s, `academyAssignments/${A}_astu`), { status: 'active', updatedAt: NOW, auditId: 'p2' });
  accept.set(doc(s, 'academyAuditLog/p2'), { academyId: A, actorId: 'astu', action: 'assignment.accepted', targetType: 'assignment', targetId: 'astu', at: serverTimestamp() });
  await assertSucceeds(accept.commit());
  await assertSucceeds(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));

  const tr = writeBatch(o);
  tr.update(doc(o, `academyAssignments/${A}_astu`), { teacherId: 'ateacher2', status: 'pending', requestedBy: 'aowner', previousTeacherId: 'ateacher', teacherName: 'prof', updatedAt: NOW, auditId: 'p3' });
  tr.set(doc(o, 'academyAuditLog/p3'), { academyId: A, actorId: 'aowner', action: 'assignment.transferred', targetType: 'assignment', targetId: 'astu', at: serverTimestamp() });
  await assertSucceeds(tr.commit());
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
  await assertFails(getDoc(doc(db('ateacher2'), `academyMembers/${A}_astu`)));
});

test('fluxo: professor de outra academia não pode ser proposto como responsável', async () => {
  const o = db('aowner');
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyAssignments/${A}_astu`), { status: 'ended' }); });
  const b = writeBatch(o);
  b.update(doc(o, `academyAssignments/${A}_astu`), { teacherId: 'bteacher', status: 'pending', requestedBy: 'aowner', previousTeacherId: 'ateacher', teacherName: 'prof', updatedAt: NOW, auditId: 'p1' });
  b.set(doc(o, 'academyAuditLog/p1'), { academyId: A, actorId: 'aowner', action: 'assignment.proposed', targetType: 'assignment', targetId: 'astu', at: serverTimestamp() });
  await assertFails(b.commit());
});

test('fluxo: aluno encerra a atribuição e o professor perde o acesso na hora', async () => {
  const s = db('astu');
  const b = writeBatch(s);
  b.update(doc(s, `academyAssignments/${A}_astu`), { status: 'ended', updatedAt: NOW, auditId: 'e1' });
  b.set(doc(s, 'academyAuditLog/e1'), { academyId: A, actorId: 'astu', action: 'assignment.ended', targetType: 'assignment', targetId: 'astu', at: serverTimestamp() });
  await assertSucceeds(b.commit());
  await assertFails(getDoc(doc(db('ateacher'), `academyMemberStats/${A}_astu`)));
});

test('fluxo: aderência - aluno grava com check-in real e validade curta; valores inventados falham', async () => {
  const s = db('astu');
  const ref = doc(s, `academyMemberStats/${A}_astu`);
  const base = { academyId: A, userId: 'astu', updatedAt: NOW };
  await assertFails(setDoc(ref, { ...base, validUntil: days(3), lastCheckInId: 'inventado' }));
  await assertFails(setDoc(ref, { ...base, validUntil: days(30), lastCheckInId: 'c1' }));
  await assertFails(setDoc(ref, { ...base, validUntil: days(3), lastCheckInId: 'c1', carga: 100 }));
  await assertSucceeds(setDoc(ref, { ...base, validUntil: days(3), lastCheckInId: 'c1' }));
  await assertFails(setDoc(doc(db('ateacher'), `academyMemberStats/${A}_astu`), { ...base, validUntil: days(3), lastCheckInId: 'c1' }));
});

test('fluxo: revogar consentimento exige apagar a aderência no mesmo lote', async () => {
  const s = db('astu');
  const only = writeBatch(s);
  only.update(doc(s, `academyMembers/${A}_astu`), { consent: { adherence: false }, updatedAt: NOW, auditId: 'c1' });
  only.set(doc(s, 'academyAuditLog/c1'), { academyId: A, actorId: 'astu', action: 'member.consent', targetType: 'member', targetId: 'astu', at: serverTimestamp(), detail: 'revogado' });
  await assertFails(only.commit());
  const both = writeBatch(s);
  both.update(doc(s, `academyMembers/${A}_astu`), { consent: { adherence: false }, updatedAt: NOW, auditId: 'c2' });
  both.delete(doc(s, `academyMemberStats/${A}_astu`));
  both.set(doc(s, 'academyAuditLog/c2'), { academyId: A, actorId: 'astu', action: 'member.consent', targetType: 'member', targetId: 'astu', at: serverTimestamp(), detail: 'revogado' });
  await assertSucceeds(both.commit());
});

test('fluxo: auditoria é imutável e só a equipe da academia lê', async () => {
  await assertSucceeds(getDoc(doc(db('aowner'), `academyAuditLog/${A}_log`)));
  await assertFails(getDoc(doc(db('ateacher'), `academyAuditLog/${A}_log`)));
  await assertFails(updateDoc(doc(db('aowner'), `academyAuditLog/${A}_log`), { action: 'member.left' }));
  await assertFails(deleteDoc(doc(db('aowner'), `academyAuditLog/${A}_log`)));
});

test('fluxo: ficha versionada - nova versão é imutável e aluno só lê a versão atribuída', async () => {
  const t = db('aowner');
  const b = writeBatch(t);
  b.update(doc(t, 'trainingSeries/s_a'), { currentVersion: 2, updatedAt: NOW, auditId: 't1' });
  b.set(doc(t, 'trainingVersions/s_a_2'), { academyId: A, seriesId: 's_a', version: 2, name: 'Série', exercises: [], createdBy: 'aowner', createdAt: NOW });
  b.set(doc(t, 'academyAuditLog/t1'), { academyId: A, actorId: 'aowner', action: 'training.updated', targetType: 'training', targetId: 's_a', at: serverTimestamp() });
  await assertSucceeds(b.commit());
  await assertFails(updateDoc(doc(t, 'trainingVersions/s_a_1'), { name: 'Adulterada' }));
  await assertSucceeds(getDoc(doc(db('astu'), 'trainingVersions/s_a_1')));
  await assertSucceeds(getDoc(doc(db('astu'), 'trainingSeries/s_a')));
  await assertFails(getDoc(doc(db('arecep'), 'trainingVersions/s_a_1')));
});

// ---------- ACHADOS DA REVISÃO ----------
const logDoc = (d, id, aid, uid, action, targetType, targetId) =>
  [doc(d, `academyAuditLog/${id}`), { academyId: aid, actorId: uid, action, targetType, targetId, at: serverTimestamp() }];

test('revisão: convidado não se concede perms no próprio create', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/prof'), { uid: 'prof', role: 'user' }); });
  const d = db('prof');
  const inv = 'ai_convProfAAAAAAAAAAA';
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `academyInvites/${inv}`), { academyId: A, academyName: 'Academia a', role: 'teacher', expiresAt: days(5), maxUses: 5, uses: 0, revoked: false, createdBy: 'aowner', createdAt: NOW });
  });
  const mk = (extra) => {
    const b = writeBatch(d);
    b.set(doc(d, `academyMembers/${A}_prof`), { ...member(A, 'prof', 'teacher'), inviteId: inv, auditId: 'k1', ...extra });
    b.set(...logDoc(d, 'k1', A, 'prof', 'member.joined', 'member', 'prof'));
    b.update(doc(d, `academyInvites/${inv}`), { uses: increment(1) });
    return b;
  };
  await assertFails(mk({ perms: { createTrainings: true } }).commit());
  await assertSucceeds(mk({}).commit());
});

test('revisão: professor rebaixado perde leitura do aluno e da aderência', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyMembers/${A}_ateacher`), { role: 'reception' }); });
  await assertFails(getDoc(doc(db('ateacher'), `academyMemberStats/${A}_astu`)));
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
});

test('revisão: uso do convite não pode ser queimado sem entrar ninguém', async () => {
  const s = db('astu');
  const b = writeBatch(s);
  b.update(doc(s, `academyInvites/${invA}`), { uses: increment(1) });
  await assertFails(b.commit());
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyMembers/${A}_astu`), { inviteId: invA }); });
  const b2 = writeBatch(s);
  b2.update(doc(s, `academyInvites/${invA}`), { uses: increment(1) });
  await assertFails(b2.commit());
});

test('revisão: equipe não lista aderência (consentimento mora em outro documento)', async () => {
  await assertFails(getDocs(query(collection(db('aowner'), 'academyMemberStats'), where('academyId', '==', A))));
  await assertSucceeds(getDocs(query(collection(db('astu'), 'academyMemberStats'), where('userId', '==', 'astu'))));
});

test('saída: aluno sai, a aderência é apagada no mesmo lote e a saída é auditada', async () => {
  const s = db('astu');
  const mk = (withDelete, id) => {
    const b = writeBatch(s);
    b.update(doc(s, `academyMembers/${A}_astu`), { status: 'left', consent: { adherence: false }, updatedAt: NOW, auditId: id });
    b.set(...logDoc(s, id, A, 'astu', 'member.left', 'member', 'astu'));
    if (withDelete) b.delete(doc(s, `academyMemberStats/${A}_astu`));
    return b;
  };
  await assertFails(mk(false, 'o0').commit());
  await assertSucceeds(mk(true, 'o1').commit());
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
  await env.withSecurityRulesDisabled(async (ctx) => {
    const x = await getDoc(doc(ctx.firestore(), `academyMemberStats/${A}_astu`));
    if (x.exists()) throw new Error('aderência não foi apagada');
  });
});

test('revisão: aluno não forja auditoria de ações da equipe', async () => {
  const s = db('astu');
  await assertFails(setDoc(...logDoc(s, 'f1', A, 'astu', 'member.updated', 'member', 'ateacher')));
  await assertFails(setDoc(...logDoc(s, 'f2', A, 'astu', 'invite.revoked', 'invite', invA)));
  await assertFails(setDoc(...logDoc(s, 'f3', A, 'astu', 'member.left', 'member', 'aowner')));
});

test('revisão: ficha atribuída só com o professor responsável de fato', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), `academyAssigned/${A}_astu`)); });
  const t = db('ateacher');
  const mk = (teacherId) => {
    const b = writeBatch(t);
    b.set(doc(t, `academyAssigned/${A}_astu`), { academyId: A, studentId: 'astu', seriesId: 's_a', version: 1, teacherId, assignedBy: 'ateacher', auditId: 'g1', updatedAt: NOW });
    b.set(...logDoc(t, 'g1', A, 'ateacher', 'training.assigned', 'training', 'astu'));
    return b;
  };
  await assertFails(mk('aowner').commit());
  await assertSucceeds(mk('ateacher').commit());
});

test('revisão: academia suspensa congela os membros', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academies/${A}`), { status: 'suspended' }); });
  await assertFails(getDoc(doc(db('aowner'), `academies/${A}`)));
  await assertFails(getDoc(doc(db('aowner'), `academyMembers/${A}_astu`)));
  await assertSucceeds(updateDoc(doc(db('admin1'), `academies/${A}`), { status: 'active', updatedAt: NOW }));
});

test('revisão: aluno que sai e volta não reabre o acesso do professor antigo', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyMembers/${A}_astu`), { status: 'left' }); });
  const s = db('astu');
  const mk = (endAssign) => {
    const b = writeBatch(s);
    b.update(doc(s, `academyMembers/${A}_astu`), { status: 'active', role: 'student', inviteId: invA, consent: { adherence: false }, displayName: 'astu', updatedAt: NOW, auditId: 'r1' });
    b.set(...logDoc(s, 'r1', A, 'astu', 'member.joined', 'member', 'astu'));
    b.update(doc(s, `academyInvites/${invA}`), { uses: increment(1) });
    if (endAssign) {
      b.update(doc(s, `academyAssignments/${A}_astu`), { status: 'ended', updatedAt: NOW, auditId: 'r1' });
    }
    return b;
  };
  await assertFails(mk(false).commit());
  await assertSucceeds(mk(true).commit());
});

test('consentimento: sair encerra o consentimento (não pode sair mantendo adherence true)', async () => {
  const s = db('astu');
  const b = writeBatch(s);
  b.update(doc(s, `academyMembers/${A}_astu`), { status: 'left', updatedAt: NOW, auditId: 'z1' });
  b.set(...logDoc(s, 'z1', A, 'astu', 'member.left', 'member', 'astu'));
  b.delete(doc(s, `academyMemberStats/${A}_astu`));
  await assertFails(b.commit());
});

test('consentimento: ativar, revogar (apagando a aderência) e reativar, sempre auditado; o vínculo permanece', async () => {
  const s = db('astu');
  const toggle = (allowed, id, withDelete) => {
    const b = writeBatch(s);
    b.update(doc(s, `academyMembers/${A}_astu`), { consent: { adherence: allowed }, updatedAt: NOW, auditId: id });
    if (withDelete) b.delete(doc(s, `academyMemberStats/${A}_astu`));
    b.set(doc(s, `academyAuditLog/${id}`), { academyId: A, actorId: 'astu', action: 'member.consent', targetType: 'member', targetId: 'astu', at: serverTimestamp(), detail: allowed ? 'concedido' : 'revogado' });
    return b;
  };
  await assertSucceeds(toggle(false, 'k1', true).commit());
  const m = await getDoc(doc(s, `academyMembers/${A}_astu`));
  if (m.data().status !== 'active' || m.data().role !== 'student') throw new Error('vínculo mudou');
  await assertSucceeds(toggle(true, 'k2', false).commit());
  await assertFails(toggle(true, 'k2', false).commit()); // auditoria já usada
  // auditoria mentirosa: grava revogado enquanto concede
  const lie = writeBatch(s);
  lie.update(doc(s, `academyMembers/${A}_astu`), { consent: { adherence: false }, updatedAt: NOW, auditId: 'k3' });
  lie.delete(doc(s, `academyMemberStats/${A}_astu`));
  lie.set(doc(s, 'academyAuditLog/k3'), { academyId: A, actorId: 'astu', action: 'member.consent', targetType: 'member', targetId: 'astu', at: serverTimestamp(), detail: 'concedido' });
  await assertFails(lie.commit());
  await assertSucceeds(getDoc(doc(db('aowner'), `academyAuditLog/k1`)));
});

test('consentimento: revogar e sair funcionam mesmo sem aderência publicada', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), `academyMemberStats/${A}_astu`)); });
  const s = db('astu');
  const rev = writeBatch(s);
  rev.update(doc(s, `academyMembers/${A}_astu`), { consent: { adherence: false }, updatedAt: NOW, auditId: 'n1' });
  rev.delete(doc(s, `academyMemberStats/${A}_astu`));
  rev.set(doc(s, 'academyAuditLog/n1'), { academyId: A, actorId: 'astu', action: 'member.consent', targetType: 'member', targetId: 'astu', at: serverTimestamp(), detail: 'revogado' });
  await assertSucceeds(rev.commit());
  const out = writeBatch(s);
  out.update(doc(s, `academyMembers/${A}_astu`), { status: 'left', consent: { adherence: false }, updatedAt: NOW, auditId: 'n2' });
  out.delete(doc(s, `academyMemberStats/${A}_astu`));
  out.set(...logDoc(s, 'n2', A, 'astu', 'member.left', 'member', 'astu'));
  await assertSucceeds(out.commit());
  // professor que sai (nunca teve aderência)
  const t = db('ateacher');
  const tl = writeBatch(t);
  tl.update(doc(t, `academyMembers/${A}_ateacher`), { status: 'left', consent: { adherence: false }, updatedAt: NOW, auditId: 'n3' });
  tl.delete(doc(t, `academyMemberStats/${A}_ateacher`));
  tl.set(...logDoc(t, 'n3', A, 'ateacher', 'member.left', 'member', 'ateacher'));
  await assertSucceeds(tl.commit());
});

test('consentimento: não apaga a aderência de outra pessoa nem de outra academia', async () => {
  await assertFails(deleteDoc(doc(db('bstu'), `academyMemberStats/${A}_astu`)));
  await assertFails(deleteDoc(doc(db('aowner'), `academyMemberStats/${A}_astu`)));
});

test('revisão: equipe não reativa quem saiu sem convite', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyMembers/${A}_astu`), { status: 'left' }); });
  const o = db('aowner');
  const b = writeBatch(o);
  b.update(doc(o, `academyMembers/${A}_astu`), { status: 'active', updatedAt: NOW, auditId: 'u1' });
  b.set(...logDoc(o, 'u1', A, 'aowner', 'member.updated', 'member', 'astu'));
  await assertFails(b.commit());
});

// ---------- PAPÉIS E ATRIBUIÇÃO (critérios da frente de papéis) ----------
const roleBatch = (uid, aid, target, patch, id, detail) => {
  const d = db(uid);
  const b = writeBatch(d);
  b.update(doc(d, `academyMembers/${aid}_${target}`), { ...patch, updatedAt: NOW, auditId: id });
  b.set(doc(d, `academyAuditLog/${id}`), { academyId: aid, actorId: uid, action: 'member.updated', targetType: 'member', targetId: target, at: serverTimestamp(), ...(detail === undefined ? {} : { detail }) });
  return b;
};

test('papéis: dono promove aluno a admin; admin promove a professor mas não cria outro admin; ambos auditados', async () => {
  await assertSucceeds(roleBatch('aowner', A, 'astu', { role: 'admin' }, 'p1', 'admin,active').commit());
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyMembers/${A}_astu`), { role: 'student' }); });
  await assertSucceeds(roleBatch('aadmin', A, 'astu', { role: 'teacher' }, 'p2', 'teacher,active').commit());
  await assertFails(roleBatch('aadmin', A, 'astu', { role: 'admin' }, 'p3').commit());
  await assertSucceeds(getDoc(doc(db('aowner'), 'academyAuditLog/p1')));
});

test('papéis: professor, recepção e aluno não mudam papel de ninguém', async () => {
  for (const u of ['ateacher', 'arecep', 'astu']) await assertFails(roleBatch(u, A, 'astu', { role: 'teacher' }, `x_${u}`).commit());
  await assertFails(roleBatch('ateacher', A, 'arecep', { status: 'removed' }, 'x2').commit());
});

test('papéis: ninguém altera o proprietário (último proprietário não sai nem é rebaixado)', async () => {
  await assertFails(roleBatch('aowner', A, 'aowner', { role: 'admin' }, 'o1').commit());
  await assertFails(roleBatch('aadmin', A, 'aowner', { role: 'student' }, 'o2').commit());
  await assertFails(roleBatch('aadmin', A, 'aowner', { status: 'removed' }, 'o3').commit());
  const o = db('aowner');
  const leave = writeBatch(o);
  leave.update(doc(o, `academyMembers/${A}_aowner`), { status: 'left', consent: { adherence: false }, updatedAt: NOW, auditId: 'o4' });
  leave.set(...logDoc(o, 'o4', A, 'aowner', 'member.left', 'member', 'aowner'));
  await assertFails(leave.commit());
});

test('papéis: admin da academia B não muda papel nem remove membro da academia A', async () => {
  await assertFails(roleBatch('badmin', A, 'astu', { role: 'teacher' }, 'b1').commit());
  await assertFails(roleBatch('bowner', A, 'astu', { status: 'removed' }, 'b2').commit());
});

test('papéis: remover membro corta o acesso e é auditado', async () => {
  await assertSucceeds(roleBatch('aowner', A, 'ateacher', { status: 'removed' }, 'm1', 'teacher,removed').commit());
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
  await assertFails(getDoc(doc(db('ateacher'), `academies/${A}`)));
});

test('atribuição: não propõe aluno de outra academia nem aluno inexistente', async () => {
  const o = db('aowner');
  const mk = (sid, id) => {
    const b = writeBatch(o);
    b.set(doc(o, `academyAssignments/${A}_${sid}`), { academyId: A, studentId: sid, teacherId: 'ateacher', status: 'pending', requestedBy: 'aowner', previousTeacherId: '', teacherName: 'prof', createdAt: NOW, updatedAt: NOW, auditId: id });
    b.set(...logDoc(o, id, A, 'aowner', 'assignment.proposed', 'assignment', sid));
    return b;
  };
  await assertFails(mk('bstu', 'q1').commit());
  await assertFails(mk('ninguem', 'q2').commit());
});

test('atribuição: só o próprio aluno aceita; professor e equipe não aceitam por ele', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyAssignments/${A}_astu`), { status: 'pending' }); });
  for (const u of ['ateacher', 'aowner', 'aadmin']) {
    const d = db(u);
    const b = writeBatch(d);
    b.update(doc(d, `academyAssignments/${A}_astu`), { status: 'active', updatedAt: NOW, auditId: `ac_${u}` });
    b.set(...logDoc(d, `ac_${u}`, A, u, 'assignment.accepted', 'assignment', 'astu'));
    await assertFails(b.commit());
  }
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
});

test('atribuição: professor encerra a própria atribuição e perde o acesso na hora (auditado)', async () => {
  const t = db('ateacher');
  const b = writeBatch(t);
  b.update(doc(t, `academyAssignments/${A}_astu`), { status: 'ended', updatedAt: NOW, auditId: 'te1' });
  b.set(...logDoc(t, 'te1', A, 'ateacher', 'assignment.ended', 'assignment', 'astu'));
  await assertSucceeds(b.commit());
  await assertFails(getDoc(doc(db('ateacher'), `academyMembers/${A}_astu`)));
});

test('atribuição: primeira proposta (create) da equipe para professor da própria academia', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await deleteDoc(doc(d, `academyAssignments/${A}_astu`));
  });
  const o = db('aowner');
  const b = writeBatch(o);
  b.set(doc(o, `academyAssignments/${A}_astu`), { academyId: A, studentId: 'astu', teacherId: 'ateacher', status: 'pending', requestedBy: 'aowner', previousTeacherId: '', teacherName: 'prof', createdAt: NOW, updatedAt: NOW, auditId: 'cr1' });
  b.set(...logDoc(o, 'cr1', A, 'aowner', 'assignment.proposed', 'assignment', 'astu'));
  await assertSucceeds(b.commit());
});

test('atribuição: aluno NÃO lê o cadastro do professor (o nome vem na própria atribuição)', async () => {
  await assertFails(getDoc(doc(db('astu'), `academyMembers/${A}_ateacher`)));
  const snap = await getDoc(doc(db('astu'), `academyAssignments/${A}_astu`));
  if (!snap.exists()) throw new Error('aluno deveria ler a própria atribuição');
});

test('atribuição: professor só lê/lista a atribuição depois do aceite', async () => {
  await assertSucceeds(getDocs(query(collection(db('ateacher'), 'academyAssignments'), where('teacherId', '==', 'ateacher'), where('status', '==', 'active'))));
  await assertFails(getDocs(query(collection(db('ateacher'), 'academyAssignments'), where('teacherId', '==', 'ateacher'))));
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), `academyAssignments/${A}_astu`), { status: 'pending' }); });
  await assertFails(getDoc(doc(db('ateacher'), `academyAssignments/${A}_astu`)));
});

test('papéis: o registro member.updated precisa dizer o que mudou (papel,status finais)', async () => {
  await assertFails(roleBatch('aowner', A, 'astu', { role: 'teacher' }, 'd1', 'admin,active').commit());
  await assertFails(roleBatch('aowner', A, 'astu', { role: 'teacher' }, 'd2', undefined).commit());
  await assertSucceeds(roleBatch('aowner', A, 'astu', { role: 'teacher' }, 'd3', 'teacher,active').commit());
});

test('papéis: perms só aceita createTrainings booleano', async () => {
  await assertFails(roleBatch('aowner', A, 'ateacher', { perms: { admin: true } }, 'e1', 'teacher,active').commit());
  await assertFails(roleBatch('aowner', A, 'ateacher', { perms: { createTrainings: 'sim' } }, 'e2', 'teacher,active').commit());
  await assertSucceeds(roleBatch('aowner', A, 'ateacher', { perms: { createTrainings: true } }, 'e3', 'teacher,active').commit());
});
