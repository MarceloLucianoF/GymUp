import { collection, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, Timestamp, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// V2.0 academias (docs/V2_ACADEMIAS.md). Papel na academia nunca altera users.role. Toda ação administrativa grava o
// registro de auditoria no MESMO lote da mudança; as regras (firestore.rules > V2: ACADEMIAS) recusam o lote sem ele.

export const ACADEMY_ROLES = ['owner', 'admin', 'teacher', 'reception', 'student'];
export const ADHERENCE = { onTrack: 'em_dia', late: 'atrasado', noData: 'sem_dados' };
const ADHERENCE_DAYS = 7;
const now = () => new Date().toISOString();
const rand = (n, alphabet) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => alphabet[v % alphabet.length]).join('');

export const newAcademyId = () => rand(20, 'abcdefghijklmnopqrstuvwxyz0123456789');
export const newInviteId = () => `ai_${rand(20, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}`;
export const INVITE_RE = /^ai_[A-Za-z0-9]{20}$/;
export const isAcademyInviteId = (v) => INVITE_RE.test(String(v || ''));
export const memberId = (academyId, userId) => `${academyId}_${userId}`;

/** Aderência mínima a partir do documento academyMemberStats: sem cargas, medidas nem histórico. */
export function adherenceStatus(stats, nowMs = Date.now()) {
  if (!stats?.validUntil) return ADHERENCE.noData;
  const ms = typeof stats.validUntil.toMillis === 'function' ? stats.validUntil.toMillis() : Date.parse(stats.validUntil);
  if (!Number.isFinite(ms)) return ADHERENCE.noData;
  return ms > nowMs ? ADHERENCE.onTrack : ADHERENCE.late;
}

/** validUntil gravado após um check-in: agora + 7 dias (a regra aceita no máximo 7 dias + 1 h). */
export const adherenceValidUntil = (nowMs = Date.now()) => Timestamp.fromMillis(nowMs + ADHERENCE_DAYS * 86400000);

function audit(batch, userId, academyId, id, action, targetType, targetId, detail = '') {
  batch.set(doc(db, 'academyAuditLog', id), { academyId, actorId: userId, action, targetType, targetId, at: serverTimestamp(), ...(detail ? { detail: String(detail).slice(0, 200) } : {}) });
}
const newAuditId = () => doc(collection(db, 'academyAuditLog')).id;

const baseMember = (academyId, userId, role, displayName, extra = {}) => ({
  academyId, userId, role, status: 'active', displayName: String(displayName || '').slice(0, 80),
  consent: { adherence: false }, createdAt: now(), updatedAt: now(), ...extra
});

export async function createAcademy(user, name) {
  const academyId = newAcademyId();
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'academies', academyId), { name: String(name).trim(), ownerId: user.uid, status: 'active', createdAt: now(), updatedAt: now(), auditId });
  batch.set(doc(db, 'academyMembers', memberId(academyId, user.uid)), baseMember(academyId, user.uid, 'owner', user.displayName, { auditId }));
  audit(batch, user.uid, academyId, auditId, 'academy.created', 'academy', academyId);
  await batch.commit();
  return academyId;
}

export async function listMyMemberships(userId) {
  const snap = await getDocs(query(collection(db, 'academyMembers'), where('userId', '==', userId)));
  const active = snap.docs.map((d) => d.data()).filter((m) => m.status === 'active');
  return Promise.all(active.map(async (m) => {
    const a = await getDoc(doc(db, 'academies', m.academyId));
    return { ...m, academy: a.exists() ? { id: a.id, ...a.data() } : { id: m.academyId, name: 'Academia' } };
  }));
}

export async function listAcademyMembers(academyId) {
  const snap = await getDocs(query(collection(db, 'academyMembers'), where('academyId', '==', academyId)));
  return snap.docs.map((d) => d.data()).filter((m) => m.status === 'active');
}

export async function listAcademyInvites(academyId) {
  const snap = await getDocs(query(collection(db, 'academyInvites'), where('academyId', '==', academyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Estado exibido de um convite: ok | revoked | expired | exhausted. */
export function academyInviteStatus(inv, nowMs = Date.now()) {
  if (!inv) return 'missing';
  if (inv.revoked) return 'revoked';
  const exp = typeof inv.expiresAt?.toMillis === 'function' ? inv.expiresAt.toMillis() : Date.parse(inv.expiresAt);
  if (!Number.isFinite(exp) || exp <= nowMs) return 'expired';
  if ((inv.uses || 0) >= (inv.maxUses || 0)) return 'exhausted';
  return 'ok';
}

export const ROLE_LABEL = { owner: 'Proprietário', admin: 'Administrador', teacher: 'Professor', reception: 'Recepção', student: 'Aluno' };

export async function createAcademyInvite(user, academy, { role, days = 7, maxUses = 20 }) {
  const id = newInviteId();
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'academyInvites', id), {
    academyId: academy.id, academyName: academy.name, role, expiresAt: Timestamp.fromMillis(Date.now() + days * 86400000 + 60000),
    maxUses, uses: 0, revoked: false, createdBy: user.uid, createdAt: now(), auditId
  });
  audit(batch, user.uid, academy.id, auditId, 'invite.created', 'invite', id);
  await batch.commit();
  return id;
}

export async function revokeAcademyInvite(user, invite) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'academyInvites', invite.id), { revoked: true, auditId });
  audit(batch, user.uid, invite.academyId, auditId, 'invite.revoked', 'invite', invite.id);
  await batch.commit();
}

export async function getAcademyInviteInfo(inviteId) {
  if (!isAcademyInviteId(inviteId)) return null;
  const snap = await getDoc(doc(db, 'academyInvites', inviteId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Entra na academia com o papel do convite; soma 1 uso no mesmo lote. Quem já saiu volta pelo mesmo caminho. */
export async function joinAcademy(user, invite, { adherenceConsent = false } = {}) {
  const auditId = newAuditId();
  const ref = doc(db, 'academyMembers', memberId(invite.academyId, user.uid));
  const prev = await getDoc(ref);
  const batch = writeBatch(db);
  const consent = { adherence: !!adherenceConsent };
  if (prev.exists()) {
    const asg = doc(db, 'academyAssignments', memberId(invite.academyId, user.uid));
    const asgSnap = await getDoc(asg);
    if (asgSnap.exists() && asgSnap.data().status !== 'ended') {
      batch.update(asg, { status: 'ended', updatedAt: now(), auditId }); // o mesmo registro 'member.joined' cobre o encerramento
    }
    batch.update(ref, { status: 'active', role: invite.role, inviteId: invite.id, consent, displayName: String(user.displayName || '').slice(0, 80), updatedAt: now(), auditId });
  } else {
    batch.set(ref, baseMember(invite.academyId, user.uid, invite.role, user.displayName, { inviteId: invite.id, consent, auditId }));
  }
  batch.update(doc(db, 'academyInvites', invite.id), { uses: increment(1) });
  audit(batch, user.uid, invite.academyId, auditId, 'member.joined', 'member', user.uid);
  await batch.commit();
}

export async function leaveAcademy(user, academyId) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'academyMembers', memberId(academyId, user.uid)), { status: 'left', updatedAt: now(), auditId });
  batch.delete(doc(db, 'academyMemberStats', memberId(academyId, user.uid))); // sair apaga a aderência (exigido pelas regras)
  audit(batch, user.uid, academyId, auditId, 'member.left', 'member', user.uid);
  await batch.commit();
}

/** Consentimento de aderência. Revogar apaga o status mínimo no mesmo lote (exigido pelas regras). */
export async function setAdherenceConsent(user, academyId, allowed) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'academyMembers', memberId(academyId, user.uid)), { consent: { adherence: !!allowed }, updatedAt: now(), auditId });
  if (!allowed) batch.delete(doc(db, 'academyMemberStats', memberId(academyId, user.uid)));
  audit(batch, user.uid, academyId, auditId, 'member.consent', 'member', user.uid, allowed ? 'concedido' : 'revogado');
  await batch.commit();
}

/** Equipe altera papel/status de um membro abaixo dela (nunca de si nem do proprietário). */
export async function updateMember(actor, member, patch) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'academyMembers', memberId(member.academyId, member.userId)), { ...patch, updatedAt: now(), auditId });
  audit(batch, actor.uid, member.academyId, auditId, 'member.updated', 'member', member.userId);
  await batch.commit();
}

/** Equipe propõe (ou transfere) o professor responsável; o aluno precisa aceitar antes de qualquer acesso. */
export async function proposeAssignment(actor, academyId, studentId, teacherId) {
  const ref = doc(db, 'academyAssignments', memberId(academyId, studentId));
  const prev = await getDoc(ref);
  const auditId = newAuditId();
  const batch = writeBatch(db);
  if (prev.exists()) {
    const p = prev.data();
    batch.update(ref, { teacherId, status: 'pending', requestedBy: actor.uid, previousTeacherId: p.teacherId, updatedAt: now(), auditId });
    audit(batch, actor.uid, academyId, auditId, p.status === 'active' ? 'assignment.transferred' : 'assignment.proposed', 'assignment', studentId);
  } else {
    batch.set(ref, { academyId, studentId, teacherId, status: 'pending', requestedBy: actor.uid, previousTeacherId: '', createdAt: now(), updatedAt: now(), auditId });
    audit(batch, actor.uid, academyId, auditId, 'assignment.proposed', 'assignment', studentId);
  }
  await batch.commit();
}

export async function acceptAssignment(user, academyId) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'academyAssignments', memberId(academyId, user.uid)), { status: 'active', updatedAt: now(), auditId });
  audit(batch, user.uid, academyId, auditId, 'assignment.accepted', 'assignment', user.uid);
  await batch.commit();
}

export async function endAssignment(actor, academyId, studentId) {
  const auditId = newAuditId();
  const batch = writeBatch(db);
  batch.update(doc(db, 'academyAssignments', memberId(academyId, studentId)), { status: 'ended', updatedAt: now(), auditId });
  audit(batch, actor.uid, academyId, auditId, 'assignment.ended', 'assignment', studentId);
  await batch.commit();
}

/** Chamado pelo aluno após um check-in concluído (só com consentimento): publica a validade da aderência. */
export async function publishAdherence(user, academyId, lastCheckInId) {
  await setDoc(doc(db, 'academyMemberStats', memberId(academyId, user.uid)), {
    academyId, userId: user.uid, validUntil: adherenceValidUntil(), lastCheckInId, updatedAt: now()
  });
}

/** Aderência do próprio aluno (a equipe não lê na V2.0). */
export async function getMyAdherence(academyId, userId) {
  const snap = await getDoc(doc(db, 'academyMemberStats', memberId(academyId, userId)));
  return adherenceStatus(snap.exists() ? snap.data() : null);
}

export async function clearAdherence(academyId, userId) {
  await deleteDoc(doc(db, 'academyMemberStats', memberId(academyId, userId)));
}
