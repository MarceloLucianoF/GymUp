// Remove emojis e pictogramas (a interface do BohTreinar não usa emojis; ícones são SVG).
// Mantém símbolos tipográficos comuns (setas, bullets, travessões) e dígitos.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23FF}\u{E0020}-\u{E007F}️‍⃣]/gu;

export const stripEmojis = (text) => String(text ?? '')
  .replace(EMOJI, '')
  .replace(/[ \t]{2,}/g, ' ')        // espaços duplos deixados pela remoção
  .replace(/ +([,.;:!?])/g, '$1')    // espaço antes de pontuação
  .replace(/[ \t]+\n/g, '\n')         // espaço sobrando no fim da linha
  .replace(/^[ \t]+$/gm, '')         // linhas que ficaram só com espaços
  .trim();
