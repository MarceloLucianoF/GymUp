import { ImageError, checkImageHeader, fitSize, isSafePhoto, prepareImage, sniffImageType } from './imageAttach';

const bytes = (...n) => Uint8Array.from(n);
const file = (size, data = []) => ({ size, arrayBuffer: async () => Uint8Array.from(data).buffer });

test('tipo pela assinatura real do arquivo', () => {
  expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
  expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe('png');
  expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('webp');
  expect(sniffImageType(bytes(0x4d, 0x5a, 0x90, 0))).toBeNull();           // executável
  expect(sniffImageType(Array.from('<svg onload=alert(1)>').map((c) => c.charCodeAt(0)))).toBeNull();   // SVG nunca entra
  expect(sniffImageType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();        // PDF
});

test('recusa arquivo vazio, grande demais e de tipo falso', () => {
  expect(() => checkImageHeader(file(0), bytes())).toThrow(ImageError);
  expect(() => checkImageHeader(file(9 * 1024 * 1024), bytes(0xff, 0xd8, 0xff))).toThrow(/8 MB/);
  expect(() => checkImageHeader(file(100), bytes(0x4d, 0x5a))).toThrow(/JPEG, PNG, WebP ou HEIC/);
  expect(() => checkImageHeader(file(100), bytes(0xff, 0xd8, 0xff))).not.toThrow();
});

test('tamanho: reduz pelo lado maior e nunca amplia', () => {
  expect(fitSize(4000, 3000, 720)).toEqual({ width: 720, height: 540 });
  expect(fitSize(3000, 4000, 720)).toEqual({ width: 540, height: 720 });
  expect(fitSize(300, 200, 720)).toEqual({ width: 300, height: 200 });
});

test('só exibe o que o app gerou: data URL JPEG limitada', () => {
  expect(isSafePhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
  expect(isSafePhoto('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
  expect(isSafePhoto('https://golpe.com/a.jpg')).toBe(false);
  expect(isSafePhoto('javascript:alert(1)')).toBe(false);
  expect(isSafePhoto('data:image/jpeg;base64,' + 'A'.repeat(200000))).toBe(false);
  expect(isSafePhoto(null)).toBe(false);
});

describe('prepareImage com canvas simulado', () => {
  const fakeEnv = (sizes) => {
    let i = 0; const drawn = {};
    return {
      decode: async () => ({ width: 3000, height: 2000, close() {} }),
      canvas: (w, h) => ({ width: w, height: h, getContext: () => ({ fillRect() {}, drawImage: (_b, _x, _y, dw, dh) => { drawn.w = dw; drawn.h = dh; }, set fillStyle(v) {} }), toDataURL: () => 'data:image/jpeg;base64,' + 'A'.repeat(sizes[Math.min(i++, sizes.length - 1)]) }),
      drawn
    };
  };
  const good = file(500, [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
  test('redimensiona e devolve JPEG dentro do limite', async () => {
    const env = fakeEnv([50000]);
    const url = await prepareImage(good, 'workout', env);
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(env.drawn).toEqual({ w: 720, h: 480 });
  });
  test('baixa a qualidade até caber e desiste com erro claro', async () => {
    expect((await prepareImage(good, 'exercise', fakeEnv([90000, 60000, 30000]))).length).toBeLessThanOrEqual(45000);
    await expect(prepareImage(good, 'exercise', fakeEnv([90000]))).rejects.toThrow(/grande demais/);
  });
  test('arquivo com assinatura falsa nem chega ao canvas', async () => {
    await expect(prepareImage(file(500, [0x4d, 0x5a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'workout', fakeEnv([100]))).rejects.toThrow(/JPEG, PNG, WebP ou HEIC/);
  });
});

test('reconhece HEIC do iPhone pela assinatura', () => {
  const { sniffImageType } = require('./imageAttach');
  const heic = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];   // ....ftypheic
  expect(sniffImageType(heic)).toBe('heic');
  expect(sniffImageType([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])).toBe(null);   // mp4 (isom) não
});
