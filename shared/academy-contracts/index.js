// Contratos compartilhados entre o Worker da academia e o console da Gestão: papéis, estados, códigos de erro,
// validação de payloads (esquema fechado) e textos em português. Nada aqui acessa rede ou banco; é a fonte única dos nomes.

export const ROLES = ['owner', 'admin', 'coach', 'reception', 'student'];
export const MEMBER_STATUS = ['active', 'pending', 'suspended', 'removed'];
export const ASSIGNMENT_STATUS = ['proposed', 'pending_student', 'active', 'rejected', 'revoked'];
export const CONSENT_STATUS = ['granted', 'revoked'];
export const STAFF_ROLES = ['owner', 'admin'];
export const MANAGEMENT_ROLES = ['owner', 'admin', 'coach', 'reception'];

// Papéis que cada função pode convidar (admin não cria admin; recepção só aluno; coach e aluno não convidam).
export const INVITE_ROLES = {
  owner: ['admin', 'coach', 'reception', 'student'],
  admin: ['coach', 'reception', 'student'],
  reception: ['student']
};
// Papéis que o admin pode gerenciar (o dono gerencia qualquer outro membro).
export const ADMIN_MANAGES = ['coach', 'reception', 'student'];

export const LIMITS = {
  academyName: [2, 80], description: 500, contactEmail: 120, maxOwnedAcademies: 5,
  inviteMaxUses: 500, inviteMaxDays: 30, pageSizeMax: 50, auditPageMax: 50, exercisesMax: 20, batchMax: 50, bodyBytes: 8 * 1024
};

// ---------- erros: código estável -> [status HTTP, mensagem em português sem detalhes internos] ----------
export const ERRORS = {
  invalid_request: [400, 'Requisição inválida.'],
  idempotency_required: [400, 'Cabeçalho Idempotency-Key obrigatório (8 a 64 caracteres).'],
  no_token: [401, 'Autenticação obrigatória.'],
  invalid_token: [401, 'Sessão inválida ou expirada.'],
  origin_not_allowed: [403, 'Origem não autorizada.'],
  no_membership: [403, 'Você não tem vínculo com esta academia.'],
  membership_inactive: [403, 'Seu vínculo com esta academia não está ativo.'],
  academy_unavailable: [403, 'Esta academia está indisponível.'],
  forbidden_role: [403, 'Seu papel não permite esta operação.'],
  not_found: [404, 'Recurso não encontrado.'],
  invite_invalid: [404, 'Convite inválido, expirado ou esgotado.'],
  method_not_allowed: [405, 'Método não permitido.'],
  conflict: [409, 'Conflito com o estado atual.'],
  already_member: [409, 'Você já faz parte desta academia.'],
  limit_reached: [409, 'Limite atingido.'],
  last_owner: [409, 'A academia precisa de pelo menos um proprietário ativo.'],
  payload_too_large: [413, 'Corpo da requisição grande demais.'],
  rate_limited: [429, 'Limite temporário de solicitações excedido.'],
  upstream_error: [502, 'Não foi possível consultar o banco de dados.'],
  ops_disabled: [503, 'Operações administrativas desativadas temporariamente.']
};

// ---------- validação: esquema fechado (campo desconhecido é erro) ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function check(spec, value) {
  switch (spec.type) {
    case 'string': {
      if (typeof value !== 'string') return { ok: false };
      const v = spec.trim === false ? value : value.trim();
      if (spec.min !== undefined && v.length < spec.min) return { ok: false };
      if (spec.max !== undefined && v.length > spec.max) return { ok: false };
      if (spec.enum && !spec.enum.includes(v)) return { ok: false };
      if (spec.pattern && !spec.pattern.test(v)) return { ok: false };
      return { ok: true, value: v };
    }
    case 'int':
      return Number.isInteger(value) && (spec.min === undefined || value >= spec.min) && (spec.max === undefined || value <= spec.max) ? { ok: true, value } : { ok: false };
    case 'bool':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false };
    case 'literal':
      return value === spec.value ? { ok: true, value } : { ok: false };
    case 'array': {
      if (!Array.isArray(value) || (spec.max !== undefined && value.length > spec.max) || (spec.min !== undefined && value.length < spec.min)) return { ok: false };
      const out = [];
      for (const item of value) { const r = check(spec.of, item); if (!r.ok) return { ok: false }; out.push(r.value); }
      return { ok: true, value: out };
    }
    case 'object': return parse(spec.schema, value);
    default: return { ok: false };
  }
}

/** schema: { fields: { nome: spec }, required: [...], atLeastOne?: true }. Devolve { ok, value } ou { ok: false }. */
export function parse(schema, input) {
  if (!isObj(input)) return { ok: false };
  const keys = Object.keys(input);
  if (keys.some((k) => !Object.hasOwn(schema.fields, k))) return { ok: false };   // hasOwn: 'constructor' e afins não passam
  const out = {};
  for (const k of keys) {
    const r = check(schema.fields[k], input[k]);
    if (!r.ok) return { ok: false };
    out[k] = r.value;
  }
  if ((schema.required || []).some((k) => !(k in out))) return { ok: false };
  if (schema.atLeastOne && keys.length === 0) return { ok: false };
  return { ok: true, value: out };
}

const str = (min, max, extra = {}) => ({ type: 'string', min, max, ...extra });
const UID = str(1, 128, { pattern: /^[A-Za-z0-9_-]+$/ });
const CODE = { type: 'string', trim: false, min: 32, max: 32, pattern: /^[a-z0-9]{32}$/ };

export const SCHEMAS = {
  empty: { fields: {} },
  createAcademy: { fields: { name: str(...LIMITS.academyName) }, required: ['name'] },
  updateAcademy: { fields: { name: str(...LIMITS.academyName), description: str(0, LIMITS.description), contactEmail: str(0, LIMITS.contactEmail, { pattern: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/ }) }, atLeastOne: true },
  createInvite: {
    fields: { role: { type: 'string', enum: ['admin', 'coach', 'reception', 'student'] }, maxUses: { type: 'int', min: 1, max: LIMITS.inviteMaxUses }, expiresInDays: { type: 'int', min: 1, max: LIMITS.inviteMaxDays } },
    required: ['role']
  },
  inviteCode: { fields: { code: CODE }, required: ['code'] },
  changeRole: { fields: { role: { type: 'string', enum: ROLES } }, required: ['role'] },
  transferOwnership: { fields: { toUid: UID, confirm: { type: 'literal', value: true } }, required: ['toUid', 'confirm'] },
  proposeCoach: { fields: { studentUid: UID, coachUid: UID }, required: ['studentUid'] },
  consent: { fields: { shareAdherence: { type: 'bool' } }, required: ['shareAdherence'] },
  createTraining: {
    fields: {
      name: str(2, 80), description: str(0, 300),
      exercises: { type: 'array', min: 1, max: LIMITS.exercisesMax, of: { type: 'object', schema: { fields: { name: str(1, 120), muscleGroup: str(0, 40), sets: str(1, 10), reps: str(1, 20), rest: { type: 'int', min: 0, max: 300 }, machineImage: str(0, 300, { pattern: /^(|https:\/\/[^\s]+|\/(exercicios|exercises)\/[A-Za-z0-9._-]+)$/ }) }, required: ['name', 'sets', 'reps', 'rest'] } } }
    },
    required: ['name', 'exercises']
  },
  assignTraining: { fields: { studentUid: UID, version: { type: 'int', min: 1, max: 100000 } }, required: ['studentUid'] },
  setPermissions: { fields: { canCreateTrainings: { type: 'bool' } }, required: ['canCreateTrainings'] },
  updateTraining: null,   // definido abaixo: mesmos campos de createTraining, todos opcionais
  duplicateTraining: { fields: { name: str(2, 80) } },
  assignBatch: {
    fields: {
      studentUids: { type: 'array', min: 1, max: LIMITS.batchMax, of: UID }, version: { type: 'int', min: 1, max: 100000 },
      replace: { type: 'bool' }, dryRun: { type: 'bool' }
    },
    required: ['studentUids']
  }
};
SCHEMAS.updateTraining = { fields: SCHEMAS.createTraining.fields, atLeastOne: true };

// ---------- textos em português (rótulos, mensagens e ações de auditoria) ----------
export const ROLE_LABELS = { owner: 'Proprietário', admin: 'Administrador', coach: 'Professor', reception: 'Recepção', student: 'Aluno' };
export const STATUS_LABELS = { active: 'Ativo', pending: 'Pendente', suspended: 'Suspenso', removed: 'Removido' };
export const ASSIGNMENT_LABELS = { proposed: 'Aguardando aprovação', pending_student: 'Aguardando o aluno', active: 'Ativo', rejected: 'Recusado', revoked: 'Encerrado' };
export const ACTION_LABELS = {
  'academy.created': 'Academia criada', 'academy.updated': 'Dados da academia atualizados',
  'member.joined': 'Entrou na academia', 'member.left': 'Saiu da academia', 'member.role_changed': 'Papel alterado',
  'member.suspended': 'Membro suspenso', 'member.reactivated': 'Membro reativado', 'member.removed': 'Membro removido',
  'invite.created': 'Convite criado', 'invite.revoked': 'Convite revogado', 'ownership.transferred': 'Propriedade transferida',
  'coach.proposed': 'Professor proposto', 'coach.approved': 'Proposta aprovada', 'coach.accepted': 'Professor aceito pelo aluno',
  'coach.rejected': 'Professor recusado', 'coach.revoked': 'Vínculo com professor encerrado',
  'consent.granted': 'Consentimento concedido', 'consent.revoked': 'Consentimento revogado',
  'training.created': 'Ficha criada', 'training.published': 'Versão de ficha publicada', 'training.assigned': 'Ficha atribuída', 'training.updated': 'Rascunho de ficha editado', 'training.duplicated': 'Ficha duplicada',
  'training.archived': 'Ficha arquivada', 'training.restored': 'Ficha restaurada', 'training.batch_assigned': 'Ficha atribuída em lote', 'member.permission_changed': 'Permissões do professor alteradas'
};
export const ERROR_MESSAGES = {
  network: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  no_token: 'Entre novamente para continuar.',
  invalid_token: 'Sua sessão expirou. Entre novamente.',
  no_membership: 'Você não tem vínculo com esta academia.',
  membership_inactive: 'Seu vínculo com esta academia não está ativo.',
  academy_unavailable: 'Esta academia está indisponível no momento.',
  forbidden_role: 'Seu papel não permite esta operação.',
  rate_limited: 'Muitas solicitações seguidas. Aguarde um minuto.',
  ops_disabled: 'As operações administrativas estão pausadas.',
  upstream_error: 'O servidor não conseguiu concluir. Tente novamente.',
  limit_reached: 'Você atingiu o limite permitido.',
  last_owner: 'A academia precisa de pelo menos um proprietário ativo.',
  conflict: 'Não foi possível concluir: os dados mudaram. Atualize e tente de novo.',
  invalid_request: 'Confira os dados informados.',
  idempotency_required: 'Não foi possível enviar. Atualize a página e tente de novo.',
  invite_invalid: 'Este convite é inválido, expirou ou já foi usado.',
  already_member: 'Você já faz parte desta academia.',
  not_found: 'Não encontramos o que você procurou.'
};
export const friendlyError = (err) => ERROR_MESSAGES[err?.code] || 'Algo deu errado. Tente novamente.';
