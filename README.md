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
- **Treinos do aluno:** "Meus treinos" (privados, fora da loja de fichas): montar do zero, **importar de PDF** (lido no aparelho; só o texto higienizado vai à IA, que devolve JSON validado e revisável), editar, reordenar, foto do treino e dos exercícios próprios. **Meus exercícios** (`/meus-exercicios`) cria exercícios reutilizáveis, que entram também no gerador por IA. A tela Fichas separa **Meus treinos** dos treinos **Prontos** (com filtros de dificuldade).
- **Exercícios e execução:** biblioteca embutida de 141 exercícios com foto e GIF (peso livre, máquinas, cardio, alongamento e mobilidade), mais a coleção do Firestore. Três tipos de exercício (musculação, por tempo, cardio) e quatro **tipos de série** (normal, aquecimento, drop-set, até a falha) com **superset**; o aquecimento não entra em volume nem em recordes. O aluno marca os **equipamentos da sua academia** no Perfil e o gerador só usa o que ele tem. A aba **Semana** do Coach IA monta a semana inteira (2 a 6 dias, com cardio e alongamento opcionais) e salva cada dia em Meus treinos; **carga sugerida** por dupla progressão, **trocar exercício** e **resumo pós-treino** acompanham a execução. Para o treinador, o detalhe do aluno traz um **resumo das últimas 4 semanas** (aderência, cargas que subiram, exercícios parados, esforço alto), com texto opcional pela IA conferido contra os números. A **notificação do treino em andamento** (exercício, série e botões Concluir série e Pular descanso, sem pausar a música) é opcional; com os **avisos com o app fechado** (Web Push pelo Worker), o fim do descanso e as curtidas chegam mesmo com o navegador fechado.
- **Meu treinador:** o aluno pede o vínculo (busca por nome, código ou link `/convite/<código>`) e o treinador aceita antes de ver qualquer dado. O aluno pode cancelar ou encerrar quando quiser.
- **Convite por link:** o treinador cria links com validade e limite de usos (cancelável); o aluno novo se cadastra pelo link ou o existente abre o pedido no perfil, e o treinador aceita (com a mensalidade padrão sugerida e editável) antes de ver qualquer dado.
- **Amigos e ranking:** pedido de amizade por @usuário ou código de amigo (sem busca por nome, de propósito: as regras do Firestore não conseguem esconder quem bloqueou); ranking semanal opcional de "Consistência registrada" (treinos, dias ativos, sequência), sem peso, medidas ou check-ins. **Atividade** opcional: o aluno pode publicar o resumo de cada treino concluído (nome, duração, séries, recordes; nunca carga ou saúde) só para amigos ativos, com curtidas.
- **Treinador:** fila de ação do dia, alunos com aderência, solicitações de vínculo, atribuição de fichas, financeiro (cobrança por WhatsApp), chat com respostas rápidas, biblioteca e editor de fichas.
- **Gestão para academias** (produto separado, em homologação fechada): console `gestao/`, API `gestao-worker/` em Cloudflare D1, contratos em `shared/academy-contracts/`. Membros, convites, professores, fichas, alunos e **financeiro** (planos, matrículas, cobranças mensais com baixa manual, resumo e exportação). Ver [docs/GESTAO_ARQUITETURA.md](docs/GESTAO_ARQUITETURA.md) e [docs/GESTAO_PRODUCAO.md](docs/GESTAO_PRODUCAO.md).
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
- `scripts/catalogo-novo.py [--write]`: baixa foto e GIF do Free Exercise DB e acrescenta exercícios novos à biblioteca embutida.
- `npm run audit:catalog -- --remote exportacao.json`: auditoria somente leitura do catálogo e das fichas da loja (ver [docs/AUDITORIA_CATALOGO.md](docs/AUDITORIA_CATALOGO.md)).
- `mcp/`: servidor MCP para gerenciar fichas, alunos e atribuições (ver [docs/MCP.md](docs/MCP.md)). Exige `serviceAccountKey.json` na raiz (fora do git).

## Segurança e privacidade

- Papéis (`role`) vêm do Firestore e não são alteráveis pelo cliente; aluno só vê o próprio; treinador só vê alunos vinculados (com aceite do aluno).
- Check-ins não podem ser listados de forma ampla (nem pelo admin); métricas vêm de contadores (`userStats`).
- Links vindos de dados editáveis passam por `safeHttpUrl`; CSP e HSTS ativos.
- Treinos e exercícios pessoais ficam em `users/{uid}/myWorkouts` e `myExercises`: só o dono lê e grava, com formato fechado. Importação de PDF: assinatura `%PDF-`, até 5 MB, sem scripts, texto sem links, contatos e frases de comando; a resposta da IA é validada (schema, limites, sem URL/HTML) e revisada pelo aluno. Fotos anexadas: só JPEG, PNG e WebP reais, redesenhadas no aparelho (sem EXIF), guardadas como JPEG pequeno.
- Termos e Política de Privacidade são modelos e precisam de revisão jurídica antes do lançamento público.

## Documentação

- [docs/DIAGNOSTICO.md](docs/DIAGNOSTICO.md): histórico de achados e entregas
- [docs/ROADMAP_PRODUTO.md](docs/ROADMAP_PRODUTO.md): próximos passos da Gestão e do treino com IA, e a paridade com os apps do mercado
- [docs/BIBLIOTECA.md](docs/BIBLIOTECA.md), [docs/AUDITORIA_CATALOGO.md](docs/AUDITORIA_CATALOGO.md) e [docs/LIMPEZA_CATALOGO_PREVIA.md](docs/LIMPEZA_CATALOGO_PREVIA.md): biblioteca de exercícios, auditoria e limpeza do catálogo
- [docs/IA.md](docs/IA.md): arquitetura da IA, modelos e limites
- [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md): Worker, domínio e configurações no console
- [docs/APPCHECK.md](docs/APPCHECK.md): roteiro do enforce do App Check e da proteção contra enumeração de e-mail
- [docs/V2_ACADEMIAS.md](docs/V2_ACADEMIAS.md): desenho da V2 para academias (multiempresa, papéis, isolamento de dados, roadmap); sem código
- [docs/INTEGRACOES_SAUDE_E_RELOGIO.md](docs/INTEGRACOES_SAUDE_E_RELOGIO.md): Health Connect/Samsung Health e Wear OS (o que a web faz e o que exige app Android)
- [docs/PLANO_SOCIAL.md](docs/PLANO_SOCIAL.md): plano de amigos, ranking e desafios (MVP de amizade e ranking semanal implementado; pontos e desafios planejados)
- [CLAUDE.md](CLAUDE.md) e [AGENTS.md](AGENTS.md): regras de trabalho para os agentes

## Créditos

- Imagens de exercícios: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (domínio público, Unlicense). Alguns exercícios do seed usam imagens com atribuição própria no campo `imageAttribution`.
- Ícones: Lucide. Fontes: Inter e Outfit (OFL), hospedadas no próprio site.

Licença: MIT.
