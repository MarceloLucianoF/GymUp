import { modelLabel } from './aiMeta';

test('rótulos por provedor', () => {
  expect(modelLabel(null)).toBe('Coach IA');
  expect(modelLabel({ provider: 'local', reason: 'cota' })).toBe('IA indisponível');
  expect(modelLabel({ provider: 'local', reason: 'sem-internet' })).toBe('Sem internet');
  expect(modelLabel({ provider: 'gemini', model: 'gemini-3.5-flash' })).toBe('Gemini 3.5 Flash');
  expect(modelLabel({ provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' })).toBe('NVIDIA Nemotron 70b');
  expect(modelLabel({ provider: 'x' })).toBe('Coach IA');
});

import { failureMessage } from './aiMeta';
import { classifyFailure } from './aiService';

describe('falhas do Coach IA', () => {
  it('classifica o erro e nunca fala em "modo offline" quando a falha foi do provedor', () => {
    expect(classifyFailure(new Error('NVIDIA proxy 504'))).toBe('lento');
    expect(classifyFailure({ name: 'AbortError' })).toBe('lento');
    expect(classifyFailure(new Error('[429 ] You exceeded your current quota'))).toBe('cota');
    expect(classifyFailure(new Error('NVIDIA proxy 502'))).toBe('indisponivel');
    for (const r of ['cota', 'lento', 'indisponivel', 'sem-internet', 'x']) expect(failureMessage(r)).not.toMatch(/offline/i);
    expect(failureMessage('cota')).toMatch(/pedidos demais/);
  });
});
