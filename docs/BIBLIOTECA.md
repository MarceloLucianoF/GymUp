# Biblioteca de exercícios

Estado em 21/10/2026. A biblioteca embutida (`src/data/exercises.js`) tem **141 exercícios, todos com GIF** em `public/exercises/<slug>.gif` (e foto em `public/exercicios/<slug>.jpg`, usada em miniaturas). O app junta esta lista com a coleção `exercises` do Firestore (51 exercícios, todos com GIF local), sem duplicar por nome: catálogo final de 143 (confira com o auditor `scripts/audit-catalog.cjs`).

Por grupo (catálogo final): costas 17, pernas 17, peito 14, core 12, ombros 11, bíceps 11, alongamento e mobilidade 11, tríceps 9, cardio 9, glúteos 6, panturrilha 3.

## Lote 2 de 21/10/2026 (21 exercícios novos, ex121 a ex141)
- **Panturrilha (4):** leg press, sentado unilateral com halter, Smith e burrinho. **Glúteos (4):** hip thrust com barra, chute na polia, coice em quatro apoios e ponte na bola suíça.
- **Trapézio (4, no grupo Ombros):** encolhimento com barra e na polia, remada alta com barra e na polia. **Antebraço (4, no grupo Bíceps):** rosca de punho (palmas para cima e para baixo), rosca inversa e caminhada do fazendeiro (por tempo).
- **Mobilidade (5):** lombar (joelho ao peito), glúteo sentado (piriforme), glúteo deitado, antebraço e inclinação pélvica.
- Mídia e textos como na ampliação anterior (`scripts/catalogo-novo.py`, Free Exercise DB, domínio público). Os textos em português ainda precisam de revisão de um treinador, como os anteriores. Trapézio e antebraço ficam nos grupos existentes porque o app não tem esses grupos separados.

## Ampliação de 20/10/2026 (50 exercícios novos, ex71 a ex120)
- **Peso livre e peso do corpo (30):** supino reto e inclinado com barra, supino fechado, crucifixo com halteres, flexão de braço, mergulho nas paralelas, remada curvada com barra, levantamento terra, barra fixa supinada, remada invertida, superman, encolhimento, desenvolvimento Arnold, elevação frontal, rosca martelo, tríceps testa com barra W, mergulho no banco, stiff, agachamento goblet, avanço com barra, agachamento búlgaro, subida no banco, bom dia, ponte de glúteo (comum e unilateral), abdominal no solo, prancha lateral, russian twist, elevação de pernas na barra e dead bug.
- **Braços (pedido do aluno, 2):** Rosca Scott Martelo com Halteres (pegada neutra no banco Scott; o texto explica o drop-set opcional) e Tríceps Francês na Polia Unilateral (a imagem mostra a versão com corda, de duas mãos; o movimento é o mesmo).
- **Cardio (7):** bicicleta ergométrica, elíptico, escada, remo ergométrico, pular corda, caminhada e corrida na esteira. Prescrição em minutos.
- **Alongamento e mobilidade (11):** posterior de coxa, quadríceps, peitoral, ombro, tríceps, panturrilha, flexor do quadril, gato, postura da criança e dois aquecimentos (círculos de braços e de quadril). Novo grupo "mobilidade", por tempo (segundos), sem carga.
- **Mídia:** foto e GIF de 2 quadros (início e fim) do Free Exercise DB (domínio público, licença Unlicense), gerados por `python3 scripts/catalogo-novo.py`. Os textos em português são do BohTreinar e foram escritos conferindo o movimento mostrado em cada imagem; um treinador deve revisá-los.
- **Gerador:** alongamento e cardio nunca entram em ficha de musculação. O pedido "treino de alongamento" no Coach IA monta uma sequência de 8 alongamentos por tempo; o pedido de cardio segue montando a ficha aeróbica.
- **Equipamento:** quem marcou só barra, ou só halteres e peso do corpo, passa a ter opções em todos os grupos principais.

## Rodada anterior (19/10/2026): 46 exercícios ligados a GIFs já existentes
- 46 exercícios novos com descrição e execução em português, séries, repetições e descanso iniciais, nomes iguais aos do Firestore (para não duplicar) e o GIF já existente anexado. Antes só 24 dos 77 GIFs estavam ligados à biblioteca embutida.
- A composição de fichas por IA e o filtro "somente máquinas" passam a ter muito mais opções (máquinas e polias de todos os grupos).

## GIFs que ficaram de fora de propósito (revisão do treinador)
- `supino-reto`: o GIF mostra halteres (duplica "Supino Reto com Halteres").
- `puxada-frente`: o GIF mostra a puxada atrás da nuca, movimento que não recomendamos como padrão.
- Duplicados de GIFs já usados: `supino-maquina`, `puxada-aberta-maquina`, `puxada-neutra-maquina`, `supino-inclinado-com-halteres` e `elevacao-lateral-maquina` (este mostra halteres, não máquina).

## Pendências de qualidade
- **Hip Thrust Máquina:** o GIF mostra a versão com barra, e o nome (herdado do Firestore e dos modelos oficiais de pernas) diz máquina. Para o filtro "somente máquinas" isso engana; corrigir o nome no Firestore e nos modelos oficiais depois da revisão do treinador.
- **Agachamento Livre com Barra e Rosca Direta com Halteres:** nomes ajustados para o que o GIF mostra (antes: "Agachamento Livre" e "Rosca Direta" aproximados).
- **Flexão Nórdica Inversa:** o GIF é um agachamento sissy com carga. Em 22/10/2026 a execução passou a descrever a versão ajoelhada (como o nome) e avisa que a imagem é a variação em pé; marcada como imagem de referência.
- Todos os textos novos de execução devem passar pelo olhar de um treinador antes de virarem referência oficial.

## Imagens de referência (22/10/2026)
Glúteo Máquina, Pullover Máquina, Elevação Lateral Máquina, Hip Thrust Máquina e Flexão Nórdica Inversa não têm imagem da própria máquina/movimento no banco de domínio público. O texto de execução agora diz o que a imagem mostra ("A imagem mostra a versão com barra; na máquina o movimento é o mesmo"), no app e no Firestore (backup em `~/bohtreinar-backups/catalogo-imagens-referencia-2026-10-22.json`). Glúteo Máquina ganhou descrição completa. Trocar as imagens exige foto/vídeo próprio (ex.: gravado na academia).
