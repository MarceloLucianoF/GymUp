import { safeHttpUrl } from '../../../utils/safeUrl';

export const MUSCLE_GROUPS = [['peito', 'Peito'], ['costas', 'Costas'], ['ombros', 'Ombros'], ['braços', 'Braços'], ['pernas', 'Pernas'], ['core', 'Core'], ['mobilidade', 'Alongamento e mobilidade']];
export const GROUP_LABEL = Object.fromEntries(MUSCLE_GROUPS);
export const DIFFICULTIES = [['iniciante', 'Iniciante'], ['intermediário', 'Intermediário'], ['avançado', 'Avançado']];

const norm = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

export const hasImage = (ex) => !!safeHttpUrl(ex?.machineImage);
export const hasVideo = (ex) => !!safeHttpUrl(ex?.videoUrl);
export const mediaStatus = (ex) => (hasImage(ex) && hasVideo(ex) ? 'ambos' : hasImage(ex) ? 'imagem' : hasVideo(ex) ? 'video' : 'nenhuma');

// Pendências de conteúdo de um exercício (usadas na visão geral e no filtro "com pendência").
export function exerciseIssues(ex) {
  const issues = [];
  if (!hasImage(ex)) issues.push('sem-imagem');
  if (!hasVideo(ex)) issues.push('sem-video');
  if (!hasText(ex?.execution)) issues.push('sem-execucao');
  if (!hasText(ex?.description)) issues.push('sem-descricao');
  return issues;
}
export const ISSUE_LABEL = { 'sem-imagem': 'Sem imagem', 'sem-video': 'Sem vídeo', 'sem-execucao': 'Sem passo a passo', 'sem-descricao': 'Sem descrição' };

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};
export const updatedAtOf = (item) => toMillis(item?.updatedAt) || toMillis(item?.createdAt);
export const isRecent = (item, days = 7, now = Date.now()) => now - updatedAtOf(item) < days * 86_400_000 && updatedAtOf(item) > 0;

export function filterExercises(list, { term = '', group = '', difficulty = '', media = '', status = 'ativos', issue = '', sort = 'nome' } = {}) {
  const q = norm(term);
  const out = list.filter((ex) => {
    if (status === 'ativos' && ex.archived) return false;
    if (status === 'arquivados' && !ex.archived) return false;
    if (group && ex.muscleGroup !== group) return false;
    if (difficulty && norm(ex.difficulty) !== norm(difficulty)) return false;
    if (media && mediaStatus(ex) !== media && !(media === 'com-video' && hasVideo(ex)) && !(media === 'com-imagem' && hasImage(ex))) return false;
    if (issue && !exerciseIssues(ex).includes(issue)) return false;
    if (q && !norm(`${ex.name} ${ex.muscleGroup} ${ex.difficulty}`).includes(q)) return false;
    return true;
  });
  const by = {
    nome: (a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'),
    grupo: (a, b) => String(a.muscleGroup).localeCompare(String(b.muscleGroup), 'pt-BR') || String(a.name).localeCompare(String(b.name), 'pt-BR'),
    recentes: (a, b) => updatedAtOf(b) - updatedAtOf(a)
  };
  return out.sort(by[sort] || by.nome);
}

// Validação do editor de exercício. Devolve { campo: mensagem }.
export function validateExerciseForm(form) {
  const errors = {};
  if (!hasText(form.name)) errors.name = 'Informe o nome.';
  if (!form.muscleGroup) errors.muscleGroup = 'Escolha o grupo muscular.';
  const kind = form.kind || 'strength';
  const sets = Number(form.sets);
  if (kind !== 'cardio' && (!Number.isInteger(sets) || sets < 1 || sets > 12)) errors.sets = 'De 1 a 12 séries.';
  const rest = Number(form.rest);
  if (kind !== 'cardio' && (!Number.isFinite(rest) || rest < 0 || rest > 600)) errors.rest = 'De 0 a 600 s.';
  if (!hasText(String(form.reps ?? ''))) errors.reps = kind === 'cardio' ? 'Informe a duração em minutos.' : kind === 'timed' ? 'Informe o tempo em segundos.' : 'Informe as repetições.';
  else if (kind !== 'strength' && !(parseInt(String(form.reps), 10) > 0)) errors.reps = kind === 'cardio' ? 'A duração precisa ser maior que zero.' : 'O tempo precisa ser maior que zero.';
  if (hasText(form.machineImage) && !safeHttpUrl(form.machineImage)) errors.machineImage = 'Use um link http(s) válido.';
  if (hasText(form.videoUrl) && !safeHttpUrl(form.videoUrl)) errors.videoUrl = 'Use um link http(s) válido.';
  return errors;
}

export const hasNameConflict = (list, name, ignoreId = null) =>
  list.some((ex) => ex.firestoreId !== ignoreId && norm(ex.name) === norm(name));

// ---- fichas ----
const idOf = (entry) => (entry && typeof entry === 'object' ? entry.firestoreId || entry.id : entry);

export function trainingExercises(training, exerciseMap) {
  return (training?.exercises || []).map((entry) => (entry && typeof entry === 'object' ? entry : exerciseMap.get(entry) || null)).filter(Boolean);
}

export function trainingGroups(training, exerciseMap) {
  return [...new Set(trainingExercises(training, exerciseMap).map((ex) => ex.muscleGroup).filter(Boolean))];
}

export function trainingIssues(training, exerciseMap) {
  const issues = [];
  const entries = training?.exercises || [];
  if (entries.length === 0) issues.push({ id: 'vazia', text: 'A ficha não tem exercícios.' });
  const missing = entries.filter((e) => !(e && typeof e === 'object') && !exerciseMap.has(e));
  if (missing.length) issues.push({ id: 'orfaos', text: `${missing.length} exercício(s) não existem mais na biblioteca.` });
  const resolved = trainingExercises(training, exerciseMap);
  const archived = resolved.filter((ex) => ex.archived);
  if (archived.length) issues.push({ id: 'arquivados', text: `${archived.length} exercício(s) arquivado(s) nesta ficha.` });
  const groups = new Set(resolved.map((ex) => ex.muscleGroup));
  if (/core/i.test(String(training?.name)) && !groups.has('core')) issues.push({ id: 'core', text: 'O nome cita CORE, mas a ficha não tem exercício de core.' });
  const noMedia = resolved.filter((ex) => mediaStatus(ex) === 'nenhuma').length;
  if (noMedia) issues.push({ id: 'sem-midia', text: `${noMedia} exercício(s) sem imagem nem vídeo.` });
  return issues;
}

export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Quantos alunos usam cada ficha (users.currentTrainingId).
export function usageByTraining(users) {
  const map = {};
  users.forEach((u) => { if (u.role === 'user' && u.currentTrainingId) map[u.currentTrainingId] = (map[u.currentTrainingId] || 0) + 1; });
  return map;
}

// ---- importação ----
export function parseImport(json, kind, existing) {
  let items;
  if (Array.isArray(json)) items = json;
  else if (json && typeof json === 'object') items = json[kind] || json.exercises || json.trainings || [json];
  else items = [];
  if (!Array.isArray(items)) items = [];
  const names = new Set(existing.map((e) => norm(e.name)));
  const seen = new Set();
  const result = { novos: [], duplicados: [], invalidos: [], total: items.length };
  items.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || !hasText(raw.name)) { result.invalidos.push({ index, reason: 'Sem nome.' }); return; }
    if (kind === 'exercises') {
      const group = norm(raw.muscleGroup);
      if (!MUSCLE_GROUPS.some(([v]) => norm(v) === group)) { result.invalidos.push({ index, name: raw.name, reason: 'Grupo muscular inválido.' }); return; }
      if (hasText(raw.videoUrl) && !safeHttpUrl(raw.videoUrl)) { result.invalidos.push({ index, name: raw.name, reason: 'Link de vídeo inválido.' }); return; }
      if (hasText(raw.machineImage) && !safeHttpUrl(raw.machineImage)) { result.invalidos.push({ index, name: raw.name, reason: 'Link de imagem inválido.' }); return; }
    }
    const key = norm(raw.name);
    if (names.has(key) || seen.has(key)) { result.duplicados.push({ index, name: raw.name }); return; }
    seen.add(key);
    result.novos.push(raw);
  });
  return result;
}

export const entryId = idOf;

// ---- vínculos aluno-treinador ----
export function linkOverview(users, links) {
  const students = users.filter((u) => u.role === 'user');
  const coaches = users.filter((u) => u.role === 'coach');
  const withCoach = new Set(students.filter((s) => s.coachId).map((s) => s.coachId));
  return {
    students: students.length,
    coaches: coaches.length,
    active: students.filter((s) => s.coachId).length,
    withoutCoach: students.filter((s) => !s.coachId).length,
    coachesWithoutStudents: coaches.filter((c) => !withCoach.has(c.uid)).length,
    pending: links.filter((l) => l.status === 'pending').length,
    rejected: links.filter((l) => l.status === 'rejected').length,
    revoked: links.filter((l) => l.status === 'revoked').length
  };
}

// ---- social ----
export function socialOverview(profiles, friendships) {
  return {
    profiles: profiles.length,
    discoverable: profiles.filter((p) => p.discoverable).length,
    ranking: profiles.filter((p) => p.shareRanking).length,
    friends: friendships.filter((f) => f.status === 'active').length,
    pending: friendships.filter((f) => f.status === 'pending').length,
    blocked: friendships.filter((f) => f.status === 'blocked').length
  };
}
