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
- **Pendente:** exclusão real de conta (exige regras), `phone` do aluno para WhatsApp direto, revisão jurídica, domínio próprio (atualizar sitemap/canonical), duplicação de check-ins na sincronização offline após falha parcial.
