import { deleteUserData, purgeLocalData, chunk, providerOf, friendlyDeletionError, DELETION_STEPS } from './accountDeletion';

// Firestore falso: registra a ordem das operações.
const makeDeps = ({ checkIns = [], measurements = [], chats = [], trainings = [], profileCoachId = null, noteDenied = [], noteError = null, failOn = null, friendships = [] } = {}) => {
  const log = [];
  const docsOf = (list, prefix) => list.map((d) => ({ id: d.id, ref: { path: `${prefix}/${d.id}` }, data: () => d.data || (d.participants ? { participants: d.participants } : {}) }));
  const deps = {
    db: {},
    where: (field, op, value) => ({ field, op, value }),
    collection: (db, ...path) => ({ path: path.join('/') }),
    query: (col, ...constraints) => ({ col, constraints }),
    getDocs: async (q) => {
      const path = q.path || q.col.path;
      if (failOn === path) throw Object.assign(new Error('x'), { code: 'permission-denied' });
      if (path === 'checkIns') return { docs: docsOf(checkIns, 'checkIns') };
      if (path === 'measurements') return { docs: docsOf(measurements, 'measurements') };
      if (path === 'trainings') return { docs: docsOf(trainings, 'trainings') };
      if (path === 'chats') return { docs: docsOf(chats, 'chats') };
      const match = path.match(/^chats\/(.+)\/messages$/);
      if (match) return { docs: docsOf((chats.find((c) => c.id === match[1]) || {}).messages || [], path) };
      if (path === 'friendships') return { docs: friendships.filter((f) => f.data[q.constraints[0].field] === q.constraints[0].value).map((f) => ({ ref: { path: `friendships/${f.id}` }, data: () => f.data })) };
      return { docs: [] };
    },
    writeBatch: () => {
      const refs = [];
      return { delete: (ref) => refs.push(ref.path), commit: async () => { log.push(['batch', refs.length, refs[0], [...refs]]); } };
    },
    doc: (db, col, id) => ({ path: `${col}/${id}` }),
    getDoc: async () => ({ exists: () => true, data: () => ({ coachId: profileCoachId }) }),
    deleteDoc: async (ref) => {
      const path = ref.path || ref.ref?.path;
      if (path.startsWith('coachNotes/')) {
        if (noteError) throw Object.assign(new Error('boom'), { code: noteError });
        if (noteDenied.includes(path)) throw Object.assign(new Error('negado'), { code: 'permission-denied' });
      }
      log.push(['delete', path]);
    }
  };
  return { deps, log };
};

describe('chunk', () => {
  test('divide em lotes de até o tamanho pedido', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 400)).toEqual([]);
  });
});

describe('deleteUserData - amizades', () => {
  test('todas as amizades saem no mesmo lote do documento do usuário', async () => {
    const { deps, log } = makeDeps({ friendships: [
      { id: 'u1_x', data: { userA: 'u1', userB: 'x', status: 'blocked', blockedBy: 'x' } },
      { id: 'u1_y', data: { userA: 'u1', userB: 'y', status: 'active' } },
      { id: 'u1_z', data: { userA: 'u1', userB: 'z', status: 'blocked', blockedBy: 'u1' } }
    ] });
    const counts = await deleteUserData('u1', { deps });
    const deletes = log.filter((e) => e[0] === 'delete').map((e) => e[1]);
    expect(deletes.some((path) => path.startsWith('friendships/'))).toBe(false);
    expect(log[log.length - 1][3]).toEqual(['friendships/u1_x', 'friendships/u1_y', 'friendships/u1_z', 'users/u1']);
    expect(counts.profile).toBe(1);
  });
});

describe('deleteUserData', () => {
  test('apaga na ordem certa e o perfil por último; mensagens antes do chat', async () => {
    const { deps, log } = makeDeps({
      checkIns: [{ id: 'c1' }, { id: 'c2' }],
      measurements: [{ id: 'm1' }],
      chats: [{ id: 'chatA', participants: ['u1', 'coachX'], messages: [{ id: 'x' }, { id: 'y' }] }],
      trainings: [{ id: 't1', data: { isAIGenerated: true } }, { id: 't2', data: { isAIGenerated: false } }, { id: 't3', data: { isAIGenerated: true, coachId: 'coach' } }]
    });
    const steps = [];
    const counts = await deleteUserData('u1', { deps, onStep: (id, status) => steps.push(`${id}:${status}`) });
    expect(counts).toEqual({ checkIns: 2, measurements: 1, chats: 3, trainings: 1, notes: 1, social: 3, profile: 1 });   // social: perfil, índice da busca e handle
    expect(log.map((entry) => entry[0] + ':' + entry[1])).toEqual(['batch:2', 'delete:userStats/u1', 'batch:1', 'batch:2', 'delete:chats/chatA', 'batch:1', 'delete:coachNotes/coachX_u1', 'delete:profileSearch/u1', 'delete:publicProfiles/u1', 'delete:publicStats/u1', 'batch:1']);
    expect(steps.slice(0, 2)).toEqual(['checkIns:running', 'checkIns:done']);
    expect(steps[steps.length - 1]).toBe('profile:done');
  });

  test('mais de 400 documentos viram vários lotes', async () => {
    const { deps, log } = makeDeps({ checkIns: Array.from({ length: 450 }, (_, i) => ({ id: `c${i}` })) });
    await deleteUserData('u1', { deps });
    expect(log.filter((entry) => entry[0] === 'batch').map((entry) => entry[1])).toEqual([400, 50, 1]);
  });

  test('erro numa etapa para o fluxo e preserva o perfil (nada depois é apagado)', async () => {
    const { deps, log } = makeDeps({ checkIns: [{ id: 'c1' }], failOn: 'measurements' });
    const steps = [];
    await expect(deleteUserData('u1', { deps, onStep: (id, status) => steps.push(`${id}:${status}`) })).rejects.toMatchObject({ step: 'measurements' });
    expect(steps).toContain('measurements:error');
    expect(log.some((entry) => entry[1] === 'users/u1' || entry[3]?.includes('users/u1'))).toBe(false);
  });

  test('sem uid lança erro', async () => {
    await expect(deleteUserData('')).rejects.toThrow();
  });
});

describe('notas privadas do treinador', () => {
  test('apaga as notas do treinador do perfil e dos treinadores das conversas, sem repetir', async () => {
    const { deps, log } = makeDeps({ profileCoachId: 'coachA', chats: [{ id: 'c1', participants: ['u1', 'coachA'], messages: [] }, { id: 'c2', participants: ['u1', 'coachOld'], messages: [] }] });
    const counts = await deleteUserData('u1', { deps });
    expect(counts.notes).toBe(2);
    const noteDeletes = log.filter((entry) => String(entry[1]).startsWith('coachNotes/')).map((entry) => entry[1]).sort();
    expect(noteDeletes).toEqual(['coachNotes/coachA_u1', 'coachNotes/coachOld_u1']);
  });

  test('nota inexistente (negada por regra) é ignorada e o fluxo continua até o perfil', async () => {
    const { deps, log } = makeDeps({ profileCoachId: 'coachA', noteDenied: ['coachNotes/coachA_u1'] });
    const counts = await deleteUserData('u1', { deps });
    expect(counts.notes).toBe(0);
    expect(log[log.length - 1][3]).toContain('users/u1');
  });

  test('erro real ao apagar nota (não é permissão) interrompe antes do perfil', async () => {
    const { deps, log } = makeDeps({ profileCoachId: 'coachA', noteError: 'unavailable' });
    await expect(deleteUserData('u1', { deps })).rejects.toMatchObject({ step: 'notes' });
    expect(log.some((entry) => entry[1] === 'users/u1' || entry[3]?.includes('users/u1'))).toBe(false);
  });

  test('sem treinador vinculado nem conversas, não tenta apagar nenhuma nota', async () => {
    const { deps, log } = makeDeps({ profileCoachId: null });
    const counts = await deleteUserData('u1', { deps });
    expect(counts.notes).toBe(0);
    expect(log.some((entry) => String(entry[1]).startsWith('coachNotes/'))).toBe(false);
  });
});

describe('purgeLocalData', () => {
  test('remove chaves do usuário e do app, preserva as de terceiros', () => {
    localStorage.clear();
    localStorage.setItem('academyup:weeklyGoal:u1', '4');
    localStorage.setItem('academyup_pending_checkins_u1', '[]');
    localStorage.setItem('bt_terms_accepted_at', 'x');
    localStorage.setItem('chave-do-u1', 'x');
    localStorage.setItem('outro-site', 'ok');
    expect(purgeLocalData('u1')).toBe(4);
    expect(localStorage.getItem('outro-site')).toBe('ok');
    expect(localStorage.length).toBe(1);
  });
});

describe('providerOf e mensagens', () => {
  test('detecta o método de login', () => {
    expect(providerOf({ providerData: [{ providerId: 'password' }] })).toBe('password');
    expect(providerOf({ providerData: [{ providerId: 'google.com' }] })).toBe('google');
    expect(providerOf({ providerData: [] })).toBe('unknown');
    expect(providerOf(null)).toBe('unknown');
  });

  test('mensagens amigáveis para erros comuns', () => {
    expect(friendlyDeletionError({ code: 'auth/invalid-credential' })).toBe('Senha incorreta.');
    expect(friendlyDeletionError({ cause: { code: 'permission-denied' } })).toMatch(/permissão/);
    expect(friendlyDeletionError({ message: 'outro' })).toBe('outro');
  });

  test('as etapas exibidas cobrem o fluxo inteiro', () => {
    expect(DELETION_STEPS.map((s) => s.id)).toEqual(['reauth', 'checkIns', 'measurements', 'chats', 'trainings', 'notes', 'social', 'profile', 'login']);
  });
});

describe('leaveAcademies (vínculos com academias antes de apagar a conta)', () => {
  const { leaveAcademies } = require('./accountDeletion');
  test('API desligada não faz nada', async () => {
    const api = { leaveAll: jest.fn() };
    expect(await leaveAcademies({ api, enabled: false })).toEqual({ left: 0, blocked: [] });
    expect(api.leaveAll).not.toHaveBeenCalled();
  });
  test('sai de tudo; repete enquanto houver mais de 25', async () => {
    const api = { leaveAll: jest.fn().mockResolvedValueOnce({ left: 25, blocked: [], more: true }).mockResolvedValueOnce({ left: 3, blocked: [], more: false }) };
    expect(await leaveAcademies({ api, enabled: true })).toEqual({ left: 3, blocked: [], more: false });
    expect(api.leaveAll).toHaveBeenCalledTimes(2);
  });
  test('único proprietário bloqueia com mensagem clara (a conta não é apagada)', async () => {
    const api = { leaveAll: jest.fn().mockResolvedValue({ left: 1, blocked: ['acad1'], more: false }) };
    await expect(leaveAcademies({ api, enabled: true })).rejects.toMatchObject({ step: 'academies', blocked: ['acad1'], message: expect.stringMatching(/único proprietário/) });
  });
  test('falha de rede interrompe para não deixar vínculo para trás', async () => {
    const api = { leaveAll: jest.fn().mockRejectedValue(new Error('off')) };
    await expect(leaveAcademies({ api, enabled: true })).rejects.toMatchObject({ step: 'academies', message: expect.stringMatching(/Tente de novo/) });
  });
});

describe('deleteUserData - atividade social', () => {
  test('apaga posts próprios com as curtidas e as curtidas dadas a outros', async () => {
    const { deps, log } = makeDeps();
    const baseGet = deps.getDocs;
    deps.collectionGroup = (db, name) => ({ path: `group:${name}` });
    deps.getDocs = async (q) => {
      const path = q.path || q.col.path;
      if (path === 'socialPosts') return { docs: [{ id: 'p1', ref: { path: 'socialPosts/p1' } }] };
      if (path === 'socialPosts/p1/likes') return { docs: [{ id: 'x', ref: { path: 'socialPosts/p1/likes/x' } }] };
      if (path === 'group:likes') return { docs: [{ id: 'u1', ref: { path: 'socialPosts/outro/likes/u1' } }] };
      if (path === 'group:comments') return { docs: [{ id: 'k9', ref: { path: 'socialPosts/outro/comments/k9' } }] };
      if (path === 'socialPosts/p1/comments') return { docs: [{ id: 'k1', ref: { path: 'socialPosts/p1/comments/k1' } }] };
      return baseGet(q);
    };
    await deleteUserData('u1', { deps });
    const deleted = log.filter((l) => l[0] === 'delete').map((l) => l[1]);
    expect(deleted).toEqual(expect.arrayContaining(['socialPosts/p1/likes/x', 'socialPosts/p1/comments/k1', 'socialPosts/p1', 'socialPosts/outro/likes/u1', 'socialPosts/outro/comments/k9']));
    expect(deleted.indexOf('socialPosts/p1/comments/k1')).toBeLessThan(deleted.indexOf('socialPosts/p1'));
    expect(deleted.indexOf('socialPosts/p1/likes/x')).toBeLessThan(deleted.indexOf('socialPosts/p1'));
  });
});

describe('deleteUserData - desafios em grupo', () => {
  test('sai dos desafios de outros (contador desce junto) antes de apagar o perfil social', async () => {
    const { deps, log } = makeDeps();
    const baseGet = deps.getDocs;
    const memberRef = { path: 'challenges/c1/members/u1', id: 'u1', parent: { id: 'members', parent: { id: 'c1', parent: { id: 'challenges', parent: null } } } };
    deps.collectionGroup = (db, name) => ({ path: `group:${name}` });
    deps.increment = (n) => ({ inc: n });
    deps.doc = (db, ...path) => ({ path: path.join('/') });
    deps.getDocs = async (q) => ((q.path || q.col.path) === 'group:members' ? { docs: [{ ref: memberRef, data: () => ({ uid: 'u1' }) }] } : baseGet(q));
    const baseDoc = deps.getDoc;
    deps.getDoc = async (ref) => (ref.path === 'challenges/c1' ? { exists: () => true, data: () => ({ ownerId: 'u2', code: 'ABCD2345' }) } : baseDoc(ref));
    const baseBatch = deps.writeBatch;
    deps.writeBatch = () => {
      const b = baseBatch();
      const ops = [];
      return { delete: (r) => { ops.push(`delete:${r.path}`); b.delete(r); }, update: (r) => ops.push(`update:${r.path}`), commit: async () => { log.push(['ops', ops]); await b.commit(); } };
    };
    await deleteUserData('u1', { deps });
    const challengeIdx = log.findIndex((e) => e[0] === 'ops' && e[1].includes('delete:challenges/c1/members/u1'));
    expect(log[challengeIdx][1]).toEqual(['delete:challenges/c1/members/u1', 'update:challenges/c1']);
    expect(challengeIdx).toBeLessThan(log.findIndex((e) => e[0] === 'delete' && e[1] === 'publicProfiles/u1'));
  });
});
