# BohTreinar no Cloudflare (Worker: app + proxy da NVIDIA)

Um único Worker serve o app (pasta `build/`) e a rota `POST /api/nvidia`, **na mesma origem** (sem CORS).
Login e banco continuam no Firebase (Auth + Firestore); o Firebase Hosting segue disponível como plano B.

## Publicar (uma vez)
```bash
cd worker && npm install
npx wrangler login
npx wrangler secret put NVIDIA_API_KEY --config ../wrangler.jsonc   # cole a chave NOVA; ela não passa pelo repositório
cd .. && REACT_APP_NVIDIA_PROXY=true REACT_APP_AI_PRIMARY=nvidia npm run build
cd worker && npx wrangler deploy --config ../wrangler.jsonc
```
Endereço atual: `https://bohtreinar.bohtreinar-app.workers.dev`. Um subdomínio novo leva alguns minutos para ganhar certificado HTTPS (até lá a conexão é recusada).
Cabeçalhos de segurança e cache vêm de `public/_headers` (arquivos estáticos não passam pelo código do Worker). Para republicar: refaça o build e rode `npx wrangler deploy --config ../wrangler.jsonc`.

## Depois de publicar
1. Firebase Console → Authentication → Configurações → **Domínios autorizados**: adicione o domínio do Worker (necessário para login com Google).
2. App Check (reCAPTCHA v3): adicione o domínio do Worker na lista de domínios da chave.
3. Em `wrangler.jsonc`, ajuste `ALLOWED_ORIGINS` se usar outro domínio (domínio próprio, por exemplo).

## Como a rota é protegida
Verifica o ID token do Firebase (RS256, JWKS do Google, `aud`/`iss`/`exp`), aceita só a mesma origem ou `ALLOWED_ORIGINS`, valida modelo/campos/tamanho, limita 20 req/min por usuário (por instância: é um freio, não garantia global) e nunca devolve erros internos do provedor.

## Limites do plano gratuito
100 mil requisições/dia, 10 ms de CPU por requisição (a espera pela NVIDIA não conta). Passou disso → considerar o plano pago (US$ 5/mês).

## Testes
`cd worker && npm test` (11 testes: verificação de token com RSA real, validações, limite, roteamento).
O runtime local (`wrangler dev`) não roda em Ubuntu 20.04 (glibc antiga): use Ubuntu 22.04+ ou teste após o deploy.

## Modelos da NVIDIA
O catálogo muda: o `meta/llama-3.1-70b-instruct` (antigo padrão) foi aposentado e causava 502. O padrão agora é `nvidia/llama-3.1-nemotron-70b-instruct`.
Para conferir se os modelos permitidos ainda existem: `node scripts/check-nvidia-models.mjs` (sem chave; falha com exit 1 se algum sumiu).
Quando a NVIDIA recusa, a resposta 502 do Worker inclui `upstreamStatus` (só o código HTTP) e `npx wrangler tail --config ../wrangler.jsonc` mostra o log.
