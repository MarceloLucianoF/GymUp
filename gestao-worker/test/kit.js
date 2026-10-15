import assert from 'node:assert/strict';
import { handleRequest, resetRateLimit } from '../src/index.js';
import { makeD1, seedAcademy, seedMember } from './helpers.js';

export { assert, resetRateLimit, seedAcademy, seedMember, makeD1 };
export const ENV = { FIREBASE_PROJECT_ID: 'demo-gestao', ALLOWED_ORIGINS: 'http://localhost:5174', ADMIN_OPS_ENABLED: 'true' };
export const A = 'academiaaaaaaaaaaaa';
export const B = 'academiabbbbbbbbbbbb';
export const C = 'academiaccccccccccc';   // suspensa
export const T0 = Date.parse('2026-10-14T12:00:00Z');
export const DAY = 86_400_000;

export const verifyAs = (uid, extra = {}) => async () => ({ sub: uid, name: `Nome ${uid}`, ...extra });

/** Mundo de teste: academia A (todos os papéis), academia B (outra, com todos os papéis) e academia C suspensa. */
export function world() {
  const d1 = makeD1();
  seedAcademy(d1, A, 'ZZ TESTE Gestão A'); seedAcademy(d1, B, 'ZZ TESTE Gestão B'); seedAcademy(d1, C, 'ZZ TESTE Gestão C', 'suspended');
  for (const [p, aid] of [['', A], ['B', B]]) {
    for (const [uid, role] of [['dono', 'owner'], ['adm', 'admin'], ['prof', 'coach'], ['prof2', 'coach'], ['rec', 'reception'], ['alu', 'student'], ['alu2', 'student']]) seedMember(d1, aid, `${uid}${p}`, role);
  }
  seedMember(d1, A, 'susp', 'coach', 'suspended');
  seedMember(d1, C, 'donoC', 'owner');
  return d1;
}

/** Chama o Worker como o usuário `uid` (token falso aceito pelo verificador injetado). */
export async function api(d1, uid, method, path, { body, key, deps = {}, env = {}, headers = {}, now = T0, claims = {} } = {}) {
  const init = { method, headers: { ...(uid ? { Authorization: 'Bearer tok' } : {}), ...(key ? { 'Idempotency-Key': key } : {}), ...headers } };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await handleRequest(new Request(`https://api.test${path}`, init), { ...ENV, DB: d1, ...env }, { now, verify: verifyAs(uid, claims), ...deps });
  return { res, json: await res.json().catch(() => null), status: res.status, code: undefined };
}
export const code = (r) => r.json?.error?.code;
export const data = (r) => r.json?.data;
export const count = (d1, table, where = '', ...p) => d1.raw.prepare(`SELECT count(*) n FROM ${table} ${where}`).get(...p).n;
export const row = (d1, sql, ...p) => d1.raw.prepare(sql).get(...p);
export const rows = (d1, sql, ...p) => d1.raw.prepare(sql).all(...p);
export const audit = (d1, action, aid = A) => rows(d1, 'SELECT * FROM academy_audit_log WHERE academy_id = ? AND action = ? ORDER BY rowid', aid, action);

let n = 0;
export const key = () => `chave-teste-${String(++n).padStart(6, '0')}`;
export const makeInvite = async (d1, uid, role = 'student', extra = {}, aid = A) => data(await api(d1, uid, 'POST', `/v1/academies/${aid}/invites`, { body: { role, ...extra }, key: key() }));
export const accept = (d1, uid, inviteCode, opts = {}) => api(d1, uid, 'POST', '/v1/invites/accept', { body: { code: inviteCode }, ...opts });
