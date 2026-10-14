// D1 de teste: SQLite em memória (node:sqlite) com a MESMA migração e a interface do D1 que o Worker usa (prepare/bind/first/all/run/batch).
// batch é transacional, como no D1: se um comando falha, nada é gravado.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DIR = new URL('../migrations/', import.meta.url);
export const SQL = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(new URL(f, DIR), 'utf8')).join('\n');

export function makeD1() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(SQL);
  const statement = (sql) => ({
    sql, args: [],
    bind(...args) { this.args = args; return this; },
    async first() { return raw.prepare(sql).get(...this.args) ?? null; },
    async all() { return { results: raw.prepare(sql).all(...this.args) }; },
    async run() { raw.prepare(sql).run(...this.args); return { success: true }; }
  });
  return {
    raw,
    prepare: statement,
    async batch(statements) {
      raw.exec('BEGIN');
      const results = [];
      try { for (const s of statements) results.push({ meta: { changes: Number(raw.prepare(s.sql).run(...s.args).changes) } }); raw.exec('COMMIT'); } catch (error) { raw.exec('ROLLBACK'); throw error; }
      return results;
    }
  };
}

const NOW = '2026-10-14T00:00:00.000Z';
export const seedAcademy = (d1, id, name, status = 'active') => d1.raw.prepare('INSERT INTO academies (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, status, NOW, NOW);
export const seedMember = (d1, academyId, uid, role, status = 'active', displayName = `Nome ${uid}`) => d1.raw.prepare(
  'INSERT INTO academy_members (academy_id, user_id, role, status, display_name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
).run(academyId, uid, role, status, displayName, `${uid}@example.invalid`, NOW, NOW);
