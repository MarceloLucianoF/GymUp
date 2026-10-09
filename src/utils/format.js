// Formatação compartilhada (pt-BR). Datas inválidas retornam o fallback.
const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value, options, fallback = '-') => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('pt-BR', options) : fallback;
};

// Volume em kg -> toneladas com 1 casa ("1.2t").
export const formatTonnage = (kg, unit = 't') => `${((Number(kg) || 0) / 1000).toFixed(1)}${unit}`;

// Hora HH:mm. Aceita Date, ms/ISO ou Timestamp do Firestore ({ seconds }).
export const formatTime = (value, fallback = '') => {
  const date = toDate(value?.seconds ? value.seconds * 1000 : value);
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fallback;
};

// Segundos -> "mm:ss" (ou "h:mm:ss" a partir de 1h).
export const formatDuration = (totalSeconds) => {
  const t = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
