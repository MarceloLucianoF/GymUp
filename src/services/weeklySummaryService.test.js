import { resolveNarrative, aiNarrative, snapshotId } from './weeklySummaryService';
import { buildWeeklySummary, factsHash, localNarrative } from '../utils/weeklySummary';

jest.mock('../firebase/config', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn() }));
jest.mock('./aiService', () => ({ aiService: { summarizeFacts: jest.fn() } }));

const NOW = new Date(2026, 9, 14, 15, 0);
const w = (d) => ({ id: `w${d}`, trainingId: 't', date: new Date(2026, 9, d, 10).toISOString(), duration: 3000, totalVolume: 1000, setsCompleted: 10, exercises: [{ name: 'Supino' }] });
const open = buildWeeklySummary({ history: [w(12), w(13), w(14)], weeklyGoal: 4, now: NOW });
const closed = buildWeeklySummary({ history: [w(12), w(13)], weeklyGoal: 4, now: new Date(2026, 9, 19, 9), which: 'last' });
const empty = buildWeeklySummary({ history: [], weeklyGoal: 4, now: NOW });
const GOOD = 'Você completou 3 de 4 treinos nesta semana, somando 150 minutos e 3,0 t. Falta 1 treino para a meta.';
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const deps = (over = {}) => ({ ai: { summarizeFacts: jest.fn().mockResolvedValue(GOOD) }, load: jest.fn().mockResolvedValue(null), save: jest.fn().mockResolvedValue(), now: NOW.getTime(), store: mem(), ...over });

describe('narrativa do resumo semanal', () => {
  it('id do snapshot é uid_semana', () => expect(snapshotId('u1', '2026-W42')).toBe('u1_2026-W42'));

  it('usa o snapshot quando os números são os mesmos: não chama a IA nem regrava', async () => {
    const d = deps({ load: jest.fn().mockResolvedValue({ factsHash: factsHash(open), text: 'Texto guardado.', source: 'ai' }) });
    expect(await resolveNarrative('u1', open, d)).toMatchObject({ text: 'Texto guardado.', source: 'saved-ai' });
    expect(d.ai.summarizeFacts).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it('IA válida: texto da IA, snapshot gravado com os mesmos números', async () => {
    const d = deps();
    const r = await resolveNarrative('u1', open, d);
    expect(r).toMatchObject({ text: GOOD, source: 'ai' });
    expect(d.save).toHaveBeenCalledWith('u1', open, GOOD, 'ai', expect.any(Date));
    expect(d.ai.summarizeFacts.mock.calls[0][0][1].content).toContain('"treinos_concluidos":3');
  });

  it('números diferentes dos fatos (IA inventou): usa o texto local e não regrava na semana aberta', async () => {
    const d = deps({ ai: { summarizeFacts: jest.fn().mockResolvedValue('Você completou 4 de 4 treinos e treinou 999 minutos nesta semana.') } });
    const r = await resolveNarrative('u1', open, d);
    expect(r).toMatchObject({ text: localNarrative(open), source: 'local' });
    expect(d.save).not.toHaveBeenCalled();
  });

  it.each([['vazia', null], ['lenta/429/5xx (null)', null]])('IA %s: tela segue com o texto local', async (_n, value) => {
    const d = deps({ ai: { summarizeFacts: jest.fn().mockResolvedValue(value) } });
    expect(await resolveNarrative('u1', open, d)).toMatchObject({ text: localNarrative(open), source: 'local' });
  });

  it('IA que lança erro não quebra', async () => {
    const d = deps({ ai: { summarizeFacts: jest.fn().mockRejectedValue(new Error('504')) } });
    expect(await resolveNarrative('u1', open, d)).toMatchObject({ source: 'local' });
  });

  it('depois de uma falha não tenta a IA de novo por 6 h para os mesmos números (sem regenerar à toa)', async () => {
    const store = mem();
    const fail = { summarizeFacts: jest.fn().mockResolvedValue(null) };
    await resolveNarrative('u1', open, deps({ ai: fail, store }));
    await resolveNarrative('u1', open, deps({ ai: fail, store }));
    expect(fail.summarizeFacts).toHaveBeenCalledTimes(1);
    await resolveNarrative('u1', open, deps({ ai: fail, store, now: NOW.getTime() + 7 * 3_600_000 }));
    expect(fail.summarizeFacts).toHaveBeenCalledTimes(2);
  });

  it('semana sem treinos não chama a IA; semana fechada sem IA guarda o resumo local', async () => {
    const d1 = deps();
    expect(await resolveNarrative('u1', empty, d1)).toMatchObject({ source: 'local', text: localNarrative(empty) });
    expect(d1.ai.summarizeFacts).not.toHaveBeenCalled();
    const d2 = deps({ ai: { summarizeFacts: jest.fn().mockResolvedValue(null) } });
    await resolveNarrative('u1', closed, d2);
    expect(d2.save).toHaveBeenCalledWith('u1', closed, localNarrative(closed), 'local', expect.any(Date));
  });

  it('falha ao ler ou gravar o snapshot não derruba nada', async () => {
    const d = deps({ load: jest.fn().mockRejectedValue(new Error('permission-denied')), save: jest.fn().mockRejectedValue(new Error('x')) });
    expect(await resolveNarrative('u1', open, d)).toMatchObject({ text: GOOD, source: 'ai' });
  });

  it('aiNarrative recusa texto vazio ou sem relação com os números', async () => {
    expect(await aiNarrative(open, { summarizeFacts: async () => '   ' })).toBeNull();
    expect(await aiNarrative(open, { summarizeFacts: async () => GOOD })).toBe(GOOD);
  });
});
