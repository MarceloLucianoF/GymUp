import {
  createChallenge, joinChallenge, leaveAllChallenges, leaveChallenge, listMyChallenges, newChallengeCode, syncMyScores, syncScoresAfterWorkout
} from './challengeService';

jest.mock('../firebase/config', () => ({ db: {} }));

// Firestore falso em memória: caminhos como texto, lotes registrados em ordem.
const makeDeps = (seed = {}) => {
  const store = new Map(Object.entries(seed));
  const log = [];
  const ref = (path) => {
    const parts = path.split('/');
    const node = (n) => (n <= 0 ? null : { id: parts[n - 1], parent: node(n - 1) });
    return { path, ...node(parts.length) };
  };
  let auto = 0;
  const deps = {
    db: {},
    serverTimestamp: () => 'TS',
    increment: (n) => ({ inc: n }),
    where: (field, op, value) => ({ field, op, value }),
    query: (col, ...constraints) => ({ ...col, constraints }),
    collection: (db, ...path) => ({ col: path.join('/') }),
    collectionGroup: (db, name) => ({ group: name }),
    doc: (first, ...path) => (first?.col ? ref(`${first.col}/auto${(auto += 1)}`) : ref(path.join('/'))),
    getDoc: async (r) => ({ exists: () => store.has(r.path), data: () => store.get(r.path) }),
    getDocs: async (q) => {
      let docs;
      if (q.group) {
        const c = q.constraints[0];
        docs = [...store.keys()].filter((k) => k.split('/').slice(-2)[0] === q.group && store.get(k)[c.field] === c.value);
      } else {
        const depth = q.col.split('/').length + 1;
        docs = [...store.keys()].filter((k) => k.startsWith(`${q.col}/`) && k.split('/').length === depth);
      }
      return { docs: docs.map((k) => ({ ref: ref(k), id: ref(k).id, data: () => store.get(k) })) };
    },
    updateDoc: async (r, patch) => { log.push(['update', r.path, patch]); store.set(r.path, { ...store.get(r.path), ...patch }); },
    deleteDoc: async (r) => { log.push(['delete', r.path]); store.delete(r.path); },
    writeBatch: () => {
      const ops = [];
      return {
        set: (r, data) => ops.push(['set', r.path, data]),
        update: (r, data) => ops.push(['update', r.path, data]),
        delete: (r) => ops.push(['delete', r.path]),
        commit: async () => {
          log.push(['batch', ops.map((o) => `${o[0]}:${o[1]}`)]);
          ops.forEach(([op, path, data]) => {
            if (op === 'delete') store.delete(path);
            else if (op === 'set') store.set(path, data);
            else store.set(path, { ...store.get(path), ...data });
          });
        }
      };
    }
  };
  return { deps, log, store };
};

const profile = { displayName: 'Ana', handle: 'ana' };

test('código de 8 caracteres sem letras ambíguas', () => {
  const code = newChallengeCode();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect(newChallengeCode(() => 0)).toBe('AAAAAAAA');
});

test('criar: desafio, código e o dono como membro no mesmo lote; fim calculado pela duração', async () => {
  const { deps, log, store } = makeDeps({ 'challengeCodes/AAAAAAAA': { challengeId: 'outro' } });
  let calls = 0;
  const randomInt = () => (calls++ < 8 ? 0 : 1);   // o primeiro código já existe: gera outro
  const { id, code } = await createChallenge('u1', profile, { name: '  Novembro  ', durationDays: 30 }, { deps, randomInt, now: new Date(2026, 10, 1, 9) });
  expect(code).toBe('BBBBBBBB');
  expect(log).toEqual([['batch', [`set:challenges/${id}`, 'set:challengeCodes/BBBBBBBB', `set:challenges/${id}/members/u1`]]]);
  expect(store.get(`challenges/${id}`)).toMatchObject({ name: 'Novembro', durationDays: 30, startDay: '2026-11-01', endDay: '2026-11-30', ownerId: 'u1', memberCount: 1, status: 'active' });
  expect(store.get(`challenges/${id}/members/u1`)).toMatchObject({ uid: 'u1', displayName: 'Ana', handle: 'ana', code: 'BBBBBBBB', activeDays: 0, lastDay: '' });
  await expect(createChallenge('u1', null, { name: 'X', durationDays: 7 }, { deps })).rejects.toThrow(/perfil social/);
  await expect(createChallenge('u1', profile, { name: 'X', durationDays: 14 }, { deps })).rejects.toThrow(/7 ou 30/);
});

test('entrar pelo código: membro e contador no mesmo lote; já membro não grava de novo', async () => {
  const { deps, log } = makeDeps({ 'challengeCodes/ABCD2345': { challengeId: 'c1' }, 'challenges/c1': { ownerId: 'u0', memberCount: 1 } });
  await expect(joinChallenge('u1', profile, 'xx', { deps })).rejects.toThrow(/8 letras/);
  await expect(joinChallenge('u1', profile, 'ZZZZ9999', { deps })).rejects.toThrow(/não encontrado/);
  expect(await joinChallenge('u1', profile, ' abcd-2345 ', { deps })).toEqual({ id: 'c1', already: false });
  expect(log[0]).toEqual(['batch', ['set:challenges/c1/members/u1', 'update:challenges/c1']]);
  expect(await joinChallenge('u1', profile, 'ABCD2345', { deps })).toEqual({ id: 'c1', already: true });
  expect(log).toHaveLength(1);
});

test('entrar: recusa das regras vira mensagem clara (cheio, encerrado ou terminado)', async () => {
  const { deps } = makeDeps({ 'challengeCodes/ABCD2345': { challengeId: 'c1' } });
  deps.writeBatch = () => ({ set: () => {}, update: () => {}, commit: async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); } });
  await expect(joinChallenge('u1', profile, 'ABCD2345', { deps })).rejects.toThrow(/cheio \(50 pessoas\)/);
});

test('sair: apaga o membro e desce o contador no mesmo lote', async () => {
  const { deps, log } = makeDeps();
  await leaveChallenge('u1', 'c1', { deps });
  expect(log).toEqual([['batch', ['delete:challenges/c1/members/u1', 'update:challenges/c1']]]);
});

test('lista meus desafios com membros, ignora outras subcoleções "members" e limpa sobras', async () => {
  const { deps, log } = makeDeps({
    'challenges/c1': { name: 'A', startDay: '2026-10-01', ownerId: 'u0' },
    'challenges/c1/members/u1': { uid: 'u1', activeDays: 2 },
    'challenges/c1/members/u0': { uid: 'u0', activeDays: 1 },
    'challenges/sumiu/members/u1': { uid: 'u1' },
    'grupos/g1/members/u1': { uid: 'u1' }
  });
  const list = await listMyChallenges('u1', { deps });
  expect(list.map((c) => c.id)).toEqual(['c1']);
  expect(list[0].members.map((m) => m.uid).sort()).toEqual(['u0', 'u1']);
  expect(log).toEqual([['delete', 'challenges/sumiu/members/u1']]);
});

test('placar: grava só quando muda, a partir dos check-ins dentro do período', async () => {
  const { deps, log } = makeDeps();
  const ch = { id: 'c1', startDay: '2026-10-26', endDay: '2026-11-01', durationDays: 7, status: 'active', me: { uid: 'u1', displayName: 'Ana', handle: 'ana', activeDays: 0, lastDay: '' }, members: [{ uid: 'u1', activeDays: 0 }] };
  const day = (d) => ({ date: new Date(`${d}T12:00:00`).toISOString() });
  const out = await syncMyScores('u1', [ch], [day('2026-10-26'), day('2026-10-27'), day('2026-10-20')], profile, { deps, today: '2026-10-28' });
  expect(log).toEqual([['update', 'challenges/c1/members/u1', { activeDays: 2, lastDay: '2026-10-27', updatedAt: 'TS' }]]);
  expect(out[0].members[0].activeDays).toBe(2);
  await syncMyScores('u1', out, [day('2026-10-26'), day('2026-10-27')], profile, { deps, today: '2026-10-28' });
  expect(log).toHaveLength(1);
  // nome novo no perfil social acompanha
  await syncMyScores('u1', out, [], { displayName: 'Ana B', handle: 'ana' }, { deps, today: '2026-10-28' });
  expect(log[1]).toEqual(['update', 'challenges/c1/members/u1', { displayName: 'Ana B', handle: 'ana', updatedAt: 'TS' }]);
});

test('exclusão de conta: sai dos desafios dos outros e apaga os próprios inteiros', async () => {
  const { deps, log, store } = makeDeps({
    'challenges/meu': { ownerId: 'u1', code: 'MEUCOD22' },
    'challengeCodes/MEUCOD22': { challengeId: 'meu' },
    'challenges/meu/members/u1': { uid: 'u1' },
    'challenges/meu/members/u2': { uid: 'u2' },
    'challenges/dele': { ownerId: 'u2', code: 'DELECO33' },
    'challenges/dele/members/u1': { uid: 'u1' },
    'challenges/dele/members/u2': { uid: 'u2' }
  });
  const removed = await leaveAllChallenges('u1', { deps });
  expect(removed).toBe(5);
  expect(log).toEqual([
    ['batch', ['delete:challenges/meu/members/u1', 'delete:challenges/meu/members/u2', 'delete:challengeCodes/MEUCOD22', 'delete:challenges/meu']],
    ['batch', ['delete:challenges/dele/members/u1', 'update:challenges/dele']]
  ]);
  expect(store.has('challenges/dele/members/u2')).toBe(true);
});

test('ao concluir o treino, sobe o placar só dos desafios em andamento', async () => {
  const { deps, log } = makeDeps({
    'challenges/c1': { name: 'Ativo', startDay: '2026-10-26', endDay: '2026-11-01', status: 'active' },
    'challenges/c1/members/u1': { uid: 'u1', activeDays: 1, lastDay: '2026-10-27' },
    'challenges/c2': { name: 'Encerrado', startDay: '2026-10-01', endDay: '2026-10-07', status: 'ended' },
    'challenges/c2/members/u1': { uid: 'u1', activeDays: 3, lastDay: '2026-10-06' }
  });
  const day = (d) => ({ date: new Date(`${d}T12:00:00`).toISOString() });
  const fetchCheckIns = jest.fn(async () => [day('2026-10-27'), day('2026-10-30')]);
  expect(await syncScoresAfterWorkout('u1', fetchCheckIns, { deps, today: '2026-10-30' })).toBe(1);
  expect(log.filter((l) => l[0] === 'update')).toEqual([['update', 'challenges/c1/members/u1', { activeDays: 2, lastDay: '2026-10-30', updatedAt: 'TS' }]]);
  // sem desafio ativo não lê os check-ins
  const empty = makeDeps();
  const none = jest.fn();
  expect(await syncScoresAfterWorkout('u1', none, { deps: empty.deps })).toBe(0);
  expect(none).not.toHaveBeenCalled();
});
