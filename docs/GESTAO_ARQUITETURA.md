# BohTreinar Gestão: arquitetura e contratos (Fase 0)

Status: **revisão 2 (14/10/2026): o domínio da academia passa para Cloudflare D1** (decisão A). As seções 1, 2, 5, 6, 9 e 12 foram reescritas; a revisão 1 (modelo híbrido com Firestore e service account) está superada. Fecha os contratos antes do código, como pedido na Fase 0.
Complementa `docs/V2_ACADEMIAS.md` (desenho do produto e decisões da V2.0) e substitui a ideia de um painel da academia dentro do app do aluno.

## 1. Decisões assumidas

1. **Dois produtos.** App do aluno (BohTreinar, como hoje) e **BohTreinar Gestão** (frontend e Worker próprios). **Firebase Auth compartilhado** só para identidade: o mesmo login serve aos dois e os usuários não são duplicados.
2. **Domínio da academia em Cloudflare D1** (SQLite): academias, vínculos e papéis, convites, vínculo professor-aluno, fichas versionadas, atribuições, consentimento, aderência, auditoria, e depois planos e cobrança. **O Firestore guarda só dados pessoais do aluno**: treinos, check-ins, medidas, chat, preferências. O Worker da academia **não tem credencial do Firestore**.
3. A conta global (`users/{uid}`) nunca recebe papel empresarial. Papel e status vivem só na tabela `academy_members` do D1.
4. O app do aluno mantém só: Minha academia, convites e aceite, consentimento, ficha atribuída, execução e chat com o professor. Para os dados da academia, ele **chama a API do Worker** (escopo do próprio aluno), nunca o D1.
5. Academia paga pelo serviço; aluno não paga enquanto vinculado. Um professor responsável por vez. Sem gateway e sem catraca na primeira versão.
6. Painel empresarial **sem** peso, medidas, cargas, volume, horários de treino, histórico detalhado ou saúde. Aderência individual só com consentimento, e como resumo (seção 6.2).
7. Fichas versionadas são a fonte oficial. IA empresarial só lê dados agregados.
8. Revisão jurídica (LGPD) antes de qualquer uso comercial; migração de treinadores atuais opcional e assistida.

### Uma única autoridade de escrita: o Worker

Todo dado da academia é escrito **somente** pelo Worker; o cliente (Gestão e app do aluno) nunca escreve nele. Isso elimina a dupla autoridade e a necessidade de service account. A segurança tem quatro camadas:

1. **Worker:** endpoints explícitos (nunca caminho arbitrário), token validado, `uid` derivado do token, vínculo e papel lidos do D1 a cada chamada, `academyId` só da URL, campos permitidos por operação, idempotência, rate limit por usuário e por academia, kill switch (`ADMIN_OPS_ENABLED`).
2. **Banco (D1):** chaves compostas impedem cruzar academias (versão de outra academia, professor de outra academia, aluno de outra academia); gatilhos garantem versão imutável, auditoria imutável, último dono protegido, ficha arquivada sem novas atribuições, aderência só com consentimento e apagada ao revogar ou sair. Um bug no Worker não consegue desfazer essas garantias. Está em `gestao-worker/migrations/0001_init.sql` e é testado em `gestao-worker/test/schema.test.js` (15 testes, mesmo SQL do D1). Tabelas: `academies`, `academy_members`, `academy_consents`, `academy_invites`, `coach_assignments`, `training_templates`, `training_versions`, `training_assignments`, `academy_adherence`, `academy_plans`, `academy_billing`, `academy_audit_log`, `idempotency_keys`. Todas as tabelas empresariais têm `academy_id`; datas em UTC (ISO 8601 com Z); estados controlados por `CHECK`; convite guarda só o hash do código; nenhuma tabela guarda peso, medidas, cargas ou histórico detalhado de treino; sem exclusão física onde há auditoria (status `removed`/`left`, ficha `archived`).
3. **Transações:** cada operação e sua auditoria vão no mesmo `batch` do D1 (atômico). Isso remove o limite de 20 acessos do Firestore: o lote de atribuições vira uma transação.
4. **Revisão e testes:** `revisor-diff` em toda mudança do Worker e do esquema, testes com duas academias, kill switch e rotação de credenciais (seção 9).

Sem a camada de regras do Firestore, a barra de testes do Worker sobe: a matriz de papéis (seção 4) vira teste por endpoint e por papel, e **todo endpoint novo só entra com o teste de isolamento entre duas academias**.

## 2. Visão geral

```
                      Firebase Auth (só identidade, mesmo projeto)
                                  |
        +-------------------------+--------------------------+
        |                                                    |
App do aluno (Worker "bohtreinar")                Gestão (Worker "bohtreinar-gestao": assets)
  Firestore: treinos, check-ins, medidas, chat              |
  /api/nvidia (segredo NVIDIA)                              |
        |                                                   |
        +--------------> API da academia (Worker "bohtreinar-academy-worker") <----+
                           /v1/... escopo aluno e escopo gestão
                                  |
                           D1 (domínio da academia; sem credencial do Firestore)
```

Três Workers, três conjuntos de segredos e limites: `bohtreinar` (app e Coach IA), `bohtreinar-gestao` (só assets) e `bohtreinar-academy-worker` (API e D1). Revogar ou medir um não afeta os outros.

```
src/                      app do aluno (como hoje; chama a API para dados da academia)
gestao/                   frontend da gestão (Vite)
worker/                   Worker do app do aluno
gestao-worker/            Worker da API da academia + migrations/ (D1) + test/
shared/                   verificação de token e contratos; páginas do app do aluno nunca são copiadas
```

## 3. Contrato de identidade

- `users/{uid}` (Firestore): conta global do produto pessoal. `role` (`user`, `coach`, `admin`) não representa função em academia.
- Tabela `academy_members` (D1), chave `(academy_id, user_id)`: `role (owner|admin|teacher|reception|student)`, `status (active|suspended|removed|left)`, `display_name`, `email`, `can_create_trainings`, `branch_id`, datas. O consentimento mora em `academy_consents`. É a única fonte de papel.
- Um uid pode ter vínculos diferentes em academias diferentes. O Worker **sempre** resolve o papel lendo o vínculo da academia em questão; `role`, `userId` e `academyId` vindos do cliente nunca são autoridade.
- Dono, admin, professor e recepção usam a Gestão; o aluno usa o app do aluno. A mesma pessoa pode ter os dois acessos com o mesmo login.

## 4. Matriz de papéis (operações)

S = sim, N = não, P = só os próprios alunos/itens, C = só com `perms.createTrainings`.

| Operação | Dono | Admin | Professor | Recepção | Aluno |
|---|---|---|---|---|---|
| Criar academia | S (vira dono) | n/a | n/a | n/a | n/a |
| Editar dados da academia | S | S (campos permitidos) | N | N | N |
| Criar/revogar convite | S | S (sem criar admin) | N | S (só aluno) | N |
| Aceitar/recusar convite | n/a | n/a | n/a | n/a | S (o próprio) |
| Alterar papel / suspender / remover membro | S | S (abaixo de admin) | N | N | N |
| Sair da academia | S* | S | S | S | S |
| Remover o último dono | N | N | N | N | N |
| Atribuir/transferir professor | S | S | N | N | aceita |
| Encerrar vínculo professor-aluno | S | S | P | N | S |
| Criar/editar/publicar/duplicar/arquivar ficha | S | S | C | N | N |
| Atribuir ficha (um aluno) | S | S | P | N | N |
| Aplicar ficha em lote | S | S | P | N | N |
| Ver lista de alunos | S | S | P | cadastro | N |
| Ver peso, medidas, cargas, volume, horários | **N** | **N** | **N** (nesta versão) | **N** | S (os próprios) |
| Ver aderência individual (status) | N até a V2.1 | N até a V2.1 | P, com consentimento | N | S |
| Planos e mensalidades (V2.2) | S | S | N | S | N |
| Relatórios agregados | S | S | N | operacionais | N |
| Ver auditoria | S | S | N | N | N |

\* Dono só sai se houver outro dono; senão precisa transferir antes. O último dono nunca é removido nem rebaixado.

Pontos de atenção: hoje o professor **vê** nome do aluno e a ficha atribuída, mas não os dados de treino do aluno; "Acompanha treinos autorizados" fica para o agregador (V2.1) com consentimento. O Worker aplica a matriz em cada endpoint; o banco garante o último dono.

## 5. Dados: onde cada coisa mora

| Dado | Onde | Quem escreve | Observação |
|---|---|---|---|
| academias, vínculos/papéis, convites, professor-aluno, fichas, versões, atribuições, consentimento, auditoria, idempotência | **D1** | só o Worker | tabelas em `0001_init.sql` |
| aderência (resumo: status, treinos da semana, dias ativos, sequência) | **D1** | Worker, a pedido do próprio aluno | só com consentimento; apagada ao revogar ou sair (gatilho) |
| planos, mensalidades (V2.2), filiais (V2.4) | **D1** | só o Worker | tabelas futuras, mesma regra |
| treinos pessoais, check-ins, medidas, preferências, chat, execução | Firestore | o aluno, sob as regras | como hoje; o check-in da ficha da academia leva `academyId` e `versionId` só como referência |
| modelos oficiais globais (`trainingTemplates`) | Firestore | só o admin da plataforma | leitura por qualquer usuário logado; a Gestão copia para uma ficha da academia pela API |

As coleções de academia do Firestore (`academies`, `academyMembers`, `academyInvites`, `academyAssignments`, `trainingSeries`, `trainingVersions`, `academyAssigned`, `academyAuditLog`, `academyMemberStats`) **ficam congeladas** durante a migração e depois passam a `allow read, write: if false`. Toda tabela do D1 tem `academy_id`, e nenhuma consulta confia só em `uid`.

## 6. Contrato da API da academia (`/v1`)

Cada requisição, nesta ordem: (1) origem e método; (2) rate limit por IP, antes do token; (3) validar o Firebase ID token (assinatura, `aud`, `iss`, expiração); (4) `uid` = `sub`; (5) rate limit por usuário; (6) ler o vínculo no D1 (`academy_members` por `academy_id` + `user_id`) e exigir vínculo `active`, academia `active` e papel permitido; (7) ignorar como autoridade qualquer `role`, `userId`, `actorId` ou `academyId` do corpo (o `academyId` vem **da URL**); (8) validar o payload com esquema fechado (campo desconhecido é erro); (9) operações de lote exigem `Idempotency-Key`: mesma chave e mesmo corpo devolve o resultado salvo, corpo diferente é `409`; (10) gravar dado e auditoria no **mesmo `batch`**; (11) responder `{ok, data|error, requestId}` sem detalhes internos.

Erros: `400` payload, `401` token, `403` papel/vínculo/academia suspensa, `404`, `409` conflito/idempotência, `413`, `429` com `Retry-After`, `502` falha do banco, `503` kill switch. Violação de gatilho do banco (`last_owner`, `archived_series`, `immutable_version`...) vira `409` com código estável, sem a mensagem do banco.

### 6.1 Escopo da gestão (dono, admin, professor, recepção)

| Endpoint | Papel | Efeito |
|---|---|---|
| `POST /v1/academies` | autenticado | cria academia e vínculo de dono |
| `GET /v1/academies/:id` | membro ativo | dados básicos |
| `PATCH /v1/academies/:id` | dono, admin | nome e dados permitidos |
| `GET /v1/academies/:id/members` | dono, admin (recepção: cadastro) | lista sem consentimento nem saúde |
| `GET/POST /v1/academies/:id/invites`, `POST .../invites/:inviteId/revoke` | dono, admin, recepção (aluno) | cria, lista (cada função só vê os papéis que pode convidar) e revoga; o código só aparece na criação |
| `GET /v1/academies/:id/audit` | dono, admin | últimas 100 entradas |
| `POST /v1/academies/:id/members/:uid/role` | dono, admin | papel, suspender, reativar, remover; último dono protegido |
| `POST /v1/academies/:id/assignments` | dono, admin | propõe professor; aceite é do aluno |
| `GET/POST .../trainings`, `PATCH .../trainings/:id` | autores | rascunho, duplicar, arquivar, restaurar |
| `POST .../trainings/:id/publish` | autores | versão nova imutável |
| `POST .../trainings/:id/assign` | dono, admin, professor (P) | atribui a um aluno |
| `POST .../trainings/:id/batch` (`dryRun`) | dono, admin, professor (P) | prévia ou aplicação, resultado por aluno, `expectedVersion` por aluno |
| `GET .../reports?type=` | dono, admin | só agregados |

### 6.2 Escopo do aluno (o próprio `uid`, nunca outro)

| Endpoint | Efeito |
|---|---|
| `GET /v1/me` | meus vínculos |
| `POST /v1/invites/preview` e `POST /v1/invites/accept` | ver e aceitar convite. O código vai **no corpo** (não na URL, que aparece em logs); vira hash; erro único `invite_invalid` para inexistente, revogado, expirado e esgotado. O portão do uso e a entrada do membro vão no mesmo batch |
| `POST /v1/me/academies/:id/leave` | sair (só quem está ativo: suspenso não escapa da suspensão); apaga consentimento e aderência; **funciona mesmo com o kill switch ligado** |
| `PUT /v1/me/academies/:id/consent` | conceder ou revogar a aderência |
| `POST /v1/me/assignments/:id/accept` | aceitar ou recusar o professor |
| `GET /v1/me/academies/:id/training` | minha ficha atribuída com a **versão exata** (o app guarda uma cópia local para executar offline) |
| `PUT /v1/me/academies/:id/adherence` | envia o resumo semanal calculado no app, só com consentimento |
| `DELETE /v1/me` | exclusão de conta: marca `left`, apaga consentimento e aderência em todas as academias (o fluxo de exclusão de conta do app chama este endpoint) |

**Aderência (decisão fechada):** não é dado verificado. **V2.0: sem aderência individual no painel.** V2.1: resumo enviado pelo app do aluno, gravado com `source = 'client_report'` (o banco só aceita esse valor), só com consentimento `granted`, e mostrado como "informado pelo aluno". Nenhuma decisão financeira, cobrança, punição ou ranking oficial pode usar esse resumo. Aderência **confiável** exige, no futuro, uma ponte confiável entre Firestore e D1 (função, fila ou Worker com credencial restrita e escopo mínimo), decisão separada.

**Execução offline:** ao abrir ou receber uma atribuição, o app guarda um snapshot local `{academyId, assignmentId, trainingVersionId, versionHash, exercises, downloadedAt}` (`assignmentId` e `content_hash` vêm do banco: `training_assignments.assignment_id` e `training_versions.content_hash`). A execução e a leitura offline usam o snapshot; ele **nunca** é autoridade para permissão. O check-in continua pessoal, no Firestore, com `academyId`, `trainingVersionId`, `source` e `clientId`.

**Sem dual-write permanente:** durante a migração o Worker é a única autoridade de escrita; não se grava em Firestore e D1 ao mesmo tempo em produção. Comparar respostas Firestore x D1 só em ambiente controlado.

## 7. Modelo de auditoria

Tabela `academy_audit_log`: `academy_id, actor_id, action, target_type, target_id, at (hora do servidor), detail (<=200)`. Ações atuais: `academy.*`, `member.*`, `invite.*`, `assignment.*`, `training.created|updated|published|archived|restored|deleted|assigned|unassigned`. Novas: `training.batch` (resumo do lote: total, ok, falhas), `billing.*` (V2.2), `report.generated` (V2.3).

- Só o Worker grava, no mesmo `batch` da operação, com `actorId` = uid do token; nunca aceita ator do corpo. O banco impede alterar ou apagar registros (`academy_audit_log` imutável).
- Leitura de dados **não** é auditada nesta versão (decisão anterior mantida).

## 8. Privacidade, consentimento, exportação e exclusão

- **Consentimento de aderência** (`academy_consents`): por academia, revogável, com a versão do texto aceito, auditado, removido ao sair. Revogar apaga a aderência na mesma operação (gatilho) e corta a leitura de imediato.
- **Dados que a gestão nunca recebe:** peso, medidas, cargas, volume, horários, histórico, saúde. O resumo de aderência tem só `status, week_workouts, active_days, streak, updated_at` e `source = client_report`.
- **Exportação (pedido do titular):** o aluno exporta no app do aluno seus dados pessoais; a academia exporta dados cadastrais e de vínculo do membro. A definição do formato é pendência jurídica.
- **Exclusão:** sair da academia ou excluir a conta apaga o consentimento e a aderência (gatilho do banco); o registro de auditoria é mantido (necessário para integridade e defesa) com identificadores, sem dados de saúde. Prazo de retenção a definir com a revisão jurídica.
- **Menores de idade, dado de saúde e contrato com a academia (operador x controlador):** pendências da revisão jurídica, bloqueiam uso comercial.

## 9. Ambientes e segredos

| Ambiente | Firebase (só Auth) | Worker e D1 | Uso |
|---|---|---|---|
| local | emulador de Auth/Firestore do app | testes com `node:sqlite` (mesmo SQL) | testes do Worker e do esquema |
| **homologação** | `bohtreinar-gestao-hml` | `bohtreinar-academy-worker-hml` + D1 `bohtreinar-gestao-hml` | toda operação nova |
| produção | `workout-tracker-app-20e43` | Worker e D1 de produção (a criar) | só depois de aprovada em homologação; sem dados de academia hoje (a HELL GYM de teste foi apagada) |

Domínio: `workers.dev` em desenvolvimento e homologação; domínio próprio (`gestao.bohtreinar.com`) antes do primeiro cliente pagante.

**Segredos:** `bohtreinar` guarda `NVIDIA_API_KEY` (como hoje); o Worker da academia **não tem segredo de banco** (o D1 é um binding, sem chave) nem credencial do Firebase; só variáveis públicas (`FIREBASE_PROJECT_ID`, origens permitidas, kill switch). Nenhum segredo no bundle nem em log. Se uma integração futura exigir segredo (gateway, IA administrativa), ele entra por `wrangler secret`, separado por ambiente, com rotação documentada. **Acesso ao D1:** só pelo Worker e pelo `wrangler` do dono da conta; backup e restauração por D1 Time Travel e exportação antes de cada migração.

**Localização e LGPD:** o D1 permite dica de localização e jurisdição, mas a lista de regiões não inclui a América do Sul (a homologação usa `enam`). O local de armazenamento entra na revisão jurídica antes do primeiro cliente. **Recuperação:** Time Travel e exportação existem, mas o procedimento de restauração precisa ser **ensaiado em homologação** antes do primeiro cliente (pendente). Se a réplica de leitura for habilitada no futuro, leituras logo após gravações importantes devem usar a sessão consistente ou o primário.

**Migrações do esquema:** arquivos numerados em `gestao-worker/migrations/`, aplicados primeiro em homologação. Mudança de esquema passa por `revisor-diff` e pelos testes de `schema.test.js`.

Limites e medição: rate limits próprios (`GESTAO_USER_LIMIT`, `GESTAO_ACADEMY_LIMIT`, `GESTAO_IP_LIMIT`), logs por `requestId`, contador de operações por academia.

## 10. Testes obrigatórios

Os 84 testes de regras da academia viram **testes de endpoint e de esquema**, com o mesmo conteúdo: duas academias, todos os papéis, convite cruzado, `academyId` do corpo ignorado, elevação de papel, auditoria não forjável, ficha arquivada em uso, lote parcial, duplicação sem permissão, tentativa de alterar versão publicada, consentimento e saída.

Esquema (D1): chaves compostas, gatilhos e restrições (`schema.test.js`). Worker: token inválido/expirado, papel insuficiente, academia suspensa, vínculo suspenso, `academyId` da URL diferente do vínculo, idempotência (repetição e corpo diferente), rate limit, payload inválido ou com campo extra, falha parcial no lote, auditoria no mesmo batch (a operação falha se a auditoria falhar), último dono, kill switch. Interface: desktop (dono, recepção), celular (professor), estados vazios, erros de permissão, convite inválido, carregamento, cancelamento, revogação, acessibilidade e teclado. Homologação: duas academias fictícias, IDs registrados, limpeza ao final, smoke test depois do deploy. Produção: contagem de documentos de academia antes e depois de qualquer migração.

## 11. Decisões aprovadas

1. **D1 para o domínio da academia** (decisão A, 14/10/2026), com uma única autoridade de escrita: o Worker. Firestore só para dados pessoais do aluno; Auth compartilhado para identidade.
2. **Domínio:** `workers.dev` até o primeiro cliente pagante; depois domínio próprio.
3. **Homologação:** projeto Firebase (Auth), Worker e D1 separados, usuários fictícios.
4. **Frontend:** Vite, build, deploy e testes próprios.
5. **Recepção:** convites e cadastro só com nome e e-mail; CPF, telefone e afins aguardam revisão jurídica.
6. **Aderência:** resumo enviado pelo aluno, com consentimento, sem service account.

## 12. Próximos passos e migração

1. **Esquema D1** (feito, revisão 2): `0001_init.sql` em homologação (D1 recriado vazio), 15 testes de integridade.
2. **Worker no D1** (feito): `GET /v1/health`, `/v1/me`, `/v1/academies` (lista), `POST /v1/academies` (com `Idempotency-Key`, esquema fechado, limite de 5 academias como dono, academia + dono + auditoria + chave no mesmo batch), `GET /v1/academies/:id` e `/members`. `firestore.js` removido; o Worker não tem credencial do Firestore.
3. **Fundação empresarial** (próximo), uma operação por vez, cada uma com teste de duas academias e `revisor-diff`: convites e entrada de membro, papéis, suspensão e reativação, saída, auditoria (consulta), vínculo professor-aluno e consentimento.
4. **Fichas:** modelos, versões (com `content_hash`), atribuições (com `assignment_id`), cópia de modelos oficiais, lote, snapshot de execução. O app do aluno troca apenas `academyService` e `academyTrainingService` por um cliente da API; o resto do domínio pessoal fica no Firestore. Exclusão de conta chama `DELETE /v1/me`.
5. **Sem migração de dados reais:** a HELL GYM foi apagada em 14/10/2026 e a produção não tem nenhuma academia. O D1 de produção nasce limpo. Se surgir uma academia real antes do corte, um script revisável, com prévia e conferência de contagens, a leva (convites antigos viram hash do código).
6. **Corte:** nenhuma escrita empresarial nova no Firestore; homologação executa todos os fluxos; produção começa com uma academia fictícia; depois as coleções de academia do Firestore passam a `if false` e, após um período de reversão, são removidas, mantendo exportação e plano de rollback.
7. Homologação com duas academias fictícias; depois produção.

Critério de saída da V2.0: lista de validação do roadmap, em homologação, com todas as garantias do esquema e do Worker testadas.
