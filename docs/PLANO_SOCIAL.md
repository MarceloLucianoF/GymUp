# Plano: amigos, ranking e desafios

**Status:** itens 1 a 3 do MVP (amizade, perfil social, ranking semanal de consistência) e o MVP de desafios em grupo (item 6, 29/10/2026) estão implementados; pontos e conquistas continuam como plano. Detalhes em `docs/DIAGNOSTICO.md`.

## Princípios
- **Competição opt-in** e baseada em **consistência**, nunca em dados de saúde: nada de peso, medidas, cargas ou fotos no ranking.
- Treinador (relação profissional, acesso a dados com aceite) e amigo (relação social, sem acesso a dados) são relações **separadas**.
- Pontos só são gravados por um caminho confiável; o cliente não atribui pontos.
- Linguagem sem culpa: "João treinou hoje. Você ainda tem 2 dias para a sua meta", nunca "você está perdendo".

## Limitação técnica a resolver antes
O plano gratuito do Firebase não tem Cloud Functions. Para pontos e ranking confiáveis há duas saídas:
1. **Regras do Firestore** (como o contador `userStats`): o documento de pontos só muda junto do check-in no mesmo lote, com valor calculado pela regra (`getAfter`). Serve para pontos simples por treino.
2. **Worker da Cloudflare com credencial de serviço** (secret): cálculo de ranking, temporadas e conquistas fora do cliente. Exige guardar uma chave de serviço no Worker (decisão de segurança a tomar).

## MVP (ordem)
1. Amizade: `friendRequests/{id}` e `friendships/{id}` (`pending | active | blocked | removed`), por @usuário ou código, e por prefixo do nome/@ entre quem escolheu ser encontrado (29/10/2026; ver seção abaixo).
2. Perfil social com privacidade (`public | friends | private`) e `publicProfiles/{uid}` só com nome, foto e métricas de consistência.
3. Ranking entre amigos da semana: treinos concluídos, dias ativos, sequência (derivados de `userStats`).
4. Pontos por treino concluído (limite diário), meta semanal e sequência de 3 e 7 dias; histórico imutável `pointsLedger`.
5. Badges básicas (consistência, evolução, social), sempre explicando como foram obtidas.
6. Desafio simples de 7 ou 30 dias (`challenges`, `challenges/{id}/members`, `challengeCodes`), com entrar por código e sair. **Implementado (MVP, sem pausar), ver seção abaixo.**

## Pontuação sugerida
Treino concluído 100; meta semanal 250; treino em dia planejado +25; sequência de 3 dias +100 e de 7 dias +300; desafio concluído 500; primeiro treino do mês +100. Teto diário para não premiar excesso. Sem pontos por abrir o app, registrar carga sem concluir séries ou repetir treino no mesmo dia.

## Atividade entre amigos (implementada em 21/10/2026)
Coleção `socialPosts` (autor, título, minutos, séries, exercícios, recordes) com `likes`. Opt-in em `publicProfiles.shareWorkouts`; leitura só para o autor e amigos ativos de quem compartilha. Sem comentários, imagens nem texto livre, para não abrir moderação. Denúncia (motivos fixos, fila no painel do admin) e aviso de curtidas implementados. Comentários (curtos, sem links, denunciáveis) e avisos com o app fechado (Web Push) implementados em 22/10/2026.

## Busca de pessoas pelo nome (implementada em 29/10/2026)
**Como funciona.** A aba Buscar aceita nome, @usuário ou código. O @ e o código exatos continuam por documento (`handles`, `friendCodes`). Além disso, `searchProfiles` (`src/services/socialService.js`) faz duas consultas de prefixo em `publicProfiles`: `where('discoverable','==',true)` + `orderBy('displayNameLower')` + `startAt(termo)`/`endAt(termo+'\uf8ff')` + `limit(10)`, e o mesmo com `orderBy('handle')`. Digitar "marc" acha "Marcelo". Mínimo de 2 letras. Índices compostos `(discoverable, displayNameLower)` e `(discoverable, handle)` em `firestore.indexes.json`.

**Contrato das regras (`publicProfiles`, `allow list`).** Admin lista tudo. Usuário logado só lista se a consulta garantir `discoverable == true` (filtro de igualdade obrigatório) e tiver `limit` inteiro de no máximo 20. Sem o filtro, com `discoverable == false`, sem limite, com limite acima de 20 ou sem login: negado. O `get` não mudou (bloqueado continua sem ler o perfil de quem o bloqueou). Testes em `rules-test/firestore.rules.test.js`.

**Bloqueios.** As regras não conseguem consultar a amizade de cada documento numa lista. Por isso o app busca as amizades do usuário (`friendships` com `userA`/`userB`) e esconde quem bloqueou o usuário ou foi bloqueado por ele, além do próprio usuário. Um cliente adulterado consegue ver na lista o nome e o @ de quem o bloqueou, se essa pessoa for descobrível. Quem quer sumir de vez desliga "Pessoas podem me encontrar pelo nome" (o teste de regras comprova que o perfil sai da busca na hora).

**Riscos avaliados.**
- *Enumeração de perfis descobríveis:* com prefixos curtos e paginação, alguém consegue listar todos os perfis com `discoverable == true` (nome, @, código de amigo, meta semanal e opções de compartilhamento: o documento inteiro, porque o Firestore não projeta campos). Isso já era legível um a um pelo `get` para quem soubesse o @; a busca só facilita juntar a lista. Mitigações: opt-in explícito com texto claro no perfil (padrão desligado), limite de 20 por consulta, nenhum dado de saúde ou treino no perfil público, foto sempre vazia. Pedido de amizade continua exigindo aceite.
- *Bloqueio só no cliente:* descrito acima; a pessoa bloqueada não consegue ler o perfil por `get`, não vê posts nem pede amizade de novo (regras de `friendships`).
- *Custo:* cada busca são até 2 consultas de até 10 documentos mais as 2 consultas de amizades.
- *Futuro (se o risco crescer):* mover a busca para o Worker com credencial de serviço, que filtra bloqueios no servidor e devolve só nome e @, ou criar uma coleção de índice sem o código de amigo; limitar taxa por usuário.
- Só o começo do nome é buscado ("filho" não acha "Marcelo Filho"); buscar por palavras exigiria um campo de termos no perfil.

## Desafios em grupo (MVP implementado em 29/10/2026)
**Como funciona.** Aba Desafios em Amigos (`src/components/social/ChallengesTab.jsx`, `src/services/challengeService.js`, `src/utils/challenges.js`). Exige perfil social (os membros veem nome público e @). Criar começa hoje; o código de 8 caracteres (sem O/0/I/1, gerado com `crypto.getRandomValues`) é o convite.

**Contrato.**
- `challenges/{id}`: `name` (1 a 40, sem links), `durationDays` (7 ou 30), `startDay`/`endDay` (AAAA-MM-DD no fuso do aparelho; fim = início + duração − 1), `ownerId`, `code` (`^[A-Z0-9]{8}$`), `memberCount` (0 a 50), `status` (`active | ended`), `createdAt` (hora do servidor).
- `challenges/{id}/members/{uid}`: `uid`, `displayName` e `handle` (iguais aos do `publicProfiles` do próprio usuário), `code` (o do desafio), `joinedAt`, `activeDays` (0 a 30), `lastDay` (vazio ou AAAA-MM-DD), `updatedAt` (hora do servidor).
- `challengeCodes/{code}`: `{ challengeId }`.

**Permissões.**
- Ler desafio e lista de membros: só membros (nem admin). Listar `challenges` ou `challengeCodes`: ninguém. `challengeCodes/{code}` por `get`: qualquer pessoa logada (quem sabe o código).
- Criar: o dono, num lote com o código e o próprio membro; `memberCount == 1`, início entre −36 h e +14 h da hora do servidor (fusos).
- Entrar: lote com o próprio membro (código igual ao do desafio, placar zerado) + `memberCount` +1; desafio `active`, não terminado e com menos de 50.
- Sair: lote apagando o próprio membro + `memberCount` −1. O dono não sai: encerra (`status: ended`, só esse campo) ou apaga (membros, código e desafio no mesmo lote).
- Placar: cada um só no próprio documento; `activeDays` nunca diminui; a cada aumento `lastDay` avança pelo menos tantos dias de calendário quanto o aumento (no máximo 1 por dia), fica dentro do período e não no futuro (+14 h de tolerância de fuso); congela com o desafio encerrado ou depois do fim.
- Grupo de coleções `members`: cada um lista só os próprios documentos (`uid == auth.uid`), para a lista "meus desafios" e a exclusão de conta. Índice de campo `members.uid` (COLLECTION_GROUP) em `firestore.indexes.json`.

**Riscos aceitos.**
- *Fraude no placar:* não é à prova de fraude. O valor vem do aparelho; um cliente adulterado consegue marcar até 1 dia por dia sem ter treinado. As regras só impedem números impossíveis. Endurecer depois: exigir `userStats.lastActiveDay >= lastDay` (vale só se o contador estiver sempre em dia) ou calcular no Worker com credencial de serviço.
- *Código como convite:* quem recebe o código (ou o link) entra; o dono não expulsa nem troca o código nesta versão (pode encerrar ou apagar). Tentar adivinhar: 32^8 combinações.
- *Sobras:* as regras não conseguem conferir que todos os membros saíram quando o dono apaga; o app apaga tudo no mesmo lote, e sobras de desafio inexistente são apagadas pelo próprio membro na próxima abertura.
- *Spam:* não há limite de desafios criados por pessoa; o nome é curto e sem links.
- *Denúncia:* ficou para depois (`socialReports` só aceita post e comentário; incluir desafio exige nova forma de documento e fila no admin). Sem chat e sem foto.

## Fases seguintes
Convites por QR, desafios cooperativos, temporadas mensais, notificações configuráveis, grupos e equipes, painel admin (engajamento, badges, denúncias e bloqueios).

## Busca por nome (29/10/2026, após revisão)
A busca não lista o perfil público inteiro: usa o índice `profileSearch/{uid}` com só `uid`, nome e @ (sem código de amigo nem preferências), escrito no mesmo lote do perfil e só enquanto "Pessoas podem me encontrar pelo nome" estiver ligado (as regras conferem com `getAfter`). Listagem com login e no máximo 10 por consulta; sem leitura direta. Limites aceitos: dá para juntar os nomes e @ de quem escolheu ser encontrado; quem bloqueou ainda aparece por nome/@ para o bloqueado (o app esconde; o perfil completo e o pedido de amizade continuam barrados pelas regras). Perfis que já eram descobríveis entram na busca na próxima vez que salvarem o perfil social.

