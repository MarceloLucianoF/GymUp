# BohTreinar Gestão: arquitetura e contratos (Fase 0)

Status: **decisões aprovadas (seção 11)**. Este documento fecha os contratos antes do código, como pedido na Fase 0.
Complementa `docs/V2_ACADEMIAS.md` (desenho do produto e decisões da V2.0) e substitui a ideia de um painel da academia dentro do app do aluno.

## 1. Decisões assumidas

1. **Dois produtos, um projeto Firebase.** App do aluno (BohTreinar, como hoje) e **BohTreinar Gestão** (frontend e Worker próprios). Mesmo Firebase Auth e mesmo Firestore, com separação por código, rotas, Workers, credenciais e permissões. Os usuários não são duplicados.
2. O app do aluno mantém só: Minha academia, convites e aceite, consentimento, ficha atribuída, execução, chat com o professor.
3. A conta global (`users/{uid}`) nunca recebe papel empresarial. O papel vive em `academyMembers/{academyId}_{uid}`.
4. Academia paga pelo serviço; aluno não paga enquanto vinculado. Um professor responsável por vez. Sem gateway e sem catraca na primeira versão.
5. Painel empresarial **sem** peso, medidas, cargas, volume, horários de treino, histórico detalhado ou saúde. Aderência individual só após o agregador seguro (V2.1).
6. Fichas versionadas são a fonte oficial. IA empresarial só lê dados agregados.
7. Revisão jurídica (LGPD) antes de qualquer uso comercial; migração de treinadores atuais opcional e assistida.

### Modelo híbrido: uma única autoridade de escrita por operação (aprovado)

Um Worker é uma boa fronteira de segurança; o risco está em uma service account que **ignora as regras do Firestore**: um bug no Worker passa a poder ler ou alterar qualquer coleção que a credencial alcance. Por isso a divisão é por responsabilidade, e **cada operação tem exatamente uma autoridade de escrita** (nunca o cliente e o Worker para a mesma operação):

| Autoridade | Operações |
|---|---|
| **App do aluno, sob as regras do Firestore** | check-ins, medidas, preferências pessoais, execução de treino, dados que pertencem ao aluno; aceite/recusa do convite, consentimento e saída da academia (ações do próprio aluno) |
| **Worker empresarial** | criar academia, alterar papéis (suspender, reativar, remover), convidar membros, atribuir ou transferir professores, atribuir ficha e operações em lote, relatórios agregados, agregador de aderência, integrações financeiras e de hardware |

As regras continuam como defesa do app do aluno e das leituras. Quando uma operação migra para o Worker, as regras correspondentes passam a **negar a escrita direta do cliente** (`allow write: if false` para o que é só do Worker); o código de cliente que hoje escreve essas coleções (app do aluno e telas de gestão atuais) é removido na mesma entrega, para não haver duas autoridades. Rascunho, publicação e arquivamento de fichas continuam sob regras até decisão posterior, desde que a Gestão seja o único cliente que os escreve.

Defesas do Worker, porque o IAM do Firestore não isola por coleção: (1) endpoints explícitos, **nunca caminho de coleção arbitrário**; (2) vínculo e papel validados a cada chamada; (3) lista de campos permitidos por operação; (4) transações; (5) idempotência; (6) auditoria no mesmo commit; (7) testes com duas academias; (8) revisão de diff (`revisor-diff`) em toda mudança do Worker; (9) rate limit por usuário e por academia; (10) **kill switch**: variável `ADMIN_OPS_ENABLED` que, desligada, faz todo endpoint de escrita devolver `503` sem tocar no banco. Se a Gestão passar a guardar dados financeiros e relatórios sensíveis, reavaliar um projeto Firebase empresarial separado.

### Service account do Worker

Exclusiva do Worker empresarial: diferente da NVIDIA, do Worker do app e **diferente entre homologação e produção**; só em `wrangler secret`; nunca no bundle nem em log; rotação documentada (seção 9). O Worker nasce **sem** service account (rotas `/v1/health` e `/v1/me` só validam o token, que é verificação pública de assinatura); a credencial só é criada quando a primeira operação administrativa real for liberada.

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
gestao/                   frontend da gestão (Vite, build e deploy independentes)
worker/                   Worker do app do aluno (como hoje)
gestao-worker/            Worker da API empresarial
shared/                   contratos (coleções, papéis, ações de auditoria, esquemas) e, quando necessário, tokens/ícones/componentes visuais por pacote; páginas do app do aluno nunca são copiadas
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

| Ambiente | Firebase | Workers | Uso |
|---|---|---|---|
| local | emulador (`demo-*`) | `wrangler dev` | testes de regras e do Worker |
| **homologação** | projeto Firebase **separado** (banco de testes, usuários fictícios) | Workers de homologação, segredos próprios, deploy independente | toda operação empresarial nova |
| produção | `workout-tracker-app-20e43` | três Workers | só depois de aprovada em homologação; **a produção atual, incluindo a HELL GYM, não é usada para testar operações empresariais novas** |

O projeto de homologação é criado **antes** de qualquer academia pagante (e antes da primeira operação administrativa real). Domínio: `workers.dev` em desenvolvimento e homologação; antes do primeiro cliente pagante, domínio próprio (`gestao.bohtreinar.com`).

Segredos (sempre `wrangler secret`, nunca em arquivo versionado):

- `bohtreinar`: `NVIDIA_API_KEY` (como hoje).
- `bohtreinar-academy-worker`: `GOOGLE_SERVICE_ACCOUNT_JSON` (service account `gestao-worker`, uma por ambiente, papel mínimo, revogável sem afetar o Coach IA), só quando a primeira operação real for liberada; nenhum segredo de IA até a V2.3. Rotação: criar a chave nova, `wrangler secret put`, conferir `/v1/health`, desativar e apagar a chave antiga (documentar a data); em suspeita de vazamento, ligar o kill switch, revogar a chave e investigar a auditoria.
- `bohtreinar-gestao` (assets): nenhum segredo.

Limites e medição: namespaces de rate limit próprios (`GESTAO_USER_LIMIT`, `GESTAO_ACADEMY_LIMIT`, `GESTAO_IP_LIMIT`), logs por `requestId`, contador de operações por academia para medir consumo.

## 10. Testes obrigatórios

Os testes de regras atuais (academias A e B, todos os papéis, convite cruzado, `academyId` alterado, elevação de papel, auditoria forjada, ficha arquivada em uso, lote parcial) continuam como base e valem para o frontend de Gestão sem mudança.

Worker: token inválido/expirado, papel insuficiente, academia suspensa, vínculo suspenso, `academyId` da URL diferente do vínculo, idempotência (repetição e corpo diferente), rate limit por usuário e por academia, payload inválido ou com campo extra, falha parcial no lote, auditoria ausente (o commit falha), último dono protegido.

Interface (Gestão): desktop para dono e recepção, celular para professor, estados vazios, erro de permissão, convite inválido, carregamento, cancelamento, revogação, acessibilidade e teclado.

Produção: duas academias fictícias, HELL GYM intacta (contagem antes e depois), IDs registrados, limpeza ao final, smoke test depois do deploy.

## 11. Decisões aprovadas

1. **Híbrido**, com uma única autoridade de escrita por operação (seção 1).
2. **Domínio:** `workers.dev` em desenvolvimento e homologação; domínio próprio (`gestao.bohtreinar.com`) antes do primeiro cliente pagante.
3. **Homologação:** projeto Firebase separado, Worker de homologação, segredos separados, banco de testes, usuários fictícios, deploy independente.
4. **Frontend:** **Vite**, com build, deploy, rotas, testes e variáveis próprios; identidade visual compartilhada por pacote, sem copiar páginas do app atual.
5. **Recepção:** cria convites e cadastra membros só com **nome e e-mail**. CPF, telefone obrigatório e outros dados pessoais aguardam revisão jurídica, base legal, política de retenção, texto de consentimento e fluxo de exportação e exclusão.

## 12. Próximos passos

1. Criar o projeto Firebase de homologação.
2. Criar o frontend Vite da Gestão.
3. Criar o Worker empresarial **sem service account**.
4. Implementar `/v1/health` e `/v1/me`.
5. Validar a autenticação com o Firebase ID token.
6. Contratos de resposta e erro.
7. Testes: token inválido, usuário sem academia, papel insuficiente e academia suspensa.
8. Só então liberar a primeira operação administrativa real (com a service account de homologação).

Critério de saída da V2.0: lista de validação do roadmap, com duas academias fictícias **em homologação**.
