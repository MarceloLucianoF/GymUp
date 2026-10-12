# Plano: amigos, ranking e desafios

**Status:** itens 1 a 3 do MVP (amizade, perfil social, ranking semanal de consistência) estão implementados; pontos, conquistas e desafios continuam como plano. Detalhes em `docs/DIAGNOSTICO.md`.

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
1. Amizade: `friendRequests/{id}` e `friendships/{id}` (`pending | active | blocked | removed`), por nome público, código ou link.
2. Perfil social com privacidade (`public | friends | private`) e `publicProfiles/{uid}` só com nome, foto e métricas de consistência.
3. Ranking entre amigos da semana: treinos concluídos, dias ativos, sequência (derivados de `userStats`).
4. Pontos por treino concluído (limite diário), meta semanal e sequência de 3 e 7 dias; histórico imutável `pointsLedger`.
5. Badges básicas (consistência, evolução, social), sempre explicando como foram obtidas.
6. Desafio simples de 7 ou 30 dias entre amigos (`challenges`, `challengeParticipants`), com sair e pausar.

## Pontuação sugerida
Treino concluído 100; meta semanal 250; treino em dia planejado +25; sequência de 3 dias +100 e de 7 dias +300; desafio concluído 500; primeiro treino do mês +100. Teto diário para não premiar excesso. Sem pontos por abrir o app, registrar carga sem concluir séries ou repetir treino no mesmo dia.

## Fases seguintes
Convites por QR, desafios cooperativos, temporadas mensais, notificações configuráveis, grupos e equipes, painel admin (engajamento, badges, denúncias e bloqueios).
