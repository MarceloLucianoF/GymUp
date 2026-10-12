// Links vindos de dados editáveis (ex.: vídeo da ficha): só http(s). Bloqueia javascript:, data:, etc.
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch (_) {
    return '';
  }
}

// ID do YouTube (11 caracteres) a partir de links watch?v= ou youtu.be/. Vazio se inválido.
export function youtubeId(value) {
  const text = typeof value === 'string' ? value : '';
  const match = text.match(/[?&]v=([A-Za-z0-9_-]{11})/) || text.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || text.match(/embed\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : '';
}
