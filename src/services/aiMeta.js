// Rótulo curto do provedor/modelo que respondeu, exibido no cabeçalho do Coach IA.
const titleCase = (value) => String(value).split(/[-_]/).filter(Boolean)
  .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))).join(' ');

// Motivo da falha -> mensagem amigável (o aluno não precisa saber de 429/502/504).
export const failureMessage = (reason) => ({
  'sem-internet': 'Você está sem internet. Conecte-se e tente de novo.',
  cota: 'O Coach IA recebeu pedidos demais agora. Aguarde um pouco e tente novamente.',
  lento: 'O Coach IA demorou além do normal para responder. Tente novamente.',
  indisponivel: 'O Coach IA está instável no momento. Tente novamente em instantes.'
}[reason] || 'Não consegui responder agora. Tente novamente.');

export const modelLabel = (meta) => {
  if (!meta) return 'Coach IA';
  if (meta.provider === 'local') return meta.reason === 'sem-internet' ? 'Sem internet' : 'IA indisponível';
  if (meta.provider === 'nvidia') {
    const short = String(meta.model || '').split('/').pop().replace(/^llama-3\.1-/, '').replace(/-instruct$/, '');
    return `NVIDIA ${titleCase(short)}`.trim();
  }
  if (meta.provider === 'gemini') return titleCase(meta.model || 'gemini');
  return 'Coach IA';
};
