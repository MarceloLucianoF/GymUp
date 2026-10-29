// Anexo de imagem do aluno (foto do treino ou do exercício). A imagem é LIDA no aparelho, conferida pela assinatura real do arquivo
// (JPEG, PNG ou WebP), redesenhada em um canvas (isso descarta metadados como a localização do GPS e qualquer conteúdo escondido) e
// guardada como JPEG pequeno dentro do próprio documento privado. Nada é enviado a terceiros.
export const IMAGE_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024,
  workout: { maxSide: 720, maxChars: 130000 },
  exercise: { maxSide: 420, maxChars: 45000 },
  avatar: { maxSide: 400, maxChars: 80000 },      // foto de perfil (aluno e treinador)
  progress: { maxSide: 1080, maxChars: 400000 }   // foto do shape na medição
};

/** Tipo pela assinatura dos primeiros bytes; o nome e o tipo informado pelo navegador não valem. */
export function sniffImageType(bytes) {
  const b = Array.from(bytes || []).slice(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  // HEIC/HEIF (câmera do iPhone): "ftyp" + marca. O Safari decodifica; o resultado vira JPEG como os outros.
  const ftyp = String.fromCharCode(...b.slice(4, 8));
  const brand = String.fromCharCode(...b.slice(8, 12));
  if (ftyp === 'ftyp' && ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
  return null;
}

export class ImageError extends Error {
  constructor(message) { super(message); this.name = 'ImageError'; }
}

export function checkImageHeader(file, head) {
  if (!file || typeof file.size !== 'number' || file.size === 0) throw new ImageError('Escolha uma imagem.');
  if (file.size > IMAGE_LIMITS.maxInputBytes) throw new ImageError('A imagem passa de 8 MB. Escolha uma menor.');
  if (!sniffImageType(head)) throw new ImageError('Use uma foto JPEG, PNG, WebP ou HEIC.');
}

/** Lado maior limitado a `max`, sem ampliar e mantendo a proporção. */
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Só aceita o que o app mesmo gerou: data URL JPEG dentro do limite. Usado para ler dados vindos do banco antes de exibir. */
export const isSafePhoto = (value, maxChars = IMAGE_LIMITS.workout.maxChars) =>
  typeof value === 'string' && value.length <= maxChars && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);

/** Lê, valida e reduz a imagem. `kind`: 'workout', 'exercise', 'avatar' ou 'progress'. Devolve uma data URL JPEG. */
export async function prepareImage(file, kind = 'workout', env = {}) {
  const limits = IMAGE_LIMITS[kind] || IMAGE_LIMITS.workout;
  const buf = await file.arrayBuffer();
  checkImageHeader(file, new Uint8Array(buf.slice(0, 12)));
  const decode = env.decode || (async (blob) => createImageBitmap(blob));
  const canvasFor = env.canvas || ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  let bitmap;
  try { bitmap = await decode(new Blob([buf], { type: file.type || '' })); } catch { throw new ImageError('Não consegui abrir esta imagem. Se for HEIC, tente uma foto em JPEG.'); }
  const { width, height } = fitSize(bitmap.width, bitmap.height, limits.maxSide);
  const canvas = canvasFor(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);   // PNG com fundo transparente vira fundo branco
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  for (const q of [0.78, 0.66, 0.54, 0.42, 0.32]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= limits.maxChars) return url;
  }
  throw new ImageError('A imagem ficou grande demais mesmo reduzida. Escolha outra.');
}
