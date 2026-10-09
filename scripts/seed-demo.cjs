/* eslint-disable */
// Seed de DEMONSTRAÇÃO, aditivo e idempotente (IDs fixos "demo_*"). NÃO apaga nada.
// Uso: node scripts/seed-demo.cjs            -> prévia (não grava)
//      node scripts/seed-demo.cjs --apply    -> grava no Firestore/Auth do projeto
// Todos os dados são fictícios. Senha das contas demo: DEMO_PASSWORD (padrão "123456").
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const APPLY = process.argv.includes('--apply');
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json não encontrado.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();
const auth = getAuth();
const PASSWORD = process.env.DEMO_PASSWORD || '123456';

// Treinador real do projeto (login Google) recebe os alunos demo para popular o painel.
const COACH_UID = 'bDDFE2kKpDagWh18OiNKMJojGbR2';

// PRNG determinístico para dados reprodutíveis.
let seed = 42;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const daysAgo = (n, hour = 18) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hour, Math.floor(rand() * 50), 0, 0); return d; };

const ex = (name, muscleGroup, sets, reps, rest, base) => ({ firestoreId: `demo_ex_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name, muscleGroup, sets: String(sets), reps: String(reps), rest, machineImage: null, base });

const TRAININGS = [
  { id: 'demo_training_a', name: 'Treino A — Peito e Tríceps', category: 'Hipertrofia', difficulty: 'Intermediário', description: 'Empurrar: peitoral, ombro anterior e tríceps.',
    exercises: [ex('Supino Reto', 'Peitoral', 4, '8-10', 90, 60), ex('Supino Inclinado Halteres', 'Peitoral', 3, '10-12', 75, 24), ex('Crucifixo Máquina', 'Peitoral', 3, '12', 60, 40), ex('Tríceps Corda', 'Tríceps', 3, '12-15', 60, 30), ex('Tríceps Testa', 'Tríceps', 3, '10-12', 60, 25)] },
  { id: 'demo_training_b', name: 'Treino B — Costas e Bíceps', category: 'Hipertrofia', difficulty: 'Intermediário', description: 'Puxar: dorsais, trapézio e bíceps.',
    exercises: [ex('Puxada Frontal', 'Dorsal', 4, '8-10', 90, 55), ex('Remada Curvada', 'Dorsal', 4, '8-10', 90, 50), ex('Remada Baixa', 'Dorsal', 3, '10-12', 75, 45), ex('Rosca Direta', 'Bíceps', 3, '10-12', 60, 30), ex('Rosca Martelo', 'Bíceps', 3, '12', 60, 14)] },
  { id: 'demo_training_c', name: 'Treino C — Pernas e Ombros', category: 'Hipertrofia', difficulty: 'Avançado', description: 'Quadríceps, posterior, glúteos e ombros.',
    exercises: [ex('Agachamento Livre', 'Quadríceps', 4, '6-8', 120, 80), ex('Leg Press 45', 'Quadríceps', 4, '10-12', 90, 200), ex('Mesa Flexora', 'Posterior', 3, '12', 60, 40), ex('Elevação Lateral', 'Ombros', 4, '12-15', 45, 10), ex('Panturrilha em Pé', 'Panturrilha', 4, '15', 45, 60)] },
  { id: 'demo_training_fb', name: 'Full Body Express', category: 'Resistência', difficulty: 'Iniciante', description: 'Corpo todo em 40 minutos.',
    exercises: [ex('Agachamento Goblet', 'Quadríceps', 3, '12', 60, 20), ex('Flexão de Braço', 'Peitoral', 3, '10-15', 45, 0), ex('Remada Unilateral', 'Dorsal', 3, '12', 45, 18), ex('Prancha', 'Abdômen', 3, '40s', 30, 0)] }
];

const STUDENTS = [
  { uid: 'demo_student_1', name: 'Ana Beatriz Lima', email: 'ana.demo@academyup.com', goal: 'Hipertrofia', weight: 62, height: 165, age: 27, freq: 0.9, fee: 150, pay: 'paid' },
  { uid: 'demo_student_2', name: 'Bruno Carvalho', email: 'bruno.demo@academyup.com', goal: 'Emagrecimento', weight: 94, height: 178, age: 34, freq: 0.7, fee: 120, pay: 'paid' },
  { uid: 'demo_student_3', name: 'Carla Mendes', email: 'carla.demo@academyup.com', goal: 'Força', weight: 70, height: 170, age: 31, freq: 0.8, fee: 150, pay: 'pending' },
  { uid: 'demo_student_4', name: 'Diego Ferreira', email: 'diego.demo@academyup.com', goal: 'Hipertrofia', weight: 82, height: 181, age: 25, freq: 0.5, fee: 120, pay: 'overdue' },
  { uid: 'demo_student_5', name: 'Elisa Rocha', email: 'elisa.demo@academyup.com', goal: 'Resistência', weight: 58, height: 160, age: 29, freq: 0.6, fee: 100, pay: 'paid' },
  { uid: 'demo_student_6', name: 'Felipe Andrade', email: 'felipe.demo@academyup.com', goal: 'Emagrecimento', weight: 101, height: 183, age: 41, freq: 0.2, fee: 120, pay: 'overdue' },
  { uid: 'demo_student_7', name: 'Gabriela Souza', email: 'gabriela.demo@academyup.com', goal: 'Hipertrofia', weight: 66, height: 168, age: 23, freq: 0.95, fee: 180, pay: 'paid' },
  { uid: 'demo_student_8', name: 'Henrique Alves', email: 'henrique.demo@academyup.com', goal: 'Força', weight: 88, height: 176, age: 38, freq: 0.1, fee: 120, pay: 'pending' }
];

function buildCheckIns(student) {
  const items = [];
  const order = ['demo_training_a', 'demo_training_b', 'demo_training_c'];
  let cursor = 0;
  for (let day = 41; day >= 0; day -= 1) {
    if (rand() > student.freq * 0.55) continue; // ~3-5x/semana nos mais assíduos
    const training = TRAININGS.find((t) => t.id === order[cursor % 3]);
    cursor += 1;
    const progress = 1 + (41 - day) * 0.004;
    let volume = 0; let setsCompleted = 0;
    const exercises = training.exercises.map((e) => {
      const sets = Array.from({ length: Number(e.sets) }, () => {
        const weight = Math.max(0, Math.round(e.base * progress * (0.9 + rand() * 0.2)));
        const reps = 6 + Math.floor(rand() * 7);
        volume += weight * reps; setsCompleted += 1;
        return { weight, reps, completed: true };
      });
      return { name: e.name, muscleGroup: e.muscleGroup, sets };
    });
    const date = daysAgo(day);
    items.push({
      id: `demo_ci_${student.uid.split('_').pop()}_${String(41 - day).padStart(2, '0')}`,
      userId: student.uid, userEmail: student.email, userPhoto: null,
      trainingId: training.id, trainingName: training.name, coachId: COACH_UID,
      date: date.toISOString(), createdAt: date.toISOString(),
      duration: 2400 + Math.floor(rand() * 1800), totalVolume: volume, setsCompleted, exercises
    });
  }
  return items;
}

function buildMeasurements(student) {
  const goalDelta = /emagre/i.test(student.goal) ? -0.35 : /hiper|for/i.test(student.goal) ? 0.18 : 0;
  return Array.from({ length: 8 }, (_, i) => ({
    id: `demo_ms_${student.uid.split('_').pop()}_${i}`,
    userId: student.uid, type: 'weight', photo: null,
    weight: Number((student.weight - goalDelta * (7 - i) + (rand() - 0.5) * 0.4).toFixed(1)),
    date: daysAgo((7 - i) * 7, 8).toISOString()
  }));
}

async function ensureAuth(uid, email, displayName) {
  try {
    await auth.getUser(uid);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid, email, password: PASSWORD, displayName, emailVerified: true });
  }
}

async function main() {
  const plan = { trainings: TRAININGS.length, students: STUDENTS.length, checkIns: 0, measurements: 0 };
  const writes = [];
  const now = Timestamp.now();

  for (const t of TRAININGS) {
    writes.push([db.collection('trainings').doc(t.id), {
      name: t.name, description: t.description, category: t.category, difficulty: t.difficulty, coachId: COACH_UID, createdBy: COACH_UID,
      estimatedTime: '50 min', isAIGenerated: false, createdAt: now, updatedAt: now,
      exercises: t.exercises.map(({ base, ...rest }) => rest)
    }]);
  }

  for (const [index, s] of STUDENTS.entries()) {
    writes.push([db.collection('users').doc(s.uid), {
      uid: s.uid, email: s.email, displayName: s.name, role: 'user', coachId: COACH_UID, goal: s.goal,
      weight: s.weight, height: s.height, age: s.age, photoURL: null, monthlyFee: s.fee, paymentStatus: s.pay,
      paymentDate: s.pay === 'paid' ? daysAgo(5).toISOString() : null,
      currentTrainingId: TRAININGS[index % 3].id, createdAt: daysAgo(60).toISOString()
    }]);
    const cis = buildCheckIns(s);
    const ms = buildMeasurements(s);
    plan.checkIns += cis.length; plan.measurements += ms.length;
    for (const { id, ...data } of cis) writes.push([db.collection('checkIns').doc(id), data]);
    for (const { id, ...data } of ms) writes.push([db.collection('measurements').doc(id), data]);
    if (cis.length) writes.push([db.collection('users').doc(s.uid), { lastWorkoutDate: cis[cis.length - 1].date }]);
  }

  // Perfil público do treinador (único dado do treinador legível pelos alunos).
  const coachDoc = await db.collection('users').doc(COACH_UID).get();
  writes.push([db.collection('publicCoachProfiles').doc(COACH_UID), {
    uid: COACH_UID, displayName: coachDoc.get('displayName') || 'Treinador', photoURL: coachDoc.get('photoURL') || '',
    bio: coachDoc.get('bio') || '', role: coachDoc.get('role') || 'coach', updatedAt: new Date().toISOString()
  }]);

  // Conversa de exemplo entre o treinador e a primeira aluna.
  const chatId = [COACH_UID, 'demo_student_1'].sort().join('_');
  writes.push([db.collection('chats').doc(chatId), {
    participants: [COACH_UID, 'demo_student_1'],
    participantData: { [COACH_UID]: { name: 'Treinador', photo: '' }, demo_student_1: { name: 'Ana Beatriz Lima', photo: '' } },
    lastMessage: 'Perfeito, vamos aumentar a carga na próxima semana! 💪', createdAt: now, updatedAt: now
  }]);
  const msgs = [
    ['demo_student_1', 'Oi! Consegui bater 60kg no supino hoje 🎉'],
    [COACH_UID, 'Excelente evolução, Ana! Como foi a recuperação?'],
    ['demo_student_1', 'Ótima, sem dor nenhuma.'],
    [COACH_UID, 'Perfeito, vamos aumentar a carga na próxima semana! 💪']
  ];
  msgs.forEach(([senderId, text], i) => writes.push([db.collection('chats').doc(chatId).collection('messages').doc(`demo_msg_${i}`), {
    text, senderId, senderName: senderId === COACH_UID ? 'Treinador' : 'Ana Beatriz Lima', createdAt: Timestamp.fromDate(daysAgo(1, 9 + i))
  }]));

  console.log(`Plano: ${JSON.stringify(plan)} | documentos: ${writes.length} | modo: ${APPLY ? 'APLICAR' : 'PRÉVIA'}`);
  if (!APPLY) return;

  for (const s of STUDENTS) await ensureAuth(s.uid, s.email, s.name);
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(([ref, data]) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
  console.log('Seed demo aplicado. Alunos demo: <nome>.demo@academyup.com com a senha DEMO_PASSWORD.');
}

main().catch((error) => { console.error('Erro no seed demo:', error.message); process.exit(1); });
