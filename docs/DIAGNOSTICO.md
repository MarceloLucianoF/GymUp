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
