import { collection, doc, getDoc, getDocs, increment, limit, query, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Vínculo aluno-treinador. Quem pede é o aluno; quem aceita é o treinador. As regras do Firestore garantem que
// users.coachId só vira o treinador quando o aceite acontece no mesmo lote (ver firestore.rules > coachLinks).

export const LINK_STATUS = { pending: 'pending', active: 'active', rejected: 'rejected', revoked: 'revoked' };
const now = () => new Date().toISOString();

export const normalizeCode = (value) => String(value || '').trim().replace(/^.*\/convite\//i, '').replace(/[?#].*$/, '').trim();

/** Estado exibido ao aluno a partir do perfil e do documento do vínculo. */
export function linkState(profile, link) {
  if (profile?.coachId) return 'active'; // inclui vínculos antigos, sem documento em coachLinks
  if (link?.status === LINK_STATUS.pending) return 'pending';
  if (link?.status === LINK_STATUS.rejected) return 'rejected';
  if (link?.status === LINK_STATUS.revoked) return 'revoked';
  return 'none';
}

export async function getMyLink(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'coachLinks', uid));
  return snap.exists() ? snap.data() : null;
}

/** Lista curta de treinadores com perfil público (nome, foto e bio), para o aluno escolher. */
export async function listPublicCoaches(max = 60) {
  const snap = await getDocs(query(collection(db, 'publicCoachProfiles'), limit(max)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((c) => c.role === 'coach');
}

export const filterCoaches = (coaches, term) => {
  const q = String(term || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return coaches.filter((c) => !q || `${c.displayName} ${c.bio || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
};

// ---- Convite por link: validade, limite de usos e revogação (coachInvites) ----
export const INVITE_RE = /^i_[A-Za-z0-9]{20}$/;
export const isInviteId = (value) => INVITE_RE.test(String(value || ''));
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const webRandom = (bytes) => {
  const webCrypto = typeof window !== 'undefined' ? window.crypto : null;
  if (webCrypto?.getRandomValues) return webCrypto.getRandomValues(bytes);
  return bytes.map(() => Math.floor(Math.random() * 256)); // só em ambiente sem Web Crypto (testes)
};

export function newInviteId(randomValues = webRandom) {
  const bytes = randomValues(new Uint8Array(20));
  return `i_${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

export const INVITE_MESSAGES = {
  missing: 'Convite não encontrado. Confira o link.',
  revoked: 'Este convite foi cancelado pelo treinador.',
  expired: 'Este convite expirou. Peça um novo link ao treinador.',
  exhausted: 'Este convite já atingiu o limite de usos. Peça um novo link ao treinador.'
};

const toMs = (value) => (typeof value?.toMillis === 'function' ? value.toMillis() : Number(value) || 0);

/** ok | revoked | expired | exhausted | missing */
export function inviteStatus(invite, nowMs = Date.now()) {
  if (!invite) return 'missing';
  if (invite.revoked) return 'revoked';
  if (toMs(invite.expiresAt) <= nowMs) return 'expired';
  if ((invite.uses || 0) >= (invite.maxUses || 0)) return 'exhausted';
  return 'ok';
}

/** O treinador cria um convite: validade em dias (1 a 30) e número máximo de usos (1 a 200). */
export async function createInvite(coachId, { days = 7, maxUses = 10 } = {}) {
  const d = Math.min(30, Math.max(1, Math.round(Number(days) || 7)));
  const m = Math.min(200, Math.max(1, Math.round(Number(maxUses) || 10)));
  const id = newInviteId();
  await setDoc(doc(db, 'coachInvites', id), {
    coachId, createdAt: now(), expiresAt: Timestamp.fromMillis(Date.now() + d * 86_400_000), maxUses: m, uses: 0, revoked: false
  });
  return id;
}

export async function listInvites(coachId) {
  const snap = await getDocs(query(collection(db, 'coachInvites'), where('coachId', '==', coachId)));
  return snap.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function revokeInvite(id) {
  await updateDoc(doc(db, 'coachInvites', id), { revoked: true });
}

/** Dados públicos do convite (o ID é o segredo): situação e nome do treinador. Nenhum dado do aluno. */
export async function getInviteInfo(id) {
  if (!isInviteId(id)) return { id, status: 'missing' };
  const snap = await getDoc(doc(db, 'coachInvites', id));
  if (!snap.exists()) return { id, status: 'missing' };
  const invite = snap.data();
  let coachName = '';
  try { const c = await getDoc(doc(db, 'publicCoachProfiles', invite.coachId)); coachName = c.exists() ? c.data().displayName || '' : ''; } catch (e) { /* sem nome */ }
  return { id, coachId: invite.coachId, coachName, status: inviteStatus(invite), expiresAt: invite.expiresAt, usesLeft: Math.max(0, (invite.maxUses || 0) - (invite.uses || 0)) };
}

/** Confere um código de treinador ou um convite (pode ser o link inteiro), sem login: só dados públicos. */
export async function resolveCoachCode(raw) {
  const code = normalizeCode(raw);
  if (!code) return null;
  if (isInviteId(code)) {
    const info = await getInviteInfo(code);
    return { kind: 'invite', code, ok: info.status === 'ok', coachName: info.coachName || '', message: info.status === 'ok' ? '' : (INVITE_MESSAGES[info.status] || INVITE_MESSAGES.missing) };
  }
  const snap = await getDoc(doc(db, 'publicCoachProfiles', code));
  if (!snap.exists()) return { kind: 'coach', code, ok: false, coachName: '', message: 'Código de treinador inválido.' };
  return { kind: 'coach', code, ok: true, coachName: snap.data().displayName || '', message: '' };
}

/** Pedido de vínculo por convite: grava o pedido pendente e soma 1 uso no mesmo lote (as regras exigem as duas coisas juntas). */
export async function requestWithInvite(student, inviteId) {
  const info = await getInviteInfo(inviteId);
  if (info.status !== 'ok') throw new Error(INVITE_MESSAGES[info.status] || INVITE_MESSAGES.missing);
  if (info.coachId === student.uid) throw new Error('Esse convite é o seu.');
  const existing = await getMyLink(student.uid).catch(() => null);
  const batch = writeBatch(db);
  batch.set(doc(db, 'coachLinks', student.uid), {
    studentId: student.uid,
    studentName: String(student.displayName || 'Aluno').slice(0, 100),
    coachId: info.coachId,
    status: LINK_STATUS.pending,
    requestedBy: 'student',
    inviteId,
    createdAt: existing?.createdAt || now(),
    updatedAt: now()
  });
  batch.update(doc(db, 'coachInvites', inviteId), { uses: increment(1) });
  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === 'permission-denied') throw new Error('Não foi possível usar este convite agora. Peça um novo link ao treinador.');
    throw error;
  }
  return { coachId: info.coachId, coachName: info.coachName || 'Treinador' };
}

/** O aluno pede o vínculo. Falha com mensagem clara se o código não for de um treinador. */
export async function requestCoach(student, rawCode) {
  const coachId = normalizeCode(rawCode);
  if (isInviteId(coachId)) return requestWithInvite(student, coachId);
  if (!coachId) throw new Error('Informe o código do treinador.');
  if (coachId === student.uid) throw new Error('Esse código é o seu.');
  const coachSnap = await getDoc(doc(db, 'publicCoachProfiles', coachId));
  if (!coachSnap.exists()) throw new Error('Treinador não encontrado. Confira o código.');
  const existing = await getMyLink(student.uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'coachLinks', student.uid), {
    studentId: student.uid,
    studentName: String(student.displayName || 'Aluno').slice(0, 100),
    coachId,
    status: LINK_STATUS.pending,
    requestedBy: 'student',
    createdAt: existing?.createdAt || now(),
    updatedAt: now()
  });
  await batch.commit();
  return { coachId, coachName: coachSnap.data().displayName || 'Treinador' };
}

/** O aluno cancela o pedido ou encerra o vínculo ativo: coachId volta a null e o acesso do treinador acaba. */
export async function endMyLink(uid) {
  const link = await getMyLink(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { coachId: null, updatedAt: now() });
  if (link) batch.update(doc(db, 'coachLinks', uid), { status: LINK_STATUS.revoked, updatedAt: now() });
  // Consentimento de saúde é para aquele professor: sai junto (não revive se o vínculo voltar).
  batch.delete(doc(db, 'healthConsents', uid));
  batch.delete(doc(db, 'coachShares', uid));   // idem para o que compartilhava (treinos próprios, medidas)
  await batch.commit();
}

/** Cancelar só o pedido pendente (o aluno ainda não tem treinador: não mexe no perfil). */
export async function cancelRequest(uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'coachLinks', uid), { status: LINK_STATUS.revoked, updatedAt: now() });
  await batch.commit();
}

export async function listPendingForCoach(coachId) {
  const snap = await getDocs(query(collection(db, 'coachLinks'), where('coachId', '==', coachId), where('status', '==', LINK_STATUS.pending)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** O treinador aceita: o vínculo vira active e o aluno passa a ter coachId, no mesmo lote. */
export async function acceptLink(coachId, studentId, monthlyFee = null) {
  const fee = monthlyFee === null || monthlyFee === undefined ? null : parseFee(monthlyFee);
  if (monthlyFee !== null && monthlyFee !== undefined && fee === null) throw new Error('Informe uma mensalidade maior que zero.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'coachLinks', studentId), { status: LINK_STATUS.active, updatedAt: now() });
  // Novo vínculo: a mensalidade (padrão do treinador, editável) fica registrada no aluno, com pagamento pendente.
  batch.update(doc(db, 'users', studentId), { coachId, updatedAt: now(), ...(fee !== null ? { monthlyFee: fee, paymentStatus: 'pending' } : {}) });
  await batch.commit();
}

/** Valor de mensalidade válido (maior que zero; com allowZero, aceita 0 = isento; até 100000), ou null. Aceita vírgula decimal. */
export function parseFee(value, { allowZero = false } = {}) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  return (n > 0 || (allowZero && n === 0)) && n <= 100000 ? n : null;
}

export async function rejectLink(studentId) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'coachLinks', studentId), { status: LINK_STATUS.rejected, updatedAt: now() });
  await batch.commit();
}

/** O treinador encerra o vínculo de um aluno dele. */
export async function endStudentLink(studentId) {
  const link = await getMyLink(studentId).catch(() => null);
  // O consentimento de saúde dado a este professor sai NO MESMO LOTE do fim do vínculo: assim nunca sobra um consentimento
  // antigo que voltaria a valer se o mesmo professor fosse vinculado de novo.
  const consent = await getDoc(doc(db, 'healthConsents', studentId)).catch(() => null);
  const myConsent = consent?.exists?.() && consent.data()?.coachId === auth.currentUser?.uid;
  const share = await getDoc(doc(db, 'coachShares', studentId)).catch(() => null);
  const myShare = share?.exists?.() && share.data()?.coachId === auth.currentUser?.uid;
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', studentId), { coachId: null, updatedAt: now() });
  if (link) batch.update(doc(db, 'coachLinks', studentId), { status: LINK_STATUS.revoked, updatedAt: now() });
  if (myConsent) batch.delete(doc(db, 'healthConsents', studentId));
  if (myShare) batch.delete(doc(db, 'coachShares', studentId));   // idem para o que o aluno compartilhou
  await batch.commit();
}
