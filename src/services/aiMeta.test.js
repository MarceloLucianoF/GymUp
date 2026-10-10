import { modelLabel } from './aiMeta';

test('rótulos por provedor', () => {
  expect(modelLabel(null)).toBe('Coach IA');
  expect(modelLabel({ provider: 'local' })).toBe('Modo offline');
  expect(modelLabel({ provider: 'gemini', model: 'gemini-3.5-flash' })).toBe('Gemini 3.5 Flash');
  expect(modelLabel({ provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' })).toBe('NVIDIA Nemotron 70b');
  expect(modelLabel({ provider: 'x' })).toBe('Coach IA');
});
