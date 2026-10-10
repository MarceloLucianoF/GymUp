import { fillTemplate, firstName, loadTemplates, saveTemplates, DEFAULT_TEMPLATES, normalizePhone, whatsappLink, TEMPLATES_KEY } from './coachTemplates';

const memory = () => {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
};

describe('fillTemplate', () => {
  it('substitui variáveis conhecidas', () => {
    expect(fillTemplate('Oi, {nome}! {valor}', { nome: 'Ana', valor: 'R$ 100' })).toBe('Oi, Ana! R$ 100');
  });
  it('mantém desconhecidas e esvazia nulas', () => {
    expect(fillTemplate('{nome} {x}{recorde}', { nome: 'Ana', recorde: null })).toBe('Ana {x}');
  });
});

describe('firstName', () => {
  it('pega o primeiro nome', () => {
    expect(firstName('  Maria da Silva ')).toBe('Maria');
    expect(firstName('')).toBe('aluno');
  });
});

describe('templates em storage', () => {
  it('usa padrão quando vazio ou corrompido', () => {
    expect(loadTemplates(memory())).toBe(DEFAULT_TEMPLATES);
    const s = memory(); s.setItem(TEMPLATES_KEY, '{ruim');
    expect(loadTemplates(s)).toBe(DEFAULT_TEMPLATES);
  });
  it('salva e recarrega, descartando itens inválidos', () => {
    const s = memory();
    saveTemplates([{ id: 'a', label: 'Oi', text: 'Olá {nome}' }, { id: 'b', label: '', text: 'x' }], s);
    expect(loadTemplates(s)).toEqual([{ id: 'a', label: 'Oi', text: 'Olá {nome}' }]);
  });
  it('tolera storage indisponível', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadTemplates(broken)).toBe(DEFAULT_TEMPLATES);
    expect(saveTemplates(DEFAULT_TEMPLATES, broken)).toBe(false);
  });
  it('modelos padrão usam {nome}', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    DEFAULT_TEMPLATES.forEach((t) => expect(t.text).toContain('{nome}'));
  });
});

describe('whatsapp', () => {
  it('normaliza telefones brasileiros', () => {
    expect(normalizePhone('(11) 91234-5678')).toBe('5511912345678');
    expect(normalizePhone('+55 11 91234-5678')).toBe('5511912345678');
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
  it('gera link com texto codificado ou null', () => {
    expect(whatsappLink('11912345678', 'Oi, Ana & cia')).toBe('https://wa.me/5511912345678?text=Oi%2C%20Ana%20%26%20cia');
    expect(whatsappLink('', 'x')).toBeNull();
  });
});

describe('draftForAction', () => {
  const { draftForAction } = require('./coachTemplates');
  it('preenche cobrança e recorde', () => {
    const bill = draftForAction({ type: 'overdue', student: { displayName: 'Ana Souza', monthlyFee: 150 } });
    expect(bill).toContain('Ana');
    expect(bill).toMatch(/R\$\s?150,00/);
    const rec = draftForAction({ type: 'record', student: { displayName: 'Beto' }, record: { exercise: 'Supino', weight: 80 } });
    expect(rec).toContain('em Supino (80 kg)');
  });
  it('retorna vazio para tipos sem modelo', () => {
    expect(draftForAction({ type: 'nofile', student: {} })).toBe('');
  });
});
