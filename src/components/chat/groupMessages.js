// Agrupa mensagens consecutivas do mesmo remetente (janela de 5 min) para o balão compacto.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const toMillis = (value) => {
  if (!value) return null;
  if (value.seconds) return value.seconds * 1000;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

export const groupMessages = (messages = []) => {
  const groups = [];
  messages.forEach((msg) => {
    const last = groups[groups.length - 1];
    const ms = toMillis(msg.createdAt);
    const lastMs = last ? toMillis(last.messages[last.messages.length - 1].createdAt) : null;
    const sameWindow = ms == null || lastMs == null || ms - lastMs <= GROUP_WINDOW_MS;
    if (last && last.senderId === msg.senderId && sameWindow) last.messages.push(msg);
    else groups.push({ senderId: msg.senderId, messages: [msg] });
  });
  return groups;
};
