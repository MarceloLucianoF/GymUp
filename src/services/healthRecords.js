import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { bodyFatPercent } from '../utils/bodyComposition';

// Avaliação física, anamnese e consentimento (itens 15/19). Dado de saúde é sensível (LGPD art. 11): o professor
// vinculado só lê com healthConsents/{uid} em nome dele; o admin não lê. Contrato e regras: firestore.rules > "Saúde".

export const CONSENT_VERSION = '2026-10-29';
export const ASSESSMENT_KINDS = { instructor: 'Avaliação do professor', bioimpedance: 'Bioimpedância', self: 'Avaliação própria' };
export const PERIMETERS = { arm: 'Braço', chest: 'Tórax', waist: 'Cintura', hip: 'Quadril', thigh: 'Coxa', calf: 'Panturrilha' };
export const BIO_FIELDS = { bodyFat: ['Gordura', '%'], leanMass: ['Massa magra', 'kg'], water: ['Água', '%'], visceralFat: ['Gordura visceral', ''] };
export const PARQ_QUESTIONS = [
  'Algum médico já disse que você tem problema de coração e que só deve fazer atividade física recomendada por ele?',
  'Você sente dor no peito quando pratica atividade física?',
  'No último mês, você sentiu dor no peito sem estar fazendo atividade física?',
  'Você perde o equilíbrio por tontura ou já perdeu a consciência alguma vez?',
  'Você tem algum problema nos ossos ou articulações que pode piorar com atividade física?',
  'Algum médico receita remédio para sua pressão ou para o coração?',
  'Você sabe de algum outro motivo pelo qual não deveria fazer atividade física?'
];
export const ANAMNESIS_TEXTS = {
  injuries: 'Lesões', surgeries: 'Cirurgias', medications: 'Medicamentos', diseases: 'Doenças', goals: 'Objetivos', routine: 'Rotina'
};

const LIMITS = { weight: [20, 400], height: [80, 250], bodyFat: [2, 70] };
const PERIMETER_RANGE = [5, 250];
const SKINFOLD_RANGE = [1, 90];
const BIO_RANGE = { bodyFat: [1, 80], leanMass: [5, 200], water: [10, 90], visceralFat: [0, 60] };
const SKINFOLD_KEYS = ['chest', 'abdomen', 'thigh', 'triceps', 'suprailiac', 'subscapular', 'midaxillary'];

const nowIso = () => new Date().toISOString();
const newId = (col) => doc(collection(db, col)).id;

/** Número (aceita vírgula) dentro do intervalo, com 1 casa; senão undefined. */
export function toNumber(value, [lo, hi]) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < lo || n > hi) return undefined;
  return Math.round(n * 10) / 10;
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

const pickNumbers = (source = {}, keys, rangeOf) => {
  const out = {};
  keys.forEach((k) => {
    const n = toNumber(source[k], rangeOf(k));
    if (n !== undefined) out[k] = n;
  });
  return Object.keys(out).length ? out : undefined;
};

/** Monta o documento de avaliação com só os campos do contrato (as regras recusam o resto). */
export function buildAssessment(form, { userId, authorId, kind, coachId }) {
  if (!ASSESSMENT_KINDS[kind]) throw new Error('Tipo de avaliação inválido.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(form.date || '')) ? form.date : nowIso().slice(0, 10);
  const out = { userId, kind, date, createdAt: nowIso(), createdBy: authorId };
  if (kind === 'instructor') out.coachId = coachId;
  if (form.sex === 'male' || form.sex === 'female') out.sex = form.sex;
  const age = Number.parseInt(form.age, 10);
  if (Number.isInteger(age) && age >= 10 && age <= 100) out.age = age;
  ['weight', 'height'].forEach((k) => {
    const n = toNumber(form[k], LIMITS[k]);
    if (n !== undefined) out[k] = n;
  });
  const perimeters = pickNumbers(form.perimeters, Object.keys(PERIMETERS), () => PERIMETER_RANGE);
  if (perimeters) out.perimeters = perimeters;
  const protocol = form.skinfolds?.protocol;
  if (protocol === 'pollock3' || protocol === 'pollock7') {
    const folds = pickNumbers(form.skinfolds, SKINFOLD_KEYS, () => SKINFOLD_RANGE);
    if (folds) {
      out.skinfolds = { protocol, ...folds };
      const pct = bodyFatPercent({ protocol, sex: out.sex, age: out.age, skinfolds: folds });
      if (pct !== null) out.bodyFat = pct;
    }
  }
  const bio = pickNumbers(form.bioimpedance, Object.keys(BIO_FIELDS), (k) => BIO_RANGE[k]);
  if (bio) out.bioimpedance = bio;
  const notes = text(form.notes, 500);
  if (notes) out.notes = notes;
  return out;
}

/** Monta a anamnese (PAR-Q com 7 respostas sim/não e textos curtos). */
export function buildAnamnesis(form, { userId, version }) {
  const parq = PARQ_QUESTIONS.map((_, i) => form.parq?.[i] === true);
  const out = { userId, version, createdAt: nowIso(), parq };
  Object.keys(ANAMNESIS_TEXTS).forEach((k) => {
    const v = text(form[k], 1000);
    if (v) out[k] = v;
  });
  return out;
}

export const parqNeedsClearance = (parq = []) => parq.some((answer) => answer === true);

const byDateDesc = (a, b) => String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt))
  || String(b.createdAt).localeCompare(String(a.createdAt));

/** Avaliações do aluno, mais recente primeiro. Sem orderBy: dispensa índice composto (volume pequeno por aluno). */
export async function listAssessments(userId) {
  const snap = await getDocs(query(collection(db, 'assessments'), where('userId', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDateDesc);
}

export async function listAnamneses(userId) {
  const snap = await getDocs(query(collection(db, 'anamneses'), where('userId', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.version || 0) - (a.version || 0));
}

export async function saveAssessment(form, ctx) {
  const data = buildAssessment(form, ctx);
  const id = newId('assessments');
  await setDoc(doc(db, 'assessments', id), data);
  return { id, ...data };
}

export async function deleteAssessment(id) {
  await deleteDoc(doc(db, 'assessments', id));
}

/** Cada envio vira uma versão nova (as regras não deixam editar anamnese). */
export async function saveAnamnesis(form, { userId, previous = [] }) {
  const version = Math.min(1000, previous.reduce((max, a) => Math.max(max, a.version || 0), 0) + 1);
  const data = buildAnamnesis(form, { userId, version });
  const id = newId('anamneses');
  await setDoc(doc(db, 'anamneses', id), data);
  return { id, ...data };
}

export async function deleteAnamnesis(id) {
  await deleteDoc(doc(db, 'anamneses', id));
}

/** Consentimento atual ou null. Para o professor, "sem permissão" também quer dizer "não autorizou". */
export async function getConsent(userId) {
  try {
    const snap = await getDoc(doc(db, 'healthConsents', userId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    if (error?.code === 'permission-denied') return null;
    throw error;
  }
}

/** O aluno autoriza o professor vinculado atual (as regras exigem que coachId seja o do perfil). */
export async function grantConsent(userId, coachId) {
  if (!coachId) throw new Error('Você ainda não tem professor vinculado.');
  const data = { coachId, version: CONSENT_VERSION, acceptedAt: nowIso() };
  await setDoc(doc(db, 'healthConsents', userId), data);
  return data;
}

/** Revogar corta o acesso do professor na hora (nada é apagado das avaliações). */
export async function revokeConsent(userId) {
  await deleteDoc(doc(db, 'healthConsents', userId));
}

/** Consentimento válido para este professor. */
export const consentCovers = (consent, coachId) => !!consent && !!coachId && consent.coachId === coachId;

/** Diferenças numéricas entre duas avaliações (b - a), para a comparação lado a lado. */
export function compareAssessments(a, b) {
  const rows = [];
  const push = (label, unit, va, vb) => {
    if (va === undefined && vb === undefined) return;
    const delta = typeof va === 'number' && typeof vb === 'number' ? Math.round((vb - va) * 10) / 10 : null;
    rows.push({ label, unit, a: va, b: vb, delta });
  };
  push('Peso', 'kg', a?.weight, b?.weight);
  push('Altura', 'cm', a?.height, b?.height);
  push('Gordura (dobras)', '%', a?.bodyFat, b?.bodyFat);
  Object.entries(BIO_FIELDS).forEach(([k, [label, unit]]) => push(`${label} (bioimpedância)`, unit, a?.bioimpedance?.[k], b?.bioimpedance?.[k]));
  Object.entries(PERIMETERS).forEach(([k, label]) => push(label, 'cm', a?.perimeters?.[k], b?.perimeters?.[k]));
  return rows;
}
