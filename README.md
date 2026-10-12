# BohTreinar

App de treinos para alunos e treinadores: fichas, execução com cronômetro e descanso, histórico e evolução por exercício, chat com o treinador, Coach IA e painel administrativo. Funciona offline (PWA) e é pensado para uso com uma mão no celular.

**Produção:** https://bohtreinar.marcelo-labs.workers.dev

## Como está montado

| Camada | O que usa |
| --- | --- |
| App (front) | React (CRA), Tailwind, React Router, PWA com service worker |
| Hospedagem e proxy de IA | **Cloudflare Worker** (`worker/`, `wrangler.jsonc`): serve o app e `POST /api/nvidia` na mesma origem |
| Login e banco | **Firebase** Authentication (e-mail e senha, Google) e Firestore, com regras de segurança (`firestore.rules`) |
| IA | Gemini (Firebase AI Logic) para funções e fichas; NVIDIA NIM (via Worker) para a conversa; resposta local como último recurso |
| Proteção | App Check (reCAPTCHA Enterprise), CSP/HSTS (`public/_headers`), limite por usuário no proxy |

O plano gratuito do Firebase (Spark) não tem Cloud Functions: por isso o código de servidor vive no Worker e a integridade dos dados vem das regras do Firestore (por exemplo, o contador de check-ins só muda junto do check-in).

## Funcionalidades

- **Aluno:** onboarding, painel com meta semanal, fichas, execução (séries, carga, repetições, RPE, descanso, tela sempre acesa), histórico com detalhes, evolução por exercício (1RM, volume, recordes), medidas, ferramentas (1RM, anilhas, conversões, timer), Coach IA e nutrição, exportar e excluir os próprios dados (LGPD).
- **Meu treinador:** o aluno pede o vínculo (busca por nome, código ou link `/convite/<código>`) e o treinador aceita antes de ver qualquer dado. O aluno pode cancelar ou encerrar quando quiser.
- **Treinador:** fila de ação do dia, alunos com aderência, solicitações de vínculo, atribuição de fichas, financeiro (cobrança por WhatsApp), chat com respostas rápidas, biblioteca e editor de fichas.
- **Admin:** visão geral com pendências de conteúdo, exercícios (filtros, edição em painel lateral, arquivar, importação com prévia), fichas com avisos, vínculos e histórico de alterações (`adminLog`).

## Como rodar

Requisitos: Node 22 e, para os testes de regras, Java 11 ou mais novo.

```bash
make install            # npm install --legacy-peer-deps
npm start               # desenvolvimento em http://localhost:3000
CI=true npm test -- --watchAll=false        # testes do app
(cd worker && node --test test/*.test.js)   # testes do Worker
make test-rules         # regras do Firestore no emulador (antes: npm ci em rules-test/)
npm run build           # build de produção (sem source maps)
```

Variáveis em `.env.local` (nunca versionado):

| Variável | Para quê |
| --- | --- |
| `REACT_APP_RECAPTCHA_SITE_KEY` | chave pública do reCAPTCHA Enterprise (App Check) |
| `REACT_APP_NVIDIA_PROXY=true` e `REACT_APP_AI_PRIMARY=nvidia` | usar o proxy `/api/nvidia` como primeira opção da conversa |
| `REACT_APP_GEMINI_MODEL` | (opcional) modelo preferido do Gemini |

A chave da NVIDIA fica só no Worker: `npx wrangler secret put NVIDIA_API_KEY --config wrangler.jsonc`. Segredos nunca vão para o bundle nem para o git.

## Publicar

```bash
make deploy         # build + wrangler deploy (app e proxy de IA na Cloudflare)
make deploy-rules   # regras e índices do Firestore (mostre o diff antes)
```

O Firebase Hosting está desativado: o app roda só na Cloudflare. Mais detalhes em [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md).

## Dados e scripts

- `scripts/seed-demo.cjs`: dados fictícios e aditivos para testes (não apaga nada). `scripts/seed.cjs` é destrutivo e só deve ser rodado com pedido explícito.
- `scripts/backfill-user-stats.cjs [apply]`: confere e corrige os contadores de check-ins.
- `scripts/imagens-exercicios.cjs [apply]`: baixa imagens de exercícios do Free Exercise DB e liga ao Firestore.
- `mcp/`: servidor MCP para gerenciar fichas, alunos e atribuições (ver [docs/MCP.md](docs/MCP.md)). Exige `serviceAccountKey.json` na raiz (fora do git).

## Segurança e privacidade

- Papéis (`role`) vêm do Firestore e não são alteráveis pelo cliente; aluno só vê o próprio; treinador só vê alunos vinculados (com aceite do aluno).
- Check-ins não podem ser listados de forma ampla (nem pelo admin); métricas vêm de contadores (`userStats`).
- Links vindos de dados editáveis passam por `safeHttpUrl`; CSP e HSTS ativos.
- Termos e Política de Privacidade são modelos e precisam de revisão jurídica antes do lançamento público.

## Documentação

- [docs/DIAGNOSTICO.md](docs/DIAGNOSTICO.md): histórico de achados e entregas
- [docs/IA.md](docs/IA.md): arquitetura da IA, modelos e limites
- [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md): Worker, domínio e configurações no console
- [docs/PLANO_SOCIAL.md](docs/PLANO_SOCIAL.md): plano de amigos, ranking e desafios (MVP de amizade e ranking semanal implementado; pontos e desafios planejados)
- [CLAUDE.md](CLAUDE.md) e [AGENTS.md](AGENTS.md): regras de trabalho para os agentes

## Créditos

- Imagens de exercícios: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (domínio público, Unlicense). Alguns exercícios do seed usam imagens com atribuição própria no campo `imageAttribution`.
- Ícones: Lucide. Fontes: Inter e Outfit (OFL), hospedadas no próprio site.

Licença: MIT.
