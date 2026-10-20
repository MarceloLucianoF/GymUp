# Roadmap de produto (19/10/2026)

Duas frentes: a **Gestão** (academias) e a **ferramenta de treino** (aluno, professor e IA). Ordem pensada em valor para quem paga (a academia) e em risco baixo.

## Gestão: de cadastro para gestão de verdade
Já existe: membros, convites, professor-aluno, fichas versionadas, atribuição em lote, auditoria, exportação e encerramento (LGPD). Faltava o que faz a academia usar todo dia: **dinheiro**.

### Feito agora: Financeiro (migração 0007)
- **Planos** (nome, mensalidade, ativo) e **contratos** do aluno (plano, valor combinado, dia de vencimento 1 a 28, início, pausar, encerrar).
- **Cobranças mensais**: gerar o mês (prévia e idempotente, uma por contrato e mês), **registrar pagamento** (Pix, dinheiro, cartão, transferência; recepção pode), desfazer, ajustar desconto e vencimento, isentar e cancelar (dono e administrador).
- **Resumo**: previsto, recebido, a vencer, em atraso e inadimplência do mês, últimos 6 meses, por plano, receita recorrente mensal, ticket médio, entradas e saídas de contrato em 30 dias, atrasados mais antigos e últimos pagamentos.
- **Planilha** (CSV em português, protegida contra fórmula) e tudo na auditoria. Sem gateway: nenhum dado de cartão passa pelo sistema.

### Próximos passos da Gestão (em ordem)
1. **Cobrança que chega ao aluno:** mensagem pronta de lembrete e de atraso (link de WhatsApp com texto), **Pix copia e cola** com a chave da academia, e a tela "Minhas mensalidades" no app do aluno (o aluno vê o que está em aberto e o comprovante).
2. **Geração automática** das cobranças no dia 1 (gatilho agendado do Cloudflare), com alerta de falha.
3. **Controle da academia:** retenção (alunos que pararam de treinar, com o consentimento de aderência), novos e cancelamentos por mês, meta de receita, relatório de inadimplência por faixa de atraso, fechamento do mês.
4. **Gateway** (Pix automático e boleto) só depois de validar o uso manual com uma academia piloto e de definir o parceiro; o desenho já separa cobrança de pagamento.
5. **Equipe:** comissões e horas de professor, agenda de aulas e ocupação (quando houver catraca ou check-in).

## Ferramenta de treino
Já existe: biblioteca embutida de **70 exercícios, todos com GIF**, fichas oficiais, composição de fichas por IA com validação, filtro "somente máquinas", execução guiada com descanso, offline, evolução e instalação no iPhone.

### Em andamento
- **Biblioteca completa com GIF** (PR da biblioteca) e pendências de revisão de treinador listadas em `docs/BIBLIOTECA.md`.

### Próximos passos (IA que muda o treino)
1. **Carga sugerida (dupla progressão):** a cada exercício, sugerir a carga e as repetições da próxima série a partir do histórico (bateu o topo das repetições, sobe; ficou abaixo, mantém; três semanas parado, sugere descarga). Cálculo local, sem rede, com explicação em uma frase.
2. **Trocar exercício:** na execução, "não tenho esse aparelho" ou "dói aqui": sugere equivalentes do mesmo grupo e equipamento (biblioteca primeiro; IA só explica), mantendo a ficha válida.
3. **Semana inteira pela IA:** pedido "treino de 4 dias, só máquinas" gera a divisão (ABC, push/pull/legs) com a mesma validação por biblioteca da ficha única.
4. **Resumo do treino:** ao finalizar, um parágrafo com volume por grupo, recordes e o que ajustar na próxima semana.
5. **Coach para o professor (Gestão):** o professor descreve o aluno (objetivo, nível, restrições) e a IA propõe a ficha, que ele revisa e publica; nada vai ao aluno sem revisão humana.
6. **Biblioteca viva:** busca em linguagem natural, vídeos de execução e novos exercícios (halteres e peso do corpo) com GIF próprio; revisão de treinador antes de virar referência oficial.
7. **Mais adiante:** análise de técnica por vídeo e alertas de risco (sobrecarga, desequilíbrio entre grupos).

## Regras que valem para tudo
Revisão independente do diff em mudança de Worker, banco ou regras; teste de isolamento entre duas academias em todo endpoint novo; homologação primeiro; dado financeiro só para quem tem papel; IA sugere, humano decide, e o app nunca inventa exercício fora da biblioteca.

## Paridade com o mercado (19/10/2026)

Lista dos apps líderes comparada com o que o BohTreinar tem hoje. "Tem" foi conferido no código; o que não está marcado como tem não existe.

| Recurso do mercado | Hoje | Próximo passo |
| --- | --- | --- |
| Registro de séries, carga, repetições, descanso | Tem (carga, repetições, esforço RPE, temporizador de descanso). Agora também cardio por minutos e prancha por segundos | Tipos de série: aquecimento, drop-set, até a falha, superset |
| Tipos de série (aquecimento, drop-set, falha, superset) | Não tem | Campo `setType` por série e agrupamento de superset na ficha; começa pelo aquecimento e pela falha |
| Planejador de rotinas | Tem (fichas do treinador, "Meus treinos" privados, importação de PDF, montar do zero) | Duplicar e reordenar ficha pessoal; pastas por rotina |
| Biblioteca de exercícios | 70 exercícios com GIF, sem vídeo em nenhum; treinador cadastra exercícios; aluno só cria dentro do próprio treino | Exercício personalizado do aluno (privado) reutilizável; mais cardio e alongamento; vídeos |
| Estatísticas: volume, carga, PR, 1RM, grupos | Tem gráfico por exercício, recorde de carga, 1RM nas ferramentas e equilíbrio muscular | Painel único de evolução com volume semanal e PR por exercício |
| Comunidade: seguir, curtir, feed, compartilhar rotina | Tem amigos; sem feed, curtida nem compartilhar ficha | Feed de treinos concluídos e compartilhar ficha como cópia privada |
| Strava | Não tem | Exportar treino como atividade (OAuth); só depois da Gestão em produção |
| Apple Watch e Wear OS | Não tem | Exige app nativo: começar pelo PWA com notificação de descanso e avaliar app nativo depois |
| Plataforma do treinador | Tem (fichas, pacotes, vínculos, Gestão com financeiro) | Prescrever cardio e prancha no editor (feito), retenção e relatórios (Gestão) |

Prioridade sugerida: (1) tipos de série, porque muda o registro de treino que todo aluno usa; (2) exercício personalizado do aluno e mais cardio; (3) feed e compartilhar ficha; (4) Strava; (5) relógio. As fichas da academia (Gestão) ainda usam só séries e repetições: cardio e prancha ficam para quando o contrato compartilhado ganhar o campo `kind`.
