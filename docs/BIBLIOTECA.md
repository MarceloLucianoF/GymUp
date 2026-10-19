# Biblioteca de exercícios

Estado em 19/10/2026. A biblioteca embutida (`src/data/exercises.js`) tem **70 exercícios, todos com GIF** em `public/exercises/<slug>.gif` (e foto em `public/exercicios/<slug>.jpg`, usada em miniaturas). O app junta esta lista com a coleção `exercises` do Firestore (51 exercícios, todos com GIF local), sem duplicar por nome.

Por grupo: peito 9, costas 10, ombro 8, bíceps 10, tríceps 6, perna 11, glúteo 4, panturrilha 3, core 7, cardio 2.

## O que mudou nesta rodada
- 46 exercícios novos com descrição e execução em português, séries, repetições e descanso iniciais, nomes iguais aos do Firestore (para não duplicar) e o GIF já existente anexado. Antes só 24 dos 77 GIFs estavam ligados à biblioteca embutida.
- A composição de fichas por IA e o filtro "somente máquinas" passam a ter muito mais opções (máquinas e polias de todos os grupos).

## GIFs que ficaram de fora de propósito (revisão do treinador)
- `supino-reto`: o GIF mostra halteres (duplica "Supino Reto com Halteres").
- `puxada-frente`: o GIF mostra a puxada atrás da nuca, movimento que não recomendamos como padrão.
- Duplicados de GIFs já usados: `supino-maquina`, `puxada-aberta-maquina`, `puxada-neutra-maquina`, `supino-inclinado-com-halteres` e `elevacao-lateral-maquina` (este mostra halteres, não máquina).

## Pendências de qualidade
- **Hip Thrust Máquina:** o GIF mostra a versão com barra, e o nome (herdado do Firestore e dos modelos oficiais de pernas) diz máquina. Para o filtro "somente máquinas" isso engana; corrigir o nome no Firestore e nos modelos oficiais depois da revisão do treinador.
- **Agachamento Livre com Barra e Rosca Direta com Halteres:** nomes ajustados para o que o GIF mostra (antes: "Agachamento Livre" e "Rosca Direta" aproximados).
- **Flexão Nórdica Inversa:** o GIF é um agachamento sissy com carga; revisar o nome.
- Todos os textos novos de execução devem passar pelo olhar de um treinador antes de virarem referência oficial.
