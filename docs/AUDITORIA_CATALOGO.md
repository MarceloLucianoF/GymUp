# Auditoria do catálogo de exercícios

Gerada por `node scripts/audit-catalog.cjs --remote <exportação do Firestore>`. Só lê; nada é alterado.

## Totais

- Biblioteca embutida: 70
- Firestore: 51
- Catálogo final (sem repetir nome): **74**
- Em ambas as fontes: 47; só no Firestore: 4

| Grupo | Exercícios |
| --- | --- |
| Costas | 12 |
| Pernas | 11 |
| Peito | 10 |
| Bíceps | 10 |
| Ombros | 9 |
| Core | 7 |
| Tríceps | 6 |
| Glúteos | 4 |
| Panturrilha | 3 |
| Cardio | 2 |

| Equipamento principal | Exercícios |
| --- | --- |
| maquina | 31 |
| halter | 15 |
| polia | 12 |
| livre | 9 |
| barra | 5 |
| cardio | 2 |

| Tipo | Exercícios |
| --- | --- |
| strength | 71 |
| cardio | 2 |
| timed | 1 |

| Dificuldade | Exercícios |
| --- | --- |
| iniciante | 42 |
| intermediario | 29 |
| avancado | 3 |

## Erros (quebram o uso): 0

Nenhum.

## Avisos (corrigir): 25

### grupo-generico (10)

- Rosca Alternada Máquina [firestore]: "braços" -> biceps
- Rosca Martelo na Polia [firestore]: "braços" -> biceps
- Tríceps Unilateral na Polia [firestore]: "braços" -> triceps
- Rosca Scott Máquina [firestore]: "braços" -> biceps
- Tríceps Supinado com Halteres [firestore]: "braços" -> triceps
- Rosca Direta Banco Inclinado [firestore]: "braços" -> biceps
- Tríceps Máquina [firestore]: "braços" -> triceps
- Rosca Scott com Barra W [firestore]: "braços" -> biceps
- Tríceps Barra Encostado na Polia [firestore]: "braços" -> triceps
- Rosca Direta na Polia Baixa com Corda [firestore]: "braços" -> biceps

### midia-aproximada (4)

- Elevação Lateral Máquina [firestore]
- Hip Thrust Máquina [firestore]
- Glúteo Máquina [firestore]
- Pullover Máquina [firestore]

### sem-descricao (1)

- Glúteo Máquina [firestore]

### possivel-duplicata (2)

- Supino Reto Máquina  ~  Supino Máquina [embutida / firestore]: grupos peito
- Puxada Aberta (Lat Pulldown)  ~  Puxada Aberta Máquina [embutida / firestore]: grupos costas

### fontes-divergem (8)

- Supino Declinado Máquina [embutida x firestore]: grupo peito/peito; dificuldade intermediario/iniciante
- Extensão Lombar Y + W [embutida x firestore]: grupo costas/core; dificuldade intermediario/iniciante
- Abdominal trocando bola suíça [embutida x firestore]: grupo core/core; dificuldade iniciante/intermediario
- Crucifixo Inverso no Banco Inclinado [embutida x firestore]: grupo ombros/costas; dificuldade intermediario/intermediario
- Flexão Nórdica Inversa [embutida x firestore]: grupo pernas/pernas; dificuldade avancado/intermediario
- Barra Fixa (Em pé) [embutida x firestore]: grupo costas/costas; dificuldade intermediario/avancado
- Abdominal Canivete Alternado [embutida x firestore]: grupo core/core; dificuldade intermediario/iniciante
- Pullover Máquina [embutida x firestore]: grupo costas/costas; dificuldade intermediario/iniciante

## Informações: 221

### sem-video (116)

- Supino Reto Máquina [embutida]
- Supino Inclinado Halter [embutida]
- Peck Deck (Voador) [embutida]
- Desenvolvimento Halter [embutida]
- Elevação Lateral [embutida]
- Tríceps Corda [embutida]
- ... e mais 110

### dificuldade-fora-do-padrao (3)

- Agachamento Livre ou Hack [embutida]: "avancado" (padrão: avançado)
- HIIT (Cardio de Alta Intensidade) [embutida]: "avancado" (padrão: avançado)
- Flexão Nórdica Inversa [embutida]: "avancado" (padrão: avançado)

### reps-em-texto (51)

- Mesa Flexora [firestore]: "10"
- Rosca Alternada Máquina [firestore]: "10"
- Remada Articulada [firestore]: "10"
- Extensão Lombar Y + W [firestore]: "10"
- Crucifixo no Cabo [firestore]: "12"
- Rosca Martelo na Polia [firestore]: "12"
- ... e mais 45

### equipamento-deduzido (51)

- Mesa Flexora [firestore]: maquina
- Rosca Alternada Máquina [firestore]: maquina
- Remada Articulada [firestore]: maquina
- Extensão Lombar Y + W [firestore]: livre
- Crucifixo no Cabo [firestore]: polia
- Rosca Martelo na Polia [firestore]: polia
- ... e mais 45

## Fichas na loja: 13 achados em 8 fichas

### ficha-demonstracao (4)

- Treino A — Peito e Tríceps: 5 de 5 itens com id demo_*
- Treino B — Costas e Bíceps: 5 de 5 itens com id demo_*
- Treino C — Pernas e Ombros: 5 de 5 itens com id demo_*
- Full Body Express: 4 de 4 itens com id demo_*

### exercicio-fora-do-catalogo (4)

- Treino A — Peito e Tríceps: 3 de 5 sem correspondência no catálogo
- Treino B — Costas e Bíceps: 5 de 5 sem correspondência no catálogo
- Treino C — Pernas e Ombros: 2 de 5 sem correspondência no catálogo
- Full Body Express: 4 de 4 sem correspondência no catálogo

### exercicio-sem-imagem (4)

- Treino A — Peito e Tríceps: 3 de 5
- Treino B — Costas e Bíceps: 5 de 5
- Treino C — Pernas e Ombros: 2 de 5
- Full Body Express: 4 de 4

### titulo-incoerente (1)

- TREINO COSTAS: título fala de costas, mas só 1 de 4 exercícios são desse(s) grupo(s) (peito 2, ombros 1, costas 1)

## Catálogo final

| Nome | Grupo | Equipamento | Tipo | Dificuldade | Fontes |
| --- | --- | --- | --- | --- | --- |
| Rosca Alternada Halter | Bíceps | halter | strength | iniciante | embutida |
| Rosca Alternada Máquina | Bíceps | maquina | strength | iniciante | embutida+firestore |
| Rosca Concentrada | Bíceps | halter | strength | intermediario | embutida |
| Rosca Direta Banco Inclinado | Bíceps | halter | strength | intermediario | embutida+firestore |
| Rosca Direta Barra | Bíceps | barra | strength | iniciante | embutida |
| Rosca Direta com Halteres | Bíceps | halter | strength | iniciante | embutida |
| Rosca Direta na Polia Baixa com Corda | Bíceps | polia | strength | iniciante | embutida+firestore |
| Rosca Martelo na Polia | Bíceps | polia | strength | iniciante | embutida+firestore |
| Rosca Scott com Barra W | Bíceps | barra | strength | intermediario | embutida+firestore |
| Rosca Scott Máquina | Bíceps | maquina | strength | iniciante | embutida+firestore |
| Esteira / Bike / Escada | Cardio | cardio | cardio | iniciante | embutida |
| HIIT (Cardio de Alta Intensidade) | Cardio | cardio | cardio | avancado | embutida |
| Abdominal Canivete Alternado | Core | livre | strength | intermediario | embutida+firestore |
| Abdominal Infra | Core | livre | strength | intermediario | embutida |
| Abdominal Máquina | Core | maquina | strength | iniciante | embutida+firestore |
| Abdominal Oblíquo (Bicicleta) | Core | livre | strength | intermediario | embutida |
| Abdominal trocando bola suíça | Core | livre | strength | iniciante | embutida+firestore |
| Crunch na Polia | Core | polia | strength | intermediario | embutida+firestore |
| Prancha Abdominal | Core | livre | timed | iniciante | embutida |
| Barra Fixa (Em pé) | Costas | livre | strength | intermediario | embutida+firestore |
| Extensão Lombar Y + W | Costas | livre | strength | intermediario | embutida+firestore |
| Pullover Máquina | Costas | maquina | strength | intermediario | embutida+firestore |
| Puxada Aberta (Lat Pulldown) | Costas | polia | strength | iniciante | embutida |
| Puxada Aberta Máquina | Costas | maquina | strength | iniciante | firestore |
| Puxada Neutra Máquina | Costas | maquina | strength | iniciante | firestore |
| Puxada Triângulo (Pegada Fechada) | Costas | polia | strength | iniciante | embutida |
| Remada Articulada | Costas | maquina | strength | iniciante | embutida+firestore |
| Remada Cavalinho Máquina | Costas | maquina | strength | intermediario | embutida+firestore |
| Remada Curvada com Halteres (Pegada Neutra) | Costas | halter | strength | intermediario | embutida+firestore |
| Remada Máquina (Sentado) | Costas | maquina | strength | iniciante | embutida |
| Remada Neutra Máquina | Costas | maquina | strength | iniciante | embutida+firestore |
| Cadeira Abdutora | Glúteos | maquina | strength | iniciante | embutida+firestore |
| Elevação Pélvica (Glúteo) | Glúteos | livre/barra | strength | intermediario | embutida |
| Glúteo Máquina | Glúteos | maquina | strength | iniciante | embutida+firestore |
| Hip Thrust Máquina | Glúteos | maquina | strength | intermediario | embutida+firestore |
| Crucifixo Inverso Máquina | Ombros | maquina | strength | iniciante | embutida+firestore |
| Crucifixo Inverso no Banco Inclinado | Ombros | halter | strength | intermediario | embutida+firestore |
| Desenvolvimento Barra Reta | Ombros | barra | strength | intermediario | embutida+firestore |
| Desenvolvimento Halter | Ombros | halter | strength | intermediario | embutida |
| Desenvolvimento Máquina | Ombros | maquina | strength | iniciante | embutida+firestore |
| Elevação Lateral | Ombros | halter | strength | iniciante | embutida |
| Elevação Lateral Máquina | Ombros | maquina | strength | iniciante | firestore |
| Elevação Lateral Sentado com Halteres | Ombros | halter | strength | iniciante | embutida+firestore |
| Face Pull na Polia | Ombros | polia | strength | intermediario | embutida+firestore |
| Panturrilha em Pé (Máquina) | Panturrilha | maquina | strength | iniciante | embutida |
| Panturrilha em pé com Halteres | Panturrilha | halter | strength | iniciante | embutida+firestore |
| Panturrilha Sentado Máquina | Panturrilha | maquina | strength | iniciante | embutida+firestore |
| Chest Press Convergente | Peito | maquina | strength | iniciante | embutida+firestore |
| Crossover na Polia | Peito | polia | strength | intermediario | embutida+firestore |
| Crucifixo no Cabo | Peito | polia | strength | intermediario | embutida+firestore |
| Peck Deck (Voador) | Peito | maquina | strength | iniciante | embutida |
| Supino Declinado Máquina | Peito | maquina | strength | intermediario | embutida+firestore |
| Supino Inclinado Halter | Peito | halter | strength | intermediario | embutida+firestore |
| Supino Inclinado Máquina | Peito | maquina | strength | iniciante | embutida+firestore |
| Supino Máquina | Peito | maquina | strength | iniciante | firestore |
| Supino Reto com Halteres | Peito | halter | strength | intermediario | embutida+firestore |
| Supino Reto Máquina | Peito | maquina | strength | iniciante | embutida |
| Afundo Livre com Halteres | Pernas | halter | strength | intermediario | embutida+firestore |
| Agachamento com Halteres | Pernas | halter | strength | iniciante | embutida+firestore |
| Agachamento Livre com Barra | Pernas | barra | strength | intermediario | embutida |
| Agachamento Livre ou Hack | Pernas | barra/maquina | strength | avancado | embutida |
| Cadeira Adutora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Cadeira Extensora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Cadeira Flexora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Flexão Nórdica Inversa | Pernas | livre | strength | avancado | embutida+firestore |
| Hack Squat | Pernas | maquina | strength | intermediario | embutida+firestore |
| Leg Press | Pernas | maquina | strength | intermediario | embutida |
| Mesa Flexora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Tríceps Barra (Pushdown) | Tríceps | polia | strength | iniciante | embutida |
| Tríceps Barra Encostado na Polia | Tríceps | polia | strength | iniciante | embutida+firestore |
| Tríceps Corda | Tríceps | polia | strength | iniciante | embutida |
| Tríceps Máquina | Tríceps | maquina | strength | iniciante | embutida+firestore |
| Tríceps Supinado com Halteres | Tríceps | halter | strength | intermediario | embutida+firestore |
| Tríceps Unilateral na Polia | Tríceps | polia | strength | intermediario | embutida+firestore |
