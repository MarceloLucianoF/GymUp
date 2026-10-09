#!/usr/bin/env node
// MCP do AcademyUp: gerencia fichas de treino, alunos e atribuições no Firestore.
// Escritas só são aplicadas com apply:true; sem isso retornam uma prévia (dry run).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeTraining, findUnknownExercises, summarizeTraining } from './lib/training.js';
import { audit } from './lib/audit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'workout-tracker-app-20e43';

function initFirebase() {
  if (admin.apps.length) return;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: PROJECT_ID });
    return;
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(here, '..', 'serviceAccountKey.json');
  if (!existsSync(keyPath)) {
    throw new Error('Credencial não encontrada: defina GOOGLE_APPLICATION_CREDENTIALS ou use FIRESTORE_EMULATOR_HOST.');
  }
  const credential = admin.credential.cert(JSON.parse(readFileSync(keyPath, 'utf8')));
  admin.initializeApp({ credential, projectId: PROJECT_ID });
}

const db = () => {
  initFirebase();
  return admin.firestore();
};

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });
const guard = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (error) {
    return fail(error?.issues ? `Validação: ${JSON.stringify(error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))}` : String(error?.message || error));
  }
};

const applyFlag = z.boolean().default(false).describe('false = apenas prévia (dry run); true = grava no Firestore');
const toPlain = (doc) => ({ id: doc.id, ...doc.data() });

async function libraryNames() {
  const snap = await db().collection('exercises').select('name').get();
  return snap.docs.map((d) => d.get('name')).filter(Boolean);
}

const server = new McpServer({ name: 'academyup', version: '1.0.0' });

server.tool('list_trainings', 'Lista fichas de treino (resumo).',
  { coachId: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) },
  guard(async ({ coachId, limit }) => {
    let q = db().collection('trainings');
    if (coachId) q = q.where('coachId', '==', coachId);
    const snap = await q.limit(limit).get();
    return snap.docs.map((d) => summarizeTraining(toPlain(d)));
  }));

server.tool('get_training', 'Retorna uma ficha completa.', { id: z.string().min(1) },
  guard(async ({ id }) => {
    const doc = await db().collection('trainings').doc(id).get();
    if (!doc.exists) throw new Error('Ficha não encontrada.');
    return toPlain(doc);
  }));

server.tool('list_exercises', 'Busca exercícios da biblioteca por nome/grupo muscular.',
  { search: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) },
  guard(async ({ search, limit }) => {
    const snap = await db().collection('exercises').get();
    const term = (search || '').toLowerCase();
    return snap.docs.map(toPlain)
      .filter((e) => !term || `${e.name} ${e.muscleGroup || ''}`.toLowerCase().includes(term))
      .slice(0, limit)
      .map((e) => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup || null }));
  }));

server.tool('upsert_training',
  'Cria (sem id) ou atualiza (com id) uma ficha. Valida o formato e avisa sobre exercícios fora da biblioteca.',
  { id: z.string().optional(), training: z.record(z.any()), apply: applyFlag },
  guard(async ({ id, training, apply }) => {
    const data = normalizeTraining(training);
    const unknown = findUnknownExercises(data, await libraryNames());
    const result = { action: id ? 'update' : 'create', id: id || '(novo)', preview: data, unknownExercises: unknown, applied: false };
    if (!apply) return result;

    const ref = id ? db().collection('trainings').doc(id) : db().collection('trainings').doc();
    if (id && !(await ref.get()).exists) throw new Error('Ficha a atualizar não existe.');
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(id ? { ...data, updatedAt: stamp } : { ...data, createdAt: stamp, updatedAt: stamp }, { merge: Boolean(id) });
    audit({ tool: 'upsert_training', id: ref.id, action: result.action });
    return { ...result, id: ref.id, applied: true };
  }));

server.tool('duplicate_training', 'Duplica uma ficha com novo nome.',
  { id: z.string().min(1), newName: z.string().min(1).max(80), apply: applyFlag },
  guard(async ({ id, newName, apply }) => {
    const src = await db().collection('trainings').doc(id).get();
    if (!src.exists) throw new Error('Ficha de origem não existe.');
    const { createdAt, updatedAt, firestoreId, ...rest } = src.data();
    const copy = { ...rest, name: newName };
    if (!apply) return { action: 'duplicate', from: id, preview: { name: newName, exercises: (copy.exercises || []).length }, applied: false };
    const ref = db().collection('trainings').doc();
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({ ...copy, createdAt: stamp, updatedAt: stamp });
    audit({ tool: 'duplicate_training', from: id, id: ref.id });
    return { action: 'duplicate', from: id, id: ref.id, applied: true };
  }));

server.tool('delete_training', 'Apaga uma ficha. Exige apply:true E confirm:true.',
  { id: z.string().min(1), apply: applyFlag, confirm: z.boolean().default(false) },
  guard(async ({ id, apply, confirm }) => {
    const ref = db().collection('trainings').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Ficha não existe.');
    const summary = summarizeTraining({ id, ...doc.data() });
    if (!apply || !confirm) return { action: 'delete', target: summary, applied: false, note: 'Passe apply:true e confirm:true para apagar.' };
    await ref.delete();
    audit({ tool: 'delete_training', id });
    return { action: 'delete', target: summary, applied: true };
  }));

server.tool('list_students', 'Lista alunos vinculados a um treinador.', { coachId: z.string().min(1) },
  guard(async ({ coachId }) => {
    const snap = await db().collection('users').where('role', '==', 'user').where('coachId', '==', coachId).get();
    return snap.docs.map((d) => ({ id: d.id, displayName: d.get('displayName'), goal: d.get('goal') ?? null, currentTrainingId: d.get('currentTrainingId') ?? null }));
  }));

server.tool('assign_training', 'Define a ficha atual de um aluno (users/{id}.currentTrainingId).',
  { studentId: z.string().min(1), trainingId: z.string().min(1), apply: applyFlag },
  guard(async ({ studentId, trainingId, apply }) => {
    const [student, training] = await Promise.all([
      db().collection('users').doc(studentId).get(),
      db().collection('trainings').doc(trainingId).get()
    ]);
    if (!student.exists || student.get('role') !== 'user') throw new Error('Aluno não encontrado.');
    if (!training.exists) throw new Error('Ficha não encontrada.');
    const result = { action: 'assign', student: student.get('displayName') ?? studentId, training: training.get('name'), applied: false };
    if (!apply) return result;
    await student.ref.update({ currentTrainingId: trainingId, updatedAt: new Date().toISOString() });
    audit({ tool: 'assign_training', studentId, trainingId });
    return { ...result, applied: true };
  }));

server.tool('get_student_history', 'Últimos check-ins (treinos realizados) de um aluno.',
  { studentId: z.string().min(1), limit: z.number().int().min(1).max(30).default(10) },
  guard(async ({ studentId, limit }) => {
    const snap = await db().collection('checkIns').where('userId', '==', studentId).orderBy('date', 'desc').limit(limit).get();
    return snap.docs.map((d) => {
      const c = d.data();
      return { id: d.id, date: c.date, trainingName: c.trainingName, totalVolume: c.totalVolume, setsCompleted: c.setsCompleted, duration: c.duration };
    });
  }));

await server.connect(new StdioServerTransport());
