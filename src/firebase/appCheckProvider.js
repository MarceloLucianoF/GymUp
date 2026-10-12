// O SDK do App Check carrega o script do reCAPTCHA sem tratar falha (só `onload`): com o script bloqueado (extensão de
// privacidade, firewall, rede restrita) o token nunca chega e o Auth/Firestore ficam esperando para sempre: tela em branco.
// Este invólucro dá um prazo ao token; estourado, a chamada segue sem token. Depois de uma falha, as chamadas seguintes
// falham na hora por um tempo (senão cada serviço esperaria o prazo de novo, um depois do outro) e então o SDK tenta de novo.
export const TOKEN_WAIT_MS = 5000;
export const COOLDOWN_MS = 60000;

export function withTokenTimeout(provider, ms = TOKEN_WAIT_MS, cooldown = COOLDOWN_MS, now = Date.now) {
  let failedAt = null;
  return {
    initialize: (app) => provider.initialize(app),
    getToken: () => new Promise((resolve, reject) => {
      if (failedAt !== null && now() - failedAt < cooldown) { reject(new Error('app-check/token-unavailable')); return; }
      const timer = setTimeout(() => { failedAt = now(); reject(new Error('app-check/token-timeout')); }, ms);
      provider.getToken().then(
        (token) => { clearTimeout(timer); failedAt = null; resolve(token); },
        (error) => { clearTimeout(timer); failedAt = now(); reject(error); }
      );
    }),
    isEqual: (other) => !!other && typeof provider.isEqual === 'function' && provider.isEqual(other)
  };
}
