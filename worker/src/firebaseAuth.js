// Verifica ID tokens do Firebase Auth (JWT RS256) com WebCrypto, sem dependências.
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;

let jwksCache = { keys: null, fetchedAt: 0 };

const b64urlToBytes = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const decodeJson = (part) => JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));

async function getJwks(fetchImpl, now) {
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const response = await fetchImpl(JWKS_URL);
  if (!response.ok) throw new Error('JWKS indisponível');
  const { keys } = await response.json();
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

export const resetJwksCache = () => { jwksCache = { keys: null, fetchedAt: 0 }; };

// Retorna as claims do token ou lança erro.
export async function verifyFirebaseIdToken(token, { projectId, fetchImpl = fetch, now = Date.now() }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Token malformado');

  const header = decodeJson(parts[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Algoritmo inválido');

  const keys = await getJwks(fetchImpl, now);
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('Chave desconhecida');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error('Assinatura inválida');

  const claims = decodeJson(parts[1]);
  const nowSeconds = Math.floor(now / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds - CLOCK_SKEW_S) throw new Error('Token expirado');
  if (typeof claims.iat !== 'number' || claims.iat > nowSeconds + CLOCK_SKEW_S) throw new Error('Token emitido no futuro');
  if (claims.aud !== projectId) throw new Error('Audiência inválida');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Emissor inválido');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Sujeito inválido');
  return claims;
}
