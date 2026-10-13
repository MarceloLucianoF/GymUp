# BohTreinar Gestão: arquitetura e contratos (Fase 0)

Status: **proposta para aprovação**. Nenhum código da gestão foi escrito. Este documento fecha os contratos antes do código, como pedido na Fase 0.
Complementa `docs/V2_ACADEMIAS.md` (desenho do produto e decisões da V2.0) e substitui a ideia de um painel da academia dentro do app do aluno.

## 1. Decisões assumidas

1. **Dois produtos, um projeto Firebase.** App do aluno (BohTreinar, como hoje) e **BohTreinar Gestão** (frontend e Worker próprios). Mesmo Firebase Auth e mesmo Firestore, com separação por código, rotas, Workers, credenciais e permissões. Os usuários não são duplicados.
2. O app do aluno mantém só: Minha academia, convites e aceite, consentimento, ficha atribuída, execução, chat com o professor.
3. A conta global (`users/{uid}`) nunca recebe papel empresarial. O papel vive em `academyMembers/{academyId}_{uid}`.
4. Academia paga pelo serviço; aluno não paga enquanto vinculado. Um professor responsável por vez. Sem gateway e sem catraca na primeira versão.
5. Painel empresarial **sem** peso, medidas, cargas, volume, horários de treino, histórico detalhado ou saúde. Aderência individual só após o agregador seguro (V2.1).
6. Fichas versionadas são a fonte oficial. IA empresarial só lê dados agregados.
7. Revisão jurídica (LGPD) antes de qualquer uso comercial; migração de treinadores atuais opcional e assistida.

### Ajustes que proponho ao desenho (para você decidir, seção 11)

- **Híbrido em vez de "tudo pelo Worker".** Hoje as regras do Firestore já garantem, no próprio banco, papéis, isolamento, auditoria no mesmo lote e versões imutáveis (84 testes). Mover tudo para um Worker com credencial administrativa **desliga essas regras** para esse caminho: a segurança passa a depender só do código do Worker. Proposta: o Worker faz **apenas o que as regras não conseguem** (lote grande, agregados, relatórios, idempotência, rate limit por academia, integrações). O resto continua escrito pelo cliente sob as regras, agora também pelo frontend de Gestão.
- **Credencial do Worker.** Sem Cloud Functions (plano Spark), o Worker acessa o Firestore pela API REST com uma **service account própria** (Cloud Datastore User). Esse papel é amplo (não restringe por coleção), então o isolamento por coleção é feito no código e por teste, e o segredo fica só em `wrangler secret`. Ela é distinta do segredo da NVIDIA e do Coach IA.
- **Domínio.** `gestao.bohtreinar.com` exige comprar e configurar o domínio na Cloudflare e autorizá-lo no Firebase Auth. Até lá: `bohtreinar-gestao.marcelo-labs.workers.dev`.

## 2. Visão geral

```
                    Firebase Auth (compartilhado, mesmo projeto)
                               |
      +------------------------+---------------------------+
      |                                                    |
App do aluno (Worker "bohtreinar")             Gestão (Worker "bohtreinar-gestao": assets)
 /api/nvidia  (segredo NVIDIA)                              |
      |                                       API empresarial (Worker "bohtreinar-academy-worker")
      |                                         /v1/...  (service account própria, rate limit próprio)
      +------------------ Firestore (regras compartilhadas) ------------------+
```

Três Workers, três conjuntos de segredos e de limites: `bohtreinar` (app + Coach IA), `bohtreinar-gestao` (só assets do frontend) e `bohtreinar-academy-worker` (API). Revogar ou medir um não afeta os outros.

Código no mesmo repositório (monorepo), sem importar código de tela entre produtos:

```
src/                      app do aluno (como hoje)
gestao/                   frontend da gestão (React, CRA ou Vite; decidir na V2.0)
worker/                   Worker do app do aluno (como hoje)
gestao-worker/            Worker da API empresarial
shared/                   só contratos: nomes de coleções, papéis, ações de auditoria, esquemas
```

## 3. Contrato de identidade

- `users/{uid}`: conta global. `role` (`user`, `coach`, `admin`) continua sendo do produto pessoal e não representa função em academia.
- `academyMembers/{academyId}_{uid}`: `academyId, userId, role (owner|admin|teacher|reception|student), status (active|suspended|removed|left), displayName, consent, perms, branchId (null), createdAt, updatedAt`.
- Um uid pode ter vínculos diferentes em academias diferentes. O Worker e as regras **sempre** resolvem o papel lendo o vínculo da academia em questão; `role`, `userId` e `academyId` vindos do cliente nunca são autoridade.
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

Pontos de atenção: hoje o professor **vê** nome do aluno e a ficha atribuída, mas não os dados de treino do aluno; "Acompanha treinos autorizados" fica para o agregador (V2.1) com consentimento. Regras atuais impedem que admin altere dono/admin; o Worker repete a checagem.

## 5. Matriz de coleções

Coleções atuais (já em produção) e como a proposta do roadmap se mapeia a elas. **Não renomear coleções existentes**: os dados reais (HELL GYM) estão nelas e as regras estão testadas.

| Coleção (hoje) | Proposta do roadmap | Quem escreve | Leitura |
|---|---|---|---|
| `academies` | `academies` | cliente sob regras (dono/admin) | membros ativos |
| `academyMembers` | `academyMembers` | cliente sob regras; **papel/suspensão/remoção** também via cliente (regras já validam e auditam) | próprio vínculo; equipe da academia |
| `academyInvites` | `academyInvites` | cliente sob regras; aceite no lote do aluno | equipe |
| `academyAssignments` | `academyAssignments` | cliente sob regras (proposta/aceite/encerramento) | aluno, professor, equipe |
| `trainingSeries` + `trainingVersions` | `academyTrainingTemplates` + `academyTrainingVersions` | cliente sob regras (rascunho, publicar, arquivar) | equipe/professor; aluno só a versão atribuída |
| `academyAssigned` | (ficha atribuída) | cliente sob regras (um aluno); **Worker no lote grande** | aluno, professor, equipe |
| `trainingTemplates` | modelos oficiais globais | só admin da plataforma | qualquer logado |
| `academyAuditLog` | `academyAuditLog` | cliente no mesmo lote (regras verificam ação, ator, alvo); Worker para o que ele faz | equipe |
| `academyMemberStats` | (legado da V2.0) | cliente do aluno | só o aluno |
| (novo) `academyPublicStats` | `academyPublicStats/{academyId}_{uid}` | **só o Worker** (agregador, V2.1) | aluno; professor/equipe conforme consentimento |
| (novo) `academyBranches` | filiais | Worker (V2.4) | equipe |
| (novo) `academyBilling` | mensalidades | Worker (V2.2) | dono, admin, recepção |
| (novo) `idempotency/{academyId}_{key}` | chaves de idempotência | só o Worker | ninguém no cliente |

Regra geral: toda coleção empresarial tem `academyId` no documento ou no ID, e **nenhuma consulta confia só em `uid`**. Coleções só do Worker têm regra `allow read, write: if false` para clientes (exceto leituras explicitamente permitidas).

## 6. Contrato do Worker empresarial (`/v1`)

Cada requisição, nesta ordem:

1. Origem permitida (CORS só do frontend de Gestão) e método.
2. Rate limit por IP (antes do token) e, depois, por `uid` **e** por `academyId`.
3. Validar o Firebase ID token (assinatura, `aud`, `iss`, expiração).
4. `uid` = `sub` do token. Ler `academyMembers/{academyId}_{uid}`.
5. Exigir vínculo `active`, academia `active` e papel permitido para a operação (matriz da seção 4).
6. Ignorar como autoridade qualquer `role`, `userId`, `actorId` ou `academyId` do corpo; o `academyId` vem **da URL** e é conferido com o vínculo.
7. Validar o payload (esquema fechado: campo desconhecido é erro).
8. Operações de lote exigem cabeçalho `Idempotency-Key` (8 a 64 caracteres). Mesma chave + mesmo corpo devolve o resultado salvo; mesma chave + corpo diferente é `409`.
9. Gravar o dado e a auditoria na **mesma operação** (commit atômico do Firestore).
10. Resposta com `requestId`; erros sem detalhes internos.

Erros: `400` payload, `401` token, `403` papel/vínculo/academia suspensa, `404` inexistente (ou não visível), `409` conflito/idempotência, `413`, `429` com `Retry-After`, `502` falha do Firestore.

| Endpoint | Papel | Corpo (resumo) | Efeito |
|---|---|---|---|
| `POST /v1/academies` | autenticado | `name` | cria academia e vínculo de dono (se o cliente já faz sob regras, este endpoint é opcional) |
| `GET /v1/academies/:id` | membro ativo | | dados básicos |
| `POST /v1/academies/:id/invites` | dono, admin, recepção (aluno) | `role, maxUses, expiresInDays` | convite + auditoria |
| `POST /v1/academies/:id/members/:uid/role` | dono, admin | `role, status` | respeita matriz; protege último dono; auditoria |
| `POST /v1/academies/:id/assignments` | dono, admin | `studentId, teacherId` | proposta de vínculo; aceite continua do aluno |
| `POST /v1/academies/:id/training/batch` | dono, admin, professor (P) | `seriesId, version, mode, studentIds?` + `Idempotency-Key` | prévia (`dryRun:true`) ou aplicação; resultado por aluno; conflito não sobrescreve alteração recente |
| `GET /v1/academies/:id/reports?type=` | dono, admin | tipo, período | só agregados (sem dados de saúde) |
| `POST /v1/internal/aggregate` (agendado, V2.1) | cron do Worker | | gera `academyPublicStats` a partir dos check-ins de quem consentiu |

O lote do Worker substitui o lote cliente-por-aluno atual quando houver mais alunos do que a tela comporta, mantendo as mesmas garantias: conferir a atribuição atual antes de gravar (`expectedVersionId`), uma auditoria `training.assigned` por aluno com detalhe `lote`, resultado individual.

## 7. Modelo de auditoria

`academyAuditLog/{id}`: `academyId, actorId, action, targetType, targetId, at (hora do servidor), detail (<=200)`. Imutável (sem update/delete). Ações atuais: `academy.*`, `member.*`, `invite.*`, `assignment.*`, `training.created|updated|published|archived|restored|deleted|assigned|unassigned`. Novas: `training.batch` (resumo do lote: total, ok, falhas), `billing.*` (V2.2), `report.generated` (V2.3).

- Cliente: a regra exige o registro no mesmo lote, do mesmo ator e do alvo certo (não forjável).
- Worker: grava no mesmo commit, com `actorId` = uid do token; nunca aceita ator do corpo.
- Leitura de dados **não** é auditada nesta versão (decisão anterior mantida).

## 8. Privacidade, consentimento, exportação e exclusão

- **Consentimento de aderência:** por academia, revogável, só para `em_dia | atrasado | sem_dados`, auditado, removido ao sair. Revogar corta a leitura de imediato (regra e agregador).
- **Dados que a gestão nunca recebe:** peso, medidas, cargas, volume, horários, histórico, saúde. O agregador só publica `status, weekWorkouts, activeDays, streak, updatedAt`.
- **Exportação (pedido do titular):** o aluno exporta no app do aluno seus dados pessoais; a academia exporta dados cadastrais e de vínculo do membro. A definição do formato é pendência jurídica.
- **Exclusão:** sair da academia apaga o consentimento e o documento de estatísticas do vínculo; o registro de auditoria é mantido (necessário para integridade e defesa) com identificadores, sem dados de saúde. Prazo de retenção a definir com a revisão jurídica.
- **Menores de idade, dado de saúde e contrato com a academia (operador x controlador):** pendências da revisão jurídica, bloqueiam uso comercial.

## 9. Ambientes e segredos

| Ambiente | Firebase | Worker | Uso |
|---|---|---|---|
| local | emulador (`demo-*`) | `wrangler dev` | testes de regras e do Worker |
| produção | `workout-tracker-app-20e43` | três Workers | academias fictícias para teste; HELL GYM nunca é tocada |

Não há projeto de homologação separado hoje (custo e Spark). Mitigação: testes no emulador, em produção com IDs fictícios prefixados e limpeza ao final. Um projeto de staging é recomendável antes do primeiro cliente pagante (decisão na seção 11).

Segredos (sempre `wrangler secret`, nunca em arquivo versionado):

- `bohtreinar`: `NVIDIA_API_KEY` (como hoje).
- `bohtreinar-academy-worker`: `GOOGLE_SERVICE_ACCOUNT_JSON` (service account própria, nome `gestao-worker`, papel mínimo; revogável sem afetar o Coach IA), nenhum segredo de IA até a V2.3.
- `bohtreinar-gestao` (assets): nenhum segredo.

Limites e medição: namespaces de rate limit próprios (`GESTAO_USER_LIMIT`, `GESTAO_ACADEMY_LIMIT`, `GESTAO_IP_LIMIT`), logs por `requestId`, contador de operações por academia para medir consumo.

## 10. Testes obrigatórios

Os testes de regras atuais (academias A e B, todos os papéis, convite cruzado, `academyId` alterado, elevação de papel, auditoria forjada, ficha arquivada em uso, lote parcial) continuam como base e valem para o frontend de Gestão sem mudança.

Worker: token inválido/expirado, papel insuficiente, academia suspensa, vínculo suspenso, `academyId` da URL diferente do vínculo, idempotência (repetição e corpo diferente), rate limit por usuário e por academia, payload inválido ou com campo extra, falha parcial no lote, auditoria ausente (o commit falha), último dono protegido.

Interface (Gestão): desktop para dono e recepção, celular para professor, estados vazios, erro de permissão, convite inválido, carregamento, cancelamento, revogação, acessibilidade e teclado.

Produção: duas academias fictícias, HELL GYM intacta (contagem antes e depois), IDs registrados, limpeza ao final, smoke test depois do deploy.

## 11. Decisões que dependem de você

1. **Híbrido (recomendado) ou tudo pelo Worker?** O primeiro mantém as garantias das regras e usa o Worker só onde elas não alcançam; o segundo concentra tudo no Worker, mas troca o isolamento do banco por isolamento de código.
2. **Domínio:** comprar `bohtreinar.com` agora ou começar em `workers.dev`?
3. **Staging:** criar um segundo projeto Firebase para homologação antes de clientes pagantes?
4. **Framework do frontend de Gestão:** manter CRA (reaproveita ferramentas, testes e componentes) ou Vite (mais rápido, mas diverge do app). Recomendo CRA na V2.0 para reaproveitar o que já está testado e reavaliar depois.
5. **Recepção e cadastro de alunos:** recepção cria convites, mas cadastro com dados pessoais (CPF, telefone) só entra com a revisão jurídica.

## 12. Próximos passos (após aprovação)

1. Você decide a seção 11.
2. V2.0 da Gestão: esqueleto do frontend (login compartilhado, rotas, layout desktop/mobile), reutilizando os serviços de academia já testados; Worker com `/v1/health` e a cadeia de autenticação (itens 1 a 7 da seção 6) e testes.
3. Telas: criar/configurar academia, convites, membros e papéis, suspensão/reativação, auditoria, dashboard inicial; remover do app do aluno apenas as telas de gestão que migrarem (ficha atribuída, consentimento e convites ficam).
4. Critério de saída da V2.0 conforme a lista de validação do roadmap, com duas academias fictícias em produção.
