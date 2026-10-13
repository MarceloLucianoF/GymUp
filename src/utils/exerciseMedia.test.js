import { stillSrc } from './exerciseMedia';

test('GIF local vira a foto leve; outras fontes ficam como estão', () => {
  expect(stillSrc('/exercises/hack-squat.gif')).toBe('/exercicios/hack-squat.jpg');
  expect(stillSrc('/exercicios/hack-squat.jpg')).toBe('/exercicios/hack-squat.jpg');
  expect(stillSrc('https://exemplo.com/a.gif')).toBe('https://exemplo.com/a.gif');
  expect(stillSrc(null)).toBeNull();
  expect(stillSrc('')).toBe('');
});
