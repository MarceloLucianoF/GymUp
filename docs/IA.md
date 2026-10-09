# Integração de IA

## Por que a integração anterior falhava
1. O projeto `workout-tracker-app-20e43` está no plano **Spark**: Cloud Functions e Secret Manager exigem **Blaze**, então o proxy `/api/nvidia` nunca pôde ser publicado.
2. A API da NVIDIA (`integrate.api.nvidia.com`) não envia `Access-Control-Allow-Origin`; o navegador bloqueia chamadas diretas.
3. A chave NVIDIA chegou a ficar no bundle/histórico git. **Rotacione a chave** no provedor; não a use no frontend.

## Arquitetura atual (`src/services/aiService.js`)
Cadeia de provedores:
1. **Gemini via Firebase AI Logic** (`firebase/ai`, `GoogleAIBackend`): roda no plano Spark, sem chave no bundle. Modelos tentados em ordem: `REACT_APP_GEMINI_MODEL`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` (avança em 404/indisponibilidade).
2. **NVIDIA NIM** via `/api/nvidia` (Cloud Function em `functions/`), somente com `REACT_APP_NVIDIA_PROXY=true`.
3. **Fallback local**: resposta com macros calculados e gerador determinístico de treino.

Funções executadas pela IA (function calling, laço de até 4 rodadas):
- `calcular_macros` → cálculo local de calorias/macros.
- `gerar_treino` → ficha com exercícios da biblioteca (saída JSON estruturada, validada contra a biblioteca; fallback local).
- `consultar_historico` → resumo dos últimos check-ins do aluno.

## Reativar o proxy NVIDIA (requer Blaze)
1. Atualizar o projeto para Blaze no console.
2. `firebase functions:secrets:set NVIDIA_NIM_API_KEY` (chave **nova**).
3. Restaurar em `firebase.json`: `"functions": {"source": "functions"}` e o rewrite `{"source": "/api/nvidia", "function": "nvidiaProxy"}` antes do `**`.
4. `make deploy-functions` e `make deploy-hosting`; definir `REACT_APP_NVIDIA_PROXY=true` no build.

## Recomendações
- Ativar **App Check** (reCAPTCHA) no console para impedir uso da cota de IA fora do app.
- Definir orçamento/alertas de cota no Google Cloud.
