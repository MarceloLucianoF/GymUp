import { describe, expect, test } from 'vitest';
import { INVITE_ROLES, memberActions, safeNext } from './policy';

const m = (role, status = 'active', userId = 'x') => ({ userId, role, status });

describe('memberActions (só visual)', () => {
  test('dono gerencia qualquer outro; ninguém age sobre si mesmo', () => {
    const me = { userId: 'me', role: 'owner' };
    expect(memberActions(me, m('admin'))).toMatchObject({ suspend: true, remove: true, reactivate: false });
    expect(memberActions(me, m('admin')).roles).toContain('owner');
    expect(memberActions(me, m('teacher', 'active', 'me'))).toMatchObject({ suspend: false, remove: false, roles: [] });
  });
  test('admin só mexe em professor, recepção e aluno e não promove', () => {
    const me = { userId: 'me', role: 'admin' };
    expect(memberActions(me, m('owner')).suspend).toBe(false);
    expect(memberActions(me, m('admin')).remove).toBe(false);
    expect(memberActions(me, m('teacher')).roles).toEqual(['reception', 'student']);
  });
  test('removido só volta pelo dono; quem saiu não tem ações', () => {
    expect(memberActions({ userId: 'me', role: 'admin' }, m('student', 'removed')).reactivate).toBe(false);
    expect(memberActions({ userId: 'me', role: 'owner' }, m('student', 'removed')).reactivate).toBe(true);
    expect(memberActions({ userId: 'me', role: 'owner' }, m('student', 'left')).remove).toBe(false);
  });
  test('professor e aluno não têm ações', () => {
    expect(memberActions({ userId: 'me', role: 'teacher' }, m('student')).suspend).toBe(false);
  });
});

test('convite: papéis por função', () => {
  expect(INVITE_ROLES.admin).not.toContain('admin');
  expect(INVITE_ROLES.reception).toEqual(['student']);
});

test('safeNext só aceita caminho interno', () => {
  expect(safeNext('/convite/abc123')).toBe('/convite/abc123');
  expect(safeNext('//malvado.com')).toBe('/');
  expect(safeNext('https://malvado.com')).toBe('/');
  expect(safeNext('/\\x')).toBe('/');
  expect(safeNext(undefined)).toBe('/');
});
