import { handleNvidiaRequest } from './nvidiaProxy.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/nvidia') return handleNvidiaRequest(request, env);
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    // Demais rotas: app estático (SPA) servido pelo binding de assets.
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
    if (pathname.startsWith('/static/')) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
