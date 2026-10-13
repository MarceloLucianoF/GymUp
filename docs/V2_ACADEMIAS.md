# BohTreinar V2: academias (desenho)

Status: **proposta de desenho, sem código**. Data: 13/10/2026. Objetivo: transformar o produto em plataforma multiempresa
**sem** perder o modo independente (aluno sozinho, professor autônomo). A academia entra como camada organizacional por cima do
que já existe; ninguém é obrigado a pertencer a uma.

Este documento parte do que o app faz hoje (seção 0) e termina com decisões que dependem do dono do produto (seção 11).

## 0. Ponto de partida (o que já existe e deve ser reaproveitado)

| Hoje | Como funciona | Papel na V2 |
| --- | --- | --- |
| `users/{uid}.role` = `user` \| `coach` \| `admin` | Papel **global**. `admin` também atua como treinador (`isTrainerId` aceita os dois). | Continua global. Papel de academia é outro conceito (seção 2). |
| `coachLinks/{studentId}` + `coachInvites` | Vínculo aluno-treinador por **pedido do aluno e aceite do treinador**; o treinador só lê o aluno depois do aceite. | É o modelo de consentimento. A atribuição aluno-professor da academia segue a mesma lógica. |
| `checkIns`, `measurements`, `chats`, `coachNotes` | Dados do aluno, lidos pelo treinador **vinculado**. | Continuam do aluno. A academia **não** herda acesso a eles. |
| `userStats` / `publicStats` | Contadores validados pelas regras (`getAfter`), projeção mínima sem horário. | Modelo para o que a academia vê de frequência (seção 3). |
| `trainings` (`coachId`, `packageId`, `order`) | Fichas do treinador e programas. | Ganha escopo e versão (seção 6). |
| `weeklySummaries` | Números calculados no app + texto da IA validado. | Modelo para o resumo da academia (seção 8). |
| Plano Spark, sem Cloud Functions | Integridade só por **regras do Firestore**; Worker da Cloudflare faz o proxy de IA. | Restrição central do desenho (seção 9). |

Lições já pagas que o desenho incorpora: `get` de documento inexistente é negado pelas regras (IDs determinísticos e regra para
"ainda não existe"); regras só provam o que a consulta restringe (listas precisam de filtro pelo próprio uid/academia);
leitura de lista não confere vínculo por documento; escrita de contadores só junto do fato que os gera.

## 1. Modelo de organização

```
Conta (users/{uid})                     <- dono dos próprios dados, sempre
  |-- modo independente (como hoje)     <- coachLinks, fichas pessoais, social
  `-- 0..N vínculos com academias       <- academyMembers (papel DENTRO da academia)

Academia (academies/{academyId})
  |-- filiais (academyBranches)         <- opcional na V2.0
  |-- membros (academyMembers)          <- proprietário, admin, professor, recepção, aluno
  |-- atribuições aluno->professor (academyAssignments)
  |-- fichas da academia (trainings com academyId)
  `-- operação (planos, cobranças, auditoria)
```

Definições:

- **Conta independente**: qualquer `users/{uid}`. Funciona sem academia, como hoje.
- **Academia**: empresa. Tem um proprietário e um identificador estável (`academyId`).
- **Filial**: unidade física da academia. Opcional; um membro pode ter acesso a uma, várias ou todas.
- **Membro**: vínculo entre uma conta e uma academia, com **papel da academia** e status. Uma conta pode ter vários (várias
  academias), cada um com seu papel. Um professor de uma academia pode ser aluno de outra.
- **Professor / Administrador / Recepção / Proprietário / Aluno**: papéis **dentro** da academia (seção 2).
- **Admin do BohTreinar** (`users.role = admin`): equipe do produto. Não é admin de academia. Acesso de suporte a uma academia só
  com registro de auditoria e, para dados pessoais do aluno, consentimento (seção 3).

Regra de ouro: **o papel na academia nunca altera `users.role`** e a academia nunca vira dona da conta de ninguém.

## 2. Papéis e permissões

Matriz (S = sim, N = não; "atrib." = só alunos atribuídos a ele; "próprio" = só os próprios dados):

| Ação | Proprietário | Admin | Professor | Recepção | Aluno |
| --- | --- | --- | --- | --- | --- |
| Editar dados da academia (nome, marca, filiais) | S | Parcial: tudo menos propriedade, exclusão e plano contratado | N | N | N |
| Transferir ou encerrar a academia | S | N | N | N | N |
| Gerenciar equipe (convidar, papel, suspender) | S | S, mas não mexe em proprietário nem em admin acima dele | N | N | N |
| Convidar e cadastrar alunos | S | S | N (pode gerar convite que cai na recepção/admin, a decidir) | S | N |
| Ver lista de alunos e situação operacional | S | S | atrib. | S (sem dados de treino) | próprio |
| Atribuir professor ao aluno | S | S | N | N (propõe) | aceita o vínculo |
| Criar fichas da academia | S | S | Opcional (permissão por professor) | N | N |
| Atribuir fichas | S | S | atrib. | N | N |
| Ver treinos, histórico, medidas e chat do aluno | N por padrão (ver abaixo) | N por padrão | atrib., com o aceite do aluno | N | próprio |
| Ver frequência agregada (último treino, semana, sequência) | S | S | atrib. | S | próprio |
| Planos, mensalidades e status de pagamento | S | S | N (vê só "em dia" do atribuído, a decidir) | S | próprio |
| Auditoria da academia | S | S (leitura) | N | N | N |

Decisões embutidas:

1. **Proprietário e admin da academia não leem dados de saúde por padrão.** Operar a academia (cadastro, plano, frequência) não
   exige medidas, cargas ou chat. Só o **professor atribuído, com o aceite do aluno**, os lê (mesmo contrato do `coachLinks`).
   Se a academia quiser que a coordenação veja treinos, é um **escopo de consentimento adicional** do aluno, nunca implícito.
2. **Recepção só vê dados operacionais** (cadastro, plano, pagamento, frequência agregada).
3. **Hierarquia de gestão**: ninguém concede papel maior que o próprio; o último proprietário não pode sair sem transferir.
4. **Um aluno tem no máximo um professor responsável ativo por academia** (ID determinístico, seção 4); co-professores ficam para depois.
5. **Permissões finas por professor** (criar fichas globais, ver pagamento do atribuído) viram campos booleanos do membro
   (`perms`), não papéis novos.

## 3. Isolamento de dados

Princípios:

1. **Toda entidade da academia carrega `academyId`** e toda regra confere a participação ativa e o papel **naquela** academia.
2. **O aluno é dono dos próprios dados** (`checkIns`, `measurements`, `chats`, `coachNotes` dele continuam sob `userId`). A academia
   recebe acesso por **atribuição aceita** (professor) ou por **projeção mínima** (frequência), nunca por cópia dos dados.
3. **Dados operacionais e dados de saúde ficam em coleções separadas** e com regras diferentes: `academyMembers`,
   `academyBilling`, `academyMemberStats` (operacional) x `measurements`, `checkIns`, `chats` (pessoal).
4. **Projeção mínima de frequência** (`academyMemberStats/{academyId}_{userId}`): `lastWorkoutDay` (só a data), `weekKey`,
   `weekWorkouts`, `activeDays`, `streak`. Sem horário, sem carga, sem medidas. Gravada pelo **próprio aluno** na mesma
   transação do check-in, com a regra conferindo que ela é idêntica ao `userStats` dele (`getAfter`), como `publicStats` hoje, e só
   enquanto o membro está ativo e o aluno consentiu em compartilhar frequência.
5. **Saída**: ao sair ou ser removido, o acesso para de valer imediatamente (membro `left`/`removed`, atribuição `ended`). O
   histórico continua com o aluno. A academia mantém só o que a lei e a operação exigem (cobranças e auditoria), sem acesso a saúde.

Verificações exigidas pelas regras (por operação):

- Membro ativo na academia (`status == 'active'`), papel suficiente, filial permitida quando houver filiais.
- Professor: `academyAssignments/{academyId}_{studentId}` ativa com `teacherId == auth.uid`, **e** o membro do aluno ativo.
- Aluno: só o próprio `userId`.
- Listas: consultas **sempre filtradas** por `academyId` (e por `teacherId` ou `userId` quando for o caso), porque as regras de lista
  não conferem vínculo por documento (aprendizado do chat do PR 70).

Dados que a academia **nunca** lê: e-mail pessoal fora do cadastro operacional informado pelo próprio aluno, medidas, fotos,
cargas, chat, notas privadas de outro professor, rede social do aluno (amigos, ranking).

Suporte (admin do BohTreinar): leitura de configuração e auditoria da academia; leitura de dados pessoais do aluno só com
consentimento registrado e entrada na auditoria.

## 4. Entidades principais

IDs **determinísticos** onde as regras precisam de um único `get` (limite de acessos por avaliação e o problema do documento
inexistente). Campos de auditoria (`createdAt`, `updatedAt`, `createdBy`) em todas.

```text
academies/{academyId}
  name, slug, ownerId, plan (contratado), branding {logoUrl, color} (V2.4), status (active|suspended), createdAt, updatedAt

academyBranches/{academyId}_{branchSlug}                       (V2.2)
  academyId, name, address?, status

academyMembers/{academyId}_{userId}                            <- um por pessoa por academia
  academyId, userId, role (owner|admin|teacher|reception|student), status (invited|active|suspended|left|removed),
  branchIds?[], perms? {createTrainings, seePaymentOfAssigned}, invitedBy, joinedAt?, createdAt, updatedAt

academyInvites/{inviteId}                                      <- como coachInvites: ID secreto, validade, usos, revogação
  academyId, role (papel que o convite concede), branchId?, expiresAt, maxUses, uses, revoked, createdBy

academyAssignments/{academyId}_{studentId}                     <- no máximo um professor responsável ativo
  academyId, studentId, teacherId, status (pending|active|ended), requestedBy, sharedScopes ['training','measurements'?, 'chat'],
  createdAt, updatedAt, endedAt?

academyMemberStats/{academyId}_{userId}                        <- projeção mínima de frequência (seção 3)
  academyId, userId, weekKey, weekWorkouts, activeDays, streak, lastWorkoutDay, updatedAt

academyPlans/{planId}                                          (V2.2)
  academyId, name, priceCents, periodicity, active

academyBilling/{academyId}_{userId}_{AAAA-MM}                  (V2.2)
  academyId, userId, planId, amountCents, status (pending|paid|exempt|overdue), dueDate, paidAt?, updatedBy, updatedAt

academyAuditLog/{logId}                                        <- só criação; leitura por proprietário/admin
  academyId, actorId, action (código fixo), targetType, targetId, at, detail (sem dados de saúde)
```

Mudanças em coleções existentes:

- `trainings`: acrescentar `academyId?`, `scope` (`personal|teacher|academy|official`), `version`, `seriesId`, `status`
  (`draft|published|archived`), e os campos explícitos `programId` e `rotationOrder` (dívida registrada no PR 73).
- `users`: nenhum campo de academia. A lista de academias do usuário é a consulta `academyMembers where userId == uid` (e um
  documento por academia no ID determinístico para as regras).

Índices previstos: `academyMembers (academyId, role, status)`, `academyMembers (userId, status)`,
`academyAssignments (academyId, teacherId, status)`, `academyBilling (academyId, status, dueDate)`,
`academyAuditLog (academyId, at desc)`.

## 5. Fluxos essenciais

Todos terminam com uma linha em `academyAuditLog` **no mesmo lote** da mudança, para a auditoria não depender de o cliente lembrar de
gravar: o documento alterado carrega `auditId` e a regra confere `existsAfter(academyAuditLog/{auditId})` com o mesmo `academyId`, o
ator (`actorId == auth.uid`) e o alvo coerentes com a mudança.

1. **Criar academia**: a conta cria `academies/{id}` e o próprio `academyMembers/{id}_{uid}` com `role: owner` no mesmo lote
   (a regra só aceita se `ownerId == auth.uid` e o membro criado é o proprietário). Limite de academias por conta a definir.
2. **Convidar usuário** (equipe ou aluno): proprietário/admin (ou recepção, para aluno) cria `academyInvites` com papel, validade e
   usos. O papel concedido nunca excede o de quem convida.
3. **Aceitar convite**: a conta logada cria o próprio `academyMembers` com o papel do convite e soma 1 uso, no mesmo lote
   (mesmo mecanismo comprovado em `coachInvites`). Convite revogado, expirado ou esgotado é recusado. Usuário novo cadastra-se pelo
   link e cai no aceite. Convite não altera `users.role`.
4. **Atribuir professor ao aluno**: admin/proprietário propõe (`academyAssignments` `pending`, `requestedBy`); **o aluno aceita**
   (`active`) escolhendo os escopos que compartilha. Sem aceite, o professor não lê nada do aluno.
5. **Atribuir ficha**: professor atribuído (ou admin) grava `currentTrainingId` e a **versão** da ficha atribuída (seção 6).
6. **Trocar professor**: encerra a atribuição atual (`ended`) e cria a nova `pending`; o acesso do professor anterior termina na
   hora, o histórico do aluno fica intacto, as notas privadas do professor anterior não passam ao novo.
7. **Remover aluno** (pela academia): membro `removed`, atribuição `ended`, frequência (`academyMemberStats`) apagada; cobranças
   ficam (obrigação), sem dado de saúde.
8. **Suspender membro**: `status: suspended` bloqueia tudo da academia, preserva dados e permite reativar. Vale para equipe e aluno.
9. **Trocar filial**: altera `branchIds`; só admin/proprietário.
10. **Sair da academia** (pelo membro): `left`, mesmas consequências do 7. O proprietário só sai depois de transferir a propriedade.
11. **Histórico pessoal depois da saída**: `checkIns`, `measurements`, fichas pessoais, social e resumos continuam sob a conta. Fichas
    atribuídas pela academia deixam de atualizar, mas o aluno mantém uma **cópia pessoal** da versão que treinava (fica no histórico
    dele); a ficha da academia sai da lista ativa.
12. **Excluir a conta** (LGPD): o aluno apaga os próprios dados (como hoje), sai de todas as academias e a academia perde acesso
    imediato; registros de cobrança e auditoria permanecem anonimizando o nome conforme a política.

## 6. Fichas e conteúdo

Quatro escopos, nunca misturados na mesma consulta sem filtro:

| Escopo | Dono | Quem edita | Quem usa |
| --- | --- | --- | --- |
| Pessoal | aluno | o próprio aluno | só ele |
| Do professor | professor | o professor | alunos atribuídos a ele |
| Da academia | academia | proprietário, admin, professores com permissão | alunos da academia |
| Oficial BohTreinar | produto | equipe do produto | todos (somente leitura) |

**Versionamento (recomendado)**: toda ficha publicada é uma **série** (`seriesId`) com **versões** imutáveis (`version` 1, 2, 3).
A atribuição fixa a versão. Ao editar uma ficha em uso:

1. O editor mostra quantos alunos usam a versão atual ("12 alunos usam esta ficha").
2. Edição gera a **versão seguinte** em rascunho; ao publicar, o responsável escolhe **aplicar a todos**, **só aos novos
   alunos** (padrão) ou **escolher alunos**.
3. Quem treina uma versão antiga continua nela até a troca; o histórico de treinos aponta para a versão em que foi feito (`checkIns.trainingVersion`).
4. Excluir é arquivar: ficha em uso nunca some (regra atual de desatribuir ao excluir passa a valer só para rascunhos sem uso).

Rotação (PR 73) passa a usar `programId` e `rotationOrder` explícitos; o fallback por nome "Treino A/B/C" é removido na migração.

## 7. Financeiro

Escopo **operacional** na primeira versão (sem gateway de pagamento):

- Plano do aluno (`academyPlans`), mensalidade, status `pending | paid | exempt | overdue`, histórico mensal (`academyBilling`
  com ID `academy_user_AAAA-MM`, uma cobrança por mês, sem duplicar).
- Permissões: proprietário e admin tudo; recepção lança e baixa; professor não vê (ou só "em dia" do atribuído, decisão aberta);
  aluno lê as próprias cobranças.
- **Isenção** vira estado explícito de cobrança (o modelo atual acopla `exempt` a mensalidade 0; na V2 separar `amountCents` de
  `status`, como sugerido).
- Alterações de valor ou status geram linha de auditoria.
- Gateway (Pix, cartão, boleto, conciliação, webhooks): **fase posterior**; exige servidor com credenciais (Worker) e decisão
  de provedor (seção 11).

## 8. IA da academia

Mesmo contrato do resumo semanal do aluno: **o sistema calcula, a IA só redige**.

- Entrada: **agregados e mínimos** (contagens de alunos ativos, inativos há N dias, aderência por turma/professor, cobranças em
  aberto em número e valor total). Sem nome de aluno por padrão; listas nominais só para quem já pode vê-las (professor vê os
  atribuídos) e sem dados de saúde.
- Saídas: resumo semanal da academia, lista de alunos sem treino recente (calculada, não "adivinhada"), sugestões de contato para o
  professor (texto proposto, **nunca enviado sozinho**), alertas de retenção, resumo de desempenho por turma.
- Proibido: diagnosticar saúde, alterar permissões, pagamentos, professor ou ficha, enviar mensagens, tomar decisão irreversível,
  expor dado de um aluno a outro.
- Mesmos guarda-corpos já provados: validação de que todo número do texto existe nos fatos; snapshot por período para não regenerar;
  prazo, orçamento de tokens para modelo de raciocínio e fallback local; limite de uso por academia (e cota diária global, decisão
  de custo registrada no PR 75).
- Agregação **no servidor** (Worker) quando a academia for grande: ler centenas de alunos pelo cliente não escala nem é seguro
  (seção 9).

## 9. Arquitetura, custo e segurança (restrições reais)

1. **Spark, sem Cloud Functions**: papéis não podem virar *custom claims*; as regras leem `academyMembers` por `get` em cada
   operação. Cada `get` conta como leitura faturada e há limite de documentos acessados por avaliação (10; 20 em lotes): o desenho
   usa IDs determinísticos para exigir **no máximo 2 a 3 `get`** por regra (membro do ator, atribuição, e o alvo).
2. **Integridade por lote**: criação de academia, aceite de convite, atribuição, troca de professor, mudança de papel e cobrança
   gravam a mudança, o espelho necessário e o log de auditoria no **mesmo lote**, conferidos por `getAfter`/`existsAfter`.
3. **Servidor com credencial** (Worker + conta de serviço): necessário para (a) importar alunos em massa, (b) relatórios agregados,
   (c) gateway de pagamento, (d) IA com dados agregados, (e) busca entre membros. Hoje não existe; introduzi-lo é decisão de
   segurança (secret rotacionável, permissão mínima, rate limit, verificação do token, logs sem dados pessoais, plano de
   revogação), como já mapeado para a busca por nome.
4. **Escalabilidade das listas**: dashboard operacional lê `academyMemberStats` (documentos pequenos) filtrados por academia/filial,
   com paginação; nada de ler `checkIns` de todos.
5. **Ameaças principais**: escalada de papel (regra de teto), acesso cruzado entre academias (todo ID carrega `academyId`),
   professor acessando aluno não atribuído, ex-membro com acesso residual (status checado a cada leitura), convite reaproveitado
   (uso somado no mesmo lote), enumeração de academias/membros (sem listagem pública), vazamento por listas (filtros obrigatórios),
   proprietário removido (transferência obrigatória), exclusão de conta deixando órfãos (limpeza no fluxo de exclusão).
6. **Testes obrigatórios**: matriz de regras no emulador **papel x coleção x operação** (cada célula da seção 2, positivo e
   negativo, para duas academias para provar o isolamento), testes de convite (validade, limite, revogação, papel concedido),
   troca de professor, saída e remoção, e E2E em produção com academia, equipe e alunos fictícios (como feito para treinador/aluno).

## 10. Roadmap

**V2.0, fundação** (sem filiais, sem financeiro):
- Criar academia; convites por link (validade, usos, revogação); membros e papéis; matriz de permissões nas regras e testes;
  suspensão e saída; auditoria; isolamento de dados; troca de contexto (modo individual x academia) na interface.
- Critérios de aceite: duas academias isoladas no emulador, nenhum acesso cruzado; ex-membro sem acesso; convite não muda
  `users.role`; auditoria em todo lote administrativo.

**V2.1, operação**:
- Cadastro e convite de alunos; professor responsável (pedido, aceite do aluno e escopos); atribuição de fichas com **versionamento**;
  fichas da academia; `academyMemberStats` e dashboard básico (alunos ativos, sem professor, sem treino recente, treinos da
  semana). Corresponde à "primeira versão" recomendada (criar academia até dashboard básico); filiais ficam para a etapa seguinte.
- Critérios: professor só vê atribuído **com aceite**; troca de professor encerra o acesso na hora; frequência agregada sem horário.

**V2.2, financeiro e filiais**: planos, mensalidade, status com isenção explícita, histórico, permissões por papel, relatórios
básicos; filiais (`academyBranches`, `branchIds` nas permissões e no dashboard). Gateway fica fora.

**V2.3, inteligência**: resumo semanal da academia, alertas de inatividade e retenção, sugestões de contato (nunca automáticas),
sempre sobre agregados.

**V2.4, marca e escala**: white-label (logo e cores), check-in físico, relatórios avançados, importação em massa (exige servidor com
credencial).

**Migração e convivência**: nada muda para quem não usa academia. Um treinador independente pode **criar uma academia** e convidar
seus alunos atuais; o vínculo antigo (`coachLinks`) continua válido até o aluno aceitar a atribuição da academia, e os dados do
aluno **não são copiados**: o acesso do professor passa a vir da atribuição.

## 11. Decisões que dependem do dono do produto

1. **Quem vê o quê** além do padrão proposto: a coordenação (admin) pode ver treinos dos alunos? (proposta: não, só por
   consentimento extra do aluno).
2. **Professor pode ver "em dia/atrasado" do aluno atribuído?** (proposta: não na V2.0).
3. **Um aluno pode ter mais de um professor na mesma academia?** (proposta: um responsável; co-professor depois).
4. **Nome público dos papéis** em português na interface: Proprietário, Administrador, Professor, Recepção, Aluno.
5. **Limite de academias por conta e de membros por plano**, e o **modelo comercial** (quem paga: academia ou aluno; preço).
6. **Servidor com credencial**: aceitar introduzir o Worker com conta de serviço (seção 9.3) agora ou só quando o gateway/IA agregada
   exigirem? (proposta: depois da V2.1).
7. **Gateway de pagamento**: provedor, taxas, responsabilidade fiscal (fora do escopo da V2.2 inicial).
8. **LGPD**: papéis de controlador e operador (academia x BohTreinar), contrato com a academia, base legal para dados de pagamento
   e prazo de guarda, aviso de privacidade específico e texto de consentimento do aluno ao entrar numa academia. Revisão jurídica
   antes de ligar a V2.1.
9. **Ficha: padrão de publicação** ("só novos alunos" proposto) e se alunos podem recusar atualização.
10. **Migração de treinadores atuais**: obrigatória, opcional ou nunca (proposta: opcional e assistida).

## 12. O que fica fora do desenho inicial

Aplicativo próprio por academia (white-label completo), integração com catraca e controle de acesso físico, emissão fiscal,
marketplace de professores, campeonatos entre academias, e qualquer uso de IA que altere dados ou fale com o aluno sem aprovação.

## Riscos e como o desenho responde

| Risco | Resposta |
| --- | --- |
| Misturar dados pessoais, professor e academia | Coleções separadas, acesso à saúde só por atribuição aceita, projeção mínima de frequência, papel de academia independente do papel global. |
| Regras complexas e caras (leituras por `get`) | IDs determinísticos, 2 a 3 `get` por regra, projeções pequenas para dashboards, servidor agregador só quando necessário. |
| Escalada de privilégio entre papéis | Teto de papel por quem convida/edita, proprietário protegido, auditoria no mesmo lote, matriz testada no emulador. |
| Acesso residual depois de sair | Status conferido a cada leitura; saída e remoção encerram atribuição e apagam a projeção de frequência. |
| Academia grande demais para ler no cliente | `academyMemberStats` paginado; relatórios e IA agregada no Worker. |
| Perder o aluno que usa sozinho | Modo independente permanece intacto; academia é opcional e reversível. |
