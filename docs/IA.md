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

## Verificação do uso da NVIDIA (13/10/2026)
Conferido contra o uso de referência (NIM em `integrate.api.nvidia.com/v1`, chave só no servidor, `nemotron-3-super-120b-a12b` na frente e `gpt-oss-20b` de reserva, troca por `NVIDIA_MODEL`): o desenho do app está igual. Achados e correções:
- **Lista de modelos vencida:** sete modelos devolviam 404 (`llama-3.1-nemotron-70b/51b/ultra-253b`, `mistral-nemo-12b`, `gemma-3-12b`, `mistral-large-2`, `nemotron-nano-3-30b`) e, por ficarem antes na fila, gastavam as 8 tentativas: quando os dois primeiros falhavam, o modo `auto` desistia sem chegar ao `gemma-4-31b-it`. A fila agora tem 4 modelos vivos (nemotron-3-super, gpt-oss-20b, gemma-4-31b-it, glm-5.3-flash). Para conferir de novo: `node scripts/check-nvidia-models.mjs`, e sempre que o modo `auto` voltar a dar 502 com `upstreamStatus: 404`, o primeiro passo é ver se um modelo foi aposentado.
- **Modelos de raciocínio e `max_tokens` (erro nosso no resumo semanal):** `nemotron-3-super` só devolve texto com orçamento folgado (com 260 e 600 tokens veio vazio; com 1200, 5 a 8 s). O resumo semanal pedia 260. Agora pede 1200 com prazo de 25 s (roda em segundo plano, depois de a tela estar pronta), e o Worker, quando um modelo devolve vazio com `finish_reason: length`, tenta **uma vez** o mesmo modelo com 4x os tokens (teto 2400) antes de passar ao próximo.
- **Sem cota diária global:** a referência limita 300 pedidos por dia no total. Aqui há 20/min por usuário e 60/min por IP (aproximados); um teto diário exigiria KV ou Durable Object. Fica como recomendação se o consumo preocupar.
- **Cache:** o resumo semanal guarda um snapshot por semana e não gera de novo com os mesmos números; o chat do Coach IA não tem cache (cada pergunta é nova).
- **Chave:** guardada como secret do Worker (`NVIDIA_API_KEY`, não `NVIDIA_NIM_API_KEY`); o bundle não contém a chave (conferido por busca).
