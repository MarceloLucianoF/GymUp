// Testes das regras do Firestore no emulador. Rode: make test-rules (requer Java 11+).
const { test, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment, assertFails, assertSucceeds
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, updateDoc, getDocs, collection, query, where } = require('firebase/firestore');

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
