import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env = {
  FIREBASE_PROJECT_ID: 'p',
  ASSETS: { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`, { status: 200, headers: { 'Content-Type': 'text/html' } }) }
};
const get = (path, init) => worker.fetch(new Request(`https://app.example${path}`, init), env);

test('serve arquivos do app com cabeçalhos de segurança', async () => {
  const res = await get('/coach/dashboard');
  assert.equal(await res.text(), 'asset:/coach/dashboard');
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('assets em /static/ ganham cache imutável', async () => {
  const res = await get('/static/js/main.abc.js');
  assert.match(res.headers.get('Cache-Control'), /immutable/);
});

test('/api/nvidia exige autenticação e outras rotas /api/ dão 404', async () => {
  assert.equal((await get('/api/nvidia', { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await get('/api/outro')).status, 404);
});
