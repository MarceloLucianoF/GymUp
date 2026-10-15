import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const strip = (t) => t.replace(/^\s*\/\/.*$/gm, '');
const load = (f) => JSON.parse(strip(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')));

test('modelo de produção: só origens oficiais, nada de homologação, sem workers.dev', () => {
  const prod = load('wrangler.production.example.jsonc');
  const hml = load('wrangler.jsonc');
  const origins = prod.vars.ALLOWED_ORIGINS.split(',');
  for (const o of origins) assert.match(o, /^https:\/\//);
  const text = JSON.stringify(prod);
  assert.doesNotMatch(text, /localhost|127\.0\.0\.1|-hml|workers\.dev/);
  assert.equal(prod.workers_dev, false);
  assert.notEqual(prod.name, hml.name);
  assert.notEqual(prod.vars.FIREBASE_PROJECT_ID, hml.vars.FIREBASE_PROJECT_ID);
  assert.ok(!text.includes(hml.d1_databases[0].database_id));
});

test('homologação continua identificada como tal', () => {
  const hml = load('wrangler.jsonc');
  assert.match(hml.name, /-hml$/);
  assert.match(hml.vars.FIREBASE_PROJECT_ID, /hml/);
});
