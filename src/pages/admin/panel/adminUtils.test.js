import {
  exerciseIssues, mediaStatus, filterExercises, validateExerciseForm, hasNameConflict,
  trainingIssues, trainingGroups, moveItem, usageByTraining, parseImport
} from './adminUtils';

const ex = (over = {}) => ({ firestoreId: over.firestoreId || 'e', name: 'Supino', muscleGroup: 'peito', difficulty: 'iniciante', ...over });

describe('mídia e pendências', () => {
  it('classifica a mídia e ignora links inseguros', () => {
    expect(mediaStatus(ex())).toBe('nenhuma');
    expect(mediaStatus(ex({ machineImage: 'https://a.com/x.gif' }))).toBe('imagem');
    expect(mediaStatus(ex({ videoUrl: 'https://youtu.be/abc' }))).toBe('video');
    expect(mediaStatus(ex({ machineImage: 'https://a.com/x.gif', videoUrl: 'https://youtu.be/abc' }))).toBe('ambos');
    expect(mediaStatus(ex({ videoUrl: 'javascript:alert(1)' }))).toBe('nenhuma');
  });
  it('lista as pendências de conteúdo', () => {
    expect(exerciseIssues(ex())).toEqual(['sem-imagem', 'sem-video', 'sem-execucao', 'sem-descricao']);
    expect(exerciseIssues(ex({ machineImage: 'https://a.com/x', videoUrl: 'https://a.com/v', execution: 'x', description: 'y' }))).toEqual([]);
  });
});

describe('filterExercises', () => {
  const list = [
    ex({ firestoreId: '1', name: 'Supino Reto', muscleGroup: 'peito', machineImage: 'https://a.com/1' }),
    ex({ firestoreId: '2', name: 'Puxada Aberta', muscleGroup: 'costas', difficulty: 'intermediário', videoUrl: 'https://a.com/v' }),
    ex({ firestoreId: '3', name: 'Elevação Lateral', muscleGroup: 'ombros', archived: true })
  ];
  it('arquivados ficam fora por padrão e aparecem no filtro próprio', () => {
    expect(filterExercises(list).map((e) => e.firestoreId)).toEqual(['2', '1']);
    expect(filterExercises(list, { status: 'arquivados' }).map((e) => e.firestoreId)).toEqual(['3']);
    expect(filterExercises(list, { status: 'todos' })).toHaveLength(3);
  });
  it('busca sem acento, grupo, mídia e dificuldade', () => {
    expect(filterExercises(list, { term: 'elevacao', status: 'todos' }).map((e) => e.firestoreId)).toEqual(['3']);
    expect(filterExercises(list, { group: 'costas' }).map((e) => e.firestoreId)).toEqual(['2']);
    expect(filterExercises(list, { media: 'imagem' }).map((e) => e.firestoreId)).toEqual(['1']);
    expect(filterExercises(list, { media: 'com-video' }).map((e) => e.firestoreId)).toEqual(['2']);
    expect(filterExercises(list, { difficulty: 'intermediário' }).map((e) => e.firestoreId)).toEqual(['2']);
  });
});

describe('validateExerciseForm', () => {
  const ok = { name: 'A', muscleGroup: 'peito', sets: 3, reps: '10', rest: 60, machineImage: '', videoUrl: '' };
  it('aceita formulário válido', () => expect(validateExerciseForm(ok)).toEqual({}));
  it('aponta cada problema', () => {
    const errs = validateExerciseForm({ ...ok, name: ' ', muscleGroup: '', sets: 0, rest: 700, reps: '', videoUrl: 'javascript:1', machineImage: 'ftp://x' });
    expect(Object.keys(errs).sort()).toEqual(['machineImage', 'muscleGroup', 'name', 'reps', 'rest', 'sets', 'videoUrl']);
  });
  it('detecta nome duplicado ignorando acento e o próprio item', () => {
    const list = [ex({ firestoreId: '1', name: 'Elevação Lateral' })];
    expect(hasNameConflict(list, 'elevacao lateral')).toBe(true);
    expect(hasNameConflict(list, 'elevacao lateral', '1')).toBe(false);
  });
});

describe('fichas', () => {
  const map = new Map([
    ['a', ex({ firestoreId: 'a', muscleGroup: 'peito', machineImage: 'https://a.com/1' })],
    ['b', ex({ firestoreId: 'b', muscleGroup: 'costas', archived: true })]
  ]);
  it('avisa ficha vazia, órfãos, arquivados, core e mídia', () => {
    expect(trainingIssues({ name: 'X', exercises: [] }, map).map((i) => i.id)).toEqual(['vazia']);
    const ids = trainingIssues({ name: 'Peitoral + CORE', exercises: ['a', 'b', 'zzz'] }, map).map((i) => i.id);
    expect(ids).toEqual(['orfaos', 'arquivados', 'core', 'sem-midia']);
    expect(trainingIssues({ name: 'Peitoral', exercises: ['a'] }, map)).toEqual([]);
  });
  it('lista grupos e conta alunos por ficha', () => {
    expect(trainingGroups({ exercises: ['a', 'b', 'zzz'] }, map)).toEqual(['peito', 'costas']);
    expect(usageByTraining([{ role: 'user', currentTrainingId: 't1' }, { role: 'user', currentTrainingId: 't1' }, { role: 'coach', currentTrainingId: 't1' }, { role: 'user' }])).toEqual({ t1: 2 });
  });
  it('reordena itens', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('parseImport', () => {
  const existing = [{ name: 'Supino Reto' }];
  it('separa novos, duplicados e inválidos', () => {
    const r = parseImport([
      { name: 'Puxada', muscleGroup: 'costas' },
      { name: 'supino reto', muscleGroup: 'peito' },
      { name: 'Puxada', muscleGroup: 'costas' },
      { name: 'Algo', muscleGroup: 'inexistente' },
      { muscleGroup: 'peito' },
      { name: 'Vídeo ruim', muscleGroup: 'peito', videoUrl: 'javascript:alert(1)' }
    ], 'exercises', existing);
    expect(r.novos).toHaveLength(1);
    expect(r.duplicados.map((d) => d.name)).toEqual(['supino reto', 'Puxada']);
    expect(r.invalidos).toHaveLength(3);
    expect(r.total).toBe(6);
  });
  it('aceita objeto com a chave da coleção e entrada vazia', () => {
    expect(parseImport({ exercises: [{ name: 'A', muscleGroup: 'core' }] }, 'exercises', []).novos).toHaveLength(1);
    expect(parseImport(null, 'exercises', []).total).toBe(0);
  });
});

import { linkOverview } from './adminUtils';
describe('linkOverview', () => {
  it('conta alunos sem treinador, treinadores sem alunos e solicitações', () => {
    const users = [
      { uid: 'c1', role: 'coach' }, { uid: 'c2', role: 'coach' }, { uid: 'a', role: 'admin' },
      { uid: 's1', role: 'user', coachId: 'c1' }, { uid: 's2', role: 'user' }, { uid: 's3', role: 'user', coachId: 'c1' }
    ];
    const links = [{ status: 'pending' }, { status: 'pending' }, { status: 'revoked' }, { status: 'active' }];
    expect(linkOverview(users, links)).toEqual({ students: 3, coaches: 2, active: 2, withoutCoach: 1, coachesWithoutStudents: 1, pending: 2, rejected: 0, revoked: 1 });
  });
});

import { socialOverview } from './adminUtils';
describe('socialOverview', () => {
  it('conta perfis, participantes do ranking e estados das amizades', () => {
    const r = socialOverview(
      [{ discoverable: true, shareRanking: true }, { discoverable: false, shareRanking: true }, { discoverable: true, shareRanking: false }],
      [{ status: 'active' }, { status: 'active' }, { status: 'pending' }, { status: 'blocked' }, { status: 'removed' }]
    );
    expect(r).toEqual({ profiles: 3, discoverable: 2, ranking: 2, friends: 2, pending: 1, blocked: 1 });
  });
});
