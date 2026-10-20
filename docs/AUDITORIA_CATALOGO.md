# Auditoria do catálogo de exercícios

Gerada por `node scripts/audit-catalog.cjs --remote <exportação do Firestore>`. Só lê; nada é alterado.

## Totais

- Biblioteca embutida: 118
- Firestore: 51
- Catálogo final (sem repetir nome): **120**
- Em ambas as fontes: 49; só no Firestore: 2

| Grupo | Exercícios |
| --- | --- |
| Costas | 17 |
| Pernas | 17 |
| Peito | 14 |
| Core | 12 |
| Ombros | 11 |
| Bíceps | 11 |
| Alongamento e mobilidade | 11 |
| Tríceps | 9 |
| Cardio | 9 |
| Glúteos | 6 |
| Panturrilha | 3 |

| Equipamento principal | Exercícios |
| --- | --- |
| livre | 33 |
| maquina | 29 |
| halter | 23 |
| barra | 14 |
| polia | 12 |
| cardio | 9 |

| Tipo | Exercícios |
| --- | --- |
| strength | 98 |
| timed | 13 |
| cardio | 9 |

| Dificuldade | Exercícios |
| --- | --- |
| iniciante | 69 |
| intermediario | 45 |
| avancado | 6 |

## Erros (quebram o uso): 0

Nenhum.

## Avisos (corrigir): 5

### midia-aproximada (4)

- Elevação Lateral Máquina [firestore]
- Hip Thrust Máquina [firestore]
- Glúteo Máquina [firestore]
- Pullover Máquina [firestore]

### sem-descricao (1)

- Glúteo Máquina [firestore]

## Informações: 276

### sem-video (164)

- Supino Reto Máquina [embutida]
- Supino Inclinado Halter [embutida]
- Peck Deck (Voador) [embutida]
- Desenvolvimento Halter [embutida]
- Elevação Lateral [embutida]
- Tríceps Corda [embutida]
- ... e mais 158

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

### grupo-generico (10)

- Rosca Alternada Máquina [firestore]: "braços" (rótulo do editor do treinador) -> biceps
- Rosca Martelo na Polia [firestore]: "braços" (rótulo do editor do treinador) -> biceps
- Tríceps Unilateral na Polia [firestore]: "braços" (rótulo do editor do treinador) -> triceps
- Rosca Scott Máquina [firestore]: "braços" (rótulo do editor do treinador) -> biceps
- Tríceps Supinado com Halteres [firestore]: "braços" (rótulo do editor do treinador) -> triceps
- Rosca Direta Banco Inclinado [firestore]: "braços" (rótulo do editor do treinador) -> biceps
- ... e mais 4

## Fichas na loja: 0 achados em 4 fichas

Nenhum.

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
| Rosca Martelo | Bíceps | halter | strength | iniciante | embutida |
| Rosca Martelo na Polia | Bíceps | polia | strength | iniciante | embutida+firestore |
| Rosca Scott com Barra W | Bíceps | barra | strength | intermediario | embutida+firestore |
| Rosca Scott Máquina | Bíceps | maquina | strength | iniciante | embutida+firestore |
| Bicicleta Ergométrica | Cardio | cardio | cardio | iniciante | embutida |
| Caminhada na Esteira | Cardio | cardio | cardio | iniciante | embutida |
| Corrida na Esteira | Cardio | cardio | cardio | iniciante | embutida |
| Elíptico | Cardio | cardio | cardio | intermediario | embutida |
| Escada (Stairmaster) | Cardio | cardio | cardio | intermediario | embutida |
| Esteira / Bike / Escada | Cardio | cardio | cardio | iniciante | embutida |
| HIIT (Cardio de Alta Intensidade) | Cardio | cardio | cardio | avancado | embutida |
| Pular Corda | Cardio | cardio | cardio | intermediario | embutida |
| Remo Ergométrico | Cardio | cardio | cardio | intermediario | embutida |
| Abdominal Canivete Alternado | Core | livre | strength | intermediario | embutida+firestore |
| Abdominal Infra | Core | livre | strength | intermediario | embutida |
| Abdominal Máquina | Core | maquina | strength | iniciante | embutida+firestore |
| Abdominal no Solo (Crunch) | Core | livre | strength | iniciante | embutida |
| Abdominal Oblíquo (Bicicleta) | Core | livre | strength | intermediario | embutida |
| Abdominal trocando bola suíça | Core | livre | strength | intermediario | embutida+firestore |
| Crunch na Polia | Core | polia | strength | intermediario | embutida+firestore |
| Dead Bug | Core | livre | strength | iniciante | embutida |
| Elevação de Pernas na Barra | Core | livre | strength | avancado | embutida |
| Prancha Abdominal | Core | livre | timed | iniciante | embutida |
| Prancha Lateral | Core | livre | timed | iniciante | embutida |
| Russian Twist | Core | livre | strength | intermediario | embutida |
| Barra Fixa (Em pé) | Costas | livre | strength | avancado | embutida+firestore |
| Barra Fixa Supinada (Chin-Up) | Costas | livre | strength | intermediario | embutida |
| Crucifixo Inverso no Banco Inclinado | Costas | halter | strength | intermediario | embutida+firestore |
| Extensão Lombar Y + W | Costas | livre | strength | iniciante | embutida+firestore |
| Levantamento Terra | Costas | barra | strength | avancado | embutida |
| Pullover Máquina | Costas | maquina | strength | iniciante | embutida+firestore |
| Puxada Aberta (Lat Pulldown) | Costas | polia | strength | iniciante | embutida+firestore |
| Puxada Neutra Máquina | Costas | maquina | strength | iniciante | firestore |
| Puxada Triângulo (Pegada Fechada) | Costas | polia | strength | iniciante | embutida |
| Remada Articulada | Costas | maquina | strength | iniciante | embutida+firestore |
| Remada Cavalinho Máquina | Costas | maquina | strength | intermediario | embutida+firestore |
| Remada Curvada com Barra | Costas | barra | strength | intermediario | embutida |
| Remada Curvada com Halteres (Pegada Neutra) | Costas | halter | strength | intermediario | embutida+firestore |
| Remada Invertida | Costas | livre | strength | iniciante | embutida |
| Remada Máquina (Sentado) | Costas | maquina | strength | iniciante | embutida |
| Remada Neutra Máquina | Costas | maquina | strength | iniciante | embutida+firestore |
| Superman | Costas | livre | strength | iniciante | embutida |
| Cadeira Abdutora | Glúteos | maquina | strength | iniciante | embutida+firestore |
| Elevação Pélvica (Glúteo) | Glúteos | livre/barra | strength | intermediario | embutida |
| Glúteo Máquina | Glúteos | maquina | strength | iniciante | embutida+firestore |
| Hip Thrust Máquina | Glúteos | maquina | strength | intermediario | embutida+firestore |
| Ponte de Glúteo | Glúteos | livre | strength | iniciante | embutida |
| Ponte de Glúteo Unilateral | Glúteos | livre | strength | intermediario | embutida |
| Alongamento de Ombro | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Alongamento de Panturrilha na Parede | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Alongamento de Peitoral | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Alongamento de Posterior de Coxa | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Alongamento de Quadríceps | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Alongamento de Tríceps | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Alongamento do Flexor do Quadril | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Círculos com os Braços (Aquecimento) | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Círculos de Quadril em Pé (Aquecimento) | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Gato (Cat Stretch) | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Postura da Criança | Alongamento e mobilidade | livre | timed | iniciante | embutida |
| Crucifixo Inverso Máquina | Ombros | maquina | strength | iniciante | embutida+firestore |
| Desenvolvimento Arnold | Ombros | halter | strength | intermediario | embutida |
| Desenvolvimento Barra Reta | Ombros | barra | strength | intermediario | embutida+firestore |
| Desenvolvimento Halter | Ombros | halter | strength | intermediario | embutida |
| Desenvolvimento Máquina | Ombros | maquina | strength | iniciante | embutida+firestore |
| Elevação Frontal com Halteres | Ombros | halter | strength | iniciante | embutida |
| Elevação Lateral | Ombros | halter | strength | iniciante | embutida |
| Elevação Lateral Máquina | Ombros | maquina | strength | iniciante | firestore |
| Elevação Lateral Sentado com Halteres | Ombros | halter | strength | iniciante | embutida+firestore |
| Encolhimento com Halteres | Ombros | halter | strength | iniciante | embutida |
| Face Pull na Polia | Ombros | polia | strength | intermediario | embutida+firestore |
| Panturrilha em Pé (Máquina) | Panturrilha | maquina | strength | iniciante | embutida |
| Panturrilha em pé com Halteres | Panturrilha | halter | strength | iniciante | embutida+firestore |
| Panturrilha Sentado Máquina | Panturrilha | maquina | strength | iniciante | embutida+firestore |
| Chest Press Convergente | Peito | maquina | strength | iniciante | embutida+firestore |
| Crossover na Polia | Peito | polia | strength | intermediario | embutida+firestore |
| Crucifixo com Halteres | Peito | halter | strength | iniciante | embutida |
| Crucifixo no Cabo | Peito | polia | strength | intermediario | embutida+firestore |
| Flexão de Braço | Peito | livre | strength | iniciante | embutida |
| Mergulho nas Paralelas (Peito) | Peito | livre | strength | avancado | embutida |
| Peck Deck (Voador) | Peito | maquina | strength | iniciante | embutida |
| Supino Declinado Máquina | Peito | maquina | strength | iniciante | embutida+firestore |
| Supino Inclinado com Barra | Peito | barra | strength | intermediario | embutida |
| Supino Inclinado Halter | Peito | halter | strength | intermediario | embutida+firestore |
| Supino Inclinado Máquina | Peito | maquina | strength | iniciante | embutida+firestore |
| Supino Reto com Barra | Peito | barra | strength | intermediario | embutida |
| Supino Reto com Halteres | Peito | halter | strength | intermediario | embutida+firestore |
| Supino Reto Máquina | Peito | maquina | strength | iniciante | embutida+firestore |
| Afundo Livre com Halteres | Pernas | halter | strength | intermediario | embutida+firestore |
| Agachamento Búlgaro com Halteres | Pernas | halter | strength | intermediario | embutida |
| Agachamento com Halteres | Pernas | halter | strength | iniciante | embutida+firestore |
| Agachamento Goblet | Pernas | halter | strength | iniciante | embutida |
| Agachamento Livre com Barra | Pernas | barra | strength | intermediario | embutida |
| Agachamento Livre ou Hack | Pernas | barra/maquina | strength | avancado | embutida |
| Avanço com Barra | Pernas | barra | strength | intermediario | embutida |
| Bom Dia com Barra (Good Morning) | Pernas | barra | strength | intermediario | embutida |
| Cadeira Adutora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Cadeira Extensora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Cadeira Flexora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Flexão Nórdica Inversa | Pernas | livre | strength | intermediario | embutida+firestore |
| Hack Squat | Pernas | maquina | strength | intermediario | embutida+firestore |
| Leg Press | Pernas | maquina | strength | intermediario | embutida |
| Mesa Flexora | Pernas | maquina | strength | iniciante | embutida+firestore |
| Stiff (Levantamento Romeno) | Pernas | barra | strength | intermediario | embutida |
| Subida no Banco com Halteres | Pernas | halter | strength | intermediario | embutida |
| Mergulho no Banco | Tríceps | livre | strength | iniciante | embutida |
| Supino Fechado com Barra | Tríceps | barra | strength | intermediario | embutida |
| Tríceps Barra (Pushdown) | Tríceps | polia | strength | iniciante | embutida |
| Tríceps Barra Encostado na Polia | Tríceps | polia | strength | iniciante | embutida+firestore |
| Tríceps Corda | Tríceps | polia | strength | iniciante | embutida |
| Tríceps Máquina | Tríceps | maquina | strength | iniciante | embutida+firestore |
| Tríceps Supinado com Halteres | Tríceps | halter | strength | intermediario | embutida+firestore |
| Tríceps Testa com Barra W | Tríceps | barra | strength | intermediario | embutida |
| Tríceps Unilateral na Polia | Tríceps | polia | strength | intermediario | embutida+firestore |
