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

## Modelos NVIDIA e prazos (12/10/2026)
- Teste real pelo Worker: `google/gemma-4-31b-it` estourou o prazo (antes respondia em ~2 s), `openai/gpt-oss-20b` respondeu em 7–10 s e `nvidia/nemotron-3-super-120b-a12b` devolveu resposta vazia com `max_tokens` 300 (modelo de raciocínio: precisa de mais tokens).
- Cada modelo tem prazo próprio de 12 s (total 28 s): se um trava, o modo `auto` passa ao próximo e esquece o modelo lembrado.
- A variável `NVIDIA_MODEL` do Worker (em `wrangler.jsonc` > `vars`) coloca um modelo permitido na frente da fila, sem alterar código.

## Ordem dos modelos e tokens (12/10/2026, após falha no celular)
- No celular o Coach IA caiu no modo offline: o proxy NVIDIA devolvia 504/502 (Gemma e GLM travam; modelos de raciocínio esgotavam `max_tokens` e voltavam vazios) e o Gemini respondia 429 (cota gratuita excedida).
- Correção: `nemotron-3-super-120b-a12b` e `gpt-oss-20b` (2-4 s em teste curto) vão primeiro; Gemma-4 e GLM por último; limite de tokens sobe para 1800 (teto do proxy 2400). Respostas longas ainda levam 15-25 s: modelos de raciocínio são lentos.
- A cota do Gemini (Firebase AI Logic, plano gratuito) não é ajustável pelo código. Se voltar a dar 429, aguarde o reset diário ou ative o faturamento (Blaze) com orçamento.
