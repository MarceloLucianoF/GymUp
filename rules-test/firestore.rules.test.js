// Testes das regras do Firestore no emulador. Rode: make test-rules (requer Java 11+).
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment, assertFails, assertSucceeds
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection, collectionGroup, query, where, orderBy, startAt, endAt, limit, writeBatch, deleteField, Timestamp, serverTimestamp, increment } = require('firebase/firestore');

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

test('perfil: aluno grava os equipamentos da academia, só valores conhecidos e no máximo 6', async () => {
  await assertSucceeds(updateDoc(doc(db('stu1'), 'users/stu1'), { gymEquipment: ['halter', 'livre'], updatedAt: '2026-10-19' }));
  await assertSucceeds(updateDoc(doc(db('stu1'), 'users/stu1'), { gymEquipment: [] }));
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { gymEquipment: ['laser'] }));
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { gymEquipment: 'halter' }));
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { gymEquipment: ['maquina', 'polia', 'halter', 'barra', 'livre', 'cardio', 'maquina'] }));
  await assertFails(updateDoc(doc(db('stu2'), 'users/stu1'), { gymEquipment: ['halter'] }));
});

test('myWorkouts: treino pessoal é privado, só o dono lê e grava, com formato fechado', async () => {
  const ok = { name: 'Meu treino', exercises: [{ name: 'Supino' }], source: 'pdf', createdAt: '2026-10-19' };
  await assertSucceeds(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w1'), ok));
  await assertSucceeds(getDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w1')));
  await assertFails(getDoc(doc(db('stu2'), 'users/stu1/myWorkouts/w1')));
  await assertFails(getDoc(doc(db('coach1'), 'users/stu1/myWorkouts/w1')));
  await assertFails(getDocs(collection(db('coach1'), 'users/stu1/myWorkouts')));
  await assertFails(setDoc(doc(db('stu2'), 'users/stu1/myWorkouts/w2'), ok));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w3'), { ...ok, extra: 'x' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w4'), { ...ok, exercises: [] }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w5'), { ...ok, name: 'x'.repeat(81) }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w6'), { ...ok, source: 'golpe' }));
  await assertFails(setDoc(doc(db('coach1'), 'users/coach1/myWorkouts/w7'), ok));   // só o papel aluno
  await assertFails(deleteDoc(doc(db('stu2'), 'users/stu1/myWorkouts/w1')));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'users/stu1/myWorkouts/w1')));
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
      await setDoc(doc(d, 'publicStats/' + u), { uid: u, weekKey: '2026-W42', weekWorkouts: 3, activeDays: 1, streak: 2, lastActiveDay: '2026-10-12', updatedAt: '2026-10-12T10:00:00Z' });
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

test('social: perfil completo não é listável; busca por nome/@ só no índice profileSearch (nome, @ e uid, sem código)', async () => {
  await seedSocial();
  await assertFails(getDocs(query(collection(db('stu1'), 'publicProfiles'), where('discoverable', '==', true), limit(10))));   // o perfil inteiro não se lista
  await assertSucceeds(getDocs(collection(db('admin1'), 'publicProfiles')));
  // índice: entra só quem é descobrível, no mesmo lote do perfil, com campos fechados
  const entry = (uid, over = {}) => ({ uid, displayName: 'Pessoa ' + uid, displayNameLower: 'pessoa ' + uid, handle: 'user_' + uid, ...over });
  await assertSucceeds(setDoc(doc(db('stu1'), 'profileSearch/stu1'), entry('stu1')));
  await assertSucceeds(setDoc(doc(db('stu2'), 'profileSearch/stu2'), entry('stu2')));
  await assertFails(setDoc(doc(db('stu3'), 'profileSearch/stu3'), entry('stu3')));                    // stu3 não é descobrível
  await assertFails(setDoc(doc(db('stu1'), 'profileSearch/stu2'), entry('stu2')));                    // não é dele
  await assertFails(setDoc(doc(db('stu1'), 'profileSearch/stu1'), entry('stu1', { friendCode: 'ABCD2345' })));   // sem código de amigo
  await assertFails(setDoc(doc(db('stu1'), 'profileSearch/stu1'), entry('stu1', { handle: 'outro_nome' })));      // @ tem de ser o do perfil
  await assertFails(getDoc(doc(db('stu2'), 'profileSearch/stu1')));                                   // sem get direto
  await assertFails(getDocs(collection(db('stu2'), 'profileSearch')));                                // sem limite
  await assertFails(getDocs(query(collection(db('stu2'), 'profileSearch'), limit(11))));              // acima de 10
  await assertFails(getDocs(query(collection(anonDb(), 'profileSearch'), limit(5))));                 // sem login
  const byName = await assertSucceeds(getDocs(query(collection(db('stu3'), 'profileSearch'), orderBy('displayNameLower'), startAt('pessoa'), endAt('pessoa\uf8ff'), limit(10))));
  assert.deepEqual(byName.docs.map((x) => x.id).sort(), ['stu1', 'stu2']);
  assert.deepEqual(Object.keys(byName.docs[0].data()).sort(), ['displayName', 'displayNameLower', 'handle', 'uid']);
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'profileSearch/stu1')));                             // sair da busca
  await assertFails(deleteDoc(doc(db('stu1'), 'profileSearch/stu2')));
  await assertSucceeds(getDoc(doc(db('stu1'), 'publicProfiles/stu2')));        // descobrível: get por @usuário/código continua
  await assertFails(getDoc(doc(db('stu1'), 'publicProfiles/stu3')));
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
  await assertFails(getDoc(doc(db('stu1'), 'publicStats/stu2')));                       // ainda não são amigos
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + pair('stu1', 'stu2')), fr('stu1', 'stu2', { status: 'active' })); });
  await assertSucceeds(getDoc(doc(db('stu1'), 'publicStats/stu2')));
  await assertSucceeds(getDoc(doc(db('stu2'), 'publicStats/stu1')));
  await assertFails(getDoc(doc(db('stu1'), 'userStats/stu2')));                         // amigo nunca lê o userStats (horário, total)
  await assertFails(getDoc(doc(db('stu3'), 'publicStats/stu2')));
  await assertFails(getDoc(doc(db('coach1'), 'publicStats/stu2')));
  await assertFails(getDocs(collection(db('stu1'), 'publicStats')));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'publicProfiles/stu2'), prof('stu2', { shareRanking: false })); });
  await assertFails(getDoc(doc(db('stu1'), 'publicStats/stu2')));                       // saiu do ranking sem desfazer a amizade
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
});

test('social: ler amizade inexistente do próprio par funciona; de outro par não', async () => {
  await seedSocial();
  await assertSucceeds(getDoc(doc(db('stu1'), 'friendships/' + pair('stu1', 'stu2'))));
  await assertFails(getDoc(doc(db('stu9'), 'friendships/' + pair('stu1', 'stu2'))));
});

test('social: busca não filtra bloqueio no servidor (limitação documentada: só nome e @ aparecem; o app esconde; pedido continua barrado)', async () => {
  await seedSocial();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'profileSearch/stu1'), { uid: 'stu1', displayName: 'Pessoa stu1', displayNameLower: 'pessoa stu1', handle: 'user_stu1' });
    await setDoc(doc(d, 'friendships/' + pair('stu1', 'stu2')), { ...fr('stu1', 'stu2'), status: 'blocked', blockedBy: 'stu1' });
  });
  await assertFails(getDoc(doc(db('stu2'), 'publicProfiles/stu1')));                 // o perfil completo continua negado
  const res = await assertSucceeds(getDocs(query(collection(db('stu2'), 'profileSearch'), orderBy('displayNameLower'), startAt('pessoa stu1'), endAt('pessoa stu1\uf8ff'), limit(5))));
  assert.deepEqual(res.docs.map((x) => x.id), ['stu1']);                              // só nome e @ (o filtro de bloqueio é do app)
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

test('publicStats: só espelha o userStats do dono; não aceita números inventados nem campos extras', async () => {
  await seedSocial();
  const d = db('stu1');
  const mine = { uid: 'stu1', weekKey: '2026-W42', weekWorkouts: 3, activeDays: 1, streak: 2, lastActiveDay: '2026-10-12', updatedAt: 'x' };
  await assertSucceeds(setDoc(doc(d, 'publicStats/stu1'), mine));
  await assertFails(setDoc(doc(d, 'publicStats/stu1'), { ...mine, weekWorkouts: 30 }));
  await assertFails(setDoc(doc(d, 'publicStats/stu1'), { ...mine, streak: 99 }));
  await assertFails(setDoc(doc(d, 'publicStats/stu1'), { ...mine, lastCheckInAt: '2026-10-12T10:00:00Z' }));
  await assertFails(setDoc(doc(db('stu2'), 'publicStats/stu1'), mine));
  await assertSucceeds(deleteDoc(doc(d, 'publicStats/stu1')));
});

test('userStats: apagar e recriar o mesmo check-in não infla a sequência; formatos são validados', async () => {
  await seedSocial();
  const d = db('stu1');
  const base = { uid: 'stu1', checkInCount: 6, lastCheckInAt: '2026-10-12T12:00:00Z', weekKey: '2026-W42', weekDays: ['2026-10-12'], lastActiveDay: '2026-10-12' };
  const same = writeBatch(d);
  same.set(doc(d, 'checkIns/r1'), { userId: 'stu1', date: '2026-10-12T12:00:00Z' });
  same.set(doc(d, 'userStats/stu1'), { ...base, lastCheckInId: 'r1', weekCount: 4, streak: 3 });      // mesmo dia: sequência não sobe
  await assertFails(same.commit());
  const ok = writeBatch(d);
  ok.set(doc(d, 'checkIns/r1'), { userId: 'stu1', date: '2026-10-12T12:00:00Z' });
  ok.set(doc(d, 'userStats/stu1'), { ...base, lastCheckInId: 'r1', weekCount: 4, streak: 2 });
  await assertSucceeds(ok.commit());
  const badFormat = writeBatch(d);
  badFormat.set(doc(d, 'checkIns/r2'), { userId: 'stu1', date: '2026-10-13T12:00:00Z' });
  badFormat.set(doc(d, 'userStats/stu1'), { ...base, checkInCount: 7, lastCheckInId: 'r2', weekCount: 5, streak: 3, weekKey: 'qualquer coisa', lastActiveDay: '2026-10-13' });
  await assertFails(badFormat.commit());
  const back = writeBatch(d);
  back.set(doc(d, 'checkIns/r3'), { userId: 'stu1', date: '2026-10-11T12:00:00Z' });
  back.set(doc(d, 'userStats/stu1'), { ...base, checkInCount: 7, lastCheckInId: 'r3', weekCount: 5, streak: 2, lastActiveDay: '2026-10-01' });   // dia ativo não volta
  await assertFails(back.commit());
});

test('amizade: recusa soma uma recusa e fixa espera; quem foi recusado espera e tem no máximo 3 tentativas', async () => {
  await seedSocial();
  const id = pair('stu1', 'stu2');
  const put = (data) => env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + id), data); });
  const past = Timestamp.fromMillis(Date.now() - 60_000);
  const day = (n) => Timestamp.fromMillis(Date.now() + n * 86_400_000);
  const upd = (who, patch) => setDoc(doc(db(who), 'friendships/' + id), { ...fr('stu1', 'stu2'), ...patch });
  await put(fr('stu1', 'stu2'));
  await assertFails(upd('stu2', { status: 'removed', updatedAt: 'y' }));                                  // recusar sem somar a recusa
  await assertFails(upd('stu2', { status: 'removed', updatedAt: 'y', declines: 1, retryAfter: day(0) }));  // espera curta demais
  await assertSucceeds(upd('stu2', { status: 'removed', updatedAt: 'y', declines: 1, retryAfter: day(1.1) }));
  await assertFails(upd('stu1', { status: 'pending', updatedAt: 'z', declines: 1, retryAfter: day(1.1) })); // ainda em espera
  await put(fr('stu1', 'stu2', { status: 'removed', declines: 1, retryAfter: past }));
  await assertSucceeds(upd('stu1', { status: 'pending', updatedAt: 'z', declines: 1, retryAfter: past }));
  await put(fr('stu1', 'stu2', { status: 'removed', declines: 3, retryAfter: past }));
  await assertFails(upd('stu1', { status: 'pending', updatedAt: 'z', declines: 3, retryAfter: past })); // 3 recusas
  await assertFails(upd('stu1', { status: 'pending', updatedAt: 'z' }));                                  // não dá para zerar a contagem
  await assertSucceeds(upd('stu2', { status: 'pending', requestedBy: 'stu2', updatedAt: 'z', declines: 3, retryAfter: past })); // quem recusou pode pedir
});

test('amizade: quem foi recusado não apaga o documento para zerar a espera; recusa com espera absurda é negada', async () => {
  await seedSocial();
  const id = pair('stu1', 'stu2');
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + id), fr('stu1', 'stu2', { status: 'removed', declines: 1, retryAfter: Timestamp.fromMillis(Date.now() + 86_400_000) })); });
  await assertFails(deleteDoc(doc(db('stu1'), 'friendships/' + id)));
  await assertFails(deleteDoc(doc(db('stu2'), 'friendships/' + id)));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'friendships/' + id)));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'friendships/' + id), fr('stu1', 'stu2')); });
  await assertFails(setDoc(doc(db('stu2'), 'friendships/' + id), { ...fr('stu1', 'stu2'), status: 'removed', declines: 1, retryAfter: Timestamp.fromMillis(Date.now() + 30 * 86_400_000) }));
});

test('userStats: remover o único check-in com sequência igual ao total funciona', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'userStats/stu1'), { ...stats(1, 'c1'), weekKey: '2026-W42', weekCount: 1, weekDays: ['2026-10-12'], streak: 1, lastActiveDay: '2026-10-12' });
    await setDoc(doc(f, 'checkIns/c1'), ci('c1'));
  });
  const d = db('stu1');
  const down = writeBatch(d);
  down.delete(doc(d, 'checkIns/c1'));
  down.set(doc(d, 'userStats/stu1'), { ...stats(0, 'c1', { lastRemovedId: 'c1' }), weekKey: '2026-W42', weekCount: 0, weekDays: ['2026-10-12'], streak: 1, lastActiveDay: '2026-10-12' });
  await assertSucceeds(down.commit());
});

test('retry idempotente: reenviar o mesmo check-in não aceita novo incremento nem muda o publicStats', async () => {
  await seedSocial();
  const d = db('stu1');
  const base = { uid: 'stu1', checkInCount: 6, lastCheckInAt: '2026-10-13T10:00:00Z', weekKey: '2026-W42', weekDays: ['2026-10-12', '2026-10-13'], lastActiveDay: '2026-10-13' };
  const first = writeBatch(d);
  first.set(doc(d, 'checkIns/dup1'), { userId: 'stu1', date: '2026-10-13T10:00:00Z' });
  first.set(doc(d, 'userStats/stu1'), { ...base, lastCheckInId: 'dup1', weekCount: 4, streak: 3 });
  first.set(doc(d, 'publicStats/stu1'), { uid: 'stu1', weekKey: '2026-W42', weekWorkouts: 4, activeDays: 2, streak: 3, lastActiveDay: '2026-10-13', updatedAt: 'x' });
  await assertSucceeds(first.commit());
  const replay = writeBatch(d);                                   // mesmo ID de novo, contador +1
  replay.set(doc(d, 'checkIns/dup1'), { userId: 'stu1', date: '2026-10-13T10:00:00Z' });
  replay.set(doc(d, 'userStats/stu1'), { ...base, checkInCount: 7, lastCheckInId: 'dup2', weekCount: 5, streak: 3 });
  await assertFails(replay.commit());
  const replay2 = writeBatch(d);                                  // outro ID, mas o documento do check-in já existia
  replay2.set(doc(d, 'checkIns/dup1'), { userId: 'stu1', date: '2026-10-13T10:00:00Z' });
  replay2.set(doc(d, 'userStats/stu1'), { ...base, checkInCount: 7, lastCheckInId: 'dup1', weekCount: 5, streak: 3 });
  await assertFails(replay2.commit());
  await assertFails(setDoc(doc(d, 'publicStats/stu1'), { uid: 'stu1', weekKey: '2026-W42', weekWorkouts: 9, activeDays: 2, streak: 3, lastActiveDay: '2026-10-13', updatedAt: 'x' }));
});

// ---- convite por link (coachInvites) e mensalidade no aceite ----
const INV = 'i_AbCdEfGhIjKlMnOpQrSt';
const hours = (n) => Timestamp.fromMillis(Date.now() + n * 3_600_000);
const invite = (over = {}) => ({ coachId: 'coach1', createdAt: '2026-10-12T10:00:00Z', expiresAt: hours(24 * 7), maxUses: 5, uses: 0, revoked: false, ...over });
const putInvite = (over = {}, id = INV) => env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachInvites/' + id), invite(over)); });
const useInvite = (who, linkOver = {}, bump = 1, id = INV) => {
  const d = db(who);
  const b = writeBatch(d);
  b.set(doc(d, 'coachLinks/' + who), link({ studentId: who, inviteId: id, ...linkOver }));
  b.update(doc(d, 'coachInvites/' + id), { uses: bump });
  return b.commit();
};

test('convite: só treinador cria, com validade de 1 h a 31 dias, 1 a 200 usos, uses 0 e não revogado', async () => {
  await assertSucceeds(setDoc(doc(db('coach1'), 'coachInvites/' + INV), invite()));
  await assertFails(setDoc(doc(db('stu1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZz'), invite({ coachId: 'stu1' })));          // aluno
  await assertFails(setDoc(doc(db('coach2'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ1'), invite()));                               // em nome de outro
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ2'), invite({ expiresAt: hours(0.1) })));      // curto demais
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ3'), invite({ expiresAt: hours(24 * 60) })));  // longo demais
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ4'), invite({ maxUses: 0 })));
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ5'), invite({ maxUses: 500 })));
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ6'), invite({ uses: 3 })));
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/i_ZzZzZzZzZzZzZzZzZzZ7'), invite({ revoked: true })));
  await assertFails(setDoc(doc(db('coach1'), 'coachInvites/curto'), invite()));                                                  // ID fraco
});

test('convite: leitura pelo ID (inclusive sem login); lista só do dono; sem dado pessoal no documento', async () => {
  await putInvite();
  await assertSucceeds(getDoc(doc(anonDb(), 'coachInvites/' + INV)));
  await assertSucceeds(getDocs(query(collection(db('coach1'), 'coachInvites'), where('coachId', '==', 'coach1'))));
  await assertFails(getDocs(query(collection(db('coach2'), 'coachInvites'), where('coachId', '==', 'coach1'))));
  await assertFails(getDocs(collection(anonDb(), 'coachInvites')));
});

test('convite: treinador só revoga (não reativa nem muda limites); aluno não revoga', async () => {
  await putInvite();
  await assertFails(updateDoc(doc(db('stu1'), 'coachInvites/' + INV), { revoked: true }));
  await assertFails(updateDoc(doc(db('coach2'), 'coachInvites/' + INV), { revoked: true }));
  await assertFails(updateDoc(doc(db('coach1'), 'coachInvites/' + INV), { maxUses: 100 }));
  await assertSucceeds(updateDoc(doc(db('coach1'), 'coachInvites/' + INV), { revoked: true }));
  await assertFails(updateDoc(doc(db('coach1'), 'coachInvites/' + INV), { revoked: false }));
});

test('convite: pedido do aluno consome exatamente 1 uso no mesmo lote; recusa expirado, revogado, esgotado e de outro treinador', async () => {
  await seedStu3();
  await putInvite();
  await assertFails(setDoc(doc(db('stu3'), 'coachLinks/stu3'), link({ inviteId: INV })));                // sem somar o uso
  await assertFails(useInvite('stu3', {}, 2));                                                           // somou 2
  await assertFails(useInvite('stu3', { coachId: 'coach2' }));                                           // convite é de outro treinador
  await assertSucceeds(useInvite('stu3'));
  const after = (await getDoc(doc(db('coach1'), 'coachInvites/' + INV))).data();
  assert.equal(after.uses, 1);
  assert.equal((await getDoc(doc(db('stu3'), 'coachLinks/stu3'))).data().status, 'pending');             // pendente: o aceite continua com o treinador
  assert.equal((await getDoc(doc(db('stu3'), 'users/stu3'))).data().coachId, undefined);                // e não vincula sozinho
});

test('convite: expirado, revogado e esgotado são recusados', async () => {
  await seedStu3();
  await putInvite({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  await assertFails(useInvite('stu3'));
  await putInvite({ revoked: true });
  await assertFails(useInvite('stu3'));
  await putInvite({ maxUses: 2, uses: 2 });
  await assertFails(useInvite('stu3', {}, 3));
  await putInvite({ maxUses: 2, uses: 1 });
  await assertSucceeds(useInvite('stu3', {}, 2));                                                        // último uso
});

test('convite: aluno não mexe no convite sem pedido; código fixo (sem inviteId) segue valendo', async () => {
  await seedStu3();
  await putInvite();
  await assertFails(updateDoc(doc(db('stu3'), 'coachInvites/' + INV), { uses: 1 }));                    // sem o pedido no lote
  await assertFails(updateDoc(doc(db('stu3'), 'coachInvites/' + INV), { maxUses: 999 }));
  await assertSucceeds(setDoc(doc(db('stu3'), 'coachLinks/stu3'), link()));                              // legado
});

test('convite: usuário que já tem treinador não usa convite; convite não muda papel nem expõe dados do aluno', async () => {
  await putInvite();
  await assertFails(useInvite('stu1'));                                                                  // stu1 já tem coach1
  await seedStu3();
  await assertSucceeds(useInvite('stu3'));
  await assertFails(updateDoc(doc(db('stu3'), 'users/stu3'), { role: 'coach' }));
  await assertFails(getDoc(doc(db('coach1'), 'users/stu3')));                                           // pendente: treinador ainda não lê o aluno
  await assertFails(getDocs(query(collection(db('coach1'), 'checkIns'), where('userId', '==', 'stu3'))));
});

test('aceite com mensalidade: valor positivo e paymentStatus pending; zero, negativo, texto ou outro campo são recusados', async () => {
  await seedStu3();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachLinks/stu3'), link()); });
  const accept = (extra) => {
    const d = db('coach1');
    const b = writeBatch(d);
    b.update(doc(d, 'coachLinks/stu3'), { status: 'active', updatedAt: 'x' });
    b.update(doc(d, 'users/stu3'), { coachId: 'coach1', updatedAt: 'x', ...extra });
    return b.commit();
  };
  await assertFails(accept({ monthlyFee: 0 }));
  await assertFails(accept({ monthlyFee: -10 }));
  await assertFails(accept({ monthlyFee: 'cem' }));
  await assertFails(accept({ monthlyFee: 150, paymentStatus: 'paid' }));
  await assertFails(accept({ monthlyFee: 150, role: 'coach' }));
  await assertFails(accept({ monthlyFee: 150, weight: 1 }));
  await assertSucceeds(accept({ monthlyFee: 150, paymentStatus: 'pending' }));
  const u = (await getDoc(doc(db('coach1'), 'users/stu3'))).data();
  assert.equal(u.monthlyFee, 150);
  assert.equal(u.coachId, 'coach1');
});

test('mensalidade do aluno vinculado: coach edita com valor válido; negativo e texto são recusados; isento exige exempt junto', async () => {
  await assertSucceeds(updateDoc(doc(db('coach1'), 'users/stu1'), { monthlyFee: 99.9 }));
  await assertFails(updateDoc(doc(db('coach1'), 'users/stu1'), { monthlyFee: -1 }));
  await assertFails(updateDoc(doc(db('coach1'), 'users/stu1'), { monthlyFee: 'x' }));
  await assertSucceeds(updateDoc(doc(db('coach1'), 'users/stu1'), { paymentStatus: 'paid', paymentDate: 'd', lastPaymentUpdate: 'd' })); // marcar pago continua
  await assertSucceeds(updateDoc(doc(db('coach1'), 'users/stu1'), { monthlyFee: 0, paymentStatus: 'exempt' }));                          // isento (0 vem junto)
});

test('chat: primeira conversa do par — participante pelo ID consulta o chat inexistente e cria; terceiros não', async () => {
  const id = 'coach1_stu1';
  await assertSucceeds(getDoc(doc(db('coach1'), 'chats/' + id)));                         // ainda não existe: "não encontrado", não negado
  await assertSucceeds(getDoc(doc(db('stu1'), 'chats/' + id)));
  await assertFails(getDoc(doc(db('coach2'), 'chats/' + id)));                            // de fora do ID
  await assertFails(getDoc(doc(anonDb(), 'chats/' + id)));
  const create = (who, other) => setDoc(doc(db(who), 'chats/' + id), { participants: [who, other], participantData: { [who]: { name: 'A', photo: '' }, [other]: { name: 'B', photo: '' } }, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), lastMessage: '' });
  await assertFails(create('coach2', 'stu1'));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'chats/' + id), { participants: ['coach1', 'stu1'], participantData: { coach1: { name: 'A', photo: '' }, stu1: { name: 'B', photo: '' } }, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), lastMessage: 'oi' }); });
  await assertSucceeds(getDoc(doc(db('coach1'), 'chats/' + id)));                         // existente: só participantes
  await assertFails(getDoc(doc(db('coach2'), 'chats/' + id)));
  await assertFails(getDoc(doc(db('stu2'), 'chats/' + id)));
});

test('convite: gastar uso sozinho (sem escrever o pedido no mesmo lote) é negado, mesmo com pedido pendente antigo', async () => {
  await seedStu3();
  await putInvite();
  await assertSucceeds(useInvite('stu3'));                                                    // uso legítimo
  await assertFails(updateDoc(doc(db('stu3'), 'coachInvites/' + INV), { uses: 2 }));           // loop de usos sem pedido novo
  const after = (await getDoc(doc(db('coach1'), 'coachInvites/' + INV))).data();
  assert.equal(after.uses, 1);
});

test('convite: o mesmo aluno não reaproveita o mesmo convite; revogar o pedido não mexe em inviteId', async () => {
  await seedStu3();
  await putInvite();
  await assertSucceeds(useInvite('stu3'));
  const d = db('stu3');
  const again = writeBatch(d);
  again.set(doc(d, 'coachLinks/stu3'), link({ studentId: 'stu3', inviteId: INV, updatedAt: '2026-10-13T10:00:00Z' }));
  again.update(doc(d, 'coachInvites/' + INV), { uses: 2 });
  await assertFails(again.commit());                                                          // pedido pendente + mesmo convite
  await assertFails(updateDoc(doc(d, 'coachLinks/stu3'), { status: 'revoked', inviteId: 'i_OutroConviteQualquer1', updatedAt: 'y' }));
  await assertSucceeds(updateDoc(doc(d, 'coachLinks/stu3'), { status: 'revoked', updatedAt: 'y' }));
});

test('aceite: mensalidade zero é recusada mesmo sendo permitida depois', async () => {
  await seedStu3();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'coachLinks/stu3'), link()); });
  const d = db('coach1');
  const b = writeBatch(d);
  b.update(doc(d, 'coachLinks/stu3'), { status: 'active', updatedAt: 'x' });
  b.update(doc(d, 'users/stu3'), { coachId: 'coach1', updatedAt: 'x', monthlyFee: 0 });
  await assertFails(b.commit());
});

test('chat: ninguém cria conversa com o ID de outro par', async () => {
  const mk = (who, other, id) => setDoc(doc(db(who), 'chats/' + id), { participants: [who, other], participantData: { [who]: { name: 'A', photo: '' }, [other]: { name: 'B', photo: '' } }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: '' });
  await assertFails(mk('coach1', 'stu1', 'stu1_stu2'));                                        // ID de outro par
  await assertFails(mk('coach1', 'stu1', 'qualquer'));
  await assertSucceeds(mk('coach1', 'stu1', 'coach1_stu1'));
});

test('aluno isento: exempt e mensalidade 0 andam juntos; situação inválida é recusada; marcar pago continua para quem paga', async () => {
  const c = db('coach1');
  const up = (data) => updateDoc(doc(c, 'users/stu1'), data);
  await assertFails(up({ monthlyFee: 0 }));                                              // zero sem isentar
  await assertFails(up({ paymentStatus: 'exempt' }));                                    // isentar sem zerar
  await assertFails(up({ paymentStatus: 'exempt', monthlyFee: 100 }));
  await assertFails(up({ paymentStatus: 'talvez', monthlyFee: 100 }));                   // situação inválida
  await assertSucceeds(up({ monthlyFee: 0, paymentStatus: 'exempt', lastPaymentUpdate: 'x' }));
  await assertFails(up({ paymentStatus: 'paid', paymentDate: 'x' }));                    // isento não "paga" sem valor
  await assertFails(up({ monthlyFee: 90 }));                                             // voltar a cobrar exige sair do isento junto
  await assertSucceeds(up({ monthlyFee: 90, paymentStatus: 'pending', lastPaymentUpdate: 'y' }));
  await assertSucceeds(up({ paymentStatus: 'paid', paymentDate: 'z', lastPaymentUpdate: 'z' }));
  await assertSucceeds(up({ paymentStatus: 'pending', lastPaymentUpdate: 'w' }));        // desfazer
});

test('aluno isento: o aluno não se isenta sozinho e outro treinador não mexe', async () => {
  await assertFails(updateDoc(doc(db('stu1'), 'users/stu1'), { monthlyFee: 0, paymentStatus: 'exempt' }));
  await assertFails(updateDoc(doc(db('coach2'), 'users/stu1'), { monthlyFee: 0, paymentStatus: 'exempt' }));
});

test('chat: vínculo encerrado — o treinador deixa de ler e escrever nas mensagens; o aluno continua dono da conversa', async () => {
  const id = 'coach1_stu1';
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'chats/' + id), { participants: ['coach1', 'stu1'], participantData: { coach1: { name: 'A', photo: '' }, stu1: { name: 'B', photo: '' } }, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), lastMessage: 'oi' });
    await setDoc(doc(f, 'chats/' + id + '/messages/m1'), { text: 'oi', senderId: 'stu1', createdAt: Timestamp.now(), senderName: 'B' });
  });
  const msg = (who) => setDoc(doc(db(who), 'chats/' + id + '/messages/' + who + '_novo'), { text: 'nova', senderId: who, createdAt: serverTimestamp(), senderName: 'x' });
  await assertSucceeds(getDocs(collection(db('coach1'), 'chats/' + id + '/messages')));       // vinculado: lê
  await assertSucceeds(msg('coach1'));
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'users/stu1'), { coachId: null }); });   // vínculo encerrado
  await assertFails(getDocs(collection(db('coach1'), 'chats/' + id + '/messages')));          // ex-treinador não lê
  await assertFails(getDoc(doc(db('coach1'), 'chats/' + id + '/messages/m1')));
  await assertFails(msg('coach1'));                                                           // nem escreve
  await assertFails(updateDoc(doc(db('coach1'), 'chats/' + id), { lastMessage: 'x', updatedAt: serverTimestamp() }));
  await assertSucceeds(getDocs(collection(db('stu1'), 'chats/' + id + '/messages')));         // o aluno segue lendo (exclusão de conta, histórico)
  await assertFails(msg('stu1'));                                                             // mas a conversa fica só para leitura: ele não escreve no ex-treinador
  await assertFails(updateDoc(doc(db('stu1'), 'chats/' + id), { lastMessage: 'x', updatedAt: serverTimestamp() }));
  await assertSucceeds(getDocs(query(collection(db('coach1'), 'chats'), where('participants', 'array-contains', 'coach1'))));   // a lista de conversas continua consultável
});

test('convite: admin que atua como treinador também cria o próprio convite (e continua sem criar para outro)', async () => {
  await assertSucceeds(setDoc(doc(db('admin1'), 'coachInvites/i_AdminCriaConvite1234'), invite({ coachId: 'admin1' })));
  await assertFails(setDoc(doc(db('admin1'), 'coachInvites/i_AdminCriaConvite1235'), invite({ coachId: 'coach1' })));
});

test('convite de admin: o aluno pede o vínculo normalmente (admin vale como treinador)', async () => {
  await seedStu3();
  await putInvite({ coachId: 'admin1' });
  await assertSucceeds(useInvite('stu3', { coachId: 'admin1' }));
});

test('resumo semanal: só o dono lê, grava e apaga; id e conteúdo validados', async () => {
  const ok = { uid: 'stu1', weekKey: '2026-W42', factsHash: 'v1-abc', text: 'Você concluiu 3 de 4 treinos.', source: 'ai', facts: { workouts: 3 }, updatedAt: '2026-10-14T10:00:00Z' };
  const ref = (who, id) => doc(db(who), 'weeklySummaries/' + id);
  await assertSucceeds(setDoc(ref('stu1', 'stu1_2026-W42'), ok));
  await assertSucceeds(setDoc(ref('stu1', 'stu1_2026-W42'), { ...ok, text: 'Novo texto com 4 de 4 treinos.' }));    // atualiza
  await assertSucceeds(getDoc(ref('stu1', 'stu1_2026-W42')));
  await assertFails(getDoc(ref('stu2', 'stu1_2026-W42')));                                        // outro aluno
  await assertFails(getDoc(ref('coach1', 'stu1_2026-W42')));                                      // nem o treinador vinculado
  await assertSucceeds(getDoc(ref('admin1', 'stu1_2026-W42')));
  await assertFails(setDoc(ref('stu2', 'stu1_2026-W42'), { ...ok, uid: 'stu2' }));                // id de outro
  await assertFails(setDoc(ref('stu1', 'stu1_2026-W41'), ok));                                    // id não bate com a semana
  await assertFails(setDoc(ref('stu1', 'stu1_2026-W42'), { ...ok, extra: 1 }));                   // campo extra
  await assertFails(setDoc(ref('stu1', 'stu1_2026-W42'), { ...ok, text: 'x'.repeat(801) }));      // texto grande
  await assertFails(setDoc(ref('stu1', 'stu1_2026-W42'), { ...ok, source: 'gpt' }));              // origem inválida
  await assertFails(setDoc(ref('stu1', 'stu1_2026-W42'), { ...ok, text: '' }));
  await assertSucceeds(getDocs(query(collection(db('stu1'), 'weeklySummaries'), where('uid', '==', 'stu1'))));
  await assertFails(getDocs(collection(db('stu1'), 'weeklySummaries')));
  await assertSucceeds(deleteDoc(ref('stu1', 'stu1_2026-W42')));
});

test('myWorkouts: foto só como JPEG pequeno em data URL; myExercises é privado e de formato fechado', async () => {
  const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const w = { name: 'Meu treino', exercises: [{ name: 'Supino' }], source: 'manual', createdAt: '2026-10-20' };
  await assertSucceeds(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/f1'), { ...w, photo: jpeg }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/f2'), { ...w, photo: 'data:image/svg+xml;base64,PHN2Zz4=' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/f3'), { ...w, photo: 'https://golpe.com/a.jpg' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/f4'), { ...w, photo: 'data:image/jpeg;base64,' + 'A'.repeat(141000) }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myWorkouts/f5'), { ...w, photo: 123 }));
  const e = { name: 'Minha remada', kind: 'strength', muscleGroup: 'costas', equipment: 'halter', sets: '3', reps: '10', rest: 60, note: '', createdAt: '2026-10-20' };
  await assertSucceeds(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e1'), { ...e, photo: jpeg }));
  await assertSucceeds(getDoc(doc(db('stu1'), 'users/stu1/myExercises/e1')));
  await assertFails(getDoc(doc(db('stu2'), 'users/stu1/myExercises/e1')));
  await assertFails(getDoc(doc(db('coach1'), 'users/stu1/myExercises/e1')));
  await assertFails(setDoc(doc(db('stu2'), 'users/stu1/myExercises/e2'), e));
  await assertFails(setDoc(doc(db('coach1'), 'users/coach1/myExercises/e3'), e));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e4'), { ...e, kind: 'magica' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e5'), { ...e, equipment: 'laser' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e6'), { ...e, muscleGroup: 'cabelo' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e7'), { ...e, extra: 'x' }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e8'), { ...e, name: 'x'.repeat(81) }));
  await assertFails(setDoc(doc(db('stu1'), 'users/stu1/myExercises/e9'), { ...e, photo: 'data:image/jpeg;base64,' + 'A'.repeat(51000) }));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'users/stu1/myExercises/e1')));
  await assertFails(deleteDoc(doc(db('stu2'), 'users/stu1/myExercises/e1')));
});

// ---- feed de amigos ----
const seedFeed = async ({ friends = 'active', shareA = true, shareB = true } = {}) => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const prof = (uid, share) => ({ uid, displayName: uid, displayNameLower: uid, handle: uid, photoURL: '', friendCode: 'ABCD2345', discoverable: false, shareRanking: false, shareWorkouts: share, weeklyGoal: 4, updatedAt: '2026-10-21' });
    await setDoc(doc(d, 'publicProfiles/stu1'), prof('stu1', shareA));
    await setDoc(doc(d, 'publicProfiles/stu2'), prof('stu2', shareB));
    await setDoc(doc(d, 'friendships/stu1_stu2'), { userA: 'stu1', userB: 'stu2', status: friends, requestedBy: 'stu1', createdAt: '2026-10-20', updatedAt: '2026-10-20', ...(friends === 'blocked' ? { blockedBy: 'stu2' } : {}) });
  });
};
const feedPost = (over = {}) => ({ authorId: 'stu1', kind: 'workout', title: 'Treino de Braço', minutes: 50, workSets: 12, exercises: 6, records: 1, weekCount: 2, createdAt: '2026-10-21T10:00:00.000Z', ...over });

test('feed: só quem ativou compartilhar publica, com formato fechado e sem cargas', async () => {
  await seedFeed();
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1'), feedPost()));
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p2'), feedPost({ volumeKg: 3300 })));                 // carga/volume não entra
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p3'), feedPost({ title: '' })));
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p4'), feedPost({ title: 'x'.repeat(61) })));
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p5'), feedPost({ minutes: 0 })));
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p6'), feedPost({ exercises: 41 })));
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p7'), feedPost({ kind: 'foto' })));
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p8'), feedPost({ authorId: 'stu2' })));               // em nome de outro
  await assertFails(setDoc(doc(db('stu2'), 'socialPosts/p9'), feedPost({ authorId: 'stu1' })));
  await assertFails(setDoc(doc(db('coach1'), 'socialPosts/p10'), feedPost({ authorId: 'coach1' })));          // só aluno
  await seedFeed({ shareA: false });
  await assertFails(setDoc(doc(db('stu1'), 'socialPosts/p11'), feedPost()));                                   // sem ativar compartilhar
});

test('feed: amigos ativos leem; estranho, bloqueado e ex-amigo não; autor sempre lê e apaga', async () => {
  await seedFeed();
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1'), feedPost()));
  await assertSucceeds(getDoc(doc(db('stu2'), 'socialPosts/p1')));
  await assertSucceeds(getDocs(query(collection(db('stu2'), 'socialPosts'), where('authorId', '==', 'stu1'))));
  await assertFails(getDoc(doc(db('coach1'), 'socialPosts/p1')));
  await assertFails(getDocs(query(collection(db('coach1'), 'socialPosts'), where('authorId', '==', 'stu1'))));
  await assertFails(updateDoc(doc(db('stu1'), 'socialPosts/p1'), { minutes: 60 }));                        // posts não mudam
  await assertFails(deleteDoc(doc(db('stu2'), 'socialPosts/p1')));
  await seedFeed({ friends: 'blocked' });
  await assertFails(getDoc(doc(db('stu2'), 'socialPosts/p1')));
  await seedFeed({ friends: 'removed' });
  await assertFails(getDoc(doc(db('stu2'), 'socialPosts/p1')));
  await assertSucceeds(getDoc(doc(db('stu1'), 'socialPosts/p1')));
  await seedFeed({ shareA: false });
  await assertFails(getDoc(doc(db('stu2'), 'socialPosts/p1')));                                            // desligou o compartilhamento: some para os amigos
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'socialPosts/p1')));
});

test('feed: curtidas só de amigos ativos, uma por pessoa, só o próprio id; autor e quem curtiu apagam', async () => {
  await seedFeed();
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1'), feedPost()));
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2'), { at: '2026-10-21T11:00:00.000Z', likerId: 'stu2' }));
  await assertFails(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu1'), { at: '2026-10-21T11:00:00.000Z', likerId: 'stu1' }));    // em nome de outro
  await assertFails(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2'), { at: '2026-10-21T11:00:00.000Z', likerId: 'stu2', extra: 1 }));
  await assertFails(setDoc(doc(db('coach1'), 'socialPosts/p1/likes/coach1'), { at: '2026-10-21T11:00:00.000Z', likerId: 'coach1' })); // estranho
  await assertFails(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2'), { at: '2026-10-21T11:00:00.000Z' }));                     // sem likerId
  await assertSucceeds(getDocs(collection(db('stu1'), 'socialPosts/p1/likes')));
  await assertSucceeds(getDocs(collection(db('stu2'), 'socialPosts/p1/likes')));
  await assertFails(getDocs(collection(db('coach1'), 'socialPosts/p1/likes')));
  await assertSucceeds(deleteDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2')));
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2'), { at: '2026-10-21T11:05:00.000Z', likerId: 'stu2' }));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'socialPosts/p1/likes/stu2')));                             // o autor limpa as curtidas do próprio post
  await assertFails(deleteDoc(doc(db('coach1'), 'socialPosts/p1/likes/stu2')));
});

test('curtidas dadas: cada um lista só as próprias (grupo de coleções) e apaga mesmo sem o post', async () => {
  await seedFeed();
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1'), feedPost()));
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2'), { at: '2026-10-21T11:00:00.000Z', likerId: 'stu2' }));
  await assertSucceeds(getDocs(query(collectionGroup(db('stu2'), 'likes'), where('likerId', '==', 'stu2'))));
  await assertFails(getDocs(query(collectionGroup(db('stu1'), 'likes'), where('likerId', '==', 'stu2'))));   // não lista curtida alheia
  await assertFails(getDocs(collectionGroup(db('stu2'), 'likes')));                                           // sem filtro
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'socialPosts/p1')));                                         // o autor apaga o post
  await assertSucceeds(deleteDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2')));                              // a curtida órfã ainda sai
});

test('perfil social aceita shareWorkouts booleano', async () => {
  const prof = { uid: 'stu1', displayName: 'Aluno 1', displayNameLower: 'aluno 1', handle: 'aluno1', photoURL: '', friendCode: 'ABCD2345', discoverable: false, shareRanking: false, weeklyGoal: 4, updatedAt: '2026-10-21' };
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'publicProfiles/stu1'), prof);
    await setDoc(doc(d, 'handles/aluno1'), { uid: 'stu1' });
    await setDoc(doc(d, 'friendCodes/ABCD2345'), { uid: 'stu1' });
  });
  await assertSucceeds(setDoc(doc(db('stu1'), 'publicProfiles/stu1'), { ...prof, shareWorkouts: true }));
  await assertFails(setDoc(doc(db('stu1'), 'publicProfiles/stu1'), { ...prof, shareWorkouts: 'sim' }));
});

test('denúncia de post: amigo que vê denuncia uma vez, sem texto livre; só o admin lê e remove', async () => {
  await seedFeed();
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1'), feedPost()));
  const rep = (over = {}) => ({ reporterId: 'stu2', postId: 'p1', authorId: 'stu1', reason: 'spam', createdAt: '2026-10-21T12:00:00.000Z', ...over });
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), rep({ reason: 'xingou' })));           // motivo fora da lista
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), rep({ texto: 'oi' })));                // sem texto livre
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), rep({ authorId: 'stu3' })));           // autor tem de bater com o post
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/qualquer'), rep()));                               // id fixo: uma denúncia por pessoa e post
  await assertFails(setDoc(doc(db('stu1'), 'socialReports/stu1_p1'), rep({ reporterId: 'stu1' })));         // o autor não denuncia o próprio post
  await assertFails(setDoc(doc(db('coach1'), 'socialReports/coach1_p1'), rep({ reporterId: 'coach1' })));   // quem não vê o post
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), rep()));
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), rep({ reason: 'ofensivo' })));        // não reescreve
  await assertSucceeds(getDoc(doc(db('stu2'), 'socialReports/stu2_p1')));
  await assertFails(getDoc(doc(db('stu1'), 'socialReports/stu2_p1')));                                     // o autor não sabe quem denunciou
  await assertFails(getDocs(collection(db('stu1'), 'socialReports')));
  await assertSucceeds(getDocs(collection(db('admin1'), 'socialReports')));
  await assertSucceeds(getDoc(doc(db('admin1'), 'socialPosts/p1')));                                       // o admin vê o post denunciado
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialPosts/p1/likes/stu2'), { at: '2026-10-21T11:00:00.000Z', likerId: 'stu2' }));
  await assertSucceeds(getDocs(collection(db('admin1'), 'socialPosts/p1/likes')));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'socialPosts/p1/likes/stu2')));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'socialPosts/p1')));
  await assertFails(updateDoc(doc(db('stu2'), 'socialReports/stu2_p1'), { status: 'dismissed' }));        // só o admin dispensa
  await assertFails(updateDoc(doc(db('admin1'), 'socialReports/stu2_p1'), { reason: 'outro' }));           // e só o status
  await assertSucceeds(updateDoc(doc(db('admin1'), 'socialReports/stu2_p1'), { status: 'dismissed' }));
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), rep()));                              // dispensada não é reaberta
  await assertFails(deleteDoc(doc(db('coach1'), 'socialReports/stu2_p1')));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'socialReports/stu2_p1')));
});

test('comentários: amigo que vê o post comenta (curto, sem link, sem edição); apagam autor, dono do post e admin; denúncia de comentário', async () => {
  await seedFeed();
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1'), feedPost()));
  const c = (over = {}) => ({ authorId: 'stu2', text: 'Mandou bem!', createdAt: serverTimestamp(), ...over });
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialPosts/p1/comments/c1'), c()));
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialPosts/p1/comments/c2'), c({ authorId: 'stu1', text: 'Valeu!' })));
  for (const bad of [c({ authorId: 'stu1' }), c({ text: '' }), c({ text: 'x'.repeat(281) }), c({ text: 'veja https://spam.example' }), c({ text: 'acessa www.site.com' }), c({ text: 'linha 1\nsite.com.br' }), c({ text: 'meu app x.dev' }), c({ text: 'discord.gg/abc' }), c({ text: '   \n  ' }), c({ extra: 1 }), c({ createdAt: '2099-01-01T00:00:00.000Z' })]) {
    await assertFails(setDoc(doc(db('stu2'), 'socialPosts/p1/comments/cx'), bad));
  }
  await assertFails(setDoc(doc(db('coach1'), 'socialPosts/p1/comments/c3'), c({ authorId: 'coach1' })));   // não vê o post
  await assertFails(updateDoc(doc(db('stu2'), 'socialPosts/p1/comments/c1'), { text: 'editado' }));
  await assertSucceeds(getDocs(collection(db('stu2'), 'socialPosts/p1/comments')));
  await assertFails(getDocs(collection(db('coach1'), 'socialPosts/p1/comments')));
  await assertSucceeds(getDocs(query(collectionGroup(db('stu2'), 'comments'), where('authorId', '==', 'stu2'))));
  await assertFails(getDocs(query(collectionGroup(db('stu1'), 'comments'), where('authorId', '==', 'stu2'))));
  // denúncia do comentário: id fixo, autor certo, sem denunciar o próprio
  const rep = (over = {}) => ({ reporterId: 'stu1', postId: 'p1', commentId: 'c1', authorId: 'stu2', reason: 'ofensivo', createdAt: '2026-10-22T12:00:00.000Z', ...over });
  await assertFails(setDoc(doc(db('stu1'), 'socialReports/stu1_p1'), rep()));                    // id de post com commentId
  await assertFails(setDoc(doc(db('stu1'), 'socialReports/stu1_p1_c1'), rep({ authorId: 'stu3' })));
  await assertFails(setDoc(doc(db('stu2'), 'socialReports/stu2_p1_c1'), rep({ reporterId: 'stu2' })));   // o próprio comentário
  await assertFails(setDoc(doc(db('coach1'), 'socialReports/coach1_p1_c1'), rep({ reporterId: 'coach1' })));   // quem não vê o post
  await assertFails(setDoc(doc(db('stu1'), 'socialReports/stu1_p1_nao'), rep({ commentId: 'nao' })));             // comentário que não existe
  await assertSucceeds(setDoc(doc(db('stu1'), 'socialReports/stu1_p1_c1'), rep()));
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialReports/stu2_p1'), { reporterId: 'stu2', postId: 'p1', authorId: 'stu1', reason: 'spam', createdAt: '2026-10-22T12:00:00.000Z' }));   // denúncia de post segue igual
  // apagar
  await assertFails(deleteDoc(doc(db('coach1'), 'socialPosts/p1/comments/c1')));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'socialPosts/p1/comments/c1')));                // dono do post apaga comentário alheio
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'socialPosts/p1/comments/c2')));                // o próprio
  await assertSucceeds(setDoc(doc(db('stu2'), 'socialPosts/p1/comments/c4'), c()));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'socialPosts/p1/comments/c4')));
});

// ---- Saúde (itens 15/19): avaliação física, anamnese e consentimento ----
const ISO = '2026-10-29T12:00:00.000Z';
const consent = (over = {}) => ({ coachId: 'coach1', version: '2026-10-29', acceptedAt: ISO, ...over });
const selfAssessment = (over = {}) => ({
  userId: 'stu1', kind: 'self', date: '2026-10-29', createdAt: ISO, createdBy: 'stu1',
  sex: 'male', age: 30, weight: 80.5, height: 178,
  perimeters: { arm: 35, chest: 100, waist: 82, hip: 98, thigh: 58, calf: 38 },
  skinfolds: { protocol: 'pollock3', chest: 10, abdomen: 20, thigh: 15 }, bodyFat: 14.2, notes: 'ok', ...over
});
const bioAssessment = (over = {}) => ({
  userId: 'stu1', kind: 'bioimpedance', date: '2026-10-29', createdAt: ISO, createdBy: 'stu1', weight: 80,
  bioimpedance: { bodyFat: 18, leanMass: 60, water: 55, visceralFat: 7 }, ...over
});
const instructorAssessment = (over = {}) => selfAssessment({ kind: 'instructor', coachId: 'coach1', createdBy: 'coach1', ...over });
const anamnesis = (over = {}) => ({
  userId: 'stu1', version: 1, createdAt: ISO, parq: [false, false, false, false, false, false, true],
  injuries: 'joelho', surgeries: '', medications: '', diseases: '', goals: 'saúde', routine: 'escritório', ...over
});
const seedHealth = async ({ withConsent = true } = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  if (withConsent) await setDoc(doc(d, 'healthConsents/stu1'), consent());
  await setDoc(doc(d, 'assessments/a1'), selfAssessment());
  await setDoc(doc(d, 'assessments/i1'), instructorAssessment());
  await setDoc(doc(d, 'anamneses/n1'), anamnesis());
  await setDoc(doc(d, 'users/stu3'), { uid: 'stu3', role: 'user', displayName: 'Aluno 3', coachId: 'admin1' });
  await setDoc(doc(d, 'healthConsents/stu3'), consent({ coachId: 'admin1' }));
  await setDoc(doc(d, 'assessments/a3'), selfAssessment({ userId: 'stu3', createdBy: 'stu3' }));
});
const listOf = (uid, col, owner = 'stu1') => getDocs(query(collection(db(uid), col), where('userId', '==', owner)));

test('saúde: aluno lê, lista e escreve as próprias avaliações (self/bioimpedância) e anamneses', async () => {
  await seedHealth({ withConsent: false });
  await assertSucceeds(getDoc(doc(db('stu1'), 'assessments/i1')));
  await assertSucceeds(listOf('stu1', 'assessments'));
  await assertSucceeds(listOf('stu1', 'anamneses'));
  await assertSucceeds(getDoc(doc(db('stu1'), 'healthConsents/stu1')));
  await assertSucceeds(setDoc(doc(db('stu1'), 'assessments/a2'), selfAssessment()));
  await assertSucceeds(setDoc(doc(db('stu1'), 'assessments/b1'), bioAssessment()));
  await assertSucceeds(updateDoc(doc(db('stu1'), 'assessments/a1'), { weight: 79, updatedAt: ISO }));
  await assertSucceeds(setDoc(doc(db('stu1'), 'anamneses/n2'), anamnesis({ version: 2 })));
  // aluno não lança avaliação "do instrutor", não forja autor, não edita a do instrutor nem a anamnese (versões)
  await assertFails(setDoc(doc(db('stu1'), 'assessments/x1'), instructorAssessment({ createdBy: 'stu1' })));
  await assertFails(setDoc(doc(db('stu1'), 'assessments/x2'), selfAssessment({ coachId: 'coach1' })));
  await assertFails(setDoc(doc(db('stu1'), 'assessments/x3'), selfAssessment({ createdBy: 'coach1' })));
  await assertFails(updateDoc(doc(db('stu1'), 'assessments/i1'), { weight: 70 }));
  await assertFails(updateDoc(doc(db('stu1'), 'assessments/a1'), { kind: 'instructor' }));
  await assertFails(updateDoc(doc(db('stu1'), 'assessments/a1'), { userId: 'stu2' }));
  await assertFails(updateDoc(doc(db('stu1'), 'anamneses/n1'), { injuries: 'nenhuma' }));
  // apaga tudo o que é dele, inclusive a avaliação do instrutor
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'assessments/i1')));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'assessments/a1')));
  await assertSucceeds(deleteDoc(doc(db('stu1'), 'anamneses/n1')));
});

test('saúde: professor vinculado SEM consentimento não lê nem escreve', async () => {
  await seedHealth({ withConsent: false });
  await assertFails(getDoc(doc(db('coach1'), 'assessments/a1')));
  await assertFails(getDoc(doc(db('coach1'), 'anamneses/n1')));
  await assertFails(listOf('coach1', 'assessments'));
  await assertFails(listOf('coach1', 'anamneses'));
  await assertFails(setDoc(doc(db('coach1'), 'assessments/i2'), instructorAssessment()));
  await assertFails(updateDoc(doc(db('coach1'), 'assessments/i1'), { weight: 70 }));
  await assertFails(deleteDoc(doc(db('coach1'), 'assessments/i1')));
  // pode saber que ainda não há consentimento (documento inexistente), sem erro; outro professor não
  await assertSucceeds(getDoc(doc(db('coach1'), 'healthConsents/stu1')));
  await assertFails(getDoc(doc(db('coach2'), 'healthConsents/stu1')));
});

test('saúde: professor vinculado COM consentimento lê e lança só avaliação do instrutor', async () => {
  await seedHealth();
  await assertSucceeds(getDoc(doc(db('coach1'), 'healthConsents/stu1')));
  await assertSucceeds(getDoc(doc(db('coach1'), 'assessments/a1')));
  await assertSucceeds(getDoc(doc(db('coach1'), 'anamneses/n1')));
  await assertSucceeds(listOf('coach1', 'assessments'));
  await assertSucceeds(listOf('coach1', 'anamneses'));
  await assertSucceeds(setDoc(doc(db('coach1'), 'assessments/i2'), instructorAssessment({ skinfolds: { protocol: 'pollock7', chest: 10, abdomen: 20, thigh: 15, triceps: 12, suprailiac: 14, subscapular: 16, midaxillary: 11 } })));
  await assertSucceeds(updateDoc(doc(db('coach1'), 'assessments/i1'), { weight: 79.9, updatedAt: ISO }));
  await assertFails(setDoc(doc(db('coach1'), 'assessments/x1'), selfAssessment({ createdBy: 'coach1' })));      // tipo do aluno
  await assertFails(setDoc(doc(db('coach1'), 'assessments/x2'), instructorAssessment({ coachId: 'coach2' })));  // em nome de outro
  await assertFails(setDoc(doc(db('coach1'), 'assessments/x3'), instructorAssessment({ createdBy: 'stu1' })));
  await assertFails(setDoc(doc(db('coach1'), 'assessments/x4'), instructorAssessment({ userId: 'stu2' })));     // aluno de outro
  await assertFails(updateDoc(doc(db('coach1'), 'assessments/a1'), { weight: 70 }));                            // a do aluno
  await assertFails(updateDoc(doc(db('coach1'), 'assessments/i1'), { userId: 'stu2' }));
  await assertFails(updateDoc(doc(db('coach1'), 'assessments/i1'), { coachId: 'coach2' }));
  await assertFails(setDoc(doc(db('coach1'), 'anamneses/n9'), anamnesis()));                                    // anamnese é do aluno
  await assertFails(deleteDoc(doc(db('coach1'), 'anamneses/n1')));
  await assertFails(deleteDoc(doc(db('coach1'), 'assessments/a1')));
  await assertSucceeds(deleteDoc(doc(db('coach1'), 'assessments/i1')));
  // não cria, não altera nem lista consentimentos
  await assertFails(setDoc(doc(db('coach1'), 'healthConsents/stu1'), consent({ version: 'x' })));
  await assertFails(getDocs(collection(db('coach1'), 'healthConsents')));
});

test('saúde: outro aluno, outro professor, admin e anônimo não acessam', async () => {
  await seedHealth();
  for (const uid of ['stu2', 'coach2', 'admin1']) {
    await assertFails(getDoc(doc(db(uid), 'assessments/a1')));
    await assertFails(getDoc(doc(db(uid), 'anamneses/n1')));
    await assertFails(getDoc(doc(db(uid), 'healthConsents/stu1')));
    await assertFails(listOf(uid, 'assessments'));
    await assertFails(listOf(uid, 'anamneses'));
    await assertFails(setDoc(doc(db(uid), 'assessments/z1'), instructorAssessment({ coachId: uid, createdBy: uid })));
    await assertFails(setDoc(doc(db(uid), 'anamneses/z1'), anamnesis()));
    await assertFails(updateDoc(doc(db(uid), 'assessments/a1'), { weight: 70 }));
    await assertFails(deleteDoc(doc(db(uid), 'assessments/a1')));
    await assertFails(deleteDoc(doc(db(uid), 'anamneses/n1')));
    await assertFails(deleteDoc(doc(db(uid), 'healthConsents/stu1')));
  }
  await assertFails(getDoc(doc(anonDb(), 'assessments/a1')));
  await assertFails(getDoc(doc(anonDb(), 'healthConsents/stu1')));
  await assertFails(getDocs(collection(db('admin1'), 'assessments')));
  await assertFails(getDocs(collection(db('admin1'), 'anamneses')));
  // admin como "treinador" vinculado e com consentimento também não lê: o acesso é só do papel professor
  await assertFails(getDoc(doc(db('admin1'), 'assessments/a3')));
  await assertFails(listOf('admin1', 'assessments', 'stu3'));
  await assertFails(setDoc(doc(db('admin1'), 'assessments/z3'), instructorAssessment({ userId: 'stu3', coachId: 'admin1', createdBy: 'admin1' })));
});

test('saúde: consentimento só para o professor vinculado atual; revogar corta na hora', async () => {
  await seedHealth({ withConsent: false });
  const ref = doc(db('stu1'), 'healthConsents/stu1');
  await assertFails(setDoc(ref, consent({ coachId: 'coach2' })));            // não é o professor dele
  await assertFails(setDoc(ref, consent({ extra: true })));
  await assertFails(setDoc(ref, consent({ version: 'x'.repeat(21) })));
  await assertFails(setDoc(ref, consent({ acceptedAt: 'ontem' })));
  await assertFails(setDoc(ref, { coachId: 'coach1', version: '1' }));
  await assertFails(setDoc(doc(db('stu2'), 'healthConsents/stu1'), consent()));
  await assertFails(setDoc(doc(db('stu2'), 'healthConsents/stu2'), consent()));   // o professor do stu2 é o coach2
  await assertSucceeds(setDoc(ref, consent()));
  await assertSucceeds(getDoc(doc(db('coach1'), 'assessments/a1')));
  await assertSucceeds(deleteDoc(ref));                                           // revoga
  await assertFails(getDoc(doc(db('coach1'), 'assessments/a1')));
  await assertFails(listOf('coach1', 'anamneses'));
  await assertFails(setDoc(doc(db('coach1'), 'assessments/i9'), instructorAssessment()));
});

test('saúde: vínculo trocado corta o acesso mesmo com consentimento antigo; o professor nomeado pode apagá-lo', async () => {
  await seedHealth();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users/stu1'), { coachId: 'coach2' });
  });
  await assertFails(getDoc(doc(db('coach1'), 'assessments/a1')));
  await assertFails(getDoc(doc(db('coach2'), 'assessments/a1')));               // o consentimento é para o coach1
  await assertFails(getDoc(doc(db('coach2'), 'healthConsents/stu1')));
  await assertFails(deleteDoc(doc(db('coach2'), 'healthConsents/stu1')));
  await assertSucceeds(deleteDoc(doc(db('coach1'), 'healthConsents/stu1')));    // professor nomeado encerra
  await assertFails(deleteDoc(doc(db('coach1'), 'healthConsents/stu2')));       // inexistente
  await assertFails(deleteDoc(doc(db('coach1'), 'healthConsents/stu3')));       // de outro professor
});

test('saúde: o aluno encerra o vínculo e apaga o consentimento no mesmo lote (existindo ou não)', async () => {
  await seedHealth();
  const b = writeBatch(db('stu1'));
  b.update(doc(db('stu1'), 'users/stu1'), { coachId: null, updatedAt: ISO });
  b.delete(doc(db('stu1'), 'healthConsents/stu1'));
  await assertSucceeds(b.commit());
  await assertFails(getDoc(doc(db('coach1'), 'assessments/a1')));
  const b2 = writeBatch(db('stu2'));
  b2.update(doc(db('stu2'), 'users/stu2'), { coachId: null, updatedAt: ISO });
  b2.delete(doc(db('stu2'), 'healthConsents/stu2'));                             // inexistente
  await assertSucceeds(b2.commit());
});

test('saúde: campos extras, tipos e tamanhos são recusados', async () => {
  await seedHealth({ withConsent: false });
  const put = (data) => setDoc(doc(db('stu1'), 'assessments/v1'), data);
  const bad = [
    selfAssessment({ extra: 1 }),
    selfAssessment({ kind: 'outro' }),
    selfAssessment({ date: '29/10/2026' }),
    selfAssessment({ weight: 5 }), selfAssessment({ weight: '80' }), selfAssessment({ height: 400 }),
    selfAssessment({ bodyFat: 90 }), selfAssessment({ age: 30.5 }), selfAssessment({ sex: 'x' }),
    selfAssessment({ notes: 'x'.repeat(501) }),
    selfAssessment({ perimeters: { arm: 35, neck: 40 } }), selfAssessment({ perimeters: { waist: 1000 } }),
    selfAssessment({ skinfolds: { protocol: 'durnin', chest: 10 } }), selfAssessment({ skinfolds: { chest: 10 } }),
    selfAssessment({ skinfolds: { protocol: 'pollock3', chest: 200 } }), selfAssessment({ skinfolds: { protocol: 'pollock3', knee: 5 } }),
    bioAssessment({ bioimpedance: { bodyFat: 18, bone: 3 } }), bioAssessment({ bioimpedance: { water: 150 } }),
    bioAssessment({ bioimpedance: 'x' })
  ];
  for (const data of bad) await assertFails(put(data));
  const { createdAt, ...noCreated } = selfAssessment();
  await assertFails(put(noCreated));
  await assertSucceeds(put(selfAssessment()));
  const putA = (data) => setDoc(doc(db('stu1'), 'anamneses/v1'), data);
  for (const data of [
    anamnesis({ extra: 1 }), anamnesis({ parq: [false, false] }), anamnesis({ parq: [false, false, false, false, false, false, 'sim'] }),
    anamnesis({ version: 0 }), anamnesis({ version: '1' }), anamnesis({ injuries: 'x'.repeat(1001) }), anamnesis({ goals: 5 }),
    anamnesis({ userId: 'stu2' })
  ]) await assertFails(putA(data));
  await assertSucceeds(putA(anamnesis()));
});

test('saúde: professor encerra o vínculo e apaga o consentimento no mesmo lote; revinculado, não lê sem novo consentimento', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'users/stuH'), { uid: 'stuH', role: 'user', coachId: 'coach1', displayName: 'H' });
    await setDoc(doc(d, 'healthConsents/stuH'), { coachId: 'coach1', version: '1', acceptedAt: '2026-10-29T10:00:00.000Z' });
    await setDoc(doc(d, 'assessments/aH'), { userId: 'stuH', kind: 'self', date: '2026-10-29', createdAt: '2026-10-29T10:00:00.000Z', createdBy: 'stuH', weight: 70 });
  });
  await assertSucceeds(getDoc(doc(db('coach1'), 'assessments/aH')));
  const b = writeBatch(db('coach1'));
  b.update(doc(db('coach1'), 'users/stuH'), { coachId: null, updatedAt: '2026-10-29T11:00:00.000Z' });
  b.delete(doc(db('coach1'), 'healthConsents/stuH'));
  await assertSucceeds(b.commit());
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'users/stuH'), { coachId: 'coach1' }); });   // vinculado de novo
  await assertFails(getDoc(doc(db('coach1'), 'assessments/aH')));                                     // sem consentimento novo

// ---- desafios em grupo (dias ativos) ----
const dayUTC = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const CH = 'ch1';
const CODE = 'DESAF123';
const chDoc = (over = {}) => ({ name: 'Outubro forte', durationDays: 7, startDay: dayUTC(0), endDay: dayUTC(6), ownerId: 'stu1', code: CODE, memberCount: 1, status: 'active', createdAt: serverTimestamp(), ...over });
const chMember = (uid, over = {}) => ({ uid, displayName: 'Pessoa ' + uid, handle: 'user_' + uid, code: CODE, joinedAt: serverTimestamp(), activeDays: 0, lastDay: '', updatedAt: serverTimestamp(), ...over });
const createCh = (uid = 'stu1', { ch = {}, member = {}, code = CODE, codeDoc = true, memberDoc = true, id = CH } = {}) => {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, 'challenges/' + id), chDoc({ ownerId: uid, code, ...ch }));
  if (codeDoc) b.set(doc(d, 'challengeCodes/' + code), { challengeId: id });
  if (memberDoc) b.set(doc(d, `challenges/${id}/members/${uid}`), chMember(uid, { code, ...member }));
  return b.commit();
};
const joinCh = (uid, { code = CODE, bump = 1, member = {}, id = CH, withCount = true } = {}) => {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, `challenges/${id}/members/${uid}`), chMember(uid, { code, ...member }));
  if (withCount) b.update(doc(d, 'challenges/' + id), { memberCount: increment(bump) });
  return b.commit();
};
const leaveCh = (uid, { bump = -1, id = CH, withCount = true } = {}) => {
  const d = db(uid);
  const b = writeBatch(d);
  b.delete(doc(d, `challenges/${id}/members/${uid}`));
  if (withCount) b.update(doc(d, 'challenges/' + id), { memberCount: increment(bump) });
  return b.commit();
};
// Desafio que começou há `ago` dias com stu1 (dono) e stu2 como membros.
const seedCh = async ({ ago = 3, durationDays = 7, status = 'active', memberCount = 2 } = {}) => {
  await seedSocial();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const now = Timestamp.now();
    await setDoc(doc(d, 'challenges/' + CH), { ...chDoc({ startDay: dayUTC(-ago), endDay: dayUTC(-ago + durationDays - 1), durationDays, status, memberCount }), createdAt: now });
    await setDoc(doc(d, 'challengeCodes/' + CODE), { challengeId: CH });
    await setDoc(doc(d, `challenges/${CH}/members/stu1`), { ...chMember('stu1'), joinedAt: now, updatedAt: now });
    await setDoc(doc(d, `challenges/${CH}/members/stu2`), { ...chMember('stu2'), joinedAt: now, updatedAt: now });
  });
};
const reseedCh = async (opts) => { await env.clearFirestore(); await seedCh(opts); };
const score = (uid, activeDays, lastDay, over = {}) => updateDoc(doc(db(uid), `challenges/${CH}/members/${uid}`), { activeDays, lastDay, updatedAt: serverTimestamp(), ...over });

test('desafios: criar exige código e o dono como primeiro membro, no mesmo lote, com formato válido', async () => {
  await seedSocial();
  await assertFails(createCh('stu1', { codeDoc: false }));
  await assertFails(createCh('stu1', { memberDoc: false }));
  for (const ch of [{ memberCount: 2 }, { durationDays: 10, endDay: dayUTC(9) }, { endDay: dayUTC(7) }, { name: 'x'.repeat(41) }, { name: '   ' },
    { name: 'entra em spam.com/x' }, { startDay: dayUTC(-3), endDay: dayUTC(3) }, { startDay: dayUTC(2), endDay: dayUTC(8) }, { extra: 1 },
    { status: 'ended' }, { createdAt: Timestamp.fromMillis(Date.now() - 86_400_000) }, { startDay: '2026-13-01' }, { durationDays: '7' }]) {
    await assertFails(createCh('stu1', { ch }));
  }
  await assertFails(createCh('stu1', { member: { displayName: 'Outra pessoa' } }));      // nome diferente do perfil social
  await assertFails(createCh('stu1', { member: { activeDays: 1, lastDay: dayUTC(0) } }));  // placar começa zerado
  await assertFails(createCh('coach1'));                                                  // sem perfil social
  await assertFails(createCh('stu1', { ch: { ownerId: 'stu2' } }));
  await assertSucceeds(createCh('stu1', { ch: { durationDays: 30, endDay: dayUTC(29) } }));
  // o código já está reservado: outro desafio não o reaproveita nem aponta o código para si
  await assertFails(createCh('stu2', { id: 'ch2' }));
  await assertFails(setDoc(doc(db('stu2'), 'challengeCodes/' + CODE), { challengeId: 'ch2' }));
  await assertFails(deleteDoc(doc(db('stu2'), 'challengeCodes/' + CODE)));
  await assertSucceeds(createCh('stu2', { id: 'ch2', code: 'OUTRO234' }));
});

test('desafios: só membros leem o desafio e a lista; o código é legível por quem o tem', async () => {
  await seedCh();
  await assertSucceeds(getDoc(doc(db('stu2'), 'challenges/' + CH)));
  await assertSucceeds(getDocs(collection(db('stu2'), `challenges/${CH}/members`)));
  await assertFails(getDoc(doc(db('stu3'), 'challenges/' + CH)));
  await assertFails(getDocs(collection(db('stu3'), `challenges/${CH}/members`)));
  await assertFails(getDoc(doc(db('stu3'), `challenges/${CH}/members/stu1`)));
  await assertFails(getDoc(doc(db('admin1'), 'challenges/' + CH)));
  await assertFails(getDoc(doc(anonDb(), 'challenges/' + CH)));
  await assertFails(getDocs(collection(db('stu1'), 'challenges')));
  await assertSucceeds(getDoc(doc(db('stu3'), 'challengeCodes/' + CODE)));
  await assertFails(getDoc(doc(anonDb(), 'challengeCodes/' + CODE)));
  await assertFails(getDocs(collection(db('stu3'), 'challengeCodes')));
  await assertSucceeds(getDoc(doc(db('stu3'), `challenges/${CH}/members/stu3`)));        // o próprio (inexistente), para saber se já entrou
  await assertSucceeds(getDocs(query(collectionGroup(db('stu2'), 'members'), where('uid', '==', 'stu2'))));
  await assertFails(getDocs(query(collectionGroup(db('stu3'), 'members'), where('uid', '==', 'stu2'))));
  await assertFails(getDocs(collectionGroup(db('stu2'), 'members')));
});

test('desafios: entrar pelo código sobe o contador junto; limite de 50, encerrado e terminado barram', async () => {
  await seedCh();
  await assertFails(joinCh('stu3', { code: 'ERRADO12' }));                    // código diferente do desafio
  await assertFails(joinCh('stu3', { withCount: false }));
  await assertFails(joinCh('stu3', { bump: 2 }));
  await assertFails(joinCh('stu3', { member: { displayName: 'Pessoa stu1' } }));
  await assertFails(joinCh('stu3', { member: { activeDays: 3, lastDay: dayUTC(-1) } }));
  await assertFails(updateDoc(doc(db('stu3'), 'challenges/' + CH), { memberCount: increment(1) }));   // contador sem membro
  await assertFails(updateDoc(doc(db('stu3'), 'challenges/' + CH), { name: 'Meu agora' }));
  await assertSucceeds(joinCh('stu3'));
  await assertSucceeds(getDoc(doc(db('stu3'), 'challenges/' + CH)));
  await assertFails(joinCh('stu3'));                                           // já é membro
  await assertFails(joinCh('stu2'));                                           // idem

  await reseedCh({ memberCount: 50 });
  await assertFails(joinCh('stu3'));                                           // cheio
  await reseedCh({ memberCount: 49 });
  await assertSucceeds(joinCh('stu3'));                                        // 50º
  await reseedCh({ status: 'ended' });
  await assertFails(joinCh('stu3'));
  await reseedCh({ ago: 10 });                                                 // terminou há 4 dias
  await assertFails(joinCh('stu3'));
});

test('desafios: placar sobe no máximo 1 dia por dia, dentro do período e nunca no futuro', async () => {
  await seedCh({ ago: 3 });                                                    // começou há 3 dias (hoje é o 4º dia)
  await assertFails(score('stu2', 2, dayUTC(-3)));                             // 2 dias num dia só
  await assertFails(score('stu2', 1, dayUTC(-4)));                             // antes do início
  await assertFails(score('stu2', 1, dayUTC(2)));                              // no futuro
  await assertFails(score('stu2', 1, ''));
  await assertFails(score('stu2', 5, dayUTC(0)));                              // mais que os dias decorridos
  await assertFails(score('stu2', 31, dayUTC(0)));
  await assertFails(score('stu2', 1, dayUTC(-3), { code: 'OUTRO123' }));
  await assertFails(score('stu2', 1, dayUTC(-3), { displayName: 'Outro nome' }));
  await assertFails(score('stu2', 1, dayUTC(-3), { updatedAt: Timestamp.fromMillis(Date.now() - 60_000) }));
  await assertFails(updateDoc(doc(db('stu1'), `challenges/${CH}/members/stu2`), { activeDays: 1, lastDay: dayUTC(-3), updatedAt: serverTimestamp() }));   // placar de outro
  await assertSucceeds(score('stu2', 1, dayUTC(-3)));
  await assertSucceeds(score('stu2', 3, dayUTC(-1)));                          // recupera 2 dias de uma vez (2 dias de calendário depois)
  await assertFails(score('stu2', 5, dayUTC(0)));                              // +2 em 1 dia
  await assertFails(score('stu2', 2, dayUTC(-1)));                             // nunca diminui
  await assertFails(score('stu2', 3, dayUTC(0)));                              // mesmo número, outro dia
  await assertSucceeds(score('stu2', 4, dayUTC(0)));
  await assertFails(score('stu2', 5, dayUTC(0)));                              // o mesmo dia não conta duas vezes
  await assertSucceeds(score('stu2', 4, dayUTC(0)));                           // regravar igual é inofensivo
  // nome e @ podem acompanhar o perfil social
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'publicProfiles/stu2'), { displayName: 'Nome novo' }); });
  await assertSucceeds(score('stu2', 4, dayUTC(0), { displayName: 'Nome novo' }));

  // depois do fim e com o desafio encerrado o placar congela
  await reseedCh({ ago: 10 });
  await assertFails(score('stu2', 1, dayUTC(-2)));                             // fora do período (terminou há 4 dias)
  await assertSucceeds(score('stu2', 1, dayUTC(-8)));                          // dia dentro do período
  await reseedCh({ status: 'ended' });
  await assertFails(score('stu2', 1, dayUTC(-3)));
});

test('desafios: sair a qualquer momento (contador desce junto); o dono encerra ou apaga', async () => {
  await seedCh();
  await assertFails(leaveCh('stu2', { withCount: false }));
  await assertFails(leaveCh('stu2', { bump: -2 }));
  await assertFails(deleteDoc(doc(db('stu3'), `challenges/${CH}/members/stu2`)));
  await assertFails(deleteDoc(doc(db('stu1'), `challenges/${CH}/members/stu2`)));   // dono não expulsa sem apagar o desafio
  await assertFails(leaveCh('stu1'));                                               // o dono não sai
  await assertSucceeds(leaveCh('stu2'));
  await assertFails(getDoc(doc(db('stu2'), 'challenges/' + CH)));                   // perdeu o acesso
  await assertSucceeds(joinCh('stu2'));                                             // pode voltar com o código

  // encerrar: só o dono, só o status
  await assertFails(updateDoc(doc(db('stu2'), 'challenges/' + CH), { status: 'ended' }));
  await assertFails(updateDoc(doc(db('stu1'), 'challenges/' + CH), { status: 'ended', name: 'Outro' }));
  await assertSucceeds(updateDoc(doc(db('stu1'), 'challenges/' + CH), { status: 'ended' }));
  await assertFails(updateDoc(doc(db('stu1'), 'challenges/' + CH), { status: 'active' }));
  await assertSucceeds(leaveCh('stu2'));                                            // sair de encerrado continua valendo

  // apagar: só o dono, liberando o código no mesmo lote, com os membros
  await reseedCh();
  await assertFails(deleteDoc(doc(db('stu2'), 'challenges/' + CH)));
  await assertFails(deleteDoc(doc(db('stu1'), 'challenges/' + CH)));               // sem liberar o código
  const d = db('stu1');
  const b = writeBatch(d);
  b.delete(doc(d, `challenges/${CH}/members/stu2`));
  b.delete(doc(d, `challenges/${CH}/members/stu1`));
  b.delete(doc(d, 'challengeCodes/' + CODE));
  b.delete(doc(d, 'challenges/' + CH));
  await assertSucceeds(b.commit());

  // sobra de desafio que não existe mais: cada um apaga só a própria
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, `challenges/${CH}/members/stu2`), { ...chMember('stu2'), joinedAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await setDoc(doc(f, `challenges/${CH}/members/stu3`), { ...chMember('stu3'), joinedAt: Timestamp.now(), updatedAt: Timestamp.now() });
  });
  await assertFails(deleteDoc(doc(db('stu2'), `challenges/${CH}/members/stu3`)));
  await assertSucceeds(deleteDoc(doc(db('stu2'), `challenges/${CH}/members/stu2`)));
});
