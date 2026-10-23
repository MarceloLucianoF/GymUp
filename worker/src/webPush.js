// Web Push sem biblioteca: assinatura VAPID (RFC 8292, ES256) e criptografia da mensagem (RFC 8291, aes128gcm) com WebCrypto.
const enc = new TextEncoder();
export const b64u = {
  encode: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (str) => {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
};
const hkdf = async (salt, ikm, info, length) => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
};

/** Chave pública VAPID (65 bytes, base64url) a partir da JWK privada. */
export const vapidPublicKey = (jwk) => b64u.encode(concat(new Uint8Array([4]), b64u.decode(jwk.x), b64u.decode(jwk.y)));

/** Cabeçalho Authorization VAPID para o serviço de push do endpoint. */
export async function vapidAuth(endpoint, jwk, subject, now = Date.now()) {
  const header = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u.encode(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u.encode(sig)}, k=${vapidPublicKey(jwk)}`;
}

/** Criptografa `payload` (texto) para a inscrição { p256dh, auth } em um único registro aes128gcm. */
export async function encryptPayload(payload, { p256dh, auth }, deps = {}) {
  const uaPublic = b64u.decode(p256dh);
  const authSecret = b64u.decode(auth);
  const salt = deps.salt || crypto.getRandomValues(new Uint8Array(16));
  const asKeys = deps.asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// Só serviços de push conhecidos (evita que uma inscrição forjada faça o Worker chamar endereços arbitrários).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/];
export function validEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && u.port === '' && !u.username && endpoint.length <= 600 && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch { return false; }
}

/** Chaves da inscrição no formato certo: p256dh = ponto P-256 não comprimido (65 bytes, 0x04), auth = 16 bytes. */
export function validKeys(keys) {
  try {
    const p = b64u.decode(keys?.p256dh || ''); const a = b64u.decode(keys?.auth || '');
    return p.length === 65 && p[0] === 4 && a.length === 16;
  } catch { return false; }
}

/** Envia uma mensagem. Devolve o status HTTP do serviço de push (404/410 = inscrição morta). */
export async function sendPush(sub, data, { jwk, subject, ttl = 60, urgency = 'high', fetchImpl = fetch, now = Date.now() }) {
  const body = await encryptPayload(JSON.stringify(data), sub.keys);
  const res = await fetchImpl(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(sub.endpoint, jwk, subject, now), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency },
    body,
    redirect: 'manual'
  });
  return res.status;
}
