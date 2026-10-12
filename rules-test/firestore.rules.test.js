// Testes das regras do Firestore no emulador. Rode: make test-rules (requer Java 11+).
const { test, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment, assertFails, assertSucceeds
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection, query, where, writeBatch, deleteField } = require('firebase/firestore');

let env;
const cache = new Map();
const db = (uid) => {
  if (!cache.has(uid)) cache.set(uid, env.authenticatedContext(uid).firestore());
  return cache.get(uid);
};
const anonDb = () => {
  if (!cache.has('')) cache.set('', env.unauthenticatedContext().firestore());
  return cache.get('');
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bohtreinar',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'users/admin1'), { uid: 'admin1', role: 'admin', displayName: 'Admin' });
    await setDoc(doc(d, 'users/coach1'), { uid: 'coach1', role: 'coach', displayName: 'Coach 1' });
    await setDoc(doc(d, 'users/coach2'), { uid: 'coach2', role: 'coach', displayName: 'Coach 2' });
    await setDoc(doc(d, 'users/stu1'), { uid: 'stu1', role: 'user', displayName: 'Aluno 1', coachId: 'coach1' });
    await setDoc(doc(d, 'users/stu2'), { uid: 'stu2', role: 'user', displayName: 'Aluno 2', coachId: 'coach2' });
    await setDoc(doc(d, 'checkIns/c1'), { userId: 'stu1', workoutName: 'A' });
    await setDoc(doc(d, 'coachNotes/coach1_stu1'), { coachId: 'coach1', studentId: 'stu1', text: 'nota', updatedAt: '2026-01-01' });
    await setDoc(doc(d, 'trainings/s1'), { name: 'A', exercises: [], coachId: 'coach1', createdBy: 'coach1' });
    await setDoc(doc(d, 'trainings/s2'), { name: 'B', exercises: [], coachId: 'coach2', createdBy: 'coach2' });
    await setDoc(doc(d, 'publicCoachProfiles/coach1'), { uid: 'coach1', displayName: 'Coach 1', role: 'coach', updatedAt: '2026-01-01' });
    await setDoc(doc(d, 'publicCoachProfiles/vazado'), { uid: 'vazado', displayName: 'X', role: 'coach', email: 'a@b.com', updatedAt: '2026-01-01' });
    await setDoc(doc(d, 'coachNotes/coach2_stu2'), { coachId: 'coach2', studentId: 'stu2', text: 'outra', updatedAt: '2026-01-01' });
  });
});

test('usuários: aluno lê o próprio perfil e não o de outro aluno', async () => {
  await assertSucceeds(getDoc(doc(db('stu1'), 'users/stu1')));
  await assertFails(getDoc(doc(db('stu1'), 'users/stu2')));
});

test('usuários: treinador lê só alunos vinculados', async () => {
  await assertSucceeds(getDoc(doc(db('coach1'), 'users/stu1')));
  await assertFails(getDoc(doc(db('coach1'), 'users/stu2')));
});

test('usuários: aluno não se promove a treinador nem muda o uid', async () => {
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { role: 'coach' }));
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { role: 'admin' }));
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { uid: 'x' }));
});

test('usuários: aluno edita campos permitidos e valida onboarding/telefone', async () => {
  const ref = doc(db('stu1'), 'users/stu1');
  await assertSucceeds(updateDoc(ref, { goal: 'Hipertrofia', weeklyGoal: 4, phone: '+55 (11) 99999-0000' }));
  await assertFails(updateDoc(ref, { weeklyGoal: 9 }));
  await assertFails(updateDoc(ref, { experience: 'deus' }));
  await assertFails(updateDoc(ref, { phone: 'abc<script>' }));
  await assertFails(updateDoc(ref, { monthlyFee: 0 }));
});

test('usuários: criação exige role user, termos e só os campos permitidos', async () => {
  const novo = db('novo');
  const base = { uid: 'novo', role: 'user', displayName: 'N', email: 'n@x.com', termsAcceptedAt: '2026-01-01', termsVersion: '1' };
  await assertFails(setDoc(doc(novo, 'users/novo'), { ...base, role: 'admin' }));
  await assertFails(setDoc(doc(novo, 'users/novo'), { ...base, isSuper: true }));
  await assertFails(setDoc(doc(novo, 'users/novo'), { ...base, coachId: 'stu1' }));
  await assertSucceeds(setDoc(doc(novo, 'users/novo'), { ...base, coachId: 'coach1' }));
});

test('usuários: treinador altera só mensalidade/ficha do aluno vinculado', async () => {
  await assertSucceeds(updateDoc(doc(db('coach1'), 'users/stu1'), { monthlyFee: 100, paymentStatus: 'paid' }));
  await assertFails(updateDoc(doc(db('coach1'), 'users/stu1'), { displayName: 'Hack' }));
  await assertFails(updateDoc(doc(db('coach1'), 'users/stu2'), { monthlyFee: 1 }));
});

test('usuários: aluno apaga a própria conta; ninguém apaga outro perfil', async () => {
  await assertFails(deleteDoc(doc(db('stu2'), 'users/stu1')));
  await assertFails(deleteDoc(doc(db('coach1'), 'users/stu1')));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'users/stu1')));
  await assertFails(deleteDoc(doc(db('coach1'), 'users/coach1')));
});

test('checkIns: dono e treinador vinculado leem; outros não; treinador não escreve', async () => {
  await assertSucceeds(getDoc(doc(db('stu1'), 'checkIns/c1')));
  await assertSucceeds(getDoc(doc(db('coach1'), 'checkIns/c1')));
  await assertFails(getDoc(doc(db('coach2'), 'checkIns/c1')));
  await assertFails(getDoc(doc(db('stu2'), 'checkIns/c1')));
  await assertFails(setDoc(doc(db('coach1'), 'checkIns/forjado'), { userId: 'stu1' }));
  await assertFails(setDoc(doc(db('stu2'), 'checkIns/forjado2'), { userId: 'stu1' }));
  await assertSucceeds(setDoc(doc(db('stu1'), 'checkIns/novo'), { userId: 'stu1', workoutName: 'B' }));
});

test('checkIns: nem o admin lista sem filtro; ler ID inexistente é permitido ao logado', async () => {
  await assertFails(getDocs(collection(db('admin1'), 'checkIns')));
  await assertFails(getDocs(collection(db('coach1'), 'checkIns')));
  await assertSucceeds(getDoc(doc(db('stu1'), 'checkIns/nao-existe')));
  await assertFails(getDoc(doc(anonDb(), 'checkIns/nao-existe')));
});

test('checkIns: listagem filtrada pelo dono funciona, a de outro falha', async () => {
  await assertSucceeds(getDocs(query(collection(db('stu1'), 'checkIns'), where('userId', '==', 'stu1'))));
  await assertFails(getDocs(query(collection(db('stu2'), 'checkIns'), where('userId', '==', 'stu1'))));
});

test('coachNotes: aluno não lê, não lista e só apaga a nota sobre ele', async () => {
  await assertFails(getDoc(doc(db('stu1'), 'coachNotes/coach1_stu1')));
  await assertFails(getDocs(collection(db('stu1'), 'coachNotes')));
  await assertFails(deleteDoc(doc(db('stu1'), 'coachNotes/coach2_stu2')));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'coachNotes/coach1_stu1')));
});

test('coachNotes: treinador lê/escreve só as próprias e para aluno vinculado', async () => {
  await assertSucceeds(getDoc(doc(db('coach1'), 'coachNotes/coach1_stu1')));
  await assertFails(getDoc(doc(db('coach1'), 'coachNotes/coach2_stu2')));
  const nota = { coachId: 'coach1', studentId: 'stu1', text: 'novo', updatedAt: '2026-02-02' };
  await assertSucceeds(setDoc(doc(db('coach1'), 'coachNotes/coach1_stu1'), nota));
  await assertFails(setDoc(doc(db('coach1'), 'coachNotes/coach1_stu2'), { ...nota, studentId: 'stu2' }));
  await assertFails(setDoc(doc(db('coach2'), 'coachNotes/coach1_stu1'), nota));
});

test('chats: só participantes; par aluno-treinador vinculado; sem espiar mensagens', async () => {
  const chat = { participants: ['stu1', 'coach1'], participantData: { stu1: {}, coach1: {} }, createdAt: new Date(), updatedAt: new Date(), lastMessage: '' };
  const ts = require('firebase/firestore').serverTimestamp();
  const dados = { ...chat, createdAt: ts, updatedAt: ts };
  await assertSucceeds(setDoc(doc(db('stu1'), 'chats/stu1_coach1'), dados));
  await assertFails(setDoc(doc(db('stu2'), 'chats/stu2_coach1'), { ...dados, participants: ['stu2', 'coach1'], participantData: { stu2: {}, coach1: {} } }));
  await assertFails(getDoc(doc(db('stu2'), 'chats/stu1_coach1')));
  await assertSucceeds(getDoc(doc(db('coach1'), 'chats/stu1_coach1')));
  await assertSucceeds(setDoc(doc(db('stu1'), 'chats/stu1_coach1/messages/m1'), { text: 'oi', senderId: 'stu1', createdAt: ts, senderName: 'A' }));
  await assertFails(setDoc(doc(db('stu1'), 'chats/stu1_coach1/messages/m2'), { text: 'oi', senderId: 'coach1', createdAt: ts }));
  await assertFails(getDoc(doc(db('stu2'), 'chats/stu1_coach1/messages/m1')));
});

test('trainings: ficha de treinador só é editada por ele; aluno não cria ficha de coach', async () => {
  await assertSucceeds(setDoc(doc(db('coach1'), 'trainings/t1'), { name: 'A', exercises: [], coachId: 'coach1', createdBy: 'coach1' }));
  await assertFails(updateDoc(doc(db('coach2'), 'trainings/t1'), { name: 'Hack' }));
  await assertFails(deleteDoc(doc(db('stu1'), 'trainings/t1')));
  await assertFails(setDoc(doc(db('stu1'), 'trainings/t2'), { name: 'X', exercises: [], coachId: 'coach1', createdBy: 'stu1' }));
  await assertSucceeds(setDoc(doc(db('stu1'), 'trainings/ia1'), { name: 'IA', exercises: [], createdBy: 'stu1', isAIGenerated: true }));
  await assertFails(updateDoc(doc(db('coach2'), 'trainings/t1'), { coachId: 'coach2' }));
});

test('atribuição de ficha: treinador só atribui ficha própria a aluno vinculado', async () => {
  await assertSucceeds(updateDoc(doc(db('coach1'), 'users/stu1'), { currentTrainingId: 's1' }));
  await assertFails(updateDoc(doc(db('coach1'), 'users/stu1'), { currentTrainingId: 's2' }));
});

test('publicCoachProfiles: leitura pública só no esquema público', async () => {
  const anon = anonDb();
  await assertSucceeds(getDoc(doc(anon, 'publicCoachProfiles/coach1')));
  await assertFails(getDoc(doc(anon, 'publicCoachProfiles/vazado')));
  await assertFails(setDoc(doc(db('stu1'), 'publicCoachProfiles/coach1'), { uid: 'coach1', displayName: 'Hack', role: 'coach', updatedAt: 'x' }));
});

test('exercises e coleções não mapeadas', async () => {
  await assertSucceeds(getDocs(collection(db('stu1'), 'exercises')));
  await assertFails(setDoc(doc(db('stu1'), 'exercises/e1'), { name: 'x' }));
  await assertSucceeds(setDoc(doc(db('coach1'), 'exercises/e1'), { name: 'x' }));
  await assertFails(getDoc(doc(anonDb(), 'exercises/e1')));
  await assertFails(setDoc(doc(db('admin1'), 'qualquer/coisa'), { a: 1 }));
});

test('adminLog: só admin lê e acrescenta; ninguém edita ou apaga', async () => {
  const entry = { at: '2026-10-12T10:00:00Z', uid: 'admin1', action: 'arquivar', target: 'exercises', targetId: 'e1', name: 'Supino', detail: '' };
  await assertSucceeds(setDoc(doc(db('admin1'), 'adminLog/l1'), entry));
  await assertSucceeds(getDoc(doc(db('admin1'), 'adminLog/l1')));
  await assertFails(setDoc(doc(db('admin1'), 'adminLog/l2'), { ...entry, uid: 'coach1' }));
  await assertFails(setDoc(doc(db('admin1'), 'adminLog/l3'), { ...entry, extra: 1 }));
  await assertFails(setDoc(doc(db('coach1'), 'adminLog/l4'), { ...entry, uid: 'coach1' }));
  await assertFails(setDoc(doc(db('stu1'), 'adminLog/l5'), { ...entry, uid: 'stu1' }));
  await assertFails(getDoc(doc(db('coach1'), 'adminLog/l1')));
  await assertFails(updateDoc(doc(db('admin1'), 'adminLog/l1'), { name: 'x' }));
  await assertFails(deleteDoc(doc(db('admin1'), 'adminLog/l1')));
});

// ---- contador de check-ins (userStats) ----
const ci = (id) => ({ userId: 'stu1', workoutName: 'A', date: '2026-10-12T10:00:00.000Z' });
const stats = (n, last, extra = {}) => ({ uid: 'stu1', checkInCount: n, lastCheckInAt: '2026-10-12T10:00:00.000Z', lastCheckInId: last, ...extra });

test('userStats: primeiro check-in cria o contador em 1, no mesmo lote', async () => {
  const d = db('stu1');
  const b = writeBatch(d);
  b.set(doc(d, 'checkIns/n1'), ci('n1'));
  b.set(doc(d, 'userStats/stu1'), stats(1, 'n1'));
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(d, 'userStats/stu1')));
});

test('userStats: não dá para criar/inflar o contador sozinho', async () => {
  const d = db('stu1');
  await assertFails(setDoc(doc(d, 'userStats/stu1'), stats(1, 'fantasma')));
  const b = writeBatch(d);
  b.set(doc(d, 'checkIns/n2'), ci('n2'));
  b.set(doc(d, 'userStats/stu1'), stats(50, 'n2'));
  await assertFails(b.commit());
  await assertFails(setDoc(doc(db('stu2'), 'userStats/stu1'), stats(1, 'x')));
});

test('userStats: incremento exige check-in novo no mesmo lote; remoção exige exclusão no mesmo lote', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'userStats/stu1'), stats(1, 'c1'));
  });
  const d = db('stu1');
  await assertFails(setDoc(doc(d, 'userStats/stu1'), stats(2, 'c9')));
  const up = writeBatch(d);
  up.set(doc(d, 'checkIns/n3'), ci('n3'));
  up.set(doc(d, 'userStats/stu1'), stats(2, 'n3'));
  await assertSucceeds(up.commit());
  await assertFails(setDoc(doc(d, 'userStats/stu1'), stats(1, 'n3', { lastRemovedId: 'c1' })));
  const down = writeBatch(d);
  down.delete(doc(d, 'checkIns/c1'));
  down.set(doc(d, 'userStats/stu1'), stats(1, 'n3', { lastRemovedId: 'c1' }));
  await assertSucceeds(down.commit());
  const bad = writeBatch(d);
  bad.delete(doc(d, 'checkIns/n3'));
  bad.set(doc(d, 'userStats/stu1'), stats(0, 'n3', { lastRemovedId: 'c1' }));
  await assertFails(bad.commit());
});

test('userStats: leitura só do dono e do admin; lista só do admin; admin reconcilia; dono exclui', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'userStats/stu1'), stats(3, 'c1')); });
  await assertSucceeds(getDoc(doc(db('stu1'), 'userStats/stu1')));
  await assertFails(getDoc(doc(db('stu2'), 'userStats/stu1')));
  await assertFails(getDoc(doc(db('coach1'), 'userStats/stu1')));
  await assertSucceeds(getDocs(collection(db('admin1'), 'userStats')));
  await assertFails(getDocs(collection(db('coach1'), 'userStats')));
  await assertFails(getDocs(collection(db('stu1'), 'userStats')));
  await assertSucceeds(setDoc(doc(db('admin1'), 'userStats/stu1'), stats(7, 'c1', { uid: 'stu1' })));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'userStats/stu1')));
});

// ---- vínculo aluno-treinador (coachLinks) ----
const link = (over = {}) => ({ studentId: 'stu3', studentName: 'Aluno 3', coachId: 'coach1', status: 'pending', requestedBy: 'student', createdAt: '2026-10-12T10:00:00Z', updatedAt: '2026-10-12T10:00:00Z', ...over });

async function seedStu3() {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/stu3'), { uid: 'stu3', role: 'user', displayName: 'Aluno 3' }); });
}

test('vínculo: aluno pede, só para si, só a treinador; treinador não pede por ele', async () => {
  await seedStu3();
  await assertSucceeds(setDoc(doc(db('stu3'), 'coachLinks/stu3'), link()));
  await assertFails(setDoc(doc(db('stu3'), 'coachLinks/stu3'), link({ coachId: 'stu1' })));      // não é treinador
  await assertFails(setDoc(doc(db('stu3'), 'coachLinks/stu3'), link({ status: 'active' })));     // não se auto-aprova
  await assertFails(setDoc(doc(db('stu1'), 'coachLinks/stu3'), link()));                          // outro aluno
  await assertFails(setDoc(doc(db('coach1'), 'coachLinks/stu3'), link()));                        // treinador não pede
});

test('vínculo: só participantes e admin leem; lista só pelo próprio filtro', async () => {
  await seedStu3();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachLinks/stu3'), link()); });
  await assertSucceeds(getDoc(doc(db('stu3'), 'coachLinks/stu3')));
  await assertSucceeds(getDoc(doc(db('coach1'), 'coachLinks/stu3')));
  await assertSucceeds(getDoc(doc(db('admin1'), 'coachLinks/stu3')));
  await assertFails(getDoc(doc(db('coach2'), 'coachLinks/stu3')));
  await assertFails(getDoc(doc(db('stu1'), 'coachLinks/stu3')));
  await assertSucceeds(getDocs(query(collection(db('coach1'), 'coachLinks'), where('coachId', '==', 'coach1'))));
  await assertFails(getDocs(collection(db('coach1'), 'coachLinks')));
});

test('vínculo: treinador aceita junto do coachId do aluno (mesmo lote); sem o lote falha', async () => {
  await seedStu3();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachLinks/stu3'), link()); });
  const c = db('coach1');
  await assertFails(updateDoc(doc(c, 'coachLinks/stu3'), { status: 'active', updatedAt: 'x' }));
  await assertFails(updateDoc(doc(c, 'users/stu3'), { coachId: 'coach1', updatedAt: 'x' }));
  const b = writeBatch(c);
  b.update(doc(c, 'coachLinks/stu3'), { status: 'active', updatedAt: '2026-10-12T11:00:00Z' });
  b.update(doc(c, 'users/stu3'), { coachId: 'coach1', updatedAt: '2026-10-12T11:00:00Z' });
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(c, 'users/stu3'))); // agora é aluno vinculado
});

test('vínculo: outro treinador não aceita; treinador não muda outros campos; recusa não vincula', async () => {
  await seedStu3();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachLinks/stu3'), link()); });
  const c2 = db('coach2');
  const bad = writeBatch(c2);
  bad.update(doc(c2, 'coachLinks/stu3'), { status: 'active', updatedAt: 'x' });
  bad.update(doc(c2, 'users/stu3'), { coachId: 'coach2', updatedAt: 'x' });
  await assertFails(bad.commit());
  await assertFails(updateDoc(doc(db('coach1'), 'coachLinks/stu3'), { status: 'rejected', studentName: 'Outro', updatedAt: 'x' }));
  await assertSucceeds(updateDoc(doc(db('coach1'), 'coachLinks/stu3'), { status: 'rejected', updatedAt: 'x' }));
});

test('vínculo: aluno só desfaz (coachId null); não se vincula sozinho; treinador encerra', async () => {
  // stu1 já tem coach1
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { coachId: 'coach2' }));
  await assertSucceeds(updateDoc(doc(db('stu1'), 'users/stu1'), { coachId: null }));
  await assertSucceeds(updateDoc(doc(db('coach2'), 'users/stu2'), { coachId: null, updatedAt: 'x' }));
  await assertFails(updateDoc(doc(db('coach1'), 'users/stu2'), { coachId: null }));  // não é dele
});

test('vínculo: pedido novo só sem treinador atual; cancelar vira revoked', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachLinks/stu1'), link({ studentId: 'stu1', studentName: 'Aluno 1', status: 'active' })); });
  await assertFails(setDoc(doc(db('stu1'), 'coachLinks/stu1'), link({ studentId: 'stu1', coachId: 'coach2' }))); // stu1 tem coach1
  await assertSucceeds(updateDoc(doc(db('stu1'), 'coachLinks/stu1'), { status: 'revoked', updatedAt: 'x' }));
  await assertFails(deleteDoc(doc(db('stu1'), 'coachLinks/stu1')));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'coachLinks/stu1')));
});

// ---- social: perfil público, amizade e ranking ----
const prof = (uid, over = {}) => ({ uid, displayName: 'Pessoa ' + uid, displayNameLower: 'pessoa ' + uid, handle: 'user_' + uid, photoURL: '', friendCode: ('CODE' + uid.toUpperCase() + '0000').slice(0, 8), discoverable: true, shareRanking: true, weeklyGoal: 4, updatedAt: '2026-10-12', ...over });
const pair = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const fr = (a, b, over = {}) => { const [userA, userB] = a < b ? [a, b] : [b, a]; return { userA, userB, status: 'pending', requestedBy: a, createdAt: '2026-10-12T10:00:00Z', updatedAt: '2026-10-12T10:00:00Z', ...over }; };

async function seedSocial() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const u of ['stu1', 'stu2', 'stu3']) {
      const p = prof(u, u === 'stu3' ? { discoverable: false, shareRanking: false } : {});
      await setDoc(doc(d, 'publicProfiles/' + u), p);
      await setDoc(doc(d, 'handles/' + p.handle), { uid: u });
      await setDoc(doc(d, 'friendCodes/' + p.friendCode), { uid: u });
      await setDoc(doc(d, 'userStats/' + u), { uid: u, checkInCount: 5, lastCheckInAt: '2026-10-12T10:00:00Z', lastCheckInId: 'c1', weekKey: '2026-W42', weekCount: 3, weekDays: ['2026-10-12'], streak: 2, lastActiveDay: '2026-10-12' });
    }
  });
}

test('social: perfil público só nasce junto das reservas de @usuário e código; handle é único', async () => {
  const d = db('stu1');
  const p = prof('stu1');
  await assertFails(setDoc(doc(d, 'publicProfiles/stu1'), p));                 // sem as reservas
  const b = writeBatch(d);
  b.set(doc(d, 'handles/' + p.handle), { uid: 'stu1' });
  b.set(doc(d, 'friendCodes/' + p.friendCode), { uid: 'stu1' });
  b.set(doc(d, 'publicProfiles/stu1'), p);
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(db('stu2'), 'handles/' + p.handle), { uid: 'stu2' })); // já existe (update negado)
  await assertFails(setDoc(doc(db('stu2'), 'publicProfiles/stu1'), p));        // não é dele
});

test('social: busca só lista perfis descobríveis; perfil privado só para dono, admin e amigo ativo', async () => {
  await seedSocial();
  await assertSucceeds(getDocs(query(collection(db('coach1'), 'publicProfiles'), where('discoverable', '==', true))));
  await assertFails(getDocs(collection(db('coach1'), 'publicProfiles')));
  await assertFails(getDoc(doc(db('stu1'), 'publicProfiles/stu3')));           // stu3 não é descobrível
  await assertSucceeds(getDoc(doc(db('stu3'), 'publicProfiles/stu3')));
  await assertSucceeds(getDoc(doc(db('stu1'), 'publicProfiles/stu2')));
});

test('social: pedir, aceitar só quem recebeu, remover, pedir de novo', async () => {
  await seedSocial();
  const a = db('stu1'); const b = db('stu2');
  await assertSucceeds(setDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), fr('stu1', 'stu2')));
  await assertFails(setDoc(doc(db('stu3'), 'friendships/' + pair('stu1', 'stu2')), fr('stu1', 'stu2', { requestedBy: 'stu1' }))); // terceiro
  await assertFails(updateDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), { status: 'active', updatedAt: 'x' }));            // quem pediu não aceita
  await assertSucceeds(updateDoc(doc(b, 'friendships/' + pair('stu1', 'stu2')), { status: 'active', updatedAt: 'x' }));
  await assertFails(getDoc(doc(db('stu3'), 'friendships/' + pair('stu1', 'stu2'))));
  await assertSucceeds(updateDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), { status: 'removed', updatedAt: 'y' }));
  await assertSucceeds(updateDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), { status: 'pending', requestedBy: 'stu1', updatedAt: 'z' }));
  await assertSucceeds(updateDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), { status: 'removed', updatedAt: 'w' })); // cancelar pedido
});

test('social: bloqueio impede novos pedidos; só quem bloqueou desbloqueia', async () => {
  await seedSocial();
  const a = db('stu1'); const b = db('stu2');
  await assertSucceeds(setDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), fr('stu1', 'stu2')));
  await assertSucceeds(updateDoc(doc(b, 'friendships/' + pair('stu1', 'stu2')), { status: 'blocked', blockedBy: 'stu2', updatedAt: 'x' }));
  await assertFails(updateDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), { status: 'pending', requestedBy: 'stu1', updatedAt: 'y' }));
  await assertFails(updateDoc(doc(a, 'friendships/' + pair('stu1', 'stu2')), { status: 'removed', updatedAt: 'y' }));
  await assertFails(deleteDoc(doc(a, 'friendships/' + pair('stu1', 'stu2'))));        // quem foi bloqueado não apaga o bloqueio
  await assertSucceeds(updateDoc(doc(b, 'friendships/' + pair('stu1', 'stu2')), { status: 'removed', blockedBy: deleteField(), updatedAt: 'z' }));
});

test('social: ranking só entre amigos ativos que participam; sem amizade, sem participação ou terceiros não leem', async () => {
  await seedSocial();
  await assertFails(getDoc(doc(db('stu1'), 'userStats/stu2')));                         // ainda não são amigos
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + pair('stu1', 'stu2')), fr('stu1', 'stu2', { status: 'active' })); });
  await assertSucceeds(getDoc(doc(db('stu1'), 'userStats/stu2')));
  await assertSucceeds(getDoc(doc(db('stu2'), 'userStats/stu1')));
  await assertFails(getDoc(doc(db('stu3'), 'userStats/stu2')));
  await assertFails(getDoc(doc(db('coach1'), 'userStats/stu2')));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'publicProfiles/stu2'), prof('stu2', { shareRanking: false })); });
  await assertFails(getDoc(doc(db('stu1'), 'userStats/stu2')));                         // saiu do ranking sem desfazer a amizade
  await assertSucceeds(getDoc(doc(db('stu1'), 'friendships/' + pair('stu1', 'stu2'))));
});

test('social: consistência semanal em userStats tem teto por check-in', async () => {
  await seedSocial();
  const d = db('stu1');
  const base = { uid: 'stu1', checkInCount: 6, lastCheckInAt: '2026-10-13T10:00:00Z', weekKey: '2026-W42', weekDays: ['2026-10-12', '2026-10-13'], lastActiveDay: '2026-10-13' };
  const ok = writeBatch(d);
  ok.set(doc(d, 'checkIns/s1'), { userId: 'stu1', date: '2026-10-13T10:00:00Z' });
  ok.set(doc(d, 'userStats/stu1'), { ...base, lastCheckInId: 's1', weekCount: 4, streak: 3 });
  await assertSucceeds(ok.commit());
  const inflated = writeBatch(d);
  inflated.set(doc(d, 'checkIns/s2'), { userId: 'stu1', date: '2026-10-13T11:00:00Z' });
  inflated.set(doc(d, 'userStats/stu1'), { ...base, checkInCount: 7, lastCheckInId: 's2', weekCount: 9, streak: 4 });
  await assertFails(inflated.commit());
  const streakJump = writeBatch(d);
  streakJump.set(doc(d, 'checkIns/s3'), { userId: 'stu1', date: '2026-10-13T11:00:00Z' });
  streakJump.set(doc(d, 'userStats/stu1'), { ...base, checkInCount: 7, lastCheckInId: 's3', weekCount: 5, streak: 30 });
  await assertFails(streakJump.commit());
});

test('social: socialLog só acrescenta o próprio registro; só o admin lê', async () => {
  const e = { at: '2026-10-12T10:00:00Z', uid: 'stu1', action: 'pedir', other: 'stu2', pairId: 'stu1_stu2' };
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialLog/l1'), e));
  await assertFails(setDoc(doc(db('stu1'), 'socialLog/l2'), { ...e, uid: 'stu2' }));
  await assertFails(setDoc(doc(db('stu1'), 'socialLog/l3'), { ...e, action: 'hackear' }));
  await assertSucceeds(getDoc(doc(db('admin1'), 'socialLog/l1')));
  await assertFails(getDoc(doc(db('stu1'), 'socialLog/l1')));
  await seedSocial();
  await assertFails(deleteDoc(doc(db('stu1'), 'socialLog/l1')));                 // perfil social ainda existe
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'publicProfiles/stu1')); });
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'socialLog/l1')));              // exclusão de conta
});

test('social: listas do próprio usuário funcionam (amizades por userA/userB e perfil ainda inexistente)', async () => {
  await seedSocial();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + pair('stu1', 'stu2')), fr('stu1', 'stu2')); });
  const a = db('stu1'); const b = db('stu2');
  await assertSucceeds(getDocs(query(collection(a, 'friendships'), where('userA', '==', 'stu1'))));
  await assertSucceeds(getDocs(query(collection(b, 'friendships'), where('userB', '==', 'stu2'))));
  await assertFails(getDocs(query(collection(a, 'friendships'), where('userA', '==', 'stu2'))));
  await assertFails(getDocs(collection(a, 'friendships')));
  await assertSucceeds(getDoc(doc(db('stu9'), 'publicProfiles/stu9')));            // próprio, ainda não existe
  await assertSucceeds(getDocs(query(collection(a, 'publicProfiles'), where('discoverable', '==', true), where('displayNameLower', '>=', 'pes'), where('displayNameLower', '<=', 'pes\uf8ff'))));
});

test('social: ler amizade inexistente do próprio par funciona; de outro par não', async () => {
  await seedSocial();
  await assertSucceeds(getDoc(doc(db('stu1'), 'friendships/' + pair('stu1', 'stu2'))));
  await assertFails(getDoc(doc(db('stu9'), 'friendships/' + pair('stu1', 'stu2'))));
});

test('social: bloqueado só apaga o bloqueio junto com a exclusão da própria conta', async () => {
  await seedSocial();
  const id = pair('stu1', 'stu2');
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + id), { ...fr('stu1', 'stu2'), status: 'blocked', blockedBy: 'stu1' }); });
  const b = db('stu2');
  await assertFails(deleteDoc(doc(b, 'friendships/' + id)));
  const batch = writeBatch(b);
  batch.delete(doc(b, 'friendships/' + id));
  await assertFails(batch.commit());                       // sem apagar users/stu2 no mesmo lote
  const ok = writeBatch(b);
  ok.delete(doc(b, 'friendships/' + id));
  ok.delete(doc(b, 'users/stu2'));
  await assertSucceeds(ok.commit());
});

test('social: bloqueado não lê perfil de quem bloqueou; handle/código só soltos com o perfil; socialLog próprio', async () => {
  await seedSocial();
  const id = pair('stu1', 'stu2');
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + id), { ...fr('stu1', 'stu2'), status: 'blocked', blockedBy: 'stu1' }); });
  await assertFails(getDoc(doc(db('stu2'), 'publicProfiles/stu1')));
  await assertSucceeds(getDoc(doc(db('stu1'), 'publicProfiles/stu2')));
  await assertFails(deleteDoc(doc(db('stu1'), 'handles/user_stu1')));        // perfil continua com esse handle
  await assertFails(getDocs(collection(db('stu1'), 'socialLog')));
  await assertSucceeds(getDocs(query(collection(db('stu1'), 'socialLog'), where('uid', '==', 'stu1'))));
});

test('social: exclusão de conta na ordem do app (perfil, handle, código, amizade, log) passa', async () => {
  await seedSocial();
  const a = db('stu1');
  await assertSucceeds(deleteDoc(doc(a, 'publicProfiles/stu1')));
  await assertSucceeds(deleteDoc(doc(a, 'handles/user_stu1')));
  await assertSucceeds(deleteDoc(doc(a, 'friendCodes/' + prof('stu1').friendCode)));
});
