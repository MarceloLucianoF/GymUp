const fmtDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const fmtDateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const dateOf = (iso) => (iso ? fmtDate.format(new Date(iso)) : '');
export const dateTimeOf = (iso) => (iso ? fmtDateTime.format(new Date(iso)) : '');

export function relativeTime(iso, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} d`;
  return dateOf(iso);
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const initials = (name) => (String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
