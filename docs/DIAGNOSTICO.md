# Diagnóstico inicial e organização do desenvolvimento — AcademyUp

Leitura do checkout local iniciada em 06/10/2026 (America/Sao_Paulo).
Objetivo: compreender o conteúdo, separar cinco frentes e validar o estado existente.
Não foram implementadas correções funcionais nesta etapa.

## Cobertura e limites

A equipe leu integralmente os arquivos próprios de código, documentação e configuração
em `src/`, `functions/`, `scripts/`, `public/` (texto), `.gemini/`, `.github/` e raiz.
O lockfile foi analisado como JSON, incluindo 1.766 entradas de pacotes; mídias foram
inventariadas por nome/tamanho. `fuctions/` é uma pasta vazia distinta de `functions/`.

Foram excluídos da leitura de conteúdo: `.env*`, `serviceAccountKey.json`, dependências
em `node_modules/`, artefatos de build/cache e bytes de imagens/GIFs/ícones.
Metadados e alterações do cache Firebase foram inspecionados pelo Git.
Valores de segredos encontrados em fontes não são reproduzidos neste documento.

O diagnóstico cobre o checkout local. Não comprova configuração implantada, índices
existentes apenas no Firebase, funcionamento visual, permissões em produção ou resposta
dos serviços externos. Não houve seed, deploy, push ou escrita em dados remotos.

## Arquitetura encontrada

| Camada | Implementação local |
| --- | --- |
| Interface | React/ReactDOM 19.2.4, React Router 6.30.3, Tailwind 3.4.17, Recharts, toasts |
| Ferramentas | Create React App (`react-scripts` 5.0.1), npm e Makefile local |
| Identidade | Firebase Auth; perfil/papel separado em `users/{uid}` |
| Dados | Firebase 12.9.0, Firestore acessado por hooks, serviços e diversas páginas |
| Backend HTTP | `functions/index.js`, proxy NVIDIA; rewrite `/api/nvidia` em `firebase.json` |
| Persistência offline | Sessão ativa e fila por usuário no localStorage; sincronização para Firestore |
| PWA | Manifest e service worker próprio, registrado em produção |
| Infraestrutura | Firebase Hosting/Rules/Functions; workflow GitHub de instalação/build/test |

Há jornadas implementadas para autenticação, perfil, treinos, execução/retomada, histórico,
medidas, analytics, chat, administração de exercícios/fichas e gestão de alunos/finanças.
“Implementadas” significa presença de código, não aprovação funcional em integração.
Chat de IA usa um serviço externo; geração de ficha e cálculo de macros usam heurísticas locais.

### Contratos de dados

- `users`: identidade, `role` (`user`, `coach`, `admin`), `coachId`, `currentTrainingId`, perfil e dados financeiros.
- `exercises`, `trainings`, `trainingPackages`: biblioteca, fichas e agrupamentos. Existem exercícios por referência e embutidos em fichas.
- `checkIns`: atividade por `userId`, ficha, data, duração, volume, séries e exercícios. Um hook legado usa a subcoleção `users/{uid}/checkIns`.
- `measurements`: medidas/fotos por `userId` e data.
- `chats/{id}`: participantes e resumo; `messages` contém remetente, texto e timestamp.
- Sessão/fila local: chaves por UID; dois caminhos de sincronização precisam ser unificados.

## Cinco frentes e execução

O ponto de entrada persistente é [AGENTS.md](../AGENTS.md).

| Frente | Responsável nesta leitura | Escopo e instruções |
| --- | --- | --- |
| Frontend | Subagente Sol | [Páginas, componentes, rotas, estilos](agents/frontend.md) |
| Backend | Subagente Sol | [Dados, regras, hooks, serviços e Functions](agents/backend.md) |
| Documentação | Subagente Luna | [README, roadmap, guias e configurações documentadas](agents/documentacao.md) |
| Git | Luna em uma segunda etapa, com baseline do coordenador | [Versionamento, dependências e CI](agents/git.md) |
| Validação | Subagente Terra | [Build, testes, sintaxe e checks locais](agents/validacao.md) |

O coordenador integra resultados, revisa diretamente os achados críticos e controla
arquivos compartilhados. As cinco responsabilidades são distintas; a execução foi
distribuída em etapas para respeitar o limite de três subagentes simultâneos.

## Achados prioritários

As evidências abaixo são de análise estática, salvo quando acompanhadas por um check executado.
As linhas referem-se ao checkout lido e podem mudar em correções posteriores.

| Prioridade | Achado e consequência | Evidência | Responsável |
| --- | --- | --- | --- |
| Crítica | Chave NVIDIA literal no cliente e servidor; o código cliente distribui a credencial. Remoção precisa ser acompanhada de rotação da credencial exposta. | `src/services/aiService.js:3`; `functions/index.js:4` | Backend |
| Crítica | Proxy de IA aceita chamadas sem autenticação, de qualquer origem, usando chave padrão. Não há limites explícitos, validação de payload/modelo ou timeout. | `functions/index.js:2`, `:7`, `:13` | Backend |
| Crítica | Usuário pode criar/alterar o próprio documento com `role` arbitrário e herdar privilégios de coach/admin. | `firestore.rules:6`, `:10`, `:22`, `:23` | Backend + revisão do coordenador |
| Crítica | Qualquer autenticado pode ler/escrever medidas, check-ins e mensagens de chats sem verificar proprietário/participação. | `firestore.rules:37`, `:43`, `:47` | Backend |
| Alta | Coach pode atualizar usuários sem vínculo e recursos de outros coaches; atualização de chat não protege participantes. | `firestore.rules:23`, `:34`, `:35`, `:52` | Backend |
| Alta | Perfil público, autorização e dados financeiros estão no mesmo documento; contas autenticadas podem ler docs de coach/admin completos. | `firestore.rules:16`; `src/pages/coach/CoachSettings.jsx:14`, `:63` | Backend + Frontend |
| Alta | Dashboard do coach consulta check-ins globais e usuários sem filtrar `coachId`, misturando alunos e métricas. O limite de 50 também restringe o cálculo de inatividade. | `src/hooks/useCoachDashboard.js:20`, `:35`, `:43` | Backend |
| Alta | Rotas administrativas/de coach têm guarda de autenticação sem guarda geral de papel. Redirecionamentos usam `user.role`, embora o perfil seja separado do Firebase User. | `src/App.jsx:44`, `:84`, `:112`; `src/hooks/AuthContext.js:94` | Frontend + Backend |
| Alta | Aluno recebe ação de salvar treino IA em `trainings`, mas as regras só permitem escrita a coach/admin. | `src/components/ai/AICoachModal.jsx:144`; `firestore.rules:59` | Frontend + Backend |
| Alta | Seed apaga coleções e usa credenciais previsíveis, sem proteção explícita contra projeto real; apagar documentos não limpa subcoleções. Não foi executado. | `scripts/seed.cjs:384`, `:428`, `:472`, `:594` | Backend |
| Alta | Sincronização pode duplicar check-ins: fila só é limpa após envio total; falha ao atualizar perfil pode enfileirar check-in que já foi criado. | `src/pages/user/TrainingExecutionPage.jsx:241`, `:613`; `src/services/activeWorkoutService.js:126` | Backend + Frontend |
| Média | Hook legado usa subcoleção de check-ins sem regra correspondente; não foi encontrado consumidor atual. | `src/hooks/useCheckIns.js:22`; `firestore.rules` | Backend |
| Média | Formatos de treino e datas divergem: IDs/objetos, `duration`/`estimatedTime`, `coachId`/`createdBy`, ISO/Timestamp. | `scripts/seed.cjs`; `src/services/aiService.js`; `src/pages/admin/CoachTrainingsPage.jsx`; `src/hooks/useAdmin.js:57` | Backend + Frontend |
| Média | Não há índices Firestore versionados nem lockfile das Functions. Não se verificou se índices existem no ambiente remoto. | `firebase.json`; `functions/package.json`; inventário local | Backend + Git |
| Média | Dependências declaram requisitos divergentes: `firebase-admin` 14.2.0 requer Node >=22; ambiente/CI/Functions usam Node 18. Testing Library 13.4 declara React 18, enquanto a aplicação usa 19. | `package-lock.json`; `package.json`; `.github/workflows/deploy.yml:14`; `functions/package.json:10` | Git + Validação |
| Média | README está quebrado/desatualizado e sugere regras amplas; roadmap não distingue funcionalidades existentes de planejadas. | `README.md:7`, `:48`, `:73`; `ROADMAP.md` | Documentação |

Outros pontos para revisão: loading de chat pode permanecer ativo em `permission-denied`
(`src/hooks/useChat.js:38`); perfil e histórico detalhado são enviados ao provedor de IA;
a calculadora nutricional usa parâmetros fixos enquanto a UI lhe atribui capacidade ampla.
Esses itens exigem decisões explícitas de produto e contratos documentados.

## Estado do Git na entrada

- Branch `main`, HEAD `c9247c0`; upstream local `origin/main` na mesma revisão. Não houve fetch, portanto não há confirmação do estado remoto atual.
- Oito arquivos rastreados já modificados: cache Firebase, `firebase.json`, `AICoachModal.jsx`, `StudentChatWidget.jsx`, `useChat.js`, `Home.jsx`, `UserChatPage.jsx` e `aiService.js`.
- `Makefile` e `functions/` já estavam não rastreados; nada estava staged.
- `.env.local`, `serviceAccountKey.json`, dependências e build estão ignorados. `.firebase/hosting.YnVpbGQ.cache` está rastreado.
- `git diff --check` encontrou seis linhas com espaços finais em mudanças preexistentes de `AICoachModal.jsx` e `UserChatPage.jsx`.

O workflow chamado `Deploy` executa instalação/build/test, sem etapa de publicação.
Usa `npm install`, Node 18 e não define configuração de emuladores ou validação das regras.
O Makefile usa `--legacy-peer-deps` na instalação, diferentemente do CI.

## Validação local

Ambiente observado: Ubuntu 20.04 via WSL, Node 18.20.5, npm 10.8.2 e dependências existentes.

| Verificação | Resultado | Evidência/limite |
| --- | --- | --- |
| `npm ls --depth=0` | **Aprovada** | Dependências diretas resolvidas no ambiente existente. Não prova uma instalação limpa. |
| `node --check functions/index.js` | **Aprovada** | Sintaxe válida; a Function não foi iniciada nem chamou serviço externo. |
| `node --check scripts/seed.cjs` | **Aprovada** | Sintaxe válida; o seed não foi executado. |
| ESLint em `src` | **Aprovada com avisos** | Sem erros e com três avisos em `src/hooks/useAdmin.js` sobre imports/estado não usados. |
| `npm run build` | **Aprovada com avisos** | Exit code 0. Dez avisos ESLint e base `caniuse-lite` desatualizada; gerou `build/` ignorado. |
| `CI=true npm test -- --watchAll=false --runInBand` | **Reprovada** | Exit code 1: nenhum teste encontrado entre 53 arquivos verificados. Zero testes executados. |

Os avisos do build incluem valores não usados em `useAdmin.js`, `AdminPanel.jsx`,
`ExerciseLibrary.jsx` e `FinancialPage.jsx`; dependências ausentes em hooks de
`CoachTrainingsPage.jsx`, `CoachChatPage.jsx` e `FinancialPage.jsx`; e imagem sem texto
alternativo em `FinancialPage.jsx`. A execução manual do ESLint reportou somente os três
avisos de `useAdmin.js`, indicando que os dois comandos não cobrem exatamente o mesmo conjunto.

Login, navegador, Firebase Emulator, regras Firestore, PWA, modo offline, APIs externas,
seed e deploy foram **não executados**. O gate mínimo proposto bloqueia integração se build,
dependências, sintaxe ou lint tiverem erros e exige ao menos um teste real com o comando de CI
aprovado; avisos só podem permanecer quando estiverem registrados em um baseline consciente.

## Ordem proposta para o desenvolvimento

1. **Backend + coordenador:** retirar credenciais do cliente, providenciar rotação, proteger proxy e fechar autoelevação/isolamento nas regras. Validar matriz de permissões com emulador.
2. **Git + validação:** alinhar runtime, dependências e instalação reproduzível; estabelecer testes reais e gates de integração.
3. **Backend + frontend:** fixar contratos de ficha/check-in/perfil/chat, escopo do treinador e fluxo de treino IA; tornar sincronização idempotente.
4. **Frontend + validação:** revisar papéis, redirecionamentos, estados de erro, retomada, PWA e jornadas com usuários de teste isolados.
5. **Documentação + Git:** atualizar README/roadmap com o comportamento comprovado e preparar alterações para revisão conforme escopo autorizado.

Cada tarefa deve ter proprietário de arquivos, dependências, caso reproduzível e critério
de aceite. As cinco instruções de agentes detalham esses critérios.

## Artefatos desta etapa

Foram adicionados `AGENTS.md`, este diagnóstico e cinco arquivos em `docs/agents/`.
As fontes da aplicação e suas alterações preexistentes foram preservadas.
O build local pode regenerar `build/`, que já é ignorado pelo Git.

## Atualização — 09/10/2026 (fase 3 do frontend)

**Resolvido**
- Testes automatizados do frontend: 56 testes (utils, componentes comuns/ui, chat, auth, cálculo nutricional) rodando no CI.
- Notas privadas do treinador movidas do `localStorage` para a coleção `coachNotes` (regras validadas em produção: aluno não lê, treinador só escreve para aluno vinculado).
- Home do aluno: dados em `useStudentHome`, meta semanal configurável, conquistas, tendência de volume; histórico agrupado por mês e comparação com o treino anterior.
- Formulários de autenticação acessíveis (`AuthField`), chat redesenhado.
- CTA do modo Foco preso no meio da tela (ancestral com `transform`): corrigido com portal.

**Pendente**
- Rotacionar a chave NVIDIA (segue no histórico do git) e ativar o App Check.
- Leitura de `trainings` aberta a qualquer usuário logado.
- Pull-to-refresh por gesto; teste do ForgotPassword; testes de integração com emulador (requer Java).

## Atualização — fase 4 (PWA, onboarding, evolução, notificações)

- **PWA:** manifest com atalhos, service worker versionado (shell + stale-while-revalidate; Firestore/Auth/googleapis nunca em cache), banner de atualização, convite de instalação (Android/iOS) e faixa offline.
- **Notificações:** apenas locais (descanso concluído com aba oculta, lembrete ao abrir o app). **Não há push em background** (exigiria servidor/Blaze)..
- **Onboarding:** `/onboarding` em 5 passos para alunos novos (sem `goal` e sem `onboardedAt`); regras validam `experience`, `weeklyGoal` (2–7) e `onboardedAt`.
- **Evolução por exercício:** `/analytics` (lista) e `/analytics/:exercicio` com carga, 1RM (Epley), volume, recordes, tendência e próxima carga sugerida (progressão dupla 8–12).

## Rebrand — AcademyUp → BohTreinar
Nome e marca centralizados em `src/config/brand.js` e `src/components/brand/Brand.jsx` (monograma B + seta e wordmark). Ícones do PWA regenerados. **Mantidos de propósito** (renomear apagaria dados locais/infra): chaves `academyup:*` de localStorage, ID do projeto Firebase e contas demo `@academyup.com`.

## Atualização — fase 5 (utilidade e plataforma)
- **Aluno:** execução com ±carga/±reps, copiar última sessão, notas por exercício, RPE, selo de recorde, tela sempre acesa (wake lock), compartilhar resumo; `/ferramentas` (1RM, anilhas, kg/lb, timer, IMC/hidratação).
- **Treinador:** fila de ação do dia, aderência (heatmap), atribuição em lote, CSV de alunos/financeiro, cobrança por WhatsApp/cópia, respostas rápidas no chat, editor de fichas com predefinições e reordenação por teclado.
- **Plataforma:** ErrorBoundary global/por rota, 404, recarga de chunk, `/privacidade` e `/termos` (modelo, revisar com advogado), aceite no cadastro (só local), exportar dados (JSON), SEO (OG/Twitter/JSON-LD/robots/sitemap), SDK de IA carregado sob demanda, skip link e foco por rota.
- **Coach IA:** NVIDIA com prompt próprio (sem funções simuladas), pedidos de ficha vão ao Gemini, Markdown seguro.
- **Pendente:** exclusão real de conta (exige regras), revisão jurídica, domínio próprio (atualizar sitemap/canonical).

## Atualização — fase 6
- **Sync offline idempotente:** cada check-in tem `clientId` e é gravado com `setDoc` em `checkIns/{clientId}`; falha no meio da fila não duplica; itens antigos recebem ID determinístico; sincronizações simultâneas são bloqueadas (6 testes).
- **Regras:** aceite dos termos gravado na criação da conta (`termsAcceptedAt`, `termsVersion`, validados); telefone do aluno (`phone`, só dígitos e `+()- `, ≤ 20) editável pelo próprio aluno e visível ao treinador vinculado. Testado em produção com tokens reais (10 casos).
- **Perfil:** campo WhatsApp/Telefone; cobrança do treinador abre o WhatsApp direto quando há telefone.
- **Home:** atalho para `/ferramentas`.

## Atualização — exclusão de conta e interface sem emojis
- **Exclusão de conta do aluno (LGPD):** botão "Excluir minha conta" em Perfil → confirmação digitada + reautenticação (senha ou Google) → apaga check-ins, medidas, conversas (mensagens antes do chat), fichas de IA, perfil e login; limpa o navegador. Regras: aluno apaga o próprio perfil e as conversas em que participa; treinador não. Testado em produção (12 cenários) e com 13 testes unitários. Também apaga as anotações privadas do treinador sobre o aluno (`coachNotes`) e os dados de mensalidade (ficam no perfil); treinador/admin continuam sendo removidos pelo suporte. **Fora do alcance:** cópias que o treinador exportou ou anotou fora do app, e notas de treinadores antigos sem conversa registrada com o aluno (o app só conhece o treinador do perfil e os das conversas).
- **Sem emojis:** removidos da interface (ícones SVG no lugar), dos textos de resumo/compartilhamento, dos modelos de mensagem e dos scripts de seed; prompts da IA proíbem emojis e `stripEmojis` filtra qualquer resposta que ainda traga algum. Código morto (`Navigation`, `TrainingList`) removido.
- Banner flutuante de treino ativo deixa de cobrir o campo de mensagem do chat.

## Atualização — notas do treinador na exclusão do aluno
- `coachNotes`: o aluno pode apenas **apagar** notas cujo `studentId` é o dele (regra por dado do documento); continua sem poder ler ou listar o conteúdo. O app apaga `coachNotes/{coachId}_{uid}` para o treinador do perfil e para os das conversas; documento inexistente é negado por regra e ignorado.
- Testado em produção (7 cenários) e com 4 testes unitários novos.

## Atualização — acessibilidade, emulador de regras e build
- **Auditoria axe-core (34 telas, claro/escuro, 390 px):** corrigidos zoom bloqueado no viewport, contraste do âmbar no tema claro (`amber-600` para `amber-700`), `h1` ausente (login, cadastro e título oculto nas rotas privadas), `select` sem rótulo (perfil) e overflow horizontal no painel (brilho `aurora` e cartões em grid). Chips de evolução com 44 px de alto.
- **Regras no emulador:** `rules-test/` (16 testes: isolamento aluno/treinador, escalada de papel, check-ins, notas, chats, fichas, perfil público). Roda no CI (`setup-java` + `emulators:exec`) e em `make test-rules`.
- **Build:** sem source maps em produção; `caniuse-lite` atualizado.
- **a11y:** axe-core zerado nas 34 telas (claro e escuro). Gerador de treino IA reestruturado (botoes padronizados, sem rolagem interna, sheet no celular, abas acessiveis); `color-scheme: only light` no tema claro para impedir escurecimento forçado do Android.

## Atualização — limpeza do Firebase
- App e proxy de IA somente na Cloudflare (`make deploy`). Firebase fica com Auth e Firestore (`make deploy-rules`).
- Removidos: `functions/` (proxy antigo, substituído pelo Worker), alvos `deploy-hosting`/`deploy-functions`/`deploy-all` do Makefile, testes de functions no CI, pastas vazias (`fuctions/`, `wsl.localhost/`), `.firebase/` do git.
- Firebase Hosting desativado (`firebase hosting:disable`). `/__/auth/handler` e `/__/auth/action` seguem 200 e o link de redefinição de senha abre a página de nova senha (testado).
- Domínio `bohtreinar.marcelo-labs.workers.dev` autorizado no Authentication; domínio antigo removido.

## Atualização — uso do servidor e proteção contra phishing/injeção
- **Cabeçalhos (Cloudflare `public/_headers`):** `Content-Security-Policy` aplicada (script/estilo/fonte/conexão/frame em lista de permissão; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action` 'self'), `Strict-Transport-Security`, `X-Frame-Options: DENY`. Validada em modo só-relatório nas 17 telas principais (0 violações) antes de aplicar.
- **Links de dados editáveis:** `safeHttpUrl`/`youtubeId` (`src/utils/safeUrl.js`) bloqueiam `javascript:`/`data:` no link de vídeo da ficha e no player; `rel="noopener noreferrer"` nos `_blank`.
- **Leituras do Firestore:** histórico do aluno compartilhado por 5 minutos entre Home, Treinos, Evolução e Detalhes (`checkInsCache`), invalidado ao gravar/apagar treino ou sincronizar offline. Antes cada tela relia o histórico inteiro.
- **Worker:** limite por usuário (20/min, em memória), corpo ≤ 64 KB, `max_tokens` ≤ 1200, tempo limite de 25 s, origem validada. No plano gratuito os arquivos estáticos não contam como invocação; só `/api/*`.
- **Pendente (console):** proteção contra enumeração de e-mail, política de senha mínima, nome público do app, idioma/nome do remetente dos modelos de e-mail, App Check enforce (após métricas).

## Atualização — login com Google, página de ação própria e lista de alunos
- **Login/cadastro com Google** (`GoogleButton`, `loginWithGoogle`): o primeiro acesso cria o perfil de aluno (`role: user`) com aceite dos termos registrado; o clique é o aceite e o aviso está visível. Treinadores continuam cadastrados à parte. Requer o provedor Google ativo no Firebase (já abre a janela do Google em produção) e o domínio autorizado.
- **Página própria `/auth/action`** (redefinir senha, confirmar e restaurar e-mail) no visual do app. Para usá-la: Firebase Console > Authentication > Modelos > "Personalizar URL de ação" = `https://bohtreinar.marcelo-labs.workers.dev/auth/action`.
- **Política de senha** (console: 8+, maiúscula, número, símbolo, modo "notificar") refletida no cadastro e na redefinição (`src/utils/password.js`).
- **Lista de alunos do treinador:** check-ins reaproveitados por 3 minutos entre Painel e Alunos (`ttlCache`) e limite proporcional ao tamanho da carteira (150 a 400 por lote de 30 alunos), para a aderência de 4 semanas não ficar subestimada.
- **App Check:** requisições do Firebase AI Logic (Gemini) já saem com o token (verificado em produção); exigência obrigatória a partir de 2/11/2026.

## Atualização — modelos de e-mail do Firebase
- O Firebase bloqueia a edição dos modelos de e-mail deste projeto (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`: assunto, corpo, "responder para" e URL acionável). Só o nome do remetente (`senderDisplayName`) aceitou alteração, feita pela API (Identity Toolkit admin v2).
- Por isso a página própria `/auth/action` está pronta, mas só será usada se o suporte do Firebase liberar a URL acionável personalizada. Enquanto isso, o e-mail de recuperação envia `url` de continuação para o login do app (botão "Continuar" na página padrão).

## Atualização — desempenho de carregamento (Lighthouse mobile, 4G lenta)
- **Início:** nota 29 para 88; FCP 8,6 s para 1,2 s; peso 875 para 327 KiB. **Login:** 52 para 81; **Cadastro:** 83.
- Causas e correções: fontes do Google (CSS externo bloqueante) agora em `public/fonts` com `@font-face` inline e preload; reCAPTCHA do App Check (~350 KB, ~3 s de CPU) só entra depois do carregamento nas telas públicas, ou na hora com sessão/login (`ensureAppCheck`); iframe de login do Firebase (~90 KB) só ao entrar com Google (`initializeAuth` sem resolver; resolver passado na chamada do popup).
- Medido sem sessão. Telas autenticadas não foram medidas com Lighthouse (carregam Firestore e App Check desde o início).

## Atualização — biblioteca de exercícios
- Biblioteca de 22 para 51 exercícios (máquinas, polias e pernas), grupos `peito/costas/ombros/braços/pernas/core`, sem imagens. Vídeos só quando conferidos (oEmbed): Supino Máquina, Puxada Aberta Máquina, Remada Neutra Máquina, Elevação Lateral Máquina e Cadeira Extensora.
- Removido o vídeo placeholder (`dQw4w9WgXcQ`) de 20 exercícios, de uma ficha com exercícios embutidos e de `src/data/exercises.js` e `scripts/seed.cjs`.
- Treino A (Peitoral + Dorsal + CORE) do usuário: removidos Barra Fixa, Extensão Lombar e Abdominal; incluídos Supino Máquina e Puxada Aberta Máquina.

## Atualização — painel administrativo (Centro de gestão de conteúdo)
- `/admin` redesenhado: **Visão geral** (exercícios, fichas, alunos, treinadores, treinos em 7 dias via contagem agregada; pendências de conteúdo clicáveis; fichas com aviso; atividade recente), **Exercícios** (tabela no desktop e lista no celular, filtros por grupo, nível, mídia, pendência e status, ordenação, editor em painel lateral por blocos com prévia para o aluno e validação de links, duplicar, arquivar/restaurar, excluir com confirmação) e **Fichas** (origem, nº de exercícios, grupos, alunos usando, avisos como "nome cita CORE mas não há core", editor com ordem e busca).
- **Importação em etapas**: prévia com novos, duplicados (mesmo nome) e inválidos (grupo, links); só grava após confirmar. Fichas importadas resolvem IDs antigos pelo `originalId`.
- **Histórico de alterações** (`adminLog`): quem fez o quê em exercícios e fichas. Regras: só o admin lê e acrescenta; ninguém edita ou apaga. Também liberada a listagem de `checkIns` sem filtro para o admin (métricas); testado no emulador (18 casos).
- Exercícios arquivados saem das listas de escolha (editor de fichas e biblioteca do treinador), mas continuam nas fichas já montadas.
- Testado em produção com sessão de admin: criar, validar, arquivar, filtrar, restaurar, excluir e histórico; axe sem achados (corrigido um aviso de ordem de títulos nas fichas). O exercício e o histórico do teste foram removidos.
- Não incluído: desfazer alterações, tela de usuários e rascunhos.

## Atualização — contador de check-ins (sem listar dados de saúde)
- **`userStats/{uid}`**: `checkInCount`, `lastCheckInAt`, `lastCheckInId` (e `lastRemovedId` ao apagar). Gravado numa transação junto do check-in (`checkInService`: criar, reenviar do offline sem contar duas vezes, apagar). Como o plano gratuito não tem Cloud Functions, a integridade vem das regras: o contador só muda se o check-in correspondente for criado/removido no mesmo lote (`existsAfter`/`getAfter`). Não dá para inflar, zerar ou alterar o número sozinho (testado no emulador, 22 casos).
- **Regras de `checkIns`:** voltou a não haver listagem ampla (nem para admin); ler um ID inexistente é permitido ao logado (gravação idempotente).
- **Painel admin:** "Alunos ativos (7 dias)" e total de treinos vêm de `userStats`, sem tocar em check-ins.
- **Backfill/reconciliação:** `node scripts/backfill-user-stats.cjs [apply]` compara com a contagem real (9 alunos: 0 diferenças após aplicar e após gravar/apagar em produção) e registra no `adminLog`.
- Excluir a conta do aluno também apaga o `userStats`.
- **Limite:** um cliente adulterado pode deixar de atualizar o contador (não de inflá-lo); o script de reconciliação corrige.

## Atualização — vínculo aluno-treinador (solicitação e aceite)
- Antes: o botão "Vincular treinador" tentava ler o perfil privado do treinador (negado pelas regras) e gravava `coachId` direto. Agora o fluxo é **pedido do aluno → aceite do treinador**.
- **`coachLinks/{studentId}`** (`pending | active | rejected | revoked`, com `studentName`): só os dois lados e o admin leem. O aluno pede (só para si e só a treinador), cancela ou encerra; o treinador aceita (no mesmo lote grava `users.coachId`), recusa ou encerra. O aluno **não consegue mais se vincular sozinho** (só desfazer: `coachId: null`). Testado no emulador (28 casos).
- **Aluno:** "Meu treinador" no perfil e no painel (estados nenhum, pendente, ativo, recusado, encerrado), busca por nome (perfis públicos) ou código/link `/convite/<código>`; cadastro com convite vira solicitação.
- **Treinador:** painel "Solicitações de alunos" (aceitar/recusar) e "Encerrar vínculo" no detalhe do aluno. Convite agora é o link `/convite/<código>`.
- **Admin:** aba "Vínculos" (ativos, alunos sem treinador, treinadores sem alunos, pendentes, lista com datas).
- Encerrar o vínculo revoga o acesso do treinador a dados novos; fichas atribuídas e histórico não são apagados.
- **Modais em portal:** o modal base passou a renderizar em `document.body` (um modal dentro do `<form>` do perfil enviava o formulário de fora).
- Fora desta etapa: QR Code, limite/validade de convite, múltiplos treinadores, ligação com `adminLog` das ações do aluno/treinador (o admin só lê).

## Atualização — amigos e ranking de consistência (MVP social)
- **Perfil social** (`publicProfiles/{uid}`): nome público, @usuário, foto, meta semanal e duas chaves de privacidade (`discoverable`: aparece na busca por nome; `shareRanking`: participa do ranking). Separado de `users`; nunca contém peso, medidas, e-mail ou check-ins. `@usuário` e código de amigo são reservados em `handles/` e `friendCodes/` no mesmo lote (unicidade garantida por regra).
- **Amizades** (`friendships/{menorUid_maiorUid}`, `pending | active | blocked | removed`): só os dois lados e o admin leem. Pedir, aceitar (só quem recebeu), recusar, cancelar, remover e bloquear; só quem bloqueou desbloqueia, e bloqueio impede novo pedido (testado nas regras e em produção). Pedido cruzado vira amizade.
- **Ranking semanal** ("Consistência registrada", não é competição oficial): treinos da semana, dias ativos, sequência e meta cumprida, vindos de `userStats` (campos semanais gravados na mesma transação do check-in; as regras limitam +1 por check-in). Um amigo só lê o `userStats` do outro se a amizade está ativa e **os dois** participam. Sair do ranking não desfaz a amizade.
- **Auditoria:** `socialLog` (pedir, aceitar, recusar, cancelar, remover, bloquear, entrar/sair do ranking) aparece na aba "Social" do admin, junto com perfis e amizades.
- **Exclusão de conta** apaga perfil, @usuário, código e amizades do usuário.
- **Backfill:** `scripts/backfill-user-stats.cjs` também reconcilia os campos semanais (aplicado: 9 alunos, 0 diferenças).
- **Bugs de regras achados só em produção** (o emulador acusava aprovado nos testes antigos): `get` de documento inexistente em `friendships` (negado quando não há `resource`) e `list` com `in [userA, userB]` não é provado pela consulta; ambos corrigidos e cobertos por testes que reproduzem as leituras exatas do app.
- **Limites:** o contador pode subestimar (cliente adulterado deixa de atualizar), nunca inflar além de +1 por treino; perfis ocultos aparecem como "Usuário" até existir relação; documentos de amizade bloqueada sobram após exclusão de conta do outro lado; `socialLog` guarda uid e ação.
- **Fora desta etapa:** moedas, conquistas, desafios com prêmio, ranking global, QR Code.

## Atualização — revisão do PR 55 (revisor-diff) e amizades órfãs
- **Exclusão de conta:** bloqueio feito por outra pessoa agora é apagado no mesmo lote que remove `users/{uid}` (regra `existsAfter`); o `socialLog` do próprio usuário também sai (regra: só depois de o perfil social sumir; `list` do próprio registro liberado). Nada de par de IDs órfão.
- **Bloqueio na busca:** quem foi bloqueado não consegue mais ler o perfil de quem bloqueou (por @usuário, código ou nome); a busca por nome em lista continua podendo listar perfis descobríveis (limite das regras).
- **Integridade de @usuário e código:** a reserva só vale se o perfil gravado no mesmo lote carrega o mesmo valor, e só pode ser solta junto com o perfil ou trocando o valor (fim da reserva em massa e do "roubo" de handle).
- **Outros:** `photoURL` fixo em vazio (sem pixel de rastreio); `socialLog` com limites de tamanho; busca por nome agora é por prefixo (antes só igualdade exata).
- **Reconciliação:** `node scripts/backfill-user-stats.cjs` segue como rotina de correção do contador (rodar por exemplo uma vez por mês e após mudanças nas regras); ranking continua descrito como "Consistência registrada".
- **Verificado:** o mesmo treino não incrementa duas vezes (`createdNow` + `lastCheckInId`, e `saveCheckIn` pula check-in já existente); `adminLog`/`socialLog` não guardam dados de saúde.
- **Pendências aceitas (observar uso real):** amigo lê o `userStats` inteiro (inclui horário do último treino e total de check-ins; ideal: documento `publicStats` separado); piso/formato dos campos semanais não é validado (um cliente adulterado pode inflar o próprio ranking, nunca o de outros); pedidos de amizade a qualquer usuário com perfil, sem limite; pedido cruzado simultâneo pode falhar uma vez; exclusão de conta não foi exercitada em produção (usuários de teste não têm reautenticação), só em emulador e testes unitários.

## Atualização — publicStats, validação do ranking e limites de pedidos
- **`publicStats/{uid}`:** o ranking agora lê só este documento (`weekKey`, `weekWorkouts`, `activeDays`, `streak`, `lastActiveDay`, `updatedAt`). O `userStats` voltou a ser legível só pelo dono e pelo admin: amigo não vê mais horário do último treino nem total de check-ins. As regras exigem que o `publicStats` seja idêntico ao `userStats` do mesmo dono (via `getAfter`), então ele nunca diz mais nem menos do que o contador validado. Gravado na mesma transação do check-in; `syncPublicStats` cobre quem já tinha treinos; o backfill reconcilia (9 espelhos criados em produção, 0 diferenças depois).
- **Sem `weeklyGoalMet` armazenado:** a meta cumprida é calculada na leitura (treinos da semana x meta do perfil público); um campo gravado poderia ser forjado e ficar velho quando a meta muda.
- **Ranking mais difícil de inflar (`userStats`):** `weekKey` e `lastActiveDay` com formato validado e nunca andam para trás; a sequência só sobe +1 quando o último dia ativo avança (apagar e recriar o mesmo check-in não infla); apagar só baixa números e não troca semana, dia nem sequência; dias ativos só encolhem. **Limite que continua:** quem cria check-ins falsos com datas novas ainda sobe o próprio ranking; por isso o ranking é "Consistência registrada", sem prêmio, moeda ou recompensa. Só um processamento no servidor (Worker com credencial) fecha isso.
- **Pedidos de amizade:** cada recusa soma 1 e fixa espera de 1 dia; quem foi recusado só pede de novo depois da espera e até 3 recusas (as regras conferem, não só o app). Pedidos cruzados simultâneos viram aceite, sem erro visível. **Não há limite de pedidos pendentes por usuário:** contar documentos não é possível nas regras do plano gratuito; fica para o Worker.
- **Exclusão de conta validada em produção** com uma conta de e-mail e senha: usuário, login, perfil público, @usuário, código, amizade ativa, bloqueio feito por outra pessoa, registro social, publicStats, userStats e check-ins removidos; perfis e registros dos outros intactos.
- **Pendente (decisão):** a busca **por nome** lista perfis descobríveis, inclusive de quem bloqueou o buscador. As regras não filtram bloqueio em consulta de lista. Fechar exige uma operação no servidor (Worker com credencial de serviço do Firestore) ou abrir mão da busca por nome (ficando só @usuário e código, que respeitam o bloqueio).
- **Fotos:** `photoURL` segue vazio; foto real só com caminho de armazenamento autorizado (Storage/R2), nunca URL arbitrária.
- **Revisão desta etapa (`revisor-diff`):** apagar a amizade deixou de ser um jeito de zerar a espera/recusas (só admin ou exclusão da conta, no mesmo lote do `users/{uid}`); espera da recusa limitada a 12–48 h; achado real corrigido: a regra `streak <= checkInCount` impedia apagar um check-in quando a sequência era igual ao total (agora `streak <= 3660`). Aceitos: `declines` nunca zera (decisão de produto); `publicStats` fica gravado (ilegível) se a pessoa sai do ranking; datas do ranking não são checadas contra o relógio do servidor.

## Atualização — busca por nome removida
- Decisão: sem busca por nome. As regras não filtram bloqueio em consulta de lista, e filtrar no cliente não é proteção. A listagem de `publicProfiles` agora é só do admin; amigos se encontram por **@usuário** ou **código de amigo** (`get` direto, que respeita o bloqueio). O índice composto da busca foi removido.
- A opção do perfil virou "Mostrar meu nome a quem me achar": desligada, quem tem o @usuário ou o código vê só o @usuário até serem amigos.
- Texto no app: encontre alguém pelo @usuário ou código; a busca por nome volta numa próxima etapa com proteção de privacidade.
- **Para a busca por nome voltar** (só se houver necessidade real): operação no Worker com credencial de serviço exclusiva e rotacionável, permissão mínima de leitura, verificação do ID token, limite por usuário e IP, paginação, validação do termo, filtro de bloqueio no servidor, logs sem dados pessoais, testes contra enumeração e plano de revogação.

## Atualização — limite durável no Worker de IA
- Antes: o limite por usuário (20/min) vivia na memória de cada instância, então não valia entre instâncias nem regiões e não segurava inundação de tokens inválidos.
- Agora: dois bindings de rate limit da Cloudflare (`wrangler.jsonc`): `AI_USER_LIMIT` (20/min por usuário, depois de verificar o token) e `AI_IP_LIMIT` (60/min por IP, antes de verificar o token). Se o binding falhar ou não existir (dev, testes), vale o contador em memória; a IA não cai por causa do limitador.
- Validado em produção: rajada de 400 chamadas com token inválido, 218 receberam 429. A contagem da Cloudflare é por local e aproximada (rajadas pequenas podem passar); é um freio, não uma cota exata.
- Teste novo no Worker (21 aprovados). Segue pendente a parte de identidade madura citada para uma futura busca por nome (credencial de serviço, filtros no servidor).

## Atualização — sincronização offline de check-ins
- **O que já estava certo:** cada treino concluído tem `clientId` fixo, e `saveCheckIn` grava check-in, `userStats` e `publicStats` numa transação; reenviar o mesmo ID não conta de novo (e as regras recusam novo incremento para um check-in que já existe).
- **Lacunas encontradas e corrigidas:**
  1. A fila só era enviada com a tela de treino aberta (evento `online`) ou ao abrir a Home; reabrir o app em outra tela deixava o treino parado. Agora há um gerenciador global (`useOfflineSync` no `PwaLayer`): envia ao abrir, ao voltar a rede, ao voltar para a aba e a cada minuto enquanto houver pendência.
  2. Duas abas: uma aba podia regravar a fila com uma cópia velha e **perder um treino enfileirado pela outra**. Agora cada remoção relê a fila e há uma trava entre abas (30 s) — a idempotência do ID continua sendo a garantia final.
  3. Se o check-in era salvo mas a atualização de `lastWorkoutDate` falhava, o treino ia para a fila de novo. Agora só entra na fila se o check-in não foi salvo.
  4. Reenvio regravava o documento do check-in (mudava `syncedAt`); agora o primeiro envio vale e nada é regravado.
  5. Falhas eram silenciosas. Agora o item guarda tentativas e motivo; erro que repetir não resolve (permissão, dado inválido) vira "não enviado" com botão **Tentar de novo**; erro de rede segue pendente.
- **Estados no aviso do topo:** sem conexão com N treinos aguardando; sincronizando; aguardando sincronização; falha com botão. Depois do sucesso o item sai da fila e a Home recarrega.
- **Validado em produção** (navegador real, usuário de teste): concluir sem rede (1 item na fila, nada no Firestore), fechar e reabrir offline (fila mantida), reconectar (1 check-in, `userStats` e `publicStats` +1, fila vazia), reenvio do mesmo ID 3 vezes em 2 abas (continua 1), queda de rede durante o envio (item pendente com 1 tentativa, nada pela metade) e retomada (enviado uma vez); histórico com uma entrada por check-in.
- **Limite:** o localStorage é por navegador; limpar os dados do site com treino pendente perde o treino. Não há fila em segundo plano com o app fechado (exigiria Background Sync do service worker).

## Atualização — roteiro do App Check e mensagens de login
- Criado `docs/APPCHECK.md`: estado atual, critérios de métricas (≥ 99% verificadas por 7 dias), ordem do enforce (AI Logic até 2/11/2026, Firestore, Auth por último), roteiro de fumaça, token de debug para testes e passo da proteção contra enumeração de e-mail.
- Código: login mostra a mesma mensagem para e-mail inexistente e senha errada; recuperação de senha responde igual com ou sem conta. O cadastro com e-mail já usado ainda informa (decisão de produto).
- **Pendente (console, só você):** domínios da chave reCAPTCHA, ativar a proteção contra enumeração, acompanhar métricas e ligar o enforce.

## Atualização — leitura das métricas do App Check (12/10/2026)
- Console: Firestore 46% verificadas, AI Logic 23%, Auth 32%; reCAPTCHA com 44 solicitações em 7 dias. Domínios da chave e proteção contra enumeração de e-mail conferidos.
- Causa provável do baixo percentual: tráfego dos meus testes automatizados e a primeira chamada de renovação do Auth saindo antes do App Check iniciar. Ajuste: quem já tem sessão inicia o App Check imediatamente (`bt_has_session`).
- Decisão: **sem enforce por enquanto**; reler em 19/10 com uso real, mínimo de 200 solicitações por produto e fora o tráfego de teste; Authentication fica sem enforce. Detalhes em `docs/APPCHECK.md`.

## Atualização — auditoria de dependências (12/10/2026)
- **Antes (`npm audit --omit=dev`):** app 15 (1 crítica, 4 altas); MCP 9 (2 altas); Worker 0. **Depois:** app 6 (0 críticas, 4 altas, 2 moderadas); MCP 0; Worker 0.
- **O que mudou:** `firebase-admin` e `ajv` passaram para `devDependencies` (só scripts e testes usam; não vão para o navegador nem para o Worker) — isso tirou a crítica (`websocket-driver`) da lista de produção; `react-router-dom` 6.30.3 → 6.30.6; `npm audit fix` sem `--force`; MCP atualizado de `firebase-admin` 12 para 14 (leitura no Firestore testada; sintaxe do servidor ok).
- **Restam e por quê:**
  - `@grpc/grpc-js` (via `firebase`/`@firebase/firestore`, 4 altas): é código de servidor Node; o pacote para navegador não o inclui, então não está no bundle. O "conserto" sugerido pelo `npm audit` é um downgrade absurdo do `firebase`; ignorado. Reavaliar a cada atualização do `firebase`.
  - `react-router` (2 moderadas, só corrige na 7.18): redirecionamento aberto via `Link`/`useNavigate` com destino controlado por quem ataca. O app só navega para caminhos fixos ou montados com IDs (nenhum destino vem de parâmetro de URL), então não é explorável aqui. Migrar para a v7 tem risco com o Jest do CRA 5; deixar para quando o CRA sair.
  - Ferramentas de build/teste (`react-scripts`, emulador): 105 avisos no total contando as de desenvolvimento; não entram no que é publicado.
- Rotina sugerida: rodar `npm audit --omit=dev` em `.`, `worker` e `mcp` uma vez por mês e antes de cada deploy grande.

## Atualização — desempenho das telas autenticadas (12/10/2026)
Medido em produção com a conta demo, só leitura. Lighthouse 12 (simulação: mobile = 4x CPU + 4G lenta; desktop = preset desktop). "Primeira" = perfil de navegador novo (cache frio) com sessão; "repetida" = segunda carga no mesmo perfil (cache e service worker quentes). Dados de laboratório, não de usuários reais.

| Tela | Mobile primeira (nota / LCP) | Mobile repetida | Desktop primeira | Desktop repetida |
| --- | --- | --- | --- | --- |
| `/dashboard` | 37 / 9,3 s | 63 / 2,7 s (TBT 1,85 s) | 67 / 2,9 s | 99 / 0,7 s |
| `/trainings` | 51 / 9,1 s | 89 / 2,6 s | 67 / 3,0 s | 99 / 0,7 s |
| `/history` | 47 / 8,7 s | 85 / 2,7 s | 69 / 3,0 s | 100 / 0,7 s |
| `/measurements` | 45 / 8,7 s | 78 / 2,4 s | 68 / 3,2 s | 98 / 0,9 s |
| `/chat` | 47 / 9,0 s | 83 / 2,7 s | 70 / 2,9 s | 98 / 0,9 s |

- **CLS:** 0,000 a 0,017 em todas as telas (meta < 0,1: ok). **INP** (interações reais de leitura, mobile com 4x CPU): 64 a 136 ms (meta < 200 ms: ok); desktop 32 a 64 ms. Um CLS de 0,176 no `/chat` apareceu só num script que clicou em "Voltar" (navegou para outra tela); não reproduz isolado nem no Lighthouse.
- **Navegação interna (SPA, sem recarregar):** 0,5 a 1,5 s até a tela estabilizar, sem baixar JavaScript novo (mobile 1,1 a 1,5 s; desktop 0,5 a 0,9 s). Muito melhor que a primeira visita.
- **Metas:** LCP < 2,5 s e nota mobile > 80 **só são atingidos na visita repetida e ainda assim não em todas** (`/dashboard` 63, `/measurements` 78). Na primeira visita mobile todas ficam em 37 a 51 (LCP ~9 s) e no desktop em 67 a 70 (LCP ~3 s).
- **Causa (todas as telas iguais):** a página só desenha depois que o JavaScript roda (fase "render delay" ≈ 8,7 s de 9,3 s no LCP do `/dashboard`). JavaScript da primeira visita: **~554 KB** transferidos, dos quais **346 KB são o script do reCAPTCHA** (App Check) e 207 KB o `main.js` do app. Na CPU de celular simulada, `main.js` leva ~1,7 s e o reCAPTCHA ~2 s de execução, disputando a mesma thread. O CSS (17 KB) bloqueia a renderização em ~350 ms. Na visita repetida o `/dashboard` ainda tem TBT de 1,85 s (a Home executa muito JavaScript).
- **Não feito (candidatos, em ordem de ganho esperado):** (1) tirar o reCAPTCHA do caminho crítico (iniciar depois da primeira pintura, aceitando as primeiras chamadas sem token; só vale decidir junto com o enforce do App Check, que exige token desde a primeira chamada); (2) analisar o `main.js` (207 KB) e adiar módulos do Firebase que a primeira tela não usa; (3) CSS crítico inline; (4) reduzir o JavaScript da Home. Reavaliar com dados reais de usuários (web-vitals no campo) antes de investir.

### Bug achado na medição: app em branco com o reCAPTCHA bloqueado
- Com o script do reCAPTCHA bloqueado (extensão de privacidade, firewall, rede restrita), **o usuário logado via tela em branco para sempre**: o SDK do App Check só trata o `onload` do script, o token nunca chega, e o Auth e o Firestore esperam o token sem prazo (nenhuma chamada saía depois da falha). Existia desde que o App Check foi ligado.
- **Correção:** `src/firebase/appCheckProvider.js` dá 5 s ao token e, depois de uma falha, as chamadas seguintes falham na hora por 60 s (senão cada serviço esperaria 5 s um depois do outro). Validado em produção: com o reCAPTCHA bloqueado a tela aparece em ~6 s (antes: nunca); sem bloqueio, a troca do token continua dando 200 e o fluxo social completo passa (15 verificações).
- **Atenção:** o invólucro usa a interface interna do provedor (`initialize`, `getToken`, `isEqual`); conferir ao atualizar o `firebase` (hoje 12.9.0). Quem tem o script bloqueado fica sem token: com o **enforce ligado, essas pessoas perdem acesso** (limitação já descrita no roteiro do App Check).
- **Verificações pendentes citadas na revisão:** `firebase-admin` em `devDependencies` é seguro porque nada em `src/` nem em `worker/` o importa (conferido por busca); o MCP segue sem teste de ponta a ponta além da leitura no Firestore.

## Atualização — revisão do painel do treinador (12/10/2026)
Conta de treinador do ambiente, produção, só leitura; celular (390 px) e desktop (1366 px); axe, tamanhos de alvo, estouro horizontal, console e rede por tela (`/coach/dashboard`, `/coach/students`, detalhe do aluno, `/coach/chat`, `/coach/financial`, `/coach/settings`, `/admin/trainings`, `/admin/exercises`).
- **Sem problemas:** nenhuma tela com rolagem horizontal, erro de console ou requisição falha (4xx/5xx); axe sem violações sérias nem críticas, exceto o contraste abaixo; visual coerente em claro nos dois tamanhos.
- **Números conferem entre telas:** Ativos 7, Em risco 1, Retenção 88% (7/8), Previsto R$ 1.060 e Recebido R$ 550 batem entre Painel, Alunos e Financeiro.
- **Lista de alunos (funcional):** filtros (Todos 8, Ativos 7, Em risco 1, Sem ficha 0) devolvem a contagem do chip; busca por nome/e-mail e estado vazio ok; as 5 ordenações ordenam como o nome diz; CSV baixa 8 alunos + cabeçalho; "Selecionar todos" abre a barra de ação em lote (não executada).
- **Corrigido:**
  1. **Dois `<h1>` em todas as telas do treinador** (o título da rota para leitores de tela somava-se ao título da página). Agora o título da rota só aparece quando a página não tem o próprio h1 (`RouteTitle`); conferido: exatamente um h1 em cada uma das 9 telas de aluno e nas do treinador.
  2. **Contraste** do texto "Nova conversa" na lista de conversas (2,84:1 por `opacity-60`).
  3. **Alvo de toque** das caixas de seleção de alunos (20 a 24 px): a área tocável passou a 44 px no celular e 36 px no desktop (a caixa visível não mudou).
  4. **Configurações:** o "Código de convite" mostrava só o UID do treinador; agora há **Copiar link** (`/convite/<código>`, que abre o cadastro ou o pedido de vínculo já preenchidos) além de **Copiar código**, com o aviso de que o vínculo só vale após o aceite.
- **Não executado (gravam dados; exigem conta e dados de teste dedicados):** Marcar pago, Cobrar, Atribuir ficha em lote, Trocar ficha, Encerrar vínculo, Convidar, salvar Configurações, editar ficha e exercício. O isolamento (treinador só vê os próprios alunos) segue coberto pelos testes de regras (46 casos).
- **Dado de demonstração, não bug:** a lista de conversas mostra uma conversa "Super Admin — Nova conversa" de julho.

## Atualização — fluxos de escrita do treinador testados em produção (12/10/2026)
Treinador e alunos fictícios dedicados (nada do treinador real foi tocado), pela interface; cada passo conferido no Firestore; dados removidos ao final. **20 de 20 verificações aprovadas.**
- **Painel:** Marcar pago na fila de ação grava `paymentStatus=paid` e `paymentDate`.
- **Financeiro:** Marcar pago e Desfazer; editar mensalidade (vazio e negativo recusados sem gravar; valor válido grava).
- **Alunos:** atribuir ficha a um aluno (`currentTrainingId`); atribuição em lote (3 alunos, tela de resultado correta; quem tem só pedido pendente não é tocado).
- **Vínculo:** aceitar (`coachId` + link `active`) e recusar (`rejected`, sem `coachId`); encerrar vínculo (`coachId` nulo, link `revoked`, check-ins do aluno preservados).
- **Notas privadas:** gravam em `coachNotes/{coach}_{aluno}` e voltam depois de recarregar.
- **Fichas:** criar (com `coachId`/`createdBy` do treinador), duplicar e excluir (preserva as outras).
- **Configurações:** grava nome, bio, telefone e `defaultMonthlyFee`; o papel não muda. (A mensalidade padrão é `defaultMonthlyFee`, não `monthlyFee`; ela ainda não preenche a mensalidade de alunos novos.)
- **Autorização na produção (REST com o token do treinador):** aluno vinculado aceita `paymentStatus` (200); aluno com vínculo encerrado, pedido recusado, troca de `role` e de `email` retornam 403.
- **Falsos alarmes da própria automação (não são bugs):** campo numérico não aceita texto (o navegador impede); a tela de resultado do lote fica aberta até "Concluir" e cobre a página.
- **Não coberto:** Cobrar e Parabenizar (abrem o chat com rascunho), convite por link com cadastro novo (já testado no PR do vínculo), exclusão de ficha em uso por alunos.

## Atualização — convite por link e mensalidade padrão (12/10/2026)
Implementado e validado em produção com treinador e alunos fictícios (**39 de 39 verificações aprovadas**, dados removidos ao final).
- **Convite por link (`coachInvites/{i_…}`):** o treinador cria pelo botão Convidar, com validade (1, 7 ou 30 dias) e limite de usos (1, 5, 10 ou 50); lista os convites com situação e usos e pode cancelar. O ID (20 caracteres aleatórios) é o segredo; o documento só tem `coachId`, datas, `maxUses`, `uses` e `revoked` (sem e-mail, medidas ou check-ins). Regras: o pedido do aluno só passa se o convite está ativo, não expirou, não esgotou e o **mesmo lote soma exatamente 1 uso** (`getAfter`); o treinador só revoga (não reativa nem muda limites); o aluno não mexe no convite sem o pedido. O código fixo (UID) continua valendo para quem já o divulgou, e o pedido sempre depende do aceite.
- **Bug antigo corrigido (usuário novo pelo link):** o cadastro verificava o treinador lendo `users/{id}` sem estar logado (negado), então o código nunca era confirmado e o cadastro com convite não funcionava. Agora a conferência usa só dados públicos (`coachInvites` e `publicCoachProfiles`), mostra o nome do treinador e o motivo quando o convite não vale.
- **Fluxos testados:** novo usuário (link → cadastro → pedido pendente com `inviteId`, conta sem `coachId`, 1 uso consumido); usuário existente (link → perfil → pedido pendente); treinador **não lê** o aluno nem seus check-ins enquanto pendente (403); depois do aceite lê (200); o aceite não muda o papel; convite cancelado, expirado e esgotado são recusados com mensagem clara e sem criar pedido; último uso de convite de 1 pessoa funciona e o seguinte é recusado; encerrar vínculo devolve 403 ao treinador.
- **Mensalidade padrão (`defaultMonthlyFee`):** só **sugere** o valor ao aceitar um aluno novo; o treinador vê um passo de confirmação com o valor editável; o valor final fica em `monthlyFee` do aluno com `paymentStatus: pending`. Zero, negativo, texto ou valor acima de 100.000 são recusados (app e regras). Alterar o padrão **não muda** alunos existentes (testado). A edição por aluno no Financeiro também exige valor maior que zero. Marcar pago e Desfazer seguem funcionando.
- **Bug achado nos testes (chat):** o treinador não conseguia abrir a **primeira** conversa com um aluno ("Erro ao conectar"): o `get` de um chat inexistente era negado pelas regras. Agora quem faz parte do ID (`menor_maior`) pode consultar o chat que ainda não existe e criá-lo; terceiros continuam sem acesso. Cobrar e Parabenizar abrem o chat com o rascunho certo (nome, valor de R$ 120,00; recorde "Supino Teste (50 kg)").
- **Excluir ficha em uso:** a confirmação diz quantos alunos usam e quais ("1 aluno usa esta ficha (Aluno Um Teste) e ficará sem ficha atribuída"); confirmar apaga a ficha e **desatribui** os alunos no mesmo lote; cancelar não muda nada. (Antes a mensagem prometia isso, mas os alunos ficavam com a referência quebrada.) Achado no teste: a consulta dos alunos precisa filtrar `role == 'user'` para as regras provarem o acesso.
- **Limites e não coberto:** cadastro novo **com Google** não carrega o convite (o usuário entra e reabre o link, que abre o pedido no perfil); expiração é conferida pelo horário do servidor, mas o contador de usos aceita no máximo `maxUses` por regra, sem aviso ao treinador quando esgota; convites antigos revogados/expirados continuam listados (até 10); chat do lado do aluno para pares novos usa a mesma correção, mas não foi exercitado.
- **Revisão (`revisor-diff`) desta frente e correções:** (1) **brecha alta:** o aluno podia gastar usos do convite em loop (`update uses+1` sozinho) com um pedido antigo; agora o pedido tem de ser escrito no mesmo lote, e o mesmo aluno não reaproveita o mesmo convite; (2) o ID do chat tem de bater com os participantes na criação (ninguém ocupa o ID de outro par); (3) a mensalidade "0 = isento" volta a ser aceita no Financeiro e nas regras, e só o **aceite** de aluno novo e o **padrão** exigem valor maior que zero; (4) revogar o pedido e o treinador não alteram `inviteId`/`createdAt`/`requestedBy`. Testes de regras: 60 casos; fluxos em produção refeitos depois das correções (39 de convite/mensalidade/chat/ficha e 20 de escrita do treinador).
- **Aceito:** convite revogado ou expirado depois de um pedido já feito não impede o treinador de aceitar esse pedido (a decisão é dele); o `get` do convite é público por ID (62^20 combinações, sem listagem; `Referrer-Policy: strict-origin-when-cross-origin` evita vazar o caminho a terceiros).

## Atualização — otimização de carga (12/10/2026)
**Diagnóstico:** a tela só aparecia depois que o **Auth conferia a sessão** (`accounts:lookup`) e esse pedido **esperava o token do App Check** (corrente de ~2 s até o reCAPTCHA responder); `AuthProvider` não renderiza nada até lá. Ou seja, o reCAPTCHA estava no caminho crítico da primeira pintura, e o conteúdo (Firestore) também espera o token. O adiamento simples do início do token **não ajudou** (testado e descartado): o Auth continuava esperando.

**O que mudou:**
1. O App Check **não inicia mais no carregamento** das telas privadas; o `AuthContext` inicia assim que a sessão é conhecida e **antes de qualquer leitura do Firestore** (que sempre espera o token). Entrar, cadastrar e as telas públicas seguem como antes.
2. O script do reCAPTCHA começa a baixar **já no carregamento, em paralelo** (só o download; o App Check ainda não está iniciado, então o Auth não espera). Efeito colateral: o `anchor` do reCAPTCHA é pedido duas vezes (o SDK injeta o próprio script).
3. **Cópia mínima do perfil** (`src/utils/profileCache.js`: papel, nome, foto, objetivo, `coachId`, campos de onboarding; **nenhum dado de saúde, e-mail ou telefone**): a tela abre com ela enquanto o perfil verdadeiro é lido e a substitui; quem ainda não concluiu o onboarding não usa a cópia; sai da tela/da conta limpa a cópia. Só interface: quem autoriza são as regras.
4. Mantidos: prazo de 5 s do token (app não fica em branco com o reCAPTCHA bloqueado — conferido de novo: a tela aparece em ~8 s) e as rotas já em carregamento sob demanda (o SDK de IA e cada página são chunks separados; o `main.js` de 207 KB é quase só Firebase e React, sem ganho fácil).

**Resultado (mesmo método do diagnóstico anterior, conta demo, primeira visita com cache frio e sessão):**
| Medida | Antes | Depois |
| --- | --- | --- |
| Primeira pintura real (sem simulação), todas as telas | 3,5 a 4,6 s | **1,2 a 1,6 s** |
| LCP real, primeira visita | 3,6 a 5,7 s | 1,4 a 4,0 s |
| Nota mobile, **visita repetida**: Painel / Medidas / Chat / Histórico / Treinos | 63 / 78 / 83 / 85 / 89 | **90 / 91 / 93 / 92 / 85** |
| TBT do Painel, visita repetida (mobile) | 1850 ms | 208 ms |
| Nota mobile, primeira visita (simulada, celular lento) | 37 a 51 | 40 a 49 (**sem mudança relevante**) |

A nota simulada da primeira visita não melhorou: no celular lento o conteúdo (dados do Firestore) continua dependendo do token do App Check e da conexão; o que mudou foi a tela aparecer (casca, menu, título) bem antes. Para mexer nisso é preciso reduzir o caminho até os dados (por exemplo, cache de leitura do Painel), não o reCAPTCHA.

**Consequência para o App Check (decisão):** a conferência de sessão do Auth (um pedido por abertura) sai **sem token**; isso desfaz o ajuste do PR 62 (`bt_has_session`), que antecipava o token por causa das métricas, ao custo de deixar a tela em branco ~2 s. **O enforce não deve cobrir o Authentication** (já era a recomendação); Firestore e AI Logic seguem recebendo o token (conferido: a troca do token responde 200 e as leituras do Firestore só começam depois dela).

**Verificação funcional depois da mudança (produção):** fluxo social 15/15; login por e-mail e senha + exclusão de conta 13/13; convite, cadastro novo, chat, mensalidade e ficha 39/39; sincronização offline 13/13; reCAPTCHA bloqueado ainda abre a tela. Testes do app 287, Worker 21.

## Atualização — Aluno isento (12/10/2026)
- **Antes:** a mensalidade 0 era aceita (decisão do PR 67), mas a tela a lia como valor padrão (`Number(0) || 120`): um aluno com 0 aparecia como R$ 120. Agora **isento** é um estado explícito: situação `exempt` **e** mensalidade 0, sempre juntas.
- **Interface (Financeiro):** badge "Isento"; sem "Marcar pago", "Cobrar" nem "Atrasado" e fora dos inadimplentes; botão **Marcar como isento (sem cobrança)** no modal de mensalidade (digitar 0 e salvar é recusado com aviso); **Voltar a cobrar** pede um valor positivo e devolve o aluno a "pendente"; filtro e total "Isentos"; aviso "N aluno(s) isento(s): fora do previsto e da cobrança"; o previsto, o a receber, a porcentagem e os inadimplentes só contam quem paga; Painel (receita prevista) e CSVs (financeiro e alunos) mostram "Isento". Cadastro antigo com mensalidade 0 sem situação também conta como isento.
- **Regras:** `feeStatusOk` no ramo do treinador vinculado — situação só `pending | paid | overdue | exempt`; `exempt` ⇔ mensalidade 0 sempre que um dos campos muda; isento não "paga" sem voltar a ter valor; o aluno não se isenta e outro treinador não mexe. 62 casos de regras.
- **Validado em produção** (treinador e alunos fictícios, 15 verificações; mais as 20 de escrita do treinador sem regressão): isentar, previsto de R$ 370 para R$ 250, sumiço dos inadimplentes, ausência das ações de cobrança, filtro, CSV, Marcar pago e Desfazer para quem paga, Painel, voltar a cobrar. Os dados de produção não tinham aluno com mensalidade 0 (nada a migrar).
- **Revisão (`revisor-diff`):** sem brecha de autorização. Corrigidos: cadastro antigo com 0 sem situação, fila de ação e rascunho de cobrança ignoram isento, `DEFAULT_FEE` num só lugar. Mantido: a movimentação do mês mostra "Isento" no aluno recém-isentado (a situação é o rótulo).
- **Futuro (sugestão):** separar `monthlyFee` de `billingStatus` (`pending | paid | exempt`) no modelo, em vez de acoplar o zero ao `exempt`; hoje o acoplamento mantém as regras simples.

## Atualização — chat do aluno em relacionamento novo (12/10/2026)
Treinador e alunos fictícios, produção, **22 de 22 verificações aprovadas** (dados removidos); regressões: exclusão de conta 13/13 e convite/chat/mensalidade/ficha 39/39.
- **Aluno abre o chat de um par novo:** sem erro, cabeçalho com o treinador, estado vazio claro ("Inicie a conversa"), conversa criada com os dois participantes (a correção das regras do PR 67 vale para os dois lados).
- **Mensagens:** a do aluno grava com o `senderId` dele e atualiza o último texto; HTML digitado (`<script>`) aparece como texto e não executa; campo limpo depois de enviar. O treinador vê a conversa e a mensagem, responde, e a resposta chega ao aluno **em tempo real**, na ordem certa.
- **Isolamento:** outro aluno do mesmo treinador, aluno sem treinador e anônimo recebem 403 (conversa e mensagens); o aluno não grava mensagem em nome do treinador. Aluno sem treinador vê o Coach IA e nenhuma conversa é criada.
- **Bug achado: o selo do reCAPTCHA cobria o botão "Enviar" do chat** no desktop (canto inferior direito; o clique do treinador caía no `iframe`). O selo agora fica oculto por CSS, com o aviso exigido pelo Google nas telas de entrar e cadastrar e na Política de Privacidade (novo item sobre o reCAPTCHA/App Check).
- **Achado de privacidade corrigido:** depois de **encerrar o vínculo**, o ex-treinador ainda podia ler e escrever na conversa antiga. Agora **ler** as mensagens só vale para o treinador **vinculado** (o aluno lê sempre: histórico e exclusão de conta) e **escrever** (mensagem ou atualização da conversa) só vale com o vínculo ativo, para os dois lados; a conversa antiga fica só para leitura do aluno. Verificado em produção: ex-treinador recebe 403 ao ler e ao escrever; a tela dele mostra "Conversa indisponível no momento (o vínculo pode ter sido encerrado)". **Limite:** a lista de conversas (`list`) não consegue conferir o vínculo por documento, então a linha da conversa (nome e último texto) continua aparecendo ao ex-treinador; só o conteúdo ficou protegido.
- **Observação:** o nome do aluno na lista do treinador vem do `displayName` da conta (Auth) no momento em que o chat é criado; contas de teste sem nome aparecem como "Aluno".
- **Revisão (`revisor-diff`) desta etapa:** corrigido o aluno poder escrever no chat do ex-treinador (agora escrita só com vínculo ativo; leitura do aluno preservada); aviso de conversa indisponível ficou genérico (a negação pode ter outra causa). **Aceitos:** a linha da conversa (último texto) segue visível ao ex-treinador na lista; cada mensagem custa 3 a 4 leituras de regras (dentro do limite de 10 por avaliação, mas pesa no plano gratuito). Exclusão de conta do aluno com chat segue funcionando (a ordem é apagar mensagens, depois o chat, depois o usuário).

## Correção — convite não criava para conta admin (12/10/2026)
- **Causa:** a regra de criação de `coachInvites` exigia o papel `coach`; a conta de quem usa o app como treinador aqui é **admin** (o admin atua como treinador em todo o restante: `isTrainerId` aceita os dois papéis). Resultado: "Não foi possível criar o convite." Os testes automatizados usaram um treinador de papel `coach`, por isso não pegaram.
- **Correção:** admin também cria o **próprio** convite (continua sem criar em nome de outro); o aluno pede o vínculo por convite de admin normalmente (testado nas regras: 65 casos); verificado em produção criando um convite pela interface com uma conta admin. A mensagem de erro agora diz quando é falta de permissão.
- **Lição para os próximos testes de treinador:** incluir também uma conta admin.

## Atualização — painel do aluno (12/10/2026)
O painel (`/dashboard`) foi desenhado quando havia pouca informação; agora há treinador, chat, amigos e estatísticas. Melhorias aplicadas e validadas em produção (8 verificações, conta fictícia):
1. **Meta semanal sincronizada (bug de consistência):** a meta do botão +/- vivia só no navegador, enquanto o treinador calcula a aderência com `users.weeklyGoal` e o ranking de amigos usa `publicProfiles.weeklyGoal`. Agora o valor vem do perfil e alterar grava nos dois (com atraso de 0,7 s para juntar cliques); em outro aparelho a meta aparece igual; quem só tinha a meta no navegador tem a cópia gravada uma única vez, e só depois de o perfil real ser lido (para não sobrescrever o que já estava gravado).
2. **Mensagem do treinador ainda não vista:** cartão no topo (nome, trecho da mensagem, leva ao chat) e ponto no atalho flutuante do chat; some ao abrir o chat.
3. **Novos recordes:** até 3 recordes de carga dos últimos 14 dias (exercício, carga, marca anterior, quando), a partir do histórico já carregado; só conta quando havia marca anterior.
4. **Amigos e ranking com a semana:** com amigos participando, mostra "Você está em Xº entre N esta semana" e o pódio (3 primeiros); sem amigos, convida; carregado depois do conteúdo principal e sem derrubar a tela se falhar.
- Dados extras só leem o que o aluno já podia ler (`publicStats` de amigos ativos que participam, o próprio chat). Testes: 304 (recordes, meta sincronizada com migração, cartões); fluxo social 15/15 sem regressão.
- **Ideias não feitas:** próxima ficha sugerida por rotação, comparação de peso com a meta do objetivo, e resumo semanal (domingo) com variação de volume.

## Atualização — próxima ficha por rotação e ajustes do painel (14/10/2026)
- **Regra determinística** (`src/utils/rotation.js`, 20 testes): o grupo que gira é o **programa** da ficha atribuída (`packageId`, na ordem definida) ou, sem programa, as fichas "Treino A/B/C…" do mesmo treinador; ficha avulsa gira sozinha; **arquivadas e pausadas** (`status`, `archived`, `paused`) ficam de fora. A próxima é a seguinte à **última concluída** do grupo (volta à primeira no fim), **nunca repete a mesma** quando há outras e, sem histórico, começa pela atribuída. Sem ficha atribuída, prefere uma nunca feita e evita a última. Só conta treino concluído (check-in) já ocorrido; "ontem/hoje/há N dias" por **dia de calendário** no fuso do aparelho.
- **Na tela:** o cartão do dia explica a escolha ("Você concluiu Treino A ontem. A próxima da sequência (2 de 3) é Treino B."), com a frase da meta usando só os números reais ("Faltam 4 treinos para a meta (0 de 4)", "Meta cumprida: um treino a mais é bônus", "Hoje já treinou") e o rótulo "Próximo treino" quando já treinou hoje. Nada depende da IA; a IA (NVIDIA) só poderá reescrever esse texto depois, com os mesmos fatos, e a regra continua valendo se ela estiver fora do ar.
- **Cuidados da revisão atendidos:** (1) **meta atômica**: perfil e perfil social gravam no mesmo lote (`goalService`), e se divergirem o perfil social é **reconciliado** ao abrir o painel; (2) **recordes**: só séries concluídas e janela/rótulo por dia de calendário, não blocos de 24 h; (3) **cartão de amigos**: quem saiu do ranking não tem amigos nem placar lidos e vê o cartão genérico (testado no hook e em produção).
- **Validado em produção** (10 verificações): sem histórico; A concluída ontem às 23:50 vira "ontem" e sugere a B; B concluída hoje sugere a C com "Hoje já treinou"; ficha arquivada some e a rotação fecha em duas; aluno sem ficha atribuída recebe sugestão; perfil social divergente é alinhado; alterar a meta grava os dois; saiu do ranking, sem posição. Testes do app: 320.
- **Próximos (já desenhados, não feitos):** resumo semanal (o sistema calcula treinos, minutos, volume, sequência, meta, recordes e exercícios mais feitos; a IA só transforma em texto, mostrando sempre os números usados) e, para a V2 de academias, a camada organizacional com papéis dentro da academia (fica no roteiro, sem implementação ainda).

## Atualização — resumo semanal (13/10/2026)
- **Números determinísticos** (`src/utils/weeklySummary.js`, 12 testes): semana segunda a domingo no **fuso do aparelho** (o fuso aparece no cartão); só **treinos concluídos e únicos** (sem ID ou `clientId` repetido, sem treino de zero séries concluídas, sem datas futuras; o que ainda está na fila offline não entra até sincronizar); treinos, dias ativos, minutos, volume, séries, meta e quanto falta, sequência atual, recordes da semana, exercícios mais feitos e, **só em semana fechada**, a variação de volume contra a semana anterior (semana em andamento não é comparada com uma inteira). Testados domingo à noite, virada de mês (28/09 a 04/10) e estado vazio.
- **Cartão no painel** (`WeeklySummaryCard`): "Esta semana" e "Semana passada"; os números aparecem na tela e o texto usa os mesmos; estado vazio útil (meta + link para as fichas); rodapé com a semana, o fuso e a origem do texto ("Resumo automático" ou "Texto gerado por IA a partir dos números acima").
- **IA (NVIDIA) só reescreve:** `aiService.summarizeFacts` envia só números e nomes de exercício (nada de nome, e-mail, ID, peso ou medidas; conferido em produção e em teste), com prazo de 8 s e 260 tokens, e devolve `null` em qualquer falha (lenta, vazia, 429, 5xx, sem sessão, recurso desligado). A resposta **só vale se todo número dela existir nos fatos**; senão a tela usa o texto local. A decisão de meta, ficha e permissões nunca passa pela IA.
- **Sem regeneração à toa:** snapshot em `weeklySummaries/{uid}_{semana}` (só o dono lê e grava; texto até 800 caracteres): com os mesmos números reaproveita o texto; números novos regeneram; depois de uma falha a IA não é chamada de novo para os mesmos números por 6 h; semana sem treinos nunca chama a IA; semana fechada sem IA guarda o resumo local. A exclusão de conta apaga os resumos. Regras: 66 casos.
- **Validado em produção** (19 verificações, conta fictícia): duplicado e treino sem séries não contam; texto igual aos números da tela; no máximo uma chamada à IA na primeira abertura e nenhuma ao reabrir; IA em 502 ou sem responder não atrasa nem quebra a tela; sem treinos; fila offline fora da conta; semana passada com comparação; **com o proxy simulado**: texto válido aparece e vira snapshot, é reaproveitado, números novos regeneram, números inventados são recusados. Testes do app: 352.
- **Achado:** o proxy da NVIDIA respondeu **502 (404 no provedor) em todos os modelos** durante estes testes (levou ~17 s). O resumo e o Coach IA têm fallback (local e Gemini), mas vale conferir a chave e os modelos disponíveis; por isso o caminho de sucesso da IA real **não foi exercitado** em produção, só com resposta simulada.
- **Dívida técnica registrada (rotação):** o fallback por nome "Treino A/B/C" quebra se a ficha for renomeada; evoluir para `programId` e `rotationOrder` explícitos na ficha.

## Atualização — verificação do uso da NVIDIA (13/10/2026)
- **Desenho conferido** contra o uso de referência (NIM `integrate.api.nvidia.com/v1`, chave só no servidor como secret do Worker, `nemotron-3-super-120b-a12b` na frente e `gpt-oss-20b` de reserva, troca por `NVIDIA_MODEL`, fallback sem IA): igual. A chave não está no bundle.
- **Causa do 502 do resumo semanal (erro nosso):** (1) o resumo pedia só 260 tokens e o `nemotron-3-super`, modelo de raciocínio, gasta o orçamento pensando e devolve conteúdo vazio (com 1200 tokens responde em 5 a 8 s); o problema já estava documentado em `docs/IA.md` e eu repeti; (2) a fila `auto` tinha sete modelos aposentados pela NVIDIA (404) antes do `gemma-4-31b-it`, e as 8 tentativas acabavam neles: quando os dois primeiros falhavam, o `auto` nunca chegava ao modelo vivo.
- **Correções:** resumo com 1200 tokens e prazo de 25 s (roda em segundo plano, a tela já está pronta); fila enxuta com 4 modelos vivos; o Worker repete **uma vez** o mesmo modelo com 4x os tokens (teto 2400) quando um modelo de raciocínio devolve vazio por tamanho (`finish_reason: length`). Worker: 25 testes.
- **Verificado em produção com a NVIDIA real:** pelo proxy, `auto` com `max_tokens` 260 respondeu em 1 a 1,5 s pelo `nemotron-3-super`; o resumo semanal gerou o texto pela IA em 5 a 8 s, passou na validação (todos os números existem nos fatos), foi gravado como snapshot de origem `ai` e apareceu como "Texto gerado por IA a partir dos números acima". Uma das execuções caiu no texto local porque a resposta não passou na validação (a IA é variável): é o comportamento desejado, com o texto local mostrando os mesmos números.
- **Pendências:** cota diária global (hoje só limites por minuto) e conferir periodicamente a lista de modelos (`node scripts/check-nvidia-models.mjs`).

## Atualização — desenho da V2 para academias (13/10/2026)
- Criado `docs/V2_ACADEMIAS.md` (sem código): organização (conta independente x academia, filial, membro), matriz de papéis, isolamento de dados (proprietário e admin **não** leem saúde por padrão; só o professor atribuído, com aceite do aluno; frequência por projeção mínima), entidades com IDs determinísticos (`academyMembers/{academyId}_{userId}`, `academyAssignments/{academyId}_{studentId}`), fluxos com auditoria no mesmo lote, fichas versionadas, financeiro operacional com isenção explícita, IA só sobre agregados, restrições do plano Spark e do limite de leituras por regra, roadmap V2.0 a V2.4 com critérios de aceite, riscos e **10 decisões em aberto** para o dono do produto.
- **Decisão de custo registrada (PR 75):** o limite atual por usuário e por IP contém abuso imediato, mas não o consumo diário total da IA; um teto diário global exigiria KV ou Durable Object e fica como decisão futura.

## Atualização — fundação da V2.0 academias (13/10/2026)
- **Entregue:** regras do Firestore (bloco "V2: ACADEMIAS") para academia, membros, convites, papéis, atribuição de professor com aceite do aluno, aderência mínima, fichas versionadas e auditoria no mesmo lote; serviço `src/services/academyService.js` (sem tela ainda).
- **Critério principal provado no emulador (`rules-test/academy.rules.test.js`, 32 casos):** cada papel da academia B (dono, admin, professor, recepção, aluno) não lê, não lista e não escreve nada da academia A; convite de uma academia não serve em outra; professor sem atribuição ativa aceita não lê; aderência só com consentimento; transferência corta o acesso do professor anterior. As 66 regras antigas continuam passando.
- **Decisões assumidas** registradas em `docs/V2_ACADEMIAS.md` seção 13, incluindo o desvio: a equipe lê o documento mínimo de aderência por aluno consentido enquanto não houver agregador (V2.1).
- **Pendências:** telas da V2.0; agregador no servidor (V2.1); revisão jurídica antes da V2.1; migração assistida de treinadores; faturamento operacional.

## Atualização — primeira entrega das telas da V2.0 (13/10/2026)
- **Telas:** `/academia` (criar academia; dono e admin criam, copiam e cancelam convites e veem os membros; sair da academia) e `/academia/convite/<id>` (mostra academia e papel; o aluno escolhe, sem marcação prévia, se compartilha a aderência; entra só ao clicar). Link "Minha academia" no perfil. Serviço com estado do convite e listagens. Sem gerenciar papéis, atribuir professor, fichas nem tela de auditoria ainda.
- **Aderência individual retirada do acesso da academia (decisão do dono):** `academyMemberStats` agora só é lido pelo próprio aluno (o campo `validUntil` revelaria a data do último treino); equipe e professor voltam a ler só com o agregador da V2.1. O painel mostra "Dados de aderência não compartilhados pelo aluno". Sair da academia apaga o documento no mesmo lote (regra exige).
- **Auditoria registrada:** criação, convites, entrada/saída, consentimento, papel. Auditoria de leitura não é prometida até existir servidor intermediário.
- **Verificação:** regras de academias 41 casos aprovados (sair sem apagar a aderência falha; equipe e professor não leem a aderência); testes do app 356 aprovados; build aprovado; **navegador com duas academias simultâneas, 16 verificações aprovadas** (criar, convite, aceitar com consentimento, isolamento entre donos A e B, cancelar convite, convite cancelado/inexistente, sair apagando a aderência, proprietário sem botão de sair), dados fictícios apagados.
- **Não executada:** deploy do app (apenas as regras foram publicadas); teste de revogação de consentimento pela tela (a tela de consentimento pós-entrada ainda não existe; coberto no emulador).
- **Bloqueadores antes de uso real por academias:** revisão jurídica/LGPD e política de privacidade com o consentimento; tela de revogação de consentimento; testes de exclusão de conta e saída; migração assistida dos treinadores atuais.

## Atualização — consentimento de aderência e revisão final do PR 78 (13/10/2026)
- **Tela de consentimento** no cartão da academia (aluno): status atual, texto exato do que seria compartilhado (só em dia, atrasado ou sem dados; nunca horários, datas, cargas, medidas, volume ou histórico), ativar e revogar com atualização imediata. Revogar apaga `academyMemberStats` no mesmo lote e grava `member.consent` com `detail` concedido/revogado (a regra amarra o `detail` ao valor gravado). O texto avisa que a exibição individual à academia só começa com o cálculo no servidor (V2.1).
- **Sair encerra o consentimento** (a regra exige `consent.adherence == false` na saída) e **entrar de novo pede nova decisão** (caixa desmarcada).
- **Achados do `revisor-diff` corrigidos:** apagar a aderência quando o documento não existe era negado (travaria sair e revogar para quem nunca publicou; agora a regra aceita pelo ID do próprio usuário); auditoria `member.consent` não pode mentir sobre o valor; equipe não reativa quem saiu (só convite); erro de leitura do convite não vira "não existe"; falha ao ler uma academia não derruba a lista; textos de consentimento e do painel não prometem mais que o código. **Aceitos:** `createdBy`/`auditId` visíveis a quem tem o link do convite (ID é o segredo); o login não guarda o retorno ao link do convite (o usuário reabre o link); limites de usos por papel só validados ao criar.
- **Verificação:** regras de academias 46 casos, regras antigas 66, app 356, build; navegador com duas academias simultâneas, 27 verificações aprovadas (aluno entra sem compartilhar, ativa, academia não lê, revoga, aderência apagada, vínculo e perfil intactos, auditoria x2, sair e reentrar com nova decisão, revogar e sair sem aderência publicada).

## Atualização — chat com nome desatualizado (13/10/2026)
- **Sintoma:** o treinador não "achava" o aluno vinculado no chat; só aparecia "Aluno Determinado".
- **Causa:** a conversa existia, mas o nome do outro participante é gravado em `chats.participantData` só na criação (aqui, um nome antigo de teste) e nunca atualizado; a lista e o cabeçalho mostravam esse nome velho.
- **Correção:** `useChat` mostra o perfil atual do outro participante (aluno vinculado em `users`, treinador em `publicCoachProfiles`), com cache e fallback para o nome gravado quando não há acesso. O documento do chat não é alterado. Teste de unidade (2) e verificação no navegador com a conta do treinador (lista e Alunos > Chat mostram "Marcelo Luciano Filho"), sem enviar mensagens.
- **Limite conhecido:** a busca "Buscar aluno" filtra só conversas existentes; para começar uma nova use Alunos > Chat.

## Atualização — chat do aluno caía no Coach IA (13/10/2026)
- **Sintoma:** o treinador via a conversa, mas o aluno vinculado só via "Treine com o Coach IA" e "Meu treinador: Treinador".
- **Causa:** o perfil público do treinador (`publicCoachProfiles/{uid}`) nunca foi criado para a conta admin. A sincronização lia o documento antes de gravar, e as regras negam a leitura de um perfil público que não existe; o erro era engolido e a gravação nunca acontecia. Sem o perfil, o chat do aluno achava que não havia treinador.
- **Correção:** `syncPublicCoachProfile` trata a leitura negada como "não existe" e cria o perfil; `getPublicCoach` devolve `null` em vez de falhar; o chat do aluno (página e widget) abre a conversa mesmo sem perfil público, usando um nome genérico. Testes: 4 novos; navegador: o app cria o perfil ao abrir como treinador e o aluno vê a conversa e a mensagem do treinador (sem enviar nada).

## Atualização — papéis e atribuição de professor (13/10/2026)
- **Telas** (`/academia`): dono/admin mudam o papel de membros abaixo deles (com confirmação), suspendem ou removem; propõem, transferem e encerram o professor responsável; o aluno vê a indicação e aceita ou recusa, e encerra o vínculo quando quiser; o professor vê a lista dos alunos que o aceitaram.
- **Regras:** o professor só lê a atribuição depois do aceite (consulta filtra `status == 'active'`); transferir volta a `pending` e corta o acesso do professor anterior na hora; o nome do professor vai em `teacherName` na atribuição (o aluno **não** lê o cadastro do professor, que tem `inviteId`); `member.updated` registra "papel,status" finais e a regra confere com o documento; `perms` só aceita `createTrainings` booleano; o proprietário não é alterado nem sai.
- **Achados do `revisor-diff` aceitos como limite conhecido:** professor suspenso e reativado (ou rebaixado e promovido de novo) recupera o acesso aos alunos que já o aceitaram, sem novo aceite, porque a atribuição fica `active`; recusar uma transferência encerra o vínculo (não volta ao professor anterior); `assignment.ended` não distingue recusa de encerramento na auditoria.
- **Verificação:** regras de academias 59 casos, regras antigas 66, app 362, build; navegador com duas academias simultâneas (15 verificações: papel, proposta, aceite, transferência, encerramento, suspensão, isolamento) e regressão do fluxo de convite/consentimento.

## Atualização — Coach IA "demorou além do normal" (13/10/2026)
- **Conferido:** rota `https://integrate.api.nvidia.com/v1/chat/completions` correta; o secret `NVIDIA_API_KEY` existe no Worker (`wrangler secret list` mostra só o nome) e a chave funciona; `auto`, nemotron-3-super, gpt-oss-20b e gemma-4-31b respondem em produção.
- **Causa:** o chat manda o histórico de treinos no prompt e pedia respostas longas (3 mil caracteres); sem streaming, cada modelo leva perto de 12 s, estourava o prazo por tentativa (12 s) e a fila inteira terminava em 504 aos 28 s.
- **Correção:** prompt pede no máximo 180 palavras (respostas de 3 a 5 s no teste real com contexto de histórico); prazo por tentativa 20 s e total 42 s no Worker, 46 s no app; 8 chamadas seguidas em produção: 8 respostas (uma levou 31 s, antes seria erro).
- **Modelos testados e não adotados:** `deepseek-ai/deepseek-v4.1-flash` e `z-ai/glm-5.3` estouraram 12 s no teste (a NVIDIA estava lenta no momento, até o gemma estourou); ficam como candidatos para novo teste com o prazo maior. O endpoint gratuito da NVIDIA é compartilhado e oscila; a fila `auto` e o fallback para o Gemini continuam como proteção.

## Atualização — mídia de todos os exercícios (13/10/2026)
- **Situação:** dos 51 exercícios da biblioteca, 5 não tinham imagem, 20 apontavam para GIFs hospedados no GitHub de terceiros e os 24 exercícios padrão do app usavam `via.placeholder.com` (serviço desativado).
- **Entrega:** os 51 exercícios da biblioteca e os 24 padrão agora têm foto (`public/exercicios/<slug>.jpg`) e GIF animado de 2 quadros, início e fim do movimento (`public/exercises/<slug>.gif`), hospedados no próprio app. `machineImage` passa a ser o GIF, `imageStill` a foto. Onde o banco não tem a máquina exata (Glúteo Máquina, Pullover Máquina, Elevação Lateral Máquina, Hip Thrust Máquina) usa-se o movimento equivalente; revisar com o treinador se preferir foto da máquina.
- **Licença (decisão registrada):** a fonte dos GIFs que o app usava (`hasaneyldrm/exercises-dataset`) distribui mídia da **Gym visual**, que o próprio repositório diz não ser livre ("clonar o repositório não é licença"). Por isso a nova mídia vem só do **Free Exercise DB (domínio público)** e os 20 links antigos foram substituídos. Se quiserem os GIFs de melhor qualidade da Gym visual, é preciso licença própria.
- **Scripts:** `scripts/midia-exercicios.py` (baixa e monta), `scripts/midia-exercicios-aplicar.cjs` (liga ao Firestore; simulação por padrão; backup dos campos antigos em `scripts/midia-exercicios-backup.json`).

## Atualização — gerador de treino por IA ignorava o grupo pedido (13/10/2026)
- **Sintoma:** pedido de treino de perna gerava braço e costas.
- **Causa:** o fallback local filtrava por rótulos como "Quadríceps" e "Glúteos", mas a biblioteca usa `pernas`, `perna`, `gluteo`, `braços`...; nenhum exercício batia, o filtro caía na biblioteca inteira e a ficha pegava os primeiros (braço e costas). No caminho da IA, o catálogo mandado ao modelo era a biblioteca toda e a resposta não era validada por grupo.
- **Correção:** grupos normalizados (`canonicalGroup`); a ficha escolhe só exercícios do foco (`pickForFocus`): pernas cobrem coxa, posterior, glúteo, panturrilha e adutores; focos com dois grupos dividem as vagas (por exemplo peito 60% e tríceps 40%); no máximo 2 exercícios do mesmo tipo enquanto houver opção; compostos primeiro. No caminho da IA o catálogo contém só o foco e a resposta é filtrada pelo mesmo conjunto (menos de 3 válidos cai no fallback local). O que o aluno escreveu no pedido ("perna", "costas"...) vale mais que o foco escolhido pelo modelo (`inferFocusFromPrompt`).
- **Disponibilidade de perna:** biblioteca com 13 exercícios de pernas (agachamento, afundo, hack, mesa e cadeira flexora, extensora, abdutora, adutora, hip thrust, glúteo, panturrilha em pé e sentado) mais os padrão (Leg Press, Agachamento Livre ou Hack); fichas prontas de perna existem 2 (misturadas com ombros). Sugestão: criar fichas de pernas completas na biblioteca de treinos.
- **Interface da IA (cuidado do dono):** a espera mostra progresso e o cancelamento aparece após 5 s; agora cancelar, estourar o prazo de 45 s ou fechar a tela **interrompe a chamada de verdade** e o estouro de prazo mostra o resumo local (calorias e macros do perfil) junto da mensagem. Teto de 42 s no Worker mantido; comparar p50/p95/429/5xx/vazios por modelo em várias janelas antes de mudar a fila.
- **Testes:** 6 novos (grupos, perna só com perna, costas/peito sem grupo errado, full body, inferência do pedido, fallback com biblioteca real).

## Atualização — fichas versionadas da academia, primeiro corte (13/10/2026)
- **Modelo:** `trainingSeries/{id}` guarda o RASCUNHO (`draft`) e `currentVersion` (0 = nunca publicada); `trainingVersions/{fichaId}_{n}` são as versões publicadas, imutáveis (sem update nem delete, nem sobrescrita); `academyAssigned/{academyId}_{alunoId}` guarda `seriesId`, `version` e `versionId` (uma ficha por aluno; atribuir de novo substitui a anterior).
- **Regras:** ficha nasce rascunho (não nasce publicada); editar altera só o rascunho; publicar exige que a versão nova seja **exatamente o rascunho** e suba `currentVersion` em 1 (rascunho vazio não publica); só rascunho nunca publicado pode ser excluído (ficha publicada, logo possivelmente em uso, não); atribuir só aceita versão existente (publicada) da mesma academia e com `versionId` coerente; o aluno só lê a versão atribuída a ele e nunca rascunhos; criar/editar/publicar/excluir: dono, admin e professor com `perms.createTrainings`; atribuir: equipe ou o professor responsável do aluno; aluno sem professor ativo recebe da equipe (`teacherId` vazio). Auditoria no mesmo lote para `training.created`, `training.updated`, `training.published`, `training.assigned` e `training.deleted`.
- **Telas:** `/academia/<id>/fichas` (equipe e professores): lista de fichas, editor de rascunho com busca na biblioteca (exercícios do Firestore mais os padrão), publicar versão, excluir rascunho, atribuir versão a aluno e "N alunos usam" por versão (equipe vê a academia toda; professor só os dele). O aluno vê "Minha ficha" na versão exata em `/academia`.
- **Padrão de produto:** editar uma ficha cria uma nova versão e não muda o treino já atribuído.
- **Verificação:** regras de academias 68 casos (12 novos de ficha com duas academias, professor sem permissão, aluno, ficha em uso, tentativa de alterar versão publicada), regras antigas 66, app 372, build; navegador com duas academias, 18 verificações (criar, editar, publicar, versão 2 sem mexer na atribuição, contagem, permissões, exclusão, isolamento).
- **Segundo corte (adiado):** aplicar em lote, comparação visual entre versões, duplicar, arquivar e migração automática de alunos. Ainda não há execução do treino da academia pelo aluno (hoje só visualização da ficha atribuída).
- **Achados do `revisor-diff` (fichas) corrigidos:** o aluno lia o documento da série (que carrega o rascunho): agora só equipe e professores leem a série e o aluno lê apenas a versão atribuída; a auditoria de ficha só é aceita de autores e amarrada à escrita real (`auditId` da série/atribuição, `del_<ficha>` só com a ficha removida no lote), então professor sem permissão não forja registro nem "queima" o ID de exclusão; a versão publicada também confere o rascunho nas próprias regras (defesa em profundidade); `updatedAt` validado.
- **Limite conhecido:** validar cada campo dos exercícios nas regras estoura o limite de 1000 expressões já com 8 exercícios. As regras validam lista de até **15 exercícios**, cada um um mapa com campos permitidos e nome de texto até 120; tamanhos dos demais campos ficam na tela e no tamanho máximo do documento (só autores escrevem). Se precisar de fichas maiores, o caminho é um servidor que valide (V2.1).
- **Também aceito:** `publishDraft` não usa transação (corridas falham com segurança nas regras e o usuário vê uma mensagem genérica); o rascunho idêntico à última versão pode, pela regra, ser republicado (a tela esconde o botão).

## Atualização — limite único de 20 exercícios por ficha (13/10/2026)
- Contrato único: tela (`MAX_EXERCISES` em `academyTrainingService.js`) e regras (`validExercises`, 20 posições) valem **20**. Um teste do app lê `firestore.rules` e falha se os dois divergirem; outro teste de regras publica e atribui uma ficha de 20 e recusa 21.
- Para caber em 20 no limite de 1000 expressões das regras, cada exercício é validado só como mapa com campos permitidos; tipo e tamanho de nome, séries, repetições e imagem ficam na tela (que agora trata o conteúdo de forma defensiva ao exibir) e no tamanho máximo do documento. Só autores escrevem.

## Atualização — execução da ficha versionada pelo aluno (13/10/2026)
- **Entrega:** em `/academia`, "Minha ficha" ganhou **Iniciar treino**. A execução reutiliza `/execution/:trainingId` com o ID `ac~<academyId>~<versionId>`: lê só a versão atribuída ao aluno (`academyAssigned.versionId`); o rascunho e versões mais novas são negados pelas regras. O check-in sai pelo fluxo normal (`saveCheckIn`, `clientId`, fila offline) com `academyId`, `versionId` e `source: 'academy'`; histórico, `userStats` e `publicStats` seguem iguais.
- **Comportamento definido:** nova versão publicada ou ficha arquivada **não** mudam a atribuição nem uma execução em andamento; se a ficha for trocada no meio do treino, quem começou termina a versão que começou (sessão salva); depois de reatribuída, o link da versão antiga deixa de abrir. Outra academia não abre a ficha (volta para `/academia`).
- **Verificação:** navegador, 9 verificações: versão 1 sem rascunho nem versão 2, nova versão e arquivamento sem efeito com sessão restaurada, check-in online com contador +1, check-in offline com fila e o **mesmo `clientId`** ao reconectar (1 só), isolamento entre academias e link antigo. Regras: aluno lê a versão atribuída após arquivamento, não lê a versão nova, a série nem a ficha de outra academia.
- **Ainda não:** a ficha atribuída não entra na rotação "próximo treino" do painel do aluno; arquivar ficha ainda não tem tela (a regra já preserva a leitura).

## Atualização — revisão visual da mídia dos exercícios (13/10/2026)
- **Conferido no navegador (capturas de tela):** editor de ficha da academia (miniaturas ao buscar e na lista), execução do treino (foto no cabeçalho e GIF em lista/foco), biblioteca de exercícios do treinador e aba Exercícios do painel. Todas as imagens locais carregam, 0 imagens quebradas.
- **Desempenho:** miniaturas e listas passaram a usar a **foto leve** (`/exercicios/<slug>.jpg`, ~20 KB) em vez do GIF (150 a 330 KB): sem isso, abrir a biblioteca puxaria ~9 MB de GIFs. O GIF só carrega na execução e no zoom (carregamento preguiçoso). A convenção `/exercises/<slug>.gif` ↔ `/exercicios/<slug>.jpg` fica em `src/utils/exerciseMedia.js` (testada); criei as fotos que faltavam para 4 GIFs antigos.
- **Editor de ficha da academia** agora mostra as miniaturas (antes não mostrava imagem).
- **Qualidade dos equivalentes de máquina:** `Glúteo Máquina` (ajoelhado no chão), `Pullover Máquina` (pulldown de braço estendido na polia), `Elevação Lateral Máquina` (com halteres) e `Hip Thrust Máquina` (com barra) **não mostram a máquina**: ficam marcados `mediaApprox` no banco, com o selo "Imagem de referência" no painel e na busca do editor. **Pendente: revisão de um treinador** antes de tratá-los como definitivos.
- **Créditos e licença:** Termos de Uso ganhou a seção "Créditos das imagens" (Free Exercise DB, domínio público). Os arquivos do Free Exercise DB não exigem atribuição (Unlicense); mantida por cortesia. O script de aplicação nunca sobrescreve `midia-exercicios-backup.json` (reaplicar não perde os valores originais).

## Atualização — modelos oficiais de pernas e composição de fichas por IA (13/10/2026)
- **Modelos oficiais globais:** coleção `trainingTemplates` (`scope: 'official'`), criada e mantida só pela conta admin (regras: escrita só do admin, leitura para qualquer usuário logado). Quatro modelos de pernas (`src/data/officialTemplates.json`, aplicados por `scripts/modelos-oficiais.cjs`): **Pernas A (quadríceps)**, **Pernas B (posterior e glúteos)**, **Pernas C (glúteos e estabilidade)** e **Pernas completas** (quadríceps, posterior, glúteos, adutores e panturrilhas). Dono, admin e professor com permissão da academia usam **Usar modelo oficial** em `/academia/<id>/fichas`: a cópia vira rascunho próprio e versionado (`sourceTemplateId`), editável e auditado; o modelo original não muda. A IA recebe os modelos só como referência (nome e IDs).
- **Catálogo normalizado:** `src/utils/workoutComposer.js` calcula para cada exercício `id`, `name`, `primaryGroup`, `subgroups`, `equipment`, `movementPattern`, `isCompound` e `difficulty`. A IA recebe só esses campos dos candidatos (sem imagem, descrição nem ID do Firestore), no máximo 24.
- **Fluxo:** pedido do aluno vira foco (perna, quadríceps, posterior, glúteos, panturrilhas, misto) -> filtro determinístico da biblioteca -> candidatos para a IA (NVIDIA primeiro quando o proxy está ativo, depois Gemini) -> resposta validada por ID (nada fora dos candidatos, sem repetidos) e por composição -> se falhar, montagem determinística. Regras de composição: pernas com pelo menos 70% de pernas, só pernas ou core; pelo menos 1 quadríceps, 1 posterior ou glúteo e, com 5 exercícios ou mais, panturrilha ou adutores; focos específicos (quadríceps, posterior, glúteos, panturrilhas) exigem a maioria do subgrupo; pedido misto divide explicitamente (6 exercícios = 4 de pernas e 2 de ombros) e informa a divisão. Biblioteca sem exercícios suficientes do grupo gera erro claro (`InsufficientExercisesError`), nunca ficha de outro grupo. Pedido sem grupo reconhecido usa o foco escolhido na tela. Novos focos na tela: Quadríceps, Posterior e Glúteos, Glúteos, Panturrilhas, Pernas + Ombros.
- **Teste real com a NVIDIA em produção** (biblioteca real): perna, quadríceps, posterior e glúteos voltaram com `fonte ia` (6 a 13 s) e composição válida; pernas + ombros foi recusado pela validação (sem posterior/glúteos na parte de pernas) e caiu na montagem local correta (4 de pernas e 2 de ombros).
- **Testes:** compositor (metadados, pedidos, 6 casos de IA inválida, IA fora do ar, misto, poucos exercícios, modelos oficiais dentro das regras) e gerador completo com a IA indisponível; regras: modelos só do admin, cópia independente do original.

## Atualização — chat do Coach IA monta a ficha pelo compositor (13/10/2026)
- **Achado no teste pela tela real (produção):** "Monte um treino de perna" no chat esperava 45 s e terminava sem ficha. Pedidos de ficha pulavam a NVIDIA e iam ao Gemini com funções, que não responde nesse modo. **Corrigido:** com a NVIDIA como principal, o pedido usa o compositor (filtro, IA, validação por ID e composição, fallback local), a ficha aparece na aba Treino e o chat lista os exercícios. Leva ~11 a 25 s com a IA e cai na montagem local se o proxy falhar.
- **Smoke test pela tela (produção, 4 de 4):** pedido de perna no chat com resposta exibida; Gerador com NVIDIA (HTTP 200) e exercícios todos da biblioteca; proxy forçado a 502 no Gerador e no chat: ficha válida montada localmente. Teste jest do caminho do chat com o proxy fora.

## Atualização — fichas da academia, segundo corte (13/10/2026)
- **Duplicar:** cria um rascunho novo (`sourceSeriesId`, mesma academia, nome "(cópia)"), sem atribuir ninguém e sem tocar na original; a tela mostra "Duplicada de X". Só quem pode criar ficha (dono, admin, professor com permissão).
- **Comparar versões** (`src/utils/trainingDiff.js`, função pura): exercícios adicionados e removidos, mudança de ordem (só o que realmente mudou de lugar, por maior subsequência comum), séries, repetições e descanso, nome e **descrição** (campo novo e opcional, até 300 caracteres, no rascunho e na versão), versão x rascunho, e a versão atribuída a cada aluno.
- **Arquivar e restaurar:** `status` `active`/`archived`, ambos auditados (`training.archived`, `training.restored`). Arquivada: não recebe novas atribuições (a regra de `academyAssigned` confere o status da série) e não se edita nem publica; **versões e atribuições existentes não mudam**, então quem usa continua treinando e o histórico fica. A tela avisa quantos alunos usam e lista "Arquivadas" em seção própria.
- **Aplicação em lote:** prévia por aluno (versão atual, nova versão, conflitos de troca de outra ficha, sem professor ativo, quem já usa a versão fica de fora), modos "só sem ficha", "versão anterior desta ficha", "todos" e "escolher", confirmação explícita quando há troca, resultado por aluno. Grava **um lote do Firestore por aluno** (atribuição + auditoria `training.assigned` com detalhe `lote <versão>`): o limite de 20 acessos a documentos por lote não comporta vários alunos de uma vez, e assim uma falha não derruba os demais. Antes de gravar relê as atribuições; se a do aluno mudou depois da prévia, ele é pulado como conflito. Professor só enxerga e atribui os próprios alunos; aluno sem professor ativo só pela equipe.
- **Execução em andamento:** o lote só troca a versão que o aluno abrirá da próxima vez; quem está treinando termina a versão que começou (sessão guardada) e o check-in leva o `versionId` original. Histórico não é tocado.
- **Revisão (`revisor-diff`):** sem escalada de privilégio, vazamento entre academias nem bypass de auditoria. Achado baixo aplicado: o ID de origem aceita só `[A-Za-z0-9_]`. Observação: a regra de atribuição está perto do limite de 10 acessos (testado no emulador, inclusive o caminho do professor); não acrescentar outro `get` ali.
- **Testes:** app 419, regras da academia 84 (duas academias, ficha arquivada em uso, aluno sem vínculo, lote parcial, duplicação por professor sem permissão, tentativa de alterar versão publicada), regras antigas 66; navegador 35 de 35 (duplicar, comparar, lote parcial com conflito, lote com treino em andamento, arquivar com alunos em uso e executar, restaurar, professor sem permissão, isolamento), repetido em produção.
- **Ainda não:** migração automática ao publicar versão nova (o lote "versão anterior" faz sob demanda), lote com resultado agregado em um único registro de auditoria (hoje há um registro por aluno), arquivar/duplicar fora da tela de fichas. Os quatro exercícios de máquina aproximados seguem aguardando revisão de um treinador e não devem ser usados como referência oficial até lá.

## Atualização — arquitetura do BohTreinar Gestão, Fase 0 (13/10/2026)
- Documento `docs/GESTAO_ARQUITETURA.md`: separação do produto de gestão (frontend e Worker próprios, Auth e Firestore compartilhados), contrato de identidade, matriz de papéis, matriz de coleções (mapeada às coleções atuais, sem renomear), contrato do Worker `/v1`, auditoria, privacidade, ambientes e segredos, plano de testes. **Sem código**; decisões da seção 11 aprovadas: híbrido com autoridade única por operação, workers.dev até o primeiro cliente pagante, projeto Firebase de homologação, frontend Vite, recepção só com nome e e-mail.

## Atualização — base do BohTreinar Gestão (13/10/2026)
- **Homologação:** projeto Firebase `bohtreinar-gestao-hml` criado, com app web registrado. **Pendente (manual, console):** habilitar a API do Cloud Firestore, criar o banco `(default)` em `southamerica-east1` e ativar o login por e-mail e Google; depois publicar as regras com `firebase deploy --only firestore:rules --project bohtreinar-gestao-hml`. A CLI não consegue habilitar a API sem o gcloud.
- **Worker empresarial** (`gestao-worker/`, `bohtreinar-academy-worker-hml`, publicado em `workers.dev`, **sem service account**): `GET /v1/health` (público), `GET /v1/me` (vínculos do usuário), `GET /v1/academies/:id` (membro ativo) e `GET /v1/academies/:id/members` (só dono e admin). Lê o Firestore pela REST com o **ID token do próprio usuário**, então as regras continuam valendo. Cadeia: origem, rate limit por IP, token, rate limit por usuário e por academia, vínculo real, academia ativa, papel. `academyId` só da URL (regex fechada, sem caminho arbitrário); corpo, query string e cabeçalhos nunca são autoridade. Contratos `{ok, data|error, requestId}` com códigos estáveis; kill switch `ADMIN_OPS_ENABLED` (escritas respondem 503; nenhuma rota escreve ainda).
- **Verificação de token compartilhada:** `worker/src/firebaseAuth.js` foi movido para `shared/firebaseAuth.js` e é usado pelos dois Workers (uma única cópia do código de segurança).
- **Frontend** (`gestao/`, Vite, build e testes próprios, `.env.example`; `.env.local` de homologação ignorado pelo git): login (e-mail e Google), lista de academias do usuário pela API, estados de carregamento, erro (com código do atendimento) e "sem academia"; aluno é orientado ao app. Deploy próprio previsto em `bohtreinar-gestao-hml` (assets).
- **Testes:** Worker da Gestão 16 (sem token, token inválido/malformado/expirado, usuário sem academia, vínculos com papéis diferentes, academia suspensa, vínculo inativo, isolamento A x B, papel insuficiente para professor/recepção/aluno, papel enviado pelo cliente ignorado, vínculo adulterado, caminhos inválidos, kill switch, CORS, rate limit, falha do banco sem vazamento), frontend 6, Worker do app 25 (inalterado), app 419. CI atualizado para rodar os testes e o build da Gestão.
- **Não executado:** teste ponta a ponta com login real (depende do passo manual acima); `wrangler dev` local não roda neste ambiente (libc), então o Worker foi validado por testes e por chamadas ao Worker publicado (health, sem token e token inválido).
- **Próximo:** primeira operação administrativa só depois de homologação pronta, service account própria de homologação e revisão de diff.
- **Revisão (`revisor-diff`) do Worker da Gestão:** sem bypass de autenticação ou autorização, caminho arbitrário ou vazamento em `/members`. Corrigido: limite da academia só para quem tem vínculo (um estranho não esgota o limite de outra), limite por IP sem brecha quando falta o cabeçalho, `/me` ignora vínculo com ID inválido e sinaliza `truncated`, `/health` sem o projeto, log de erro sem mensagem bruta, **JWKS atualizado uma vez por minuto quando o `kid` é desconhecido** (rotação de chaves, vale também para o Worker do app). Aceito por ora: token válido de usuário desabilitado vale até expirar (~1 h); antes de qualquer rota de escrita é preciso checar vínculo no banco, o que a cadeia já faz. A autorização depende de as regras impedirem o cliente de criar ou alterar o próprio vínculo, papel e status (coberto pelos 84 testes de regras da academia).

## Atualização — domínio da academia em Cloudflare D1 (14/10/2026)
- **Decisão (A):** academias, vínculos e papéis, convites, professor-aluno, fichas versionadas, atribuições, consentimento, aderência e auditoria passam para **Cloudflare D1**, com uma única autoridade de escrita (o Worker); o Firestore fica só com dados pessoais do aluno e o Auth segue compartilhado. O Worker da academia **não precisa de service account** (o D1 é binding). `docs/GESTAO_ARQUITETURA.md` foi reescrito (revisão 2), com contrato da API em dois escopos (gestão e aluno), plano de testes e plano de migração; o modelo híbrido anterior está superado.
- **Esquema** (`gestao-worker/migrations/0001_init.sql`, aplicado no D1 de homologação `bohtreinar-gestao-hml`): as garantias que eram regras do Firestore ficam no banco. Chaves compostas impedem cruzar academias (versão, professor e aluno de outra academia); gatilhos para versão e auditoria imutáveis, último dono protegido, ficha arquivada sem novas atribuições e sem edição, só aluno ativo recebe ficha, um professor responsável por vez, aderência só com consentimento e apagada ao revogar ou sair, convite com hash do código. **12 testes** (`test/schema.test.js`, `node:sqlite` com o mesmo SQL).
- **Estado do código:** o Worker publicado (PR 96) ainda lê vínculos do Firestore com o token do usuário; é a ponte até o passo 2 do plano (trocar a leitura pelo D1 e remover `firestore.js`). Nada do app do aluno foi alterado; as coleções de academia do Firestore seguem em uso até o corte.
- **Riscos assumidos:** perde-se a defesa das regras do Firestore (compensada por esquema no banco, testes por endpoint e `revisor-diff`); aderência passa a ser autodeclarada pelo app do aluno; o app do aluno passa a depender da API para os dados da academia, com cópia local da ficha para execução offline; migração dos dados existentes exige script com prévia e conferência (HELL GYM como validação).
- **HELL GYM apagada (14/10/2026), a pedido do dono (era academia de teste):** removidos 1 academia, 1 membro, 1 convite e 2 registros de auditoria; sem fichas, atribuições, estatísticas nem check-ins com `academyId`. O Firestore de produção não tem mais nenhuma academia, então a migração para o D1 não tem dado real a levar. A regra "nunca tocar na HELL GYM" dos testes não se aplica mais; os testes em produção continuam só com academias fictícias e limpeza ao final.

## Atualização — Worker da Gestão no D1 e esquema revisado (14/10/2026)
- **Esquema revisado** (`0001_init.sql`, D1 de homologação recriado vazio, id novo): nomes `academy_members`, `academy_consents` (tabela própria, com versão do texto e revogação), `academy_invites` (hash do código), `coach_assignments`, `training_templates`, `training_versions` (`content_hash`), `training_assignments` (`assignment_id`), `academy_adherence` (`source = client_report`), `academy_plans`, `academy_billing`, `academy_audit_log`, `idempotency_keys`. Revogar o consentimento, apagá-lo ou sair da academia apaga a aderência; consentimento só de aluno; cobrança só de aluno e com plano da mesma academia. 15 testes.
- **Worker** (`bohtreinar-academy-worker-hml`): agora lê e escreve no D1; sem credencial do Firestore; `firestore.js` removido. Novos: `GET /v1/academies` e `POST /v1/academies` (Idempotency-Key obrigatória; esquema fechado: `role`, `academyId`, `userId`, `createdBy` e qualquer campo extra são recusados; limite de 5 academias como dono; nome de exibição vem do token). Criar academia grava academia, dono, auditoria e chave de idempotência em **um batch**: teste força falha na auditoria e nada é gravado. Violações de gatilho do banco viram `409` sem a mensagem do banco. Testes: 34 no Worker (inclui os 15 do esquema), frontend 7.
- **Frontend:** lista as academias pela API e tem o formulário "Criar academia" (a chave de idempotência acompanha a tentativa, então repetir o envio não duplica).
- **Decisões fechadas nesta rodada:** aderência não é dado verificado (V2.0 sem aderência individual no painel; V2.1 `client_report`, sem uso financeiro ou punitivo); snapshot offline com `academyId, assignmentId, trainingVersionId, versionHash, exercises, downloadedAt`; sem dual-write permanente; sem migração (produção sem academias).
- **Pendente:** ativar login por e-mail/Google no projeto `bohtreinar-gestao-hml` para o teste ponta a ponta (o Firestore dele deixou de ser necessário); ensaio de restauração (Time Travel) em homologação; localização do D1 na revisão jurídica.
- **Revisão (`revisor-diff`) do Worker no D1 e do esquema, 12 achados, todos tratados** (migração `0002_hardening.sql`, aplicada em homologação): (1, alta) o limite de 5 academias como dono era check-then-insert e tinha corrida, agora é **gatilho do banco** (insert, promoção e reativação), com a checagem do Worker só para a mensagem; (2) mesma `Idempotency-Key` em paralelo devolve o resultado salvo em vez de 409; (3) violações mapeadas para 409 agora são registradas no log (sem o corpo) para não esconder bug; (4) códigos `immutable_identity`, `immutable_academy`, `version_mismatch`, `invalid_roles`, `role_in_use` mapeados; (5) papel de aluno e de professor conferidos também em UPDATE, identidade congelada em consentimento, cobrança, aderência e atribuições, vínculo professor-aluno exige aluno ativo e professor ativo da mesma academia, e aluno com registros não muda de papel; (6) versão nova só com o número que a ficha acabou de assumir e só em ficha ativa; (7) convenção testada: o Worker nunca usa `INSERT OR REPLACE`; (8) congelamento de identidade só quando o valor muda (UPSERT com o mesmo valor passa); (9) suspender não apaga consentimento (só sair ou ser removido); (10) falha do rate limit durável é registrada; (11) limite do corpo mede bytes e confere `Content-Length` antes de ler; (12) e-mail só é gravado se `email_verified`, e nunca é autoridade.
- **Testes:** Worker da Gestão 43 (28 de API e 15+ de esquema, mesmo SQL do D1 pelas duas migrações), frontend 7. Worker de homologação republicado e D1 com as migrações 0001 e 0002; health e token inválido conferidos no endpoint publicado.

## Atualização — fundação empresarial: convites, entrada, papéis, saída e auditoria (14/10/2026)
- **Worker** (homologação): `POST/GET /v1/academies/:id/invites` e `.../revoke`, `POST /v1/invites/preview` e `/accept` (código no **corpo**, nunca na URL), `POST /v1/academies/:id/members/:uid` (papel e status), `POST /v1/me/academies/:id/leave`, `GET /v1/academies/:id/audit`. Matriz em `src/policy.js` (admin não cria nem promove admin; recepção só convida aluno; ninguém altera o próprio vínculo; removido só volta pelo dono). O aceite usa um **portão** na primeira instrução do batch (convite válido, academia ativa, usuário sem vínculo diferente de "saiu") e as demais só gravam se o portão passou (`changes() = 1`); academia e papel vêm da linha do convite, não de parâmetros.
- **Revisão (`revisor-diff`), 9 achados, todos tratados:** (alta) suspenso podia sair e voltar por convite para escapar da suspensão: agora só sai quem está ativo; (média) mudança de papel/status é condicional ao papel e status lidos e ao ator ainda ativo, então alteração concorrente não é sobrescrita e ator suspenso no meio não conclui (409); quem volta depois de sair perde `can_create_trainings` e filial; revogar e sair devolvem conflito se nada mudou; código do convite fora da URL; recepção só vê convites de aluno e admin não vê convite de admin; sair continua funcionando com o kill switch ligado; formato de código inválido dá o mesmo erro de convite inexistente.
- **Testes:** Worker 62 (inclui corridas simuladas, matriz de papéis, isolamento entre 3 academias, convite esgotado/expirado/revogado/academia suspensa, suspenso x convite, auditoria), frontend 14. **No D1 real com tokens reais do Firebase: 20 de 20** (convite, aceite, último uso com 3 alunos disputando 2 vagas, suspender/reativar, admin sem poder sobre o dono, sair, único dono protegido, auditoria completa, isolamento). **No navegador (frontend publicado em homologação): 12 de 12** (criar academia, convite com link mostrado uma vez, link sem sessão leva ao login e volta ao convite, aceite, convite de 1 uso não vale de novo, suspender com confirmação, suspenso perde a lista, reativar, auditoria com nomes, sem erros de JavaScript).
- **Frontend:** telas da academia (Membros com ações conforme o papel e confirmação, Convites com link copiável e estado de cada convite, Auditoria em português), aceite de convite de equipe em `/convite/:código`. Convite de **aluno** não é aceito aqui: alunos entram pelo app BohTreinar (a troca do app do aluno para a API é a fase 4).
- **Dados de teste em homologação:** academias "ZZ ..." e usuários fictícios dos testes (os usuários do Auth são apagados ao final; as linhas do D1 ficam, porque a auditoria é imutável por desenho).
- **Pendente:** vínculo professor-aluno e consentimento (próxima fatia), edição dos dados da academia (`PATCH`), perfil/nome de exibição editável pelo usuário, auditoria de leitura (decisão anterior: não).

## Atualização — fundação completa do BohTreinar Gestão (14/10/2026)
- **Entregue (somente homologação):** esquema D1 v2 (migrações 0001 a 0004), Worker por domínio (academias, membros, convites, professor-aluno, consentimento, fichas versionadas, auditoria, `leave-all`), console com landing, painel, membros, convites, auditoria e professor-aluno, e integração do app do aluno por snapshot local atrás de `REACT_APP_ACADEMY_API`. Detalhes em `docs/GESTAO_FUNDACAO.md`.
- **Revisões (`revisor-diff`)** trataram: transferência de dono sem efeito, suspenso saindo e voltando, coach vendo aluno pendente, convite válido após criador rebaixado, sobras ao reentrar, coach sobrescrevendo ficha de admin, validação de `machineImage`, nome de exibição sem e-mail, limite por (academia, usuário), TTL da idempotência.
- **Achado só visível no D1 real:** `meta.changes` conta linhas de gatilhos; sair da academia com ficha atribuída virava `conflict`. Corrigido (`changed()` aceita 1 ou mais em chave primária) e confirmado no D1 de homologação.
- **Testes:** Worker 95; console 15; app do aluno 455 (69 suítes); API ponta a ponta com D1 e tokens reais 53/53; cliente real do app do aluno contra a API 22/22; interface 57/57; 6 viewports x ~11 telas 264/264 com axe WCAG 2.1 A/AA sem violações; Lighthouse mobile 98/100/100/50 (SEO por `noindex` intencional), desktop 100/100/100/50.
- **Backup:** exportação do D1 de homologação restaurada em D1 descartável com contagens e gatilhos idênticos.
- **Pendente:** revisão jurídica/LGPD; telas de alunos/fichas no console; teste do app do aluno no navegador com Firestore de homologação; revisão dos 4 exercícios aproximados por treinador.

## Atualização — ajustes finais do PR 97 (14/10/2026)
- **Documentação:** `docs/GESTAO_ARQUITETURA.md` reescrito para o estado construído (tabelas 0001 a 0004, papéis `coach`/`reception`, endpoints reais, `leave-all`, decisão de localização do D1); Firestore só aparece como dado pessoal do aluno.
- **Mistura Firestore/D1 bloqueada:** com `REACT_APP_ACADEMY_API` ligada, `/academia/:id/fichas` mostra "Módulo em implantação".
- **Firebase de homologação completo:** Firestore criado no projeto de homologação, regras publicadas, app do aluno compilado contra ele e testado no navegador: login, convite, aceite, professor, consentimento, ficha, offline por snapshot, saída e exclusão de conta, 15/15.
- **Produção:** `gestao-worker/wrangler.production.example.jsonc` (sem localhost, sem `-hml`, sem `workers.dev`, sem o D1 de homologação) com teste em `config.test.js`.
- **Auth de homologação conferido** por exportação: só a conta do dono; Firestore e D1 esvaziados ao final.
- **Status:** a Gestão é apresentada como fundação operacional (landing e docs).
- **Achado separado (PR 98):** o Coach IA ignorava "somente máquina" e apontava para uma aba inexistente; corrigido com filtro de equipamento e botão "Salvar em Meus treinos" na conversa.

## Atualização — smoke do Coach IA e publicação (15/10/2026)
- **PR 96 (Gestão) e PR 98 (Coach IA) mesclados em `main`.** Deploy do app feito (`make deploy`); a Gestão segue só em homologação e a API da academia fica desligada no app publicado (`REACT_APP_ACADEMY_API` vazia).
- **Smoke com conta fictícia em produção** (390 px; antes do merge com build local contra os serviços de produção, depois na URL publicada; conta e dados apagados pela exclusão de conta, login confirmado como recusado):
  - "Monte um treino full body somente com máquinas": só máquinas e polias, todos da biblioteca. NVIDIA: 6,6 s a 11,6 s (build local) e 8,7 s (publicado).
  - "Pernas só com máquinas, sem halteres": 10,1 s (publicado), só máquinas, salvo por "Salvar em Meus treinos", na lista, persistiu após recarregar e abriu na execução.
  - NVIDIA indisponível (requisição bloqueada): montagem local em 1,1 a 1,6 s, só máquinas, da biblioteca.
- **Dois achados do smoke, corrigidos antes do merge:** (1) "Pernas só com máquinas..." sem a palavra "treino" caía na conversa livre da NVIDIA (sem ficha nem botão de salvar): o pedido direto de grupo com restrição agora vira ficha; (2) com a NVIDIA fora do ar o gerador esperava o Gemini e o chat estourava os 45 s com texto genérico: com a NVIDIA como principal, a falha cai direto na montagem local.
- **Limites da biblioteca:** "somente halter" (3 exercícios) e "costas só máquinas" (2) são recusados com mensagem clara em vez de gerar ficha fora do pedido; a biblioteca precisa de mais exercícios por equipamento.
- **Não executado:** teste em aparelho físico (o smoke usou Chromium em 390 px).

## Atualização — telas de Alunos e Fichas na Gestão (15/10/2026)
- **Worker (migração 0005, 115 testes):** `GET .../students`; editar rascunho, detalhe, versões e comparação; duplicar; arquivar e restaurar; atribuição em lote com prévia (`dryRun`), idempotência e batch atômico; `PATCH .../members/:uid/permissions` (professor só cria fichas com permissão; antes não existia como concedê-la). A migração refaz a tabela de auditoria com as novas ações e a rotina de teste cobre cópia dos registros e imutabilidade.
- **Console:** páginas Alunos, Fichas e detalhe da ficha (versões, comparação), editor de rascunho, modal de atribuição (individual e lote, com prévia), ação de permissão em Membros, menu inferior com todas as seções e erro claro quando a URL é de uma academia que não é do usuário (antes caía na academia atual).
- **Regras confirmadas em teste:** arquivada não recebe atribuição nem edição; quem já tem a ficha continua; publicar não muda a ficha do aluno; troca só com "substituir"; professor não troca ficha atribuída por outra pessoa e só atribui a aluno com vínculo ativo; recepção só vê cadastro; academia B nunca vê A (alunos, fichas, versões, permissões, lote).
- **E2E Gestão para D1 e app do aluno (homologação, 40/40):** criar, editar, publicar v1 e v2, comparar, duplicar, arquivar, restaurar, atribuir individual e em lote, publicar v3 (aluno continua na v2 e aparece "desatualizada"), app do aluno em 390 px mostra a v2 e abre na execução, papéis (recepção, professor com e sem permissão), isolamento entre duas academias e auditoria.
- **Validação visual:** 5 viewports x 3 papéis x telas e modais, axe WCAG 2.1 A/AA sem violações, sem rolagem horizontal, navegação correta; modo escuro em 390 px também sem violações: 204/204.
- **Achados corrigidos no caminho:** build do console com `VITE_API_URL` de desenvolvimento publicado por engano (conferido no E2E; o build de homologação passa a ser sempre com a URL do Worker de homologação); sem API para conceder a permissão de criar fichas; URL de outra academia mostrava a academia atual.
- **Limitações:** exercícios são texto livre (sem a biblioteca do app); `REACT_APP_ACADEMY_API` segue desligada no app público; homologação apenas.
- **Revisão (`revisor-diff`) das telas de Alunos e Fichas, tratada:** professor lia e copiava o rascunho de fichas de outras pessoas (agora só o publicado; rascunho alheio sem versão não aparece; duplicar só a própria); o lote podia gravar a chave de idempotência mesmo se uma corrida zerasse uma atribuição (agora cada atribuição tem guarda que desfaz o lote inteiro, e o vínculo do professor é revalidado na escrita); atribuição individual não conferia ficha arquivada nem papel do alvo; a prévia revelava nome de quem não é aluno ativo ou não é do professor; edição concorrente do rascunho agora compara também o conteúdo. Worker 115 testes; E2E 40/40 e matriz 204/204 repetidos depois da correção.
- **Limpeza da homologação:** Firestore e D1 recriados vazios, Auth só com a conta do dono. Backup do D1 exportado antes de recriar.

## Atualização — produção fechada da Gestão (16/10/2026)
- Criados em produção (workers.dev, sem divulgação): D1 `bohtreinar-gestao` com as migrações 0001 a 0005, Worker `bohtreinar-academy-worker` e console `bohtreinar-gestao`; domínio do console adicionado aos autorizados do Firebase Auth do projeto do app. Detalhes, operação e pendências em `docs/GESTAO_PRODUCAO.md`.
- Verificado: E2E da API 22/22, console 27/27 (axe e viewports), desligador de escritas e restauração por Time Travel ensaiados. Banco recriado vazio ao final.
- Achados: `wrangler deploy --var ADMIN_OPS_ENABLED:false` não aplicou o valor (usar o arquivo de configuração); o primeiro script de E2E não apagava as contas fictícias (8 contas removidas depois pela exportação do Auth; os scripts passaram a limpar).
- `REACT_APP_ACADEMY_API` segue desligada no app público; Gestão em produção sem uso por academias reais até o jurídico e o domínio.

## Atualização — exportar e encerrar academia, dados do titular (19/10/2026)
- **Worker (migração 0006, 121 testes):** `POST /v1/academies/:id/export` (só o dono; JSON sem código de convite nem e-mail, teto de 5000 linhas por lista com aviso, auditado), `POST /v1/academies/:id/close` (só o dono, nome digitado e `Idempotency-Key`; todos saem, inclusive donos, nomes, descrição e contato são apagados, e o banco trava a academia por gatilhos; repetir com a mesma chave devolve o resultado salvo) e `GET /v1/me/export` (dados do próprio titular, com o desligador ligado também). A migração refaz a auditoria com as ações novas, preservando registros e a imutabilidade.
- **Console:** seção "Dados e encerramento" na página da academia (só dono): exportação por download e encerramento com confirmação digitada e checkbox. **App do aluno:** a exportação de dados do Perfil passa a incluir o bloco das academias quando a integração está ligada.
- **Verificado em homologação:** 11/11 (exportação baixada pela tela com conteúdo conferido, administrador sem a seção, confirmação exigida, encerramento pela tela, academia indisponível, titular ainda exporta o histórico).
- **Decisão registrada:** auditoria e versões de ficha permanecem após o encerramento (identificadores e trabalho da academia); a revisão jurídica deve confirmar a retenção. Repetir o encerramento depois de concluído responde "academia indisponível" (o estado é o resultado).
- **Revisão (`revisor-diff`), tratada:** `/me/export` vazava uids de terceiros (agora só ação, tipo e data, com marca "sobre você"; `removed_by` vira "você" ou "outra pessoa"; avisos de corte, nome da academia por junção e vínculos como professor); encerramento deixava descrição, contato e donos (agora apagados/removidos; o último dono pode sair porque os gatilhos ignoram academia encerrada) e encerrada não conta no limite de 5 academias nem bloqueia `leave-all`; repetir o encerramento com a mesma chave devolve o resultado salvo; gatilhos extras contra reativar membro, vínculo, consentimento ou atribuição em academia encerrada; exportação sem `contactEmail`, com a própria exportação incluída e a auditoria cortada pelo lado antigo; `.gitignore` do arquivo de produção, de `.agents/` e de `skills-lock.json`.

## Gestão: financeiro (feat/gestao-financeiro)

- Resolvido: planos, matrículas (contratos), cobranças mensais com prévia, baixa manual, ajuste, isenção, resumo e exportação CSV no Worker (migração 0007) e no console (`/financeiro`). Valores em centavos; sem gateway de pagamento.
- Revisão independente tratada: CSV sem injeção de fórmula; `members_role_in_use` volta a considerar cobranças; recepção só baixa valor cheio e recente; baixa e ajuste concorrentes; encerrar contrato condicionado; totais ocultos à recepção; reverter só de aluno ativo; vencimento limitado a ±12 meses.
- Pendente: migrações 0006 e 0007 não aplicadas no D1 de produção; cobrança que chega ao aluno (Pix), geração automática e relatórios de retenção (ver `docs/ROADMAP_PRODUTO.md`); homologação segue com revisão LGPD e domínio.

## Atualização — Meus treinos, importação por PDF e cardio (19/10/2026)
- **Achado:** o pedido "treino aeróbico de bicicleta e esteira" voltava uma ficha de musculação de corpo todo: o chat fixava o foco em Full Body e a biblioteca não tem cardio. Agora pedidos aeróbicos (esteira, bicicleta, elíptico, remo) geram uma ficha por regras (aquecimento, blocos, volta à calma, esforço de 1 a 10), sem IA e sem rótulo de "IA indisponível".
- **Treino pessoal do aluno:** `users/{uid}/myWorkouts` (privado, formato fechado, só o papel aluno grava). O catálogo `trainings` continua sendo a loja aberta a todos os logados. "Salvar em Meus treinos" do Coach IA agora grava no espaço privado (antes publicava na loja). Fichas de IA salvas antes na loja continuam lá; vale limpar depois.
- **Importar PDF:** o PDF é lido no aparelho (pdfjs-dist 3.11.174, sem scripts nem eval, até 5 MB e 12 páginas, assinatura `%PDF-` conferida) e não é guardado. Só o texto, sem links, e-mails, telefones e linhas com instrução à IA ou pedido de pagamento, vai à IA entre marcadores, tratado como dado. A resposta é validada (schema fechado, até 20 exercícios, números limitados, texto sem URL/HTML/contato) e o aluno revisa antes de salvar. Exercícios iguais aos da biblioteca ganham imagem e explicação.
- **Verificado:** 486 testes do app, 67 + 84 das regras no emulador (inclui o caso novo), extração de PDF real conferida em Node. Não executado: importação ponta a ponta no navegador contra a IA real e regras publicadas.
- **Para publicar:** regras primeiro (`make deploy-rules`), depois o app.

## Revisão do cadastro de exercícios (19/10/2026)
- **Achado:** a biblioteca guardava esteira, HIIT e prancha com repetições 0 ("não se aplica"). O editor do treinador transformava 0 em 10 e o aluno via "3 x 10" de esteira; a execução mostrava "Meta 3x 0"; a estimativa de tempo da ficha contava séries e descanso de cardio.
- **Correção:** modelo único de tipo (`kind`: musculação, por tempo, cardio) em `src/utils/exerciseKind.js`; em todos os tipos o campo `reps` guarda repetições, segundos ou minutos (fichas antigas continuam válidas). Biblioteca: esteira 25 min, HIIT 15 min, prancha 3 x 30 s. Ajustados: execução (cardio com um botão "Concluir N min", prancha sem carga), detalhe da ficha, editor do treinador (tipo por exercício, rótulos e padrões por tipo, modelo de séries não sobrescreve cardio), editor da biblioteca (tipo e validação), estimativa de tempo, "Meus treinos" e importação por PDF (a IA devolve `type`, `minutes` e `seconds`).
- **Filtro de dificuldade:** a biblioteca guarda "avancado" e as telas filtravam por "avançado"; agora a comparação ignora acento e caixa.
- **Pendente:** fichas da academia (Gestão) e o contrato compartilhado ainda só têm séries e repetições; exercícios com `reps` 0 que já existam no Firestore são lidos como padrão do tipo, sem migração de dados.
- **Verificado:** 492 testes do app; E2E com aluno fictício contra o Firebase e o proxy de IA de produção, 14/14 (importação de PDF com link, pedido de pagamento e instrução à IA; revisão; salvar em Meus treinos; privacidade 403 para outro aluno; abrir e executar; Coach IA devolvendo cardio). Contas e documentos fictícios apagados ao final.

## Equipamento explícito e "minha academia" (19/10/2026)
- Cada exercício da biblioteca embutida passou a ter `equipment` explícito (`maquina`, `polia`, `halter`, `barra`, `livre`, `cardio`; lista quando há alternativas, como "Agachamento livre ou hack"). Correções feitas à mão sobre a dedução por nome: Elevação Lateral e Rosca Concentrada são de halter; Tríceps Barra (Pushdown) e Puxada Triângulo, de polia. Exercícios sem o campo (os do Firestore) continuam deduzidos pelo nome, e rótulos livres do editor ("Halteres", "Máquina") são lidos como o valor padrão. O editor da biblioteca (treinador) agora escolhe o equipamento em lista.
- Perfil do aluno: `gymEquipment` (até 6 valores; vazio = tem tudo). A tela Perfil ganhou "Equipamentos da minha academia". O gerador local, o gerador da IA e o chat do Coach IA só usam exercícios que o aluno consegue executar; o contexto enviado à IA informa os equipamentos e pede para sugerir só o que cabe neles. Poucos equipamentos para uma ficha (menos de 6 exercícios) dão mensagem clara em vez de ficha fora do que ele tem.
- **Para valer em produção:** publicar as regras antes do app (`make deploy-rules`): o campo `gymEquipment` só é aceito pelas regras novas.
- **Verificado:** 501 testes do app; regras no emulador 68 + 84 (caso novo de `gymEquipment`). **Não executado:** E2E no navegador do fluxo Perfil -> Coach IA, porque o Firebase de produção ainda não aceita o campo novo.
- **Pendente:** a importação por PDF não filtra por equipamento (o treino é do próprio aluno); normalizador único e auditoria do catálogo (item 2 do plano).

## Normalizador único e auditoria do catálogo (19/10/2026)
- **Normalizador:** `src/utils/exerciseCatalog.js` dá uma forma só ao exercício, venha da biblioteca embutida ou do Firestore: grupo (os 10 do catálogo; "braços" é resolvido para bíceps ou tríceps pelo nome), dificuldade (com ou sem acento), tipo, equipamento, mídia e repetições (número ou texto). A chave de nome (`catalogKey`) ignora acento, parênteses, preposições e plural de halter; o gerador usa essa chave para não oferecer duas vezes o mesmo exercício escrito de formas diferentes ("Supino Inclinado Halter" e "Supino Inclinado com Halteres").
- **Auditoria:** `npm run audit:catalog -- --remote exportacao.json --out docs/AUDITORIA_CATALOGO.md` (só lê; sem credenciais). A exportação é um JSON com a lista de exercícios do Firestore (e, opcionalmente, as fichas em `tr`). Erros fazem o comando sair com código 1; avisos e informações não. Relatório da primeira execução, sobre a leitura de produção de hoje: `docs/AUDITORIA_CATALOGO.md`.
- **Achados da primeira execução (catálogo final de 74 exercícios):** 0 erros; 10 exercícios do Firestore com grupo genérico "braços"; 4 com mídia aproximada; 2 duplicatas prováveis (Supino Reto Máquina e Supino Máquina; Puxada Aberta (Lat Pulldown) e Puxada Aberta Máquina); 8 exercícios cujo grupo ou dificuldade diverge entre as duas fontes (por exemplo Barra Fixa: intermediário na embutida e avançado no Firestore); 4 fichas de demonstração na loja (ids `demo_ex_*`, criadas por `scripts/seed-demo.cjs --apply`) e "TREINO COSTAS" com só 1 de 4 exercícios de costas.
- **Nada foi corrigido nos dados:** a limpeza (grupo, dificuldade, duplicatas e fichas) é o próximo passo e exige backup do Firestore e a confirmação, item por item.
- **Verificado:** 511 testes do app (inclui as regras de grupo, chave de nome, junção, duplicata provável e fichas).

## Limpeza do catálogo aplicada (19/10/2026)
- Backup do Firestore antes de escrever (`exercises`, `trainings`, `trainingPackages`), guardado fora do repositório. Escritas conferidas contra o valor anterior: 4 em exercícios (Canivete Alternado: dificuldade; Extensão Lombar: grupo; duas renomeações para juntar duplicatas sem quebrar a ficha que as usa) e 1 ficha renomeada ("Treino Peito e Costas").
- Biblioteca embutida alinhada ao Firestore (dificuldades, grupo do Crucifixo Inverso, "avançado" com acento). Auditoria depois da limpeza: 0 erros, 0 duplicatas prováveis, 0 divergências entre fontes, 0 títulos incoerentes; restam 4 mídias aproximadas, 1 descrição curta e as 4 fichas demo.
- **Fichas demo (20/10/2026):** os 8 alunos de demonstração foram migrados para fichas reais do pacote Split ABC (backup dos documentos antes) e as 4 fichas demo foram apagadas. Cuidado: `scripts/seed-demo.cjs --apply` recria essas fichas e os alunos de demonstração; não rodar contra produção.
- Aplicar a mudança de código exige publicar o app; os dados de produção já estão alinhados.

## Catálogo ampliado para 118 exercícios embutidos (20/10/2026)
- 48 exercícios novos (peso livre e peso do corpo 30, cardio 7, alongamento e mobilidade 11), cada um com foto e GIF do Free Exercise DB (domínio público) e texto em português conferido contra o movimento da imagem. Novo grupo `mobilidade` (por tempo, sem carga) no normalizador, no editor do treinador e na auditoria.
- Coach IA: "treino de alongamento" monta uma sequência de 8 alongamentos por tempo; o gerador de musculação não usa alongamento nem cardio.
- Auditoria: 0 erros; catálogo final de 120; restam 4 mídias aproximadas e a descrição curta de Glúteo Máquina.
- **Pendências:** panturrilha segue com só 3 exercícios; vídeos (nenhum exercício tem); revisão dos textos por um treinador; a mídia nova são 2 quadros (sem vídeo de execução).
- **Verificado:** 518 testes e build. **Não executado:** conferência no navegador das novas fichas (alongamento e cardio) e dos novos GIFs na versão publicada.

## Meus treinos: edição, foto e "Meus exercícios" (20/10/2026)
- **Editar o próprio treino:** botão de lápis em cada treino pessoal abre o editor já carregado (nome, exercícios, tipo, séries, repetições, descanso, anotação). Dá para subir e descer exercícios, remover, adicionar e trocar a foto. A edição substitui o documento mantendo a data de criação e a origem.
- **Anexo de imagem:** foto do treino (por exemplo a ficha em papel; aparece no card e no detalhe) e foto por exercício que não é da biblioteca (aparece na execução como imagem do exercício). A imagem é lida no aparelho, conferida pela assinatura real (JPEG, PNG ou WebP; SVG e qualquer outro tipo são recusados), redesenhada em canvas (descarta EXIF e conteúdo escondido) e gravada como JPEG pequeno em data URL no documento privado: treino até 130 mil caracteres (lado maior 720 px), exercício até 45 mil (420 px). Sem Firebase Storage (o projeto segue no plano gratuito). Ao exibir, só é aceito data URL JPEG dentro do limite; link externo nunca vira imagem.
- **Meus exercícios:** nova tela `/meus-exercicios` (botão ao lado de "Meu treino"): lista, cria, edita e apaga exercícios próprios (nome, grupo, equipamento, tipo, prescrição, anotação, foto). Eles aparecem na busca ao montar ou editar um treino com a marca "meu" e entram com a prescrição definida. Apagar um exercício não altera treinos que já o usam (cada treino guarda a sua cópia).
- **Regras do Firestore (novas, publicar antes do app):** `users/{uid}/myExercises` (privado, formato fechado, foto JPEG até 50 mil caracteres) e `photo` em `myWorkouts` (JPEG em data URL até 140 mil).
- **Também:** a sequência de alongamento do Coach IA agora começa pelos aquecimentos.
- **Verificado:** 535 testes do app; regras no emulador 69 + 84 (casos novos: foto SVG, link externo, foto grande, exercício de outro aluno, tipo e equipamento inválidos, campo extra); teste em navegador real contra o Firebase de produção para a parte de imagem (11/11: foto de 6,5 MB com EXIF vira JPEG de 420 px sem metadados, PNG com transparência aceito, executável e SVG recusados). **Não executado:** salvar foto e exercícios próprios no Firestore de produção (as regras novas ainda não estão publicadas).
- **Fora desta entrega:** exercícios do aluno ainda não entram no gerador por IA nem no filtro por equipamento do Coach IA.

## Rosca Scott Martelo e Tríceps Francês na Polia Unilateral (20/10/2026)
- Dois exercícios pedidos pelo aluno entraram na biblioteca embutida (ex119 e ex120) com GIF do Free Exercise DB: Rosca Scott Martelo com Halteres (bíceps, halter) e Tríceps Francês na Polia Unilateral (tríceps, polia; a imagem é a da versão com corda). Catálogo final: 122.
- A ficha de origem usa "1x 6 a 10 + DROP" (drop-set), carga e intervalo de 90 s. O app ainda não tem tipo de série; por enquanto o drop-set vai na anotação do exercício. Os tipos de série (aquecimento, drop-set, até a falha, superset) seguem como próximo item do roadmap.

## Exercícios próprios no gerador, abas "Meus treinos" e "Prontos", card dos meus treinos (20/10/2026)
- **Gerador:** os exercícios que o aluno criou (Meus exercícios) entram no gerador local, no gerador da IA e no chat do Coach IA. Regra: até 2 deles substituem um exercício da biblioteca do MESMO grupo e subgrupo, então a divisão do foco e o total não mudam; pedido de outro grupo não recebe os dele; o filtro "equipamentos da minha academia" vale também para eles; a foto e a anotação vão junto, e a ficha guarda o id `mine_`. Exercícios do aluno de cardio ainda não entram na ficha aeróbica por regras.
- **Abas da tela Fichas:** "Meus treinos" é o primeiro filtro e mostra só os treinos do aluno; "Prontos" e os filtros de dificuldade mostram só os treinos prontos da loja. Abre em "Meus treinos" quando o aluno já tem treino próprio e em "Prontos" quando não tem. A busca vale para a aba ativa.
- **Card dos meus treinos:** Editar e Apagar agora são botões com texto abaixo do card, na largura dele (antes eram ícones soltos sobre o card, e o do lápis ficava fora de enquadramento perto da seta). O selo "Recomendado" não aparece nos treinos próprios.
- **Verificado:** 539 testes; teste em navegador contra o Firebase e o proxy de IA de produção, 17/17 (abas, treinos prontos escondidos em "Meus treinos", caixas do card sem sobreposição, busca, filtro de dificuldade só entre os prontos, ficha de costas do Coach IA com os exercícios do aluno e salva com o id `mine_`).

## Tipos de série e superset (20/10/2026)
- **Tipos:** normal, aquecimento, drop-set e até a falha. A ficha pode trazer o plano por série (`setTypes`, uma entrada por série) e o aluno troca na hora tocando no chip da série (normal, aquecimento, drop, falha). O tipo escolhido é gravado em cada série do check-in (só quando não é normal, então o histórico antigo continua igual).
- **Aquecimento** fica fora do volume, das séries de trabalho, dos recordes (PR), do 1RM e dos gráficos (`validSets`). Continua registrado e aparece com a etiqueta "Aquec." no detalhe do treino.
- **Superset:** exercícios seguidos com a mesma letra (`superset: 'A'`) são feitos alternando: ao concluir a série do primeiro, o app vai direto ao próximo sem descanso; o descanso começa depois do último do grupo e o app volta ao primeiro para a série seguinte. A tela mostra o aviso do superset e o botão passa a dizer "sem descanso" no meio do grupo.
- **Editores:** em "Meu treino" e no editor de fichas do treinador, cada exercício de musculação tem o plano por série e a opção "Superset com o próximo exercício" (as letras são refeitas ao salvar). O detalhe da ficha mostra o resumo ("Aquec. + 1 normal + Drop") e "Superset A".
- **Importação por PDF:** a IA pode indicar `setTypes` por exercício (por exemplo "+ DROP" na última série), validado como os demais campos; cardio e prancha não têm tipo de série.
- **Verificado:** 555 testes; teste em navegador contra o Firebase de produção, 14/14: plano e superset gravados, banner, avanço sem descanso, retorno ao primeiro, troca de tipo pelo chip, check-in com os tipos e volume de 1540 kg excluindo o aquecimento de 20 x 12 (com ele seria 1780).
- **Fora desta entrega:** fichas da academia (Gestão) e o contrato compartilhado ainda não têm tipo de série nem superset; a ficha de pacote do treinador só os mostra se o treinador os definir no editor; gráficos antigos de séries já gravadas não mudam.

## Carga sugerida por dupla progressão e "Trocar exercício" (21/10/2026)
- **Carga sugerida (`src/utils/progression.js`):** a faixa de repetições da ficha ("8-12") é a régua. Se TODAS as séries de trabalho com a carga mais alta do último treino bateram o teto, sugere subir a carga (halteres 1 ou 2 kg, demais 2,5 kg) e voltar ao piso da faixa; se alguma ficou abaixo do teto, mantém a carga e pede uma repetição a mais; abaixo do piso, repete a carga. Aquecimento e drop-set não entram na conta. A execução mostra o texto da sugestão, os campos já trazem a carga e as repetições sugeridas como dica, e o botão "Usar" preenche as séries ainda vazias (aquecimento fica de fora; drop-set usa cerca de 70% da carga). Concluir uma série sem digitar preenche com a sugestão. Sem histórico do exercício, vale a dica antiga.
- **Trocar exercício (`src/utils/exerciseSwap.js`, `SwapExerciseModal`):** botão "Trocar exercício" em cada exercício durante o treino. Lista até 8 equivalentes do mesmo grupo e subgrupo (quadríceps não vira posterior), do mesmo tipo (cardio só troca por cardio), dentro dos equipamentos da academia do aluno, sem repetir exercício da ficha, com os exercícios próprios dele incluídos; o mais parecido (mesmo equipamento e movimento) vem primeiro. "Só hoje" troca nesta sessão (a sessão restaurada ao recarregar mantém a troca); "Na minha ficha" (treinos pessoais) troca também no treino salvo. Séries, repetições, descanso, tipos de série e superset continuam os da posição. Se já houve série concluída, pede confirmação.
- **Verificado:** 578 testes; teste em navegador contra o Firebase de produção, 9/9: histórico de 60 kg x 12, 12, 13 gerou "Subir para 62,5 kg" e "Usar" preencheu 62,5 kg e 8 repetições nas 3 séries; a lista de equivalentes de peito saiu correta; "Na minha ficha" gravou no treino pessoal e "Só hoje" não; a troca sobreviveu ao recarregamento.
- **Fora desta entrega:** a sugestão ainda não considera RPE; treinos de academia e fichas de treinador usam só "Só hoje" (não alteram a ficha do treinador).

## Resumo pós-treino (21/10/2026)
- **O que o aluno vê ao finalizar:** além do tempo, volume, séries e recordes de antes, a tela de conclusão traz a variação do volume contra a última vez do mesmo treino, um **texto de resumo**, **como foi cada exercício** (melhor série e tendência: mais carga, mais repetições, igual, abaixo ou novo) e **para o próximo treino** (carga sugerida calculada como se esta sessão já estivesse no histórico). A rolagem da tela passou a funcionar em telas pequenas.
- **Números primeiro, texto depois (`src/utils/sessionSummary.js`):** os fatos são calculados do que o aluno registrou (aquecimento fora do volume e das comparações; aderência às séries planejadas; itens não feitos; treinos da semana contra a meta). O texto local aparece na hora; a IA (proxy da NVIDIA) reescreve em segundo plano e o texto só vale se todo número dele existir nos fatos, sem emoji e com tamanho limitado; senão, fica o local. Para a IA vão só números e nomes de exercício (nada de nome, e-mail, peso corporal, medidas ou ids).
- **Histórico:** o texto final e a origem (`ai` ou `local`) são gravados no próprio check-in (`summary`) quando ele foi salvo online, e o detalhe do treino no Histórico mostra "Resumo do treino". Sem rede, o resumo local aparece na tela, mas não é gravado.
- **Verificado:** 589 testes; teste em navegador contra o Firebase e o proxy de IA de produção, 11/11 (resumo na tela, variação do volume, "+2,5 kg", sugestão para o próximo treino, texto da IA aceito numa execução e recusado por não bater com os números em outra, caindo no texto local, gravação no check-in e exibição no Histórico).
- **Fora desta entrega:** a comparação usa o último treino com o mesmo id ou nome, e limita o histórico aos 15 check-ins mais recentes já carregados na execução; o resumo semanal da Home continua separado.

## Semana inteira pela IA (21/10/2026)
- **Onde:** aba "Semana" do Coach IA (Fichas > Gerar com IA). O aluno escolhe de 2 a 6 dias (já vem a meta semanal do perfil), a duração (30 a 75 min) e se quer um dia de cardio e/ou de alongamento. Objetivo, nível e equipamentos da academia vêm do perfil, e os exercícios que o aluno criou entram na escolha.
- **Divisão (`src/utils/weekPlan.js`):** 2 dias: corpo todo A e B; 3 dias: corpo todo A, B e C para iniciante, ou peito e tríceps, costas e bíceps, pernas e ombros; 4 dias: peito e tríceps, costas e bíceps, pernas, ombros e abdômen; 5 dias: soma posterior e glúteos; 6 dias: peito, costas, quadríceps, ombros e abdômen, posterior e glúteos, corpo todo. Dias da semana espaçados (por exemplo seg, qua e sex); cardio e alongamento vão para dias livres.
- **Montagem (`src/services/weekPlanService.js`):** cada dia é uma ficha do gerador existente (IA com validação por ids e composição, plano local se ela falhar ou passar de 35 s), em paralelo. Dias do mesmo foco vêm em ondas e o seguinte evita os exercícios do anterior (desde que sobrem pelo menos 10 exercícios na biblioteca filtrada). Foco impossível com os equipamentos do aluno vira aviso e os demais dias seguem.
- **Resultado:** texto que explica a semana (local na hora; a IA reescreve e só vale se todo número existir nos fatos da semana e sem emoji), cada dia com exercícios e prescrição, "Salvar" por dia ou "Salvar a semana em Meus treinos" (cada dia vira um treino pessoal "Semana · Seg · Peito e Tríceps", origem IA, com o dia sugerido na descrição). Lista de Meus treinos agora recarrega depois de salvar pelo Coach IA.
- **Verificado:** 603 testes; teste em navegador contra o Firebase e o proxy de IA de produção, 10/10 (meta do perfil já marcada, 4 treinos + cardio + alongamento em 6 dias diferentes, só exercícios dos equipamentos marcados, exercício próprio incluído, sem repetição entre os dias, texto da IA aceito, 6 treinos salvos, privados e listados). A montagem levou 20 a 30 s com a IA real. Numa das execuções o teste acusou "Agachamento Livre ou Hack" como fora dos equipamentos: é falso alarme, o exercício aceita barra.
- **Fora desta entrega:** a semana salva é só um conjunto de treinos pessoais (não há calendário com lembrete por dia); montar de novo não apaga os dias já salvos.

## Hoje na sua semana (21/10/2026)
- Home: com uma semana montada pela IA salva (treinos pessoais "Semana · Seg · ..."), o card "Treino de hoje" passa a ser o da semana (a menos que o treinador tenha prescrito ficha): treino de hoje com botão "Começar", faixa dos 7 dias, "Atrasado" e, depois de treinar, "Treino de hoje feito" com o próximo (`src/utils/weekSchedule.js`, `WeekTodayCard`). Só leitura. Teste em navegador contra produção: 7/7. Detalhes das demais entregas do dia em `docs/ENTREGAS_2026-10-21.md`.

## Carga sugerida considera o esforço percebido (21/10/2026)
- `suggestNext` passa a ler o RPE (6 a 10) das séries de trabalho com a carga mais alta, quando marcado em todas: teto batido com RPE médio de 9,5 ou mais segura a carga; teto batido com RPE 7 ou menos sobe um salto dobrado; dentro da faixa com RPE 6 ou menos já sobe um salto. Sem RPE completo, a regra de dupla progressão não muda. O resumo pós-treino usa a mesma função, então o "próximo treino" também respeita o esforço.

## Duplicar e compartilhar treino pessoal (21/10/2026)
- Meus treinos: botões "Duplicar" e "Compartilhar" (`src/utils/workoutShare.js`). O compartilhamento é só texto (nome, exercícios, prescrição, plano de séries, anotação, supersets). `planSummary` agora agrupa séries iguais em sequência ("3 Drop"). Navegador contra produção: 6/6.

## Controles na tela de bloqueio (21/10/2026)
- `useWorkoutMediaSession` + botão de cadeado no cabeçalho da execução. Notificação de mídia com o exercício, a série e o treino; botões do sistema: próximo = concluir série, anterior = desfazer, play/pausa = pular descanso, avançar/voltar = trocar de exercício. Áudio silencioso gerado em código mantém a sessão; desligado por padrão (avisa que a música de outro app pode pausar). Espelha no Wear OS pelo sistema. Chromium: 14/14; sem teste em aparelho físico.

## Atualização — atividade entre amigos (21/10/2026)
- **Resolvido/novo:** feed de treinos concluídos entre amigos, opt-in, sem carga nem saúde (`socialPosts`, `likes`, `publicProfiles.shareWorkouts`). Regras testadas no emulador; exclusão de conta apaga posts e curtidas.
- **Pendente:** comentários (exigem moderação); teste em celular físico. (Denúncia e aviso de curtida entregues em 21/10; "Nº treino da semana" em 22/10.)- **Limites conhecidos (revisão das regras):** curtidas dadas em posts de outras pessoas não são apagadas na exclusão de conta se o autor apagar o post antes (só guardam o uid); quem curte é visível a amigos do autor; posts antigos reaparecem se o autor religar o compartilhamento; o post usa o id do check-in (reenvio não duplica).

## Atualização — limpeza do feed (21/10/2026)
- **Resolvido:** curtida nova guarda `likerId`; ao excluir a conta, as curtidas dadas a outras pessoas saem (consulta por grupo de coleções, só as próprias; regra e índice novos), mesmo se o autor já apagou o post. Ao desligar "Publicar meus treinos", os posts antigos e as curtidas deles são apagados.
- **Limite:** curtidas feitas antes desta versão não têm `likerId` e continuam só apagáveis pelo autor do post (em produção só existiram as de teste, já apagadas).

## Atualização — denúncia e curtidas no feed (21/10/2026)
- **Novo:** denúncia de publicação na aba Atividade (motivos fixos: spam, ofensivo, impróprio, outro; sem texto livre). O post sai do feed de quem denunciou na hora; o autor não sabe quem denunciou. Coleção `socialReports` (id `denunciante_post`, uma por pessoa e post); só o admin lê a fila (Painel → Social → Denúncias do feed) e remove o post ou dispensa. O admin passa a poder ler e apagar posts e curtidas para moderar.
- **Novo:** aviso de curtidas: a aba Atividade mostra "Curtidas novas" desde a última visita; com o app aberto, confere ao abrir e a cada 15 min (5 posts mais novos) e mostra um aviso na tela, ou notificação do sistema se o app estiver em segundo plano e a permissão concedida (toque abre Amigos → Atividade).
- **Limites:** sem servidor de push (plano Spark), não há aviso com o app fechado; a ocultação do post denunciado fica no aparelho (outro aparelho volta a mostrar até o admin decidir); a denúncia não suspende o autor automaticamente; dispensar marca a denúncia (a mesma pessoa não reabre); a fila mostra as 200 mais recentes; o admin pode ler e apagar posts e curtidas de qualquer aluno para moderar (ampliação de leitura intencional).

## Atualização — Web Push (22/10/2026)
- **Novo:** avisos com o app fechado (fim do descanso e curtidas) pelo Worker do app: rotas `/api/push/*`, Durable Object `PushBox` por usuário (inscrições e alarme), VAPID + RFC 8291 com WebCrypto, segredo `VAPID_PRIVATE_JWK` (wrangler secret), limite `PUSH_USER_LIMIT` 60/min. Curtida conferida no Firestore com o token de quem curtiu (as regras valem). Endpoints de push restritos aos serviços conhecidos (sem SSRF). Exclusão de conta apaga as inscrições.
- **Dado pessoal novo fora do Firestore:** o endereço de push de cada aparelho fica no Durable Object do usuário (Cloudflare). Entra na revisão de LGPD da política de privacidade.
- **Limites:** iPhone só recebe com o app instalado na tela inicial (iOS 16.4+); o lembrete de treino diário continua só ao abrir o app.

## Atualização — retirado o controle de mídia (cadeado) e topo do treino mais compacto (22/10/2026)
- **Teste do dono em celular:** o cartão de mídia não aparecia (com ou sem Spotify). Causa provável: o Chrome no Android só mostra o cartão de mídia para áudio com 5 s ou mais, e o silêncio usado tinha 1 s; mesmo corrigido, ele disputaria o lugar com a música do aluno. Como a notificação do treino (sino) e os avisos com o app fechado já fazem o mesmo papel sem conflito, o cadeado e `useWorkoutMediaSession` foram removidos.
- **Topo da execução:** sem o cadeado, sino só com ícone (cheio ligado, riscado desligado), Lista/Foco só com ícones no celular e "Sincronizado" só com o ícone; o nome do treino passa a caber. Cronômetro com horas a partir de 60 min (3:50:53 em vez de 230:53).

## Atualização — comentários no feed (22/10/2026)
- **Novo:** `socialPosts/{post}/comments` (autor, texto 1–280, data). Leitura e escrita para quem vê o post (autor ou amigo ativo de quem compartilha); a regra recusa links (http, www, domínios comuns, inclusive em outra linha); sem edição; apagam autor do comentário, dono do post e admin. Denúncia de comentário em `socialReports` (id `denunciante_post_comentário`). Grupo de coleções `comments` para a exclusão de conta (índice novo). Aviso ao dono do post por Web Push (`/api/push/comment`, conferido no Firestore, mesmo limite das curtidas).
- **Revisão:** data do comentário é a do servidor (`request.time`), lista os 50 mais recentes, bloqueio de link para qualquer domínio (`algo.xx`, com ou sem `/`), texto só com espaços recusado, avisos de comentário com cota própria (1 a cada 30 s, 20/h, uma vez por pessoa e post).
- **Limites:** o bloqueio de links desencoraja, não impede ("site ponto com" passa; a denúncia é a defesa); sem moderação automática de palavras; um amigo do autor vê comentários de outros amigos do autor mesmo sem ser amigo deles (aparece como "Amigo", o uid chega ao aparelho); sem limite de quantidade por pessoa; um comentário criado no instante em que o post é apagado pode ficar órfão (invisível, só o admin lê); a regra de grupo `comments` vale para qualquer subcoleção com esse nome.

## Atualização — app Android, fase 1 (23/10/2026)
- **Novo:** projeto `android/` (Capacitor 8) carregando o site publicado; login Google nativo (`src/services/nativeApp.js`); avisos pelo FCM (`worker/src/fcm.js`, segredo `FCM_SERVICE_ACCOUNT_JSON` da conta `bohtreinar-fcm`, papel único Firebase Cloud Messaging Admin). App Android registrado no Firebase com a SHA-1/SHA-256 da chave de envio.
- **Revisão (revisor-diff):** nenhum segredo no git; corrigidos aparelho apagado por erro de formato do FCM, links de aviso só internos, backup do Android desligado, ouvintes duplicados, logout depois de reiniciar o app, liberação do aparelho ao desligar, página "Sem conexão" ligada (`errorPath`).
- **Pendente:** teste no aparelho do dono; CSP no site antes da loja; minificação e senhas separadas antes da Play Store; SHA-1 da Play App Signing no Firebase quando publicar.

## Atualização — fotos do iPhone, importação de PDF e avisos do app (28/10/2026)
- **Fotos (perfil do aluno, do treinador e foto do shape):** antes recusavam arquivos acima de 500 KB (toda foto de iPhone). Agora a foto é redesenhada e reduzida no aparelho (`prepareImage`, tipos `avatar` 400 px e `progress` 1080 px, JPEG sem metadados) e aceita HEIC.
- **Importar treino de PDF:** a IA levava mais de 40 s para montar uma ficha de 3 treinos e o app desistia em 40 s (o servidor em 42 s): falhava em qualquer navegador, não só no iPhone. Respostas longas (max_tokens ≥ 2000) ganham 55 s por modelo e 85 s no total no Worker; o app espera até 90 s, avisa "pode levar até 1 minuto" e diferencia "demorou demais" de outros erros.
- **App Android:** a notificação do treino não dependia mais só da permissão: ficava presa ao cadastro no FCM; agora liga só com a permissão e o FCM roda à parte, guardando o motivo da falha. Diagnóstico em Perfil → Notificações (só no app): permissão, plugins, cadastro no FCM, último erro e botões de teste (notificação do treino com 15 s e aviso pelo servidor, rota `/api/push/test`).
- **Importar PDF (segunda parte):** mesmo com 85 s a IA não terminava fichas de 3 treinos (modelos gratuitos levam 47 a 55 s ou falham). Agora o app **lê no aparelho, sem IA**, as fichas no formato comum ("Supino reto - 4 x 10 - descanso 90s", cardio em minutos), em cerca de 1 s; a IA só entra nas partes em formato diferente, uma por treino, no máximo 2 ao mesmo tempo, 55 s cada e uma nova tentativa. PDF com vários treinos (A, B, C) vira uma lista para salvar todos de uma vez ou revisar um por um.


## Atualização — fundo fixo nos modais e semana de 5 a 7 dias (29/10/2026)
- **Modais rolando a página de trás (backlog 28/10, item 1):** nenhum modal travava o fundo (só o painel do Gestor usava `overflow: hidden`, que o iOS Safari ignora). Novo `src/hooks/useBodyScrollLock.js`: fixa o `body` no ponto atual (`position: fixed; top: -scrollY`), volta à mesma posição ao fechar e conta modais empilhados. Ligado em `Modal` (base de 15 telas), Coach IA, Meu treino, Trocar exercício, Descanso, Treino concluído, Novo exercício, `Drawer` do Gestor e o chat com o treinador no celular. CSS global com `overscroll-behavior: contain` em `[aria-modal]` e nas áreas roláveis dos diálogos.
- **IA não deixava treinar 5 dias (itens 2 e 17):** o plano do cadastro (`suggestPlan`) cortava o iniciante para 4 dias e mostrava "4 dias por semana" mesmo com 5 ou 6 escolhidos. Agora usa os dias escolhidos (2 a 7), mostra a mesma divisão que a "Semana pela IA" monta (ex.: 5 dias = ABCDE com Posterior e Glúteos) e um aviso de cargas leves para iniciante com 5 ou mais. Na Semana pela IA, a escolha vai até 7 (6 treinos + 1 dia de alongamento e mobilidade) e os dias acompanham a meta do perfil mesmo quando ela chega depois de abrir a aba.
- **Pendente:** conferir no iPhone (Safari e app instalado) a trava do fundo; não testado em aparelho real.

## Atualização — execução, app instalado, objetivos e exercícios combinados (29/10/2026)
- **Voltar ao início durante o treino (backlog 3):** botão com ícone de casa no cabeçalho da execução (44 px, `aria-label`) leva à Home sem finalizar; o rascunho (`useActiveWorkoutAutosave`) continua salvo e a Home já mostra o cartão "Treino em andamento" com Continuar (a barra "Treino Ativo" do celular também).
- **App instalado abre no app (backlog 4):** `start_url` passou a `/home?source=pwa` (vai à Home do papel ou ao login). Instalações antigas (`/?source=pwa`, que o iOS não atualiza), PWA em modo standalone e o app Android (Capacitor) também saem de `/` para a Home/login (`src/utils/appLaunch.js`); no navegador, `/` continua sendo a página de divulgação.
- **Objetivos do cadastro (backlog 5):** textos profissionais para Hipertrofia, Emagrecimento, Força e Resistência; "Força Pura" (Perfil) e rótulos do Coach de IA padronizados.
- **Bi-set/Tri-set/Circuito (backlog 21):** a interface rotula o grupo pelo tamanho (2, 3, 4+) na execução, nos detalhes do treino e no texto de compartilhar; o editor diz "Combinar com o próximo exercício". O campo salvo continua `superset` (letra).
- **Pendente:** conferir no aparelho (iOS e Android) a abertura pelo ícone com e sem login.

## Atualização — estilo do Perfil, página inicial e apresentação da Gestão (29/10/2026, backlog itens 6 a 8)
- **Perfil → Notificações e app:** cartão com `surface`, botões do app (`btnPrimary` em "Permitir notificações", `btnGhost` em "Testar notificação" e no diagnóstico Android), campo de horário com `inputCls` e caixas de seleção trocadas por interruptores (`src/components/ui/Switch.jsx`, o mesmo desenho do "Alternar tema", que agora usa o componente). "Salvar", "Sair", "Exportar" e "Excluir" seguem `btnPrimary`/`btnGhost`/`btnDanger`. Conferido nos temas claro e escuro (captura com HTML gerado do componente; a tela logada não foi aberta).
- **Página inicial (`/`):** a abertura não prende mais a rolagem (antes: seção de 340vh com a tela do aparelho trocando conforme a rolagem). Agora a abertura tem altura normal e as quatro telas aparecem numa seção "Telas do app" (2 colunas no celular, 4 no desktop), com as mesmas legendas e imagens. Saíram as animações ligadas à rolagem (`animation-timeline`) e as alturas mínimas de tela cheia das seções; ficam só entradas leves, uma vez, desligadas com `prefers-reduced-motion`.
- **Gestão (landing):** os prints de "O dia a dia, na tela" ficam dentro de um celular desenhado em CSS (moldura, ilha, botões laterais), sem imagem externa; responsivo.
- **Pendente:** conferir a tela do Perfil logada no aparelho do dono (claro e escuro).

## Atualização — mobilidade, alongamento antes do treino e busca de pessoas pelo nome (29/10/2026)
- **Mobilidade e alongamento (backlog 9 e 22):** lote 3 da biblioteca com 27 exercícios por tempo (torácica, escápula, ombro, quadril, tornozelo, punho e alongamento geral), foto e GIF do Free Exercise DB (`docs/BIBLIOTECA.md`). O Coach IA monta "treino de mobilidade de ombro/quadril/coluna/tornozelo/punho" com a sequência da região, e "mobilidade geral" com a de corpo inteiro; antes, citar o músculo ("mobilidade de ombro") virava treino de força de ombros. Editores de Meus treinos e de fichas do treinador ganharam "Adicionar alongamento geral antes do treino" (6 exercícios, 1 série, no início, sem duplicar). O editor rápido de fichas do painel admin (`TrainingEditor`) não ganhou o botão (só lista exercícios da coleção do Firestore).
- **Busca de pessoas pelo nome (backlog 10):** prefixo do nome e do @ entre perfis com `discoverable == true`; regra de `list` em `publicProfiles` exige o filtro e `limit <= 20`; o app esconde bloqueios. Risco de enumeração dos perfis descobríveis e bloqueio só no cliente avaliados em `docs/PLANO_SOCIAL.md`. Requer `make deploy-rules` (regras e dois índices compostos) antes do app.
- **Pendente:** revisão dos textos do lote 3 por um treinador; 90/90 de quadril sem imagem no Free Exercise DB; deploy das regras e índices.
- **Busca por nome (revisão):** o perfil público completo voltou a ser não listável; a busca usa o índice `profileSearch` (uid, nome, @), sem expor o código de amigo. Ver `docs/PLANO_SOCIAL.md`.


## Atualização — técnica por série e cluster set (29/10/2026, backlog itens 20 e 23)
- **Editor (Meu treino e fichas do treinador, `SetPlanEditor`):** uma linha por série com repetições próprias e menu de técnica: normal, aquecimento, isometria antes/depois (segundos), drop (cargas por drop, até 4), drop + falha, até a falha e cluster (blocos, até 6, com pausa em segundos). Cada linha mostra o rótulo ("10'' iso + 15", "15 + 5'' iso", "6-10 + drop 16/12", "4-4-4 (10 s)").
- **Modelo:** `setTypes` ganhou `cluster`; novo `setPlan` opcional por exercício (índice = série; itens com `reps`, `isoBeforeSec`, `isoAfterSec`, `drops: [{ load }]`, `failure`, `blocks`, `blockRestSec`), limpo por `normalizeSetPlan` ao salvar e ao abrir. Sem `setPlan`, tudo como antes (drop antigo continua com ~70% na série e sem partes).
- **Execução:** isometria aparece como instrução da série; drop planejado abre um campo de carga e reps por drop (carga planejada como dica); cluster mostra os blocos com uma pausa curta local (não dispara o descanso principal). O check-in grava `parts: [{ weight, reps }]` em drop/cluster (volume = soma das partes; `weight`/`reps` da série = 1ª parte, então recorde e 1RM usam só ela) e `isoSec` com a isometria planejada. Detalhes do treino mostram "20+16+12"; o texto de compartilhar lista a meta de cada série.
- **Regras:** `myWorkouts`, `trainings` e `checkIns` aceitam os campos novos sem mudança (não validam o conteúdo dos exercícios). As fichas versionadas da academia (`exOk`) não aceitam `setTypes` nem `setPlan`: pendente com o backend se for preciso levar a técnica para lá.
- **Pendente:** conferir no aparelho (390 px, claro e escuro) o editor com 10 séries e a execução do cluster; não aberto em navegador nesta entrega.

## Atualização — avaliação física e anamnese com consentimento (29/10/2026, itens 15/19)
- **Coleções novas:** `assessments` (tipos `instructor`, `bioimpedance`, `self`; peso, altura, perímetros, dobras `pollock3`/`pollock7`, % de gordura calculado, bioimpedância, observações até 500), `anamneses` (PAR-Q com 7 respostas booleanas, lesões, cirurgias, medicamentos, doenças, objetivos, rotina até 1000 caracteres, `version`; sem edição, cada envio é uma versão) e `healthConsents/{uid}` (`coachId`, `version`, `acceptedAt`). Campos fechados (`hasOnly`), tipos e intervalos nas regras.
- **Acesso:** aluno lê e apaga tudo o que é dele (inclusive avaliações do professor) e escreve as próprias; o professor vinculado (`linkedStudent`) lê e lança/edita/apaga só as avaliações `instructor` que criou, e só enquanto `healthConsents/{uid}.coachId` for ele. Admin não lê. Apagar o consentimento corta o acesso na hora; trocar ou encerrar o vínculo também (o consentimento antigo não vale para outro professor e é apagado ao encerrar pelo app).
- **App:** `/measurements/saude` (consentimento, anamnese, avaliações, comparação, impressão) e aba "Saúde" no detalhe do aluno para o professor ("o aluno ainda não autorizou" sem consentimento). Cálculo em `src/utils/bodyComposition.js`; serviço em `src/services/healthRecords.js`. Exclusão de conta e exportação de dados incluem as três coleções.
- **Testes:** 9 casos novos no emulador (aluno, professor com e sem consentimento, outro aluno, outro professor, admin, revogação, troca de vínculo, campos extras e tamanhos).
- **Pendente:** `make deploy-rules` antes do app; `measurements` (peso e fotos) continua visível ao professor vinculado e ao admin sem consentimento (revisar à parte); um consentimento deixado para um professor revive se o mesmo professor voltar a ser vinculado sem passar pelo app (ex.: vínculo encerrado pelo MCP/admin); avaliação postural com fotos e lembrete de reavaliação ficam para depois.

## Atualização — Home como central e Histórico com filtros e comparação (29/10/2026, backlog itens 11 e 12)
- **Home (11):** responde "o que eu faço agora?" em até 6 blocos: treino de hoje ou "Continuar" (botão grande), atalhos (Registrar medida, Falar com professor ou Vincular professor, Histórico, Ferramentas), recado do professor não lido, meta da semana compacta com a sequência (ajuste da meta sob demanda), amigos em uma linha e "Ver evolução" com o resumo do mês. Em 390 px o treino e os atalhos aparecem sem rolar. Os cartões de números (mês, recorde, nível, resumo da semana, recordes novos, frequência, volume e conquistas) foram para a Evolução (`/measurements`, seção "Seus treinos"); "Atividade recente" fica no Histórico e "Treinos para você" na aba Treinos. O botão flutuante do chat virou o atalho "Falar com professor" (com o ponto de mensagem nova); o Coach IA continua flutuante.
- **Histórico (12):** calendário com troca de mês; tocar num dia com treino filtra a lista daquele dia (tocar de novo limpa); filtros por ficha e por exercício somam com a busca e o período; "Limpar filtros". Excluir usa o diálogo de confirmação (antes era um toast com botões pequenos).
- **Detalhe da sessão:** "Repetir treino" abre a execução da mesma ficha só se ela ainda existir para o aluno (ficha pessoal, pública ou versão da academia atribuída); com outro treino em andamento pede confirmação antes de descartar. As cargas da última vez aparecem como já acontecia na execução. "Excluir" com confirmação (as regras já permitiam via `removeCheckIn`). Comparação com a sessão anterior da mesma ficha: volume total e, por exercício, variação de carga máxima e de volume (aquecimento fora; partes de drop/cluster somadas), exercícios novos e os que ficaram de fora. Atalho para a evolução de cada exercício.
- **Pendente:** "Treino livre" (não existe no app); editar sessão (carga, reps, data sem pontuar de novo); pendências de anamnese e avaliação dependem dos itens 15/19; salvar como rotina e CSV.


## Atualização — etapa de alongamento na execução e conquistas (29/10/2026, backlog itens 22 e 14)
- **Alongamento (22):** campo opcional `warmupStretch` (booleano) na ficha. Ligado nas fichas novas de Meus treinos (inclusive as salvas de um PDF) e nas criadas em "Nova ficha" pelo treinador; interruptor "Alongamento geral antes do treino" nos dois editores. Fichas antigas (sem o campo) não mostram a etapa; a cópia de ficha mantém a escolha da original. Na execução, a etapa "Alongamento geral (5 min)" (`WarmupStretchStep`) aparece antes do 1º exercício com a sequência de `buildWarmupStretch`, cronômetro por exercício, "Próximo" e "Pular"; não grava séries nem volume e não reaparece ao retomar um treino salvo. Se a ficha já começa com o alongamento do botão (`needsWarmupStep`), a etapa não aparece.
- **Conquistas e nível (14):** `src/utils/achievements.js` calcula na exibição, a partir dos check-ins: primeiro treino; 10, 50 e 100 treinos; 4 semanas seguidas na meta semanal; primeiro recorde de carga; 7 dias seguidos; nível Iniciante (0–9), Regular (10–49), Dedicado (50–99), Atleta (100+), com barra. Anti-abuso: 1 treino por dia; não contam treinos com menos de 10 min, menos de 3 séries de trabalho (aquecimento fora) ou registrados mais de 24 h depois da data; check-in antigo sem duração conta pelas séries. Consolidado: `computeStats`/`computeAchievements` de `useStudentHome` usam o mesmo cálculo (os níveis antigos Focado/Monstro/Lenda saíram). Evolução › Seus treinos mostra as obtidas (como ganhou e data) e as próximas (o que falta).
- **Pendente (backend):** a regra de `users/{uid}/myWorkouts` usa `keys().hasOnly([...])` e ainda não aceita `warmupStretch`; até incluir o campo (`warmupStretch` opcional, `is bool`), o app grava o treino pessoal sem ele (repete a gravação sem o campo em `permission-denied`), então a etapa só funciona nas fichas do treinador. `trainings` já aceita. Fichas da academia (versões) não têm o campo. Pontos gravados e "edição não pontua" ficam para o Worker. Conferência visual em 390 px (claro e escuro) não feita nesta entrega.

## Atualização — Minha ficha: ordem dos treinos e próximo da sequência (29/10/2026, backlog 24)
- **Montar a ficha:** em Fichas → Meus treinos, "Montar minha ficha" / "Organizar ficha" abre `RoutineModal`: o aluno adiciona treinos, reordena com setas (Subir/Descer, alvo de 44 px, com `aria-label`), tira da ficha e marca o dia da semana (opcional). "Meus treinos" passa a aparecer na ordem da ficha, com o selo "Treino A/B/C"; os de fora vêm depois.
- **Home:** sem ficha prescrita pelo treinador (`currentTrainingId`), o card "Minha ficha" mostra o próximo: treino marcado para hoje e ainda não feito; com todos os treinos com dia, o próximo dia marcado; senão o seguinte ao último concluído (check-in `my_<id>`), voltando ao A depois do último. Tem prioridade sobre a semana da IA ("Semana · Seg ..."), que continua valendo para quem não montou ficha. Cálculo em `src/utils/routine.js`.
- **Onde fica:** `users/{uid}/myWorkouts/minha-ficha` (ID fixo), no formato que as regras de `myWorkouts` já aceitam: `name: 'Minha ficha'`, `category: 'routine'`, `exercises: [{ workoutId, day }]` (até 30), `source: 'manual'`, `createdAt`, `updatedAt`. Ficha vazia apaga o documento (as regras exigem ao menos um item). `listMyWorkouts` o separa e ele nunca aparece como treino. Nenhuma regra mudou.
- **Pendente (dev-backend):** quando couber mexer nas regras, mover para um lugar próprio (ex.: `users/{uid}/routine/current` com `items` validado: `workoutId` string ≤ 40, `day` int 0..6 ou null, até 30 itens, só o dono lê e grava) e migrar o documento atual. Ferramentas que listam `myWorkouts` fora do app (MCP, exportação) devem ignorar o ID `minha-ficha`. Conferência visual no aparelho (390 px, claro e escuro) não realizada.

## Atualização — desafios em grupo, MVP (29/10/2026, backlog item 13)
- **O que entrou:** aba **Desafios** em Amigos: criar (nome até 40, 7 ou 30 dias, começa hoje), copiar código ou link (`/amigos?desafio=CÓDIGO`), entrar pelo código, placar de dias ativos (posição, nome, @, dias), sair; o criador encerra (placar congela) ou apaga. Até 50 pessoas. Contrato e limites em `docs/PLANO_SOCIAL.md` e no bloco "Desafios em grupo" de `firestore.rules`.
- **Placar:** cada membro publica os próprios dias com treino no período (calculados no aparelho a partir dos check-ins, no máximo 1 por dia) ao abrir a aba. As regras limitam o valor (só sobe, no máximo 1 por dia de calendário desde o último dia contado, dentro do período, nunca no futuro), **mas não é à prova de fraude**: um cliente adulterado consegue marcar dias sem treino dentro desses limites.
- **Exclusão de conta:** sai de todos os desafios e apaga os que criou (membros, código e desafio no mesmo lote), antes de apagar o perfil social.
- **Testes:** 5 testes de regras no emulador (criação, leitura membro x não membro, entrar por código, limite de 50, placar fora do limite, sair, encerrar, apagar) e testes de unidade/componente.
- **Pendente:** deploy de regras e do índice `members.uid` (grupo de coleções) com `make deploy-rules` **antes** do app (sem o índice a lista de desafios e a exclusão de conta falham); atualizar o placar também ao concluir o treino; denúncia de desafio (nome) e moderação pelo admin; limite de desafios criados por pessoa; reações/comentários no feed do desafio.

## Atualização — análise da avaliação física (30/10/2026)
- **O que entrou:** cartão **Análise da avaliação** em Evolução › Avaliações e anamnese (aluno, em segunda pessoa) e **Análise para o treino** na aba Saúde do aluno (professor, com consentimento). Texto calculado no aparelho (`src/utils/assessmentInsight.js`): peso, IMC com faixa, % de gordura (dobras ou bioimpedância), massa magra, cintura, relação cintura-quadril (referência OMS 0,90/0,85) e cintura-altura (0,50), variações desde a avaliação anterior e leitura da tendência (recomposição, perda de gordura, alta de gordura). Para o professor, soma os pontos do treino: PAR-Q com "sim" (liberação médica), lesões registradas, anamnese não preenchida.
- **IA:** botão "Analisar com IA" usa `aiService.summarizeFacts` (proxy NVIDIA do Worker). O texto da IA só aparece se cada número dele estiver nos fatos; senão fica o texto calculado. Nada é guardado.
- **Privacidade:** para a IA vão só números, sexo, idade, objetivo e dois sim/não (PAR-Q; lesões, só para o professor). Não vão nome, datas, observações nem os textos da anamnese (teste em `assessmentInsight.test.js`). O cartão de consentimento passou a citar a análise por IA; a versão do consentimento não mudou (quem já autorizou continua autorizado).
- **Sem mudança** em regras, índices ou Worker.

## Atualização — Meu perfil por categorias (30/10/2026)
- **Pedido do dono:** faltava trocar senha, conectar Google, ver a mensalidade com o treinador, e as opções estavam misturadas, sem categorias.
- **O que entrou:** o Perfil virou categorias com atalhos fixos no topo: Dados pessoais · Treino (meta, equipamentos, links para medidas, avaliações e Minha academia) · Meu treinador (cartão do vínculo + **mensalidade**: valor, Em dia/Pendente/Atrasada/Isento e data do último pagamento, lidos de `users/{uid}`) · **Conta e segurança** (`src/services/accountSecurity.js`: trocar senha com a atual; quem só usa Google cria senha após confirmar com o Google; link de redefinição; conectar Google por popup no site e pela conta do celular no app; desconectar só com senha criada) · Notificações · **Aparência e acessibilidade** (`src/utils/a11yPrefs.js`: tema, texto Padrão/Grande/Muito grande, reduzir animações, mais contraste; classes no `<html>` aplicadas antes do React) · Privacidade e dados · Sair.
- **Sem mudança** em regras, Worker ou dados: a mensalidade já era legível pelo próprio aluno; senha e Google usam só o Firebase Auth.
- **Validação:** 806 testes; navegador (390 px, Firestore de produção, conta fictícia apagada): troca de senha real confirmada com login pela nova, texto "Muito grande" sem rolagem lateral, preferências persistem após recarregar.
- **Pendente:** trocar o e-mail da conta (exige verificação do novo e-mail); conectar Google no app Android não foi testado em aparelho.
- **Processo:** `~/bohtreinar-ops/ship.sh` agora para se a pasta tiver mudanças não commitadas (o build levaria código não revisado para produção; isso quase aconteceu em 30/10 e foi interrompido antes do envio).

## Atualização — Perfil em abas e correções (30/10/2026)
- **Perfil em abas** (pedido do dono: as categorias empilhadas com atalhos redondos confundiam): barra de 4 abas presa ao cartão — **Perfil** (dados pessoais, medidas, meta, equipamentos, atalhos), **Treinador** (vínculo e mensalidade), **Conta** (e-mail, senha, Google, privacidade e dados, sair), **Ajustes** (notificações, aparência e acessibilidade). Abas acessíveis (setas, Home/End, `role=tab`), aba na URL (`/profile?aba=conta`); o link de convite (`?coach=`) abre na aba Treinador; ponto amarelo na aba Perfil quando há alteração não salva.
- **Exercício digitado com nome trocado** (achado do QA da onda 3): no editor de Meus treinos, "Adicionar o que digitei" casava com um exercício parecido da biblioteca ("Leg Press QA3" → "Leg Press") e gravava o nome da biblioteca, embora a tela mostrasse o digitado. Agora grava o nome que está na tela (com foto e explicação da biblioteca). Na revisão da importação por PDF, a tela já mostra o nome padronizado da biblioteca, que é o gravado.
- **Texto:** "Meta da semana cumprida: 1 de 1 treino" (singular).
- **Validação:** testes de regressão; navegador 16/16 (abas, URL, teclado, troca de senha real, acessibilidade), conta fictícia apagada.

## Atualização — Home, tela de treino e imagem para compartilhar (30/10/2026)
- **Home (treino de hoje):** sem ficha do treinador, quem tem treinos próprios recebe a sugestão entre "Meus treinos" (antes sugeria uma ficha do catálogo nunca feita, ignorando o A/B/C da pessoa). Com todos já feitos, a vez é do feito há mais tempo (`utils/rotation.js`), com o motivo escrito ("Seu último treino foi… Agora é a vez deste…"). Saiu a frase genérica "Foco total no progresso e consistência" e a repetição "Sugestão para começar: <nome>".
- **Tela de treino:** nome do exercício em até 2 linhas (era cortado), etiquetas quebram linha, ações numa linha só (Copiar, Trocar, Nota; o campo de nota abre ao tocar ou quando já há nota), carga sugerida com vírgula ("42,5"), "CONCLUIR SÉRIE #1 E DESCANSAR".
- **Imagem para compartilhar** (`utils/shareCard.js`): na conclusão do treino, imagem 1080×1920 desenhada no aparelho (canvas) com treino, data, tempo, volume, séries, exercícios, recordes e o que evoluiu, mais "Treine comigo no BohTreinar" e o endereço. Prévia na tela; no celular abre o menu de compartilhar com o arquivo (stories, WhatsApp); no computador baixa o PNG; sem canvas, cai no texto. Não leva nome, e-mail nem foto.
- **Texto:** "Falta 1 treino" no singular também na sugestão e no resumo semanal.

## Atualização — páginas públicas (app e Gestão) (30/10/2026)
- **Página do app:** prints de "Telas do app" refeitos com as telas atuais no tema escuro (início com o treino de hoje, treino em andamento, evolução, imagem para os stories), conta fictícia apagada depois. Os recursos deixaram de ser interruptores (metade aparecia "desligada", parecendo recurso desativado) e viraram faixas sempre abertas, incluindo amigos/desafios/conquistas e avaliação física. O passo a passo trocou a barra deslizante por 4 botões numerados (Conta, Ficha, Treino, Evolução).
- **Gestão:** o quadro de exemplo começa com parte do mês paga (Recebido R$ 390,00, atrasados e pendentes), em vez de R$ 0,00 e cinco botões iguais; recortes de tela largos ficam num cartão do tamanho do print (sem metade da moldura de celular vazia); o fim da página diz "Criar academia" em vez de só "Criar".

## Atualização — troca de e-mail, placar ao concluir e fila do treinador (30/10/2026)
- **Trocar e-mail** (Perfil › Conta): confirma a identidade (senha atual ou Google) e chama `verifyBeforeUpdateEmail`; o link vai para o NOVO e-mail e a troca só vale quando aberto (`/auth/action`, modo `verifyAndChangeEmail`). No login seguinte o perfil copia o novo e-mail (`users.email`, que o treinador vê). **Regra nova** `emailCopyOk`: o dono do perfil só grava `email` igual ao `request.auth.token.email` com `email_verified`; testes no emulador (aluno, treinador, token sem verificação, e-mail de outra pessoa, junto com campo proibido). Revisado pelo `revisor-diff` sem bloqueio.
- **Placar dos desafios ao concluir o treino:** `syncScoresAfterWorkout` atualiza os desafios em andamento logo após salvar o check-in (antes só ao abrir a aba). Falha não atrapalha o treino.
- **Treinador:** a fila de ação deixou de chamar de "aluno novo" quem já treina com treinos próprios ("Treina por conta própria, sem ficha sua"); no detalhe do aluno, "Sem ficha ativa" explica quantos treinos ele fez em 30 dias com treinos próprios.
