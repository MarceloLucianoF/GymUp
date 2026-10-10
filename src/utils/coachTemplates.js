// Modelos de mensagem do treinador (variáveis {nome}, {valor}, {dias}, {recorde}) e link de WhatsApp.
export const TEMPLATES_KEY = 'academyup.coach.messageTemplates.v1';

export const DEFAULT_TEMPLATES = [
  { id: 'record', label: 'Parabéns pelo recorde', text: 'Parabéns, {nome}! Vi que você bateu um recorde{recorde}. Continue assim! 💪' },
  { id: 'miss', label: 'Sentimos sua falta', text: 'Oi, {nome}! Sentimos sua falta nos treinos. Está tudo bem? Posso ajustar sua ficha para ficar mais fácil de encaixar na sua rotina.' },
  { id: 'reminder', label: 'Lembrete de treino', text: 'Oi, {nome}! Passando para lembrar do treino de hoje. Qualquer dúvida, me chame por aqui.' },
  { id: 'billing', label: 'Cobrança educada', text: 'Oi, {nome}! Tudo bem? Passando para lembrar da mensalidade{valor}. Se já pagou, desconsidere. Obrigado!' }
];

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'aluno';

// Substitui {variavel}; variáveis desconhecidas ou sem valor ficam vazias só quando conhecidas, senão permanecem.
export const fillTemplate = (text, vars = {}) => String(text ?? '').replace(/\{(\w+)\}/g, (match, key) => {
  if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
  const v = vars[key];
  return v === null || v === undefined ? '' : String(v);
});

const sanitize = (list) => {
  if (!Array.isArray(list)) return null;
  const clean = list
    .filter((t) => t && typeof t.text === 'string' && typeof t.label === 'string' && t.label.trim() && t.text.trim())
    .map((t, i) => ({ id: String(t.id || `custom-${i}`), label: t.label.trim().slice(0, 40), text: t.text.slice(0, 1000) }));
  return clean.length ? clean : null;
};

export const loadTemplates = (storage = (typeof window !== 'undefined' ? window.localStorage : null)) => {
  try {
    const raw = storage?.getItem(TEMPLATES_KEY);
    return (raw && sanitize(JSON.parse(raw))) || DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
};

export const saveTemplates = (list, storage = (typeof window !== 'undefined' ? window.localStorage : null)) => {
  try {
    storage?.setItem(TEMPLATES_KEY, JSON.stringify(sanitize(list) || DEFAULT_TEMPLATES));
    return true;
  } catch {
    return false;
  }
};

// Telefone brasileiro: aceita 10-11 dígitos (acrescenta 55) ou já com DDI 55 (12-13 dígitos).
export const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return null;
};

export const whatsappLink = (phone, text) => {
  const number = normalizePhone(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text || '')}` : null;
};

export const TEMPLATE_FOR_ACTION = { overdue: 'billing', inactive: 'miss', record: 'record' };

const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

// Mensagem pronta para um item da fila de ação (usa o modelo do treinador, editado ou padrão).
export const draftForAction = (item, templates = DEFAULT_TEMPLATES) => {
  const id = TEMPLATE_FOR_ACTION[item.type];
  const tpl = templates.find((t) => t.id === id) || DEFAULT_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return '';
  const s = item.student || {};
  return fillTemplate(tpl.text, {
    nome: firstName(s.displayName),
    valor: ` de ${money(s.monthlyFee || item.weight)}`,
    dias: item.days ?? '',
    recorde: item.record ? ` em ${item.record.exercise} (${item.record.weight} kg)` : ''
  });
};
