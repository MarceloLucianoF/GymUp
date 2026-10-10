// Rótulo curto do provedor/modelo que respondeu, exibido no cabeçalho do Coach IA.
const titleCase = (value) => String(value).split(/[-_]/).filter(Boolean)
  .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))).join(' ');

export const modelLabel = (meta) => {
  if (!meta) return 'Coach IA';
  if (meta.provider === 'local') return 'Modo offline';
  if (meta.provider === 'nvidia') {
    const short = String(meta.model || '').split('/').pop().replace(/^llama-3\.1-/, '').replace(/-instruct$/, '');
    return `NVIDIA ${titleCase(short)}`.trim();
  }
  if (meta.provider === 'gemini') return titleCase(meta.model || 'gemini');
  return 'Coach IA';
};
