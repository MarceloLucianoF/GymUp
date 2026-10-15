import { describe, expect, test } from 'vitest';
import { INVITE_ROLES, NAV_BY_ROLE, memberActions, safeNext } from './policy';

const m = (role, status = 'active', userId = 'x') => ({ userId, role, status });

describe('memberActions (só visual)', () => {
  test('dono gerencia qualquer outro, menos dono e a si mesmo', () => {
    const me = { userId: 'me', role: 'owner' };
    expect(memberActions(me, m('admin'))).toMatchObject({ suspend: true, remove: true, reactivate: false });
    expect(memberActions(me, m('admin')).roles).not.toContain('owner');
    expect(memberActions(me, m('owner')).remove).toBe(false);
    expect(memberActions(me, m('coach', 'active', 'me')).suspend).toBe(false);
  });
  test('admin só mexe em coach, recepção e aluno e não promove', () => {
    const me = { userId: 'me', role: 'admin' };
    expect(memberActions(me, m('owner')).suspend).toBe(false);
    expect(memberActions(me, m('admin')).remove).toBe(false);
    expect(memberActions(me, m('coach')).roles).toEqual(['reception', 'student']);
  });
  test('removido só volta pelo dono', () => {
    expect(memberActions({ userId: 'me', role: 'admin' }, m('student', 'removed')).reactivate).toBe(false);
    expect(memberActions({ userId: 'me', role: 'owner' }, m('student', 'removed')).reactivate).toBe(true);
  });
  test('coach, recepção e aluno não têm ações', () => {
    for (const role of ['coach', 'reception', 'student']) expect(memberActions({ userId: 'me', role }, m('student')).suspend).toBe(false);
  });
});

test('convite: papéis por função', () => {
  expect(INVITE_ROLES.admin).not.toContain('admin');
  expect(INVITE_ROLES.reception).toEqual(['student']);
  expect(INVITE_ROLES.coach).toBeUndefined();
});

test('menu por papel: coach só vê alunos; recepção não vê auditoria', () => {
  expect(NAV_BY_ROLE.coach).toEqual(['alunos']);
  expect(NAV_BY_ROLE.reception).not.toContain('auditoria');
  expect(NAV_BY_ROLE.owner).toContain('auditoria');
});

test('safeNext só aceita caminho interno', () => {
  expect(safeNext('/convite/abc123')).toBe('/convite/abc123');
  expect(safeNext('/app/academia/x/membros?role=coach')).toBe('/app/academia/x/membros?role=coach');
  for (const bad of ['//malvado.com', 'https://malvado.com', '/\\x', undefined, 'javascript:alert(1)']) expect(safeNext(bad)).toBe('/app');
});
