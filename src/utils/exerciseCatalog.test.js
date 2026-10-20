import { auditCatalog, auditTrainings, catalogGroup, catalogKey, canonicalDifficulty, mergeCatalogs, nearKey, normalizeCatalogEntry } from './exerciseCatalog';
import { exercises } from '../data/exercises';
import { normalizeLibrary } from './workoutComposer';

test('grupo: "braços" vira bíceps ou tríceps pelo nome e os rótulos antigos convergem', () => {
  expect(catalogGroup({ muscleGroup: 'braços', name: 'Rosca Direta' })).toBe('biceps');
  expect(catalogGroup({ muscleGroup: 'Braços', name: 'Tríceps Corda' })).toBe('triceps');
  expect(catalogGroup({ muscleGroup: 'perna', name: 'Leg Press' })).toBe('pernas');
  expect(catalogGroup({ muscleGroup: 'perna', name: 'Hip Thrust Máquina' })).toBe('gluteos');
  expect(catalogGroup({ muscleGroup: 'pernas', name: 'Panturrilha Sentado Máquina' })).toBe('panturrilha');
  expect(catalogGroup({ muscleGroup: 'abdômen', name: 'Prancha' })).toBe('core');
  expect(catalogGroup({ muscleGroup: 'Cardio', name: 'Esteira' })).toBe('cardio');
});

test('dificuldade: com e sem acento é a mesma; valor inválido vira null', () => {
  expect(canonicalDifficulty('avancado')).toBe('avancado');
  expect(canonicalDifficulty('Avançado')).toBe('avancado');
  expect(canonicalDifficulty('intermediário')).toBe('intermediario');
  expect(canonicalDifficulty('elite')).toBeNull();
});

test('chave de nome junta as escritas do mesmo exercício e separa os diferentes', () => {
  expect(catalogKey('Supino Inclinado Halter')).toBe(catalogKey('Supino Inclinado com Halteres'));
  expect(catalogKey('Puxada Aberta (Lat Pulldown)')).toBe(catalogKey('Puxada aberta'));
  expect(catalogKey('Supino Inclinado Halter')).not.toBe(catalogKey('Supino Reto com Halteres'));
  expect(catalogKey('Elevação Lateral')).not.toBe(catalogKey('Elevação Lateral Máquina'));
  expect(nearKey('Supino Máquina')).toBe(nearKey('Supino Reto Máquina'));
});

test('junção das fontes: a embutida vence e o Firestore só acrescenta o que não existe', () => {
  const embedded = [{ name: 'Supino Inclinado Halter', muscleGroup: 'peito', reps: 10, sets: 3 }];
  const remote = [{ name: 'Supino Inclinado com Halteres', muscleGroup: 'peito', reps: '10', sets: '3' }, { name: 'Puxada Neutra Máquina', muscleGroup: 'costas', reps: '10', sets: '3' }];
  const merged = mergeCatalogs(embedded, remote);
  expect(merged).toHaveLength(2);
  expect(merged.find((e) => e.key === catalogKey('Supino Inclinado Halter')).sources).toEqual(['embutida', 'firestore']);
});

test('auditoria acusa repetição zero, grupo genérico, dificuldade fora do padrão e duplicata provável', () => {
  const embedded = [{ id: 'a', name: 'Esteira', muscleGroup: 'cardio', sets: 1, reps: 0, difficulty: 'iniciante', description: 'x'.repeat(40), execution: 'y'.repeat(70), machineImage: '/a.gif' }];
  const remote = [
    { id: 'b', name: 'Supino Máquina', muscleGroup: 'peito', sets: '3', reps: '10', difficulty: 'avancado', description: 'x'.repeat(40), execution: 'y'.repeat(70), machineImage: '/b.gif' },
    { id: 'c', name: 'Supino Reto Máquina', muscleGroup: 'peito', sets: '3', reps: '10', difficulty: 'avançado', description: 'x'.repeat(40), execution: 'y'.repeat(70), machineImage: '/c.gif' },
    { id: 'd', name: 'Rosca Direta', muscleGroup: 'braços', sets: '3', reps: '10', difficulty: 'iniciante', description: 'x'.repeat(40), execution: 'y'.repeat(70), machineImage: '/d.gif' }
  ];
  const { issues, totals } = auditCatalog(embedded, remote);
  const codes = issues.map((i) => i.code);
  expect(codes).toContain('repeticoes-zero');
  expect(codes).toContain('grupo-generico');
  expect(codes).toContain('dificuldade-fora-do-padrao');
  expect(codes).toContain('possivel-duplicata');
  expect(codes).toContain('reps-em-texto');
  expect(totals.unicos).toBe(4);
  expect(totals.porGrupo.biceps).toBe(1);
});

test('a biblioteca embutida não tem erro de auditoria (só avisos e informações)', () => {
  const { issues } = auditCatalog(exercises, []);
  expect(issues.filter((i) => i.level === 'erro')).toEqual([]);
  expect(normalizeCatalogEntry(exercises[0]).equipmentExplicit).toBe(true);
});

test('o gerador não vê o mesmo exercício duas vezes com escritas diferentes', () => {
  const lib = normalizeLibrary([{ name: 'Supino Inclinado Halter', muscleGroup: 'peito' }, { name: 'Supino Inclinado com Halteres', muscleGroup: 'peito' }, { name: 'Supino Reto com Halteres', muscleGroup: 'peito' }]);
  expect(lib).toHaveLength(2);
});

test('duplicata provável considera o equipamento: halter e máquina do mesmo exercício são exercícios diferentes', () => {
  const base = { sets: 3, reps: 10, difficulty: 'iniciante', description: 'x'.repeat(40), execution: 'y'.repeat(70), machineImage: '/a.gif' };
  const { issues } = auditCatalog([
    { ...base, name: 'Supino Reto Máquina', muscleGroup: 'peito' },
    { ...base, name: 'Supino Reto com Halteres', muscleGroup: 'peito' },
    { ...base, name: 'Puxada Aberta (Lat Pulldown)', equipment: 'polia', muscleGroup: 'costas' },
    { ...base, name: 'Tríceps Corda', muscleGroup: 'triceps' },
    { ...base, name: 'Tríceps Máquina', muscleGroup: 'triceps' }
  ], [
    { ...base, name: 'Supino Máquina', muscleGroup: 'peito' },
    { ...base, name: 'Puxada Aberta Máquina', muscleGroup: 'costas' }
  ]);
  const dups = issues.filter((i) => i.code === 'possivel-duplicata').map((i) => i.name);
  expect(dups).toHaveLength(2);
  expect(dups.some((n) => /Supino Reto Máquina.*Supino Máquina|Supino Máquina.*Supino Reto Máquina/.test(n))).toBe(true);
  expect(dups.some((n) => /Puxada Aberta/.test(n))).toBe(true);
});

test('auditoria das fichas: demo, sem catálogo, sem imagem e título incoerente', () => {
  const base = { sets: 3, reps: 10, difficulty: 'iniciante', description: 'x'.repeat(40), execution: 'y'.repeat(70), machineImage: '/a.gif' };
  const embedded = [{ ...base, name: 'Supino Reto Máquina', muscleGroup: 'peito' }, { ...base, name: 'Supino Inclinado Halter', muscleGroup: 'peito' }, { ...base, name: 'Crucifixo no Cabo', muscleGroup: 'peito' }, { ...base, name: 'Puxada Aberta (Lat Pulldown)', muscleGroup: 'costas' }];
  const { merged } = auditCatalog(embedded, []);
  const issues = auditTrainings([
    { name: 'TREINO COSTAS', exercises: [{ name: 'Supino Reto Máquina' }, { name: 'Supino Inclinado Halter' }, { name: 'Crucifixo no Cabo' }, { name: 'Puxada Aberta (Lat Pulldown)' }] },
    { name: 'Treino A', exercises: [{ name: 'Supino', firestoreId: 'demo_ex_supino' }] },
    { name: 'Vazia', exercises: [] }
  ], merged, []).map((i) => `${i.name}:${i.code}`);
  expect(issues).toContain('TREINO COSTAS:titulo-incoerente');
  expect(issues).toContain('Treino A:ficha-demonstracao');
  expect(issues).toContain('Treino A:exercicio-fora-do-catalogo');
  expect(issues).toContain('Treino A:exercicio-sem-imagem');
  expect(issues).toContain('Vazia:ficha-vazia');
});
