# Integração de IA

## Por que a integração anterior falhava
1. O projeto `workout-tracker-app-20e43` está no plano **Spark**: Cloud Functions e Secret Manager exigem **Blaze**, então o proxy `/api/nvidia` nunca pôde ser publicado lá; ele foi para o Worker da Cloudflare.
2. A API da NVIDIA (`integrate.api.nvidia.com`) não envia `Access-Control-Allow-Origin`; o navegador bloqueia chamadas diretas.
3. A chave NVIDIA chegou a ficar no bundle/histórico git. **Rotacione a chave** no provedor; não a use no frontend.

## Arquitetura atual (`src/services/aiService.js`)
Cadeia de provedores:
1. **Gemini via Firebase AI Logic** (`firebase/ai`, `GoogleAIBackend`): roda no plano Spark, sem chave no bundle. Modelos tentados em ordem: `REACT_APP_GEMINI_MODEL`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` (avança em 404/indisponibilidade).
2. **NVIDIA NIM** via `/api/nvidia` (Worker da Cloudflare em `worker/`, mesma origem do app), somente com `REACT_APP_NVIDIA_PROXY=true`.
3. **Fallback local**: resposta com macros calculados e gerador determinístico de treino.

Funções executadas pela IA (function calling, laço de até 4 rodadas):
- `calcular_macros` → cálculo local de calorias/macros.
- `gerar_treino` → ficha com exercícios da biblioteca (saída JSON estruturada, validada contra a biblioteca; fallback local).
- `consultar_historico` → resumo dos últimos check-ins do aluno.

## Proxy NVIDIA (Cloudflare)
O proxy roda no Worker (`worker/src/nvidiaProxy.js`): confere o token do Firebase, escolhe o modelo (`auto`) e guarda a chave como secret (`wrangler secret put NVIDIA_API_KEY`). Veja `docs/CLOUDFLARE.md`. A antiga Cloud Function (`functions/`) foi removida.

## Recomendações
- **App Check** (reCAPTCHA Enterprise) já está registrado; ligar o enforce só depois de observar as métricas.
- Definir orçamento/alertas de cota no Google Cloud.
