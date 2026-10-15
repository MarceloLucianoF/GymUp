# BohTreinar Gestão: fundação construída (homologação)

Estado entregue pela branch `feature/academy-console-foundation`. Complementa `docs/GESTAO_ARQUITETURA.md` (decisões e contratos). Nada disto foi publicado em produção.

## Peças

| Peça | Onde | Observação |
| --- | --- | --- |
| Console (Vite + React) | `gestao/` | landing pública, login/cadastro/recuperação, painel, perfil da academia, membros, convites, auditoria, professor-aluno |
| Worker da Gestão | `gestao-worker/` | única autoridade de escrita; sem service account |
| Contratos compartilhados | `shared/academy-contracts/`, `shared/firebaseAuth.js` | esquemas fechados, erros estáveis, rótulos pt-BR; verificação de token usada pelos dois Workers |
| Banco | Cloudflare D1 `bohtreinar-gestao-hml` | migrações em `gestao-worker/migrations/` |
| App do aluno | `src/services/academy*.js`, `src/pages/academy/*Api*.jsx` | atrás de `REACT_APP_ACADEMY_API`; sem a variável, as páginas antigas (Firestore) continuam |

## Migrações (D1)

1. `0001_core.sql`: `academies`, `academy_members`, `academy_invites` (só o hash do código), `academy_audit_log` (somente inserção, 21 ações), `idempotency_keys`.
2. `0002_coaching.sql`: `coach_assignments` (proposed, pending_student, active, rejected, revoked; um professor ativo por aluno) e `academy_consents` (versão do texto, revogação; revogado ao sair).
3. `0003_training.sql`: `training_templates`, `training_versions` (imutáveis, com `content_hash`), `training_assignments`.
4. `0004_business.sql`: `academy_plans`, `academy_billing` (reservadas; sem cobrança nesta fase) e proteção `role_in_use`.

12 tabelas, 32 gatilhos, 22 índices. Garantias no banco: último dono não sai, versões imutáveis, auditoria sem UPDATE/DELETE, limite de 5 academias por dono, consentimento revogado ao sair.

Observação do D1 real: `meta.changes` inclui linhas alteradas por gatilhos; por isso a conferência de escrita é "pelo menos 1" sobre chave primária (`changed()` em `src/db.js`). Isso só apareceu no teste com D1 de verdade.

## Papéis

owner, admin, coach, reception, student. Convites: dono cria para admin/coach/reception/student; admin para coach/reception/student; recepção só para aluno (apenas nome, sem CPF/telefone). Admin não altera dono nem outro admin. Aluno que sai fica `removed` com `removed_by` = próprio uid e pode voltar por convite; removido pela equipe não volta sozinho.

## Endpoints (`/v1`)

Público: `GET /health`. Autenticados (ID token do Firebase): `GET /me`; `GET|POST /academies`; `GET|PATCH /academies/:id`; `.../profile`, `.../dashboard`, `.../transfer-ownership`; `.../members` e `.../members/:uid/{role,suspend,reactivate,remove}`; `.../invites` (criar, listar, `/:id/revoke`); `POST /invites/preview` e `/invites/accept` (código no corpo); `.../audit` (cursor `before`, 50 por página); `.../coach-assignments` (propor, listar), `POST /coach-assignments/:id/{approve,accept,reject,revoke}`; `.../coach/students`, `.../coach/unassigned-students`; `.../trainings` (listar, criar), `/:id/publish`, `/:id/assign`; escopo do aluno: `GET /me/coach-assignments`, `GET|PUT /me/academies/:id/consent`, `GET /me/academies/:id/training`, `POST /me/academies/:id/leave`, `POST /me/leave-all`. O `academyId` vem só da URL. Escritas exigem `Idempotency-Key` (TTL 24 h); o código do convite nunca é guardado na idempotência (repetição devolve `code: null`).

## Consentimento

Compartilhar aderência com a academia é opt-in, por academia, revogável a qualquer momento; sair da academia revoga. Aderência é autodeclarada (`client_report`), não verificada, sem uso financeiro ou punitivo. Texto legal é preliminar e precisa de revisão jurídica/LGPD antes de produção.

## Ficha atribuída e snapshot offline

O Worker devolve `assignmentId`, `trainingVersionId`, `version`, `versionHash` e a ficha. O app guarda um snapshot local por usuário e academia (`academyup_ac_snapshot_<uid>_<academyId>`). O snapshot só serve para treinar sem rede: o servidor continua sendo a autoridade (vínculo inexistente ou inativo apaga o snapshot). Check-ins continuam no Firestore do aluno.

## Limites e proteções

IP 300/min (antes do token, folgado por NAT), usuário 120/min, par (academia, usuário) 120/min; corpo 8 KB; 5 academias por dono; 20 exercícios por ficha; convite até 500 usos e 30 dias; 50 itens por página; kill switch `ADMIN_OPS_ENABLED` (sair e `leave-all` continuam funcionando); CORS por lista de origens; contas anônimas bloqueadas; e-mail nunca é usado como identificador.

## Resultados em homologação

Ver `docs/DIAGNOSTICO.md` (seção da fundação). Resumo: Worker 95 testes; console 15; app do aluno 455 (69 suítes); API ponta a ponta com D1 e tokens reais 53/53; cliente real do app do aluno contra a API 22/22; interface 57/57; matriz 6 viewports 264/264 com axe sem violações; Lighthouse mobile 98/100/100 (SEO 50 por `noindex` intencional).

## Validação do app do aluno com Firestore de homologação (14/10/2026)

O projeto `bohtreinar-gestao-hml` agora tem Firestore (`southamerica-east1`) com as regras do app. O app do aluno foi compilado com `REACT_APP_FIREBASE_*` apontando para ele e `REACT_APP_ACADEMY_API` ligada, e testado no navegador (390x844, Playwright, usuários fictícios `zz.ui.*`): login, convite, aceite, professor pendente e aceite, consentimento (ativar e revogar), ficha atribuída, snapshot local, execução da ficha, leitura offline pelo snapshot, saída da academia, snapshot apagado ao sair e exclusão de conta pela tela. **15/15 aprovadas.** Ao final, Firestore e D1 de homologação foram esvaziados e o Auth ficou só com a conta do dono.

Config do app do aluno: `src/firebase/config.js` aceita `REACT_APP_FIREBASE_*` para builds de teste; sem elas vale a produção.

## Status do produto

Fundação operacional, não sistema empresarial completo: membros, convites, professores, consentimento, auditoria e ficha atribuída funcionam; telas de Alunos e Fichas do console ainda são "Em breve". Com a API ligada, a rota `/academia/:id/fichas` (ainda em Firestore) fica fechada com "Módulo em implantação".

## Limitações e riscos aceitos

- Telas de alunos e fichas do console aparecem como "Em breve"; a atribuição de ficha existe só na API.
- Professor vê nomes de alunos sem professor para propor vínculo (sem dados de saúde).
- `ALLOWED_ORIGINS` com localhost é só de homologação; o modelo de produção (`wrangler.production.example.jsonc`) não os tem e há teste que garante isso.
- D1 sem região confirmada na América do Sul; restauração ensaiada por exportação/importação (não por Time Travel). Confirmar a localização antes de vender.
- Ainda falta o E2E conjunto com telas de Alunos e Fichas no console.
- Landing sem vídeo. Modo escuro não passou por axe.
- Textos legais preliminares; revisão jurídica/LGPD pendente.

## Próximo passo recomendado

Revisão jurídica/LGPD dos textos e do consentimento; depois telas de alunos e fichas no console e habilitar `REACT_APP_ACADEMY_API` em um ambiente de teste do app do aluno com Firestore.
