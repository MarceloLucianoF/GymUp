# Limpeza do catálogo: prévia e situação da aplicação

## Situação (19/10/2026)
Aprovados pelo dono: divergências, duplicatas e "TREINO COSTAS" (renomear). **Aplicado no Firestore** depois do backup `~/bohtreinar-backups/limpeza-catalogo-2026-10-19.json` (fora do repositório; 51 exercícios, 8 fichas, 1 pacote): Abdominal Canivete Alternado para intermediário; Extensão Lombar Y + W para costas; "Supino Máquina" para "Supino Reto Máquina"; "Puxada Aberta Máquina" para "Puxada Aberta (Lat Pulldown)"; "TREINO COSTAS" para "Treino Peito e Costas". Cada escrita conferiu o valor anterior antes de gravar. **Código:** biblioteca embutida alinhada (PR de alinhamento). **Fichas demo (F1), opção B escolhida e aplicada em 20/10/2026:** os 8 alunos de demonstração (`demo_student_1` a `8`) foram migrados para fichas reais do pacote Split ABC (Peito e Tríceps para "Treino A: Peitoral + Dorsal"; Costas e Bíceps para "Treino C: Bíceps + Tríceps + CORE"; Pernas e Ombros para "Treino B: Pernas + Ombros"), com backup dos documentos dos alunos em `~/bohtreinar-backups/limpeza-catalogo-alunos-demo-2026-10-20.json`; depois de confirmar que nenhum usuário apontava para elas, as 4 fichas demo foram apagadas (cada exclusão conferiu o documento e o autor). Os 123 check-ins antigos mantêm o histórico com o nome da ficha da época. No painel do treinador demo, esses alunos aparecem com a ficha "de outro autor", porque as fichas do pacote não pertencem a ele.

Base: leitura de produção de 19/10/2026 (51 exercícios e 8 fichas no Firestore) e a biblioteca embutida (70). O relatório completo está em [AUDITORIA_CATALOGO.md](AUDITORIA_CATALOGO.md). Cada item abaixo precisa do seu "sim" ou "não" antes de qualquer escrita.

## Antes de aplicar qualquer coisa
1. **Backup do Firestore** (coleções `exercises`, `trainings`, `trainingPackages`): exportar para um arquivo local e guardar fora do repositório. Sem backup, nada é aplicado.
2. **Conferir quem usa as fichas demo** (item F1): alunos com `currentTrainingId` igual a `demo_training_*` e check-ins com esse `trainingId`. O MCP do projeto não está lendo hoje (erro "reading 'length'") e uma conta de aluno não lê esses dados; a conferência precisa ser feita no painel do administrador.
3. **Como aplicar:** fichas pelo MCP (`upsert_training` e `delete_training`, sempre com prévia `apply:false` antes; apagar exige `confirm:true`). Exercícios: o MCP não tem escrita de exercícios; sairia pelo painel do treinador ou por um script próprio com prévia, que eu escreveria depois da sua aprovação.

## Decisões sobre exercícios

### E1. "Braços" não é um erro: manter (recomendado)
Dez exercícios do Firestore estão como "braços", mas esse é o rótulo oficial do editor do treinador (`MUSCLE_GROUPS` em `adminUtils.js`), e o gerador separa bíceps e tríceps pelo nome. O normalizador já trata os dois lados. **Operação: nenhuma.** A alternativa (migrar para bíceps e tríceps) exigiria mudar o editor, os filtros e os gráficos e dá mais risco do que ganho. Por isso a auditoria passou a tratar "braços" como informação, não como aviso.

### E2. Divergências entre a biblioteca embutida e o Firestore (8)
Regra proposta: o Firestore vale (é o que o treinador mantém); a biblioteca embutida é ajustada no código para igualar. Duas exceções em que recomendo mudar o Firestore.

| Exercício | Embutida | Firestore | Final proposto | Onde muda |
| --- | --- | --- | --- | --- |
| Supino Declinado Máquina | intermediário | iniciante | iniciante | embutida |
| Pullover Máquina | intermediário | iniciante | iniciante | embutida |
| Barra Fixa (Em pé) | intermediário | avançado | avançado | embutida |
| Flexão Nórdica Inversa | avançado | intermediário | intermediário | embutida (ver nota) |
| Abdominal trocando bola suíça | iniciante | intermediário | intermediário | embutida |
| Crucifixo Inverso no Banco Inclinado | grupo ombros | grupo costas | costas | embutida (usado em 2 fichas) |
| Abdominal Canivete Alternado | intermediário | iniciante | **intermediário** | **Firestore** `g1wKqIHRbSbxITnUTfPM` |
| Extensão Lombar Y + W | grupo costas, intermediário | grupo core, iniciante | **costas, iniciante** | **Firestore** `4Jsm0hMls2TrHGtyi1Pc` (grupo) e embutida (dificuldade) |

Nota: a Flexão Nórdica Inversa aparece na ficha "Treino B: Pernas + Ombros". O nome e o GIF não batem (o GIF mostra um sissy squat); isso é revisão de conteúdo do treinador, fora desta limpeza.

### E3. Duplicatas (2): renomear, não apagar
Os dois do Firestore estão na ficha "Treino A: Peitoral + Dorsal", então apagar quebraria a ficha.

| Firestore | Equivale na embutida | Operação proposta |
| --- | --- | --- |
| `F84ywyOEq6zwob37PZqh` Supino Máquina | Supino Reto Máquina | renomear para "Supino Reto Máquina" (o id e a ficha continuam) |
| `7q1MTCBOpENcRHky5auf` Puxada Aberta Máquina | Puxada Aberta (Lat Pulldown) | renomear para "Puxada Aberta (Lat Pulldown)" |

Depois disso as duas fontes passam a ter o mesmo nome e o catálogo junta os pares (a embutida vale na lista; a ficha continua lendo o documento do Firestore pelo id, com o GIF dele).

### E4. Mídia aproximada (4) e texto curto (1): só revisão do treinador
`92wk93i4IGa3AOo1RxrB` Elevação Lateral Máquina, `ZvaIyMpqiQg4VXoWWl5O` Hip Thrust Máquina, `pGuZYcG7PEIx0l0qEgPS` Glúteo Máquina e `zJoqiJw12VLwP4edXx5T` Pullover Máquina têm GIF aproximado (marcados `mediaApprox`). Glúteo Máquina também tem descrição de 5 palavras ("Coice guiado para os glúteos."). **Operação: nenhuma automática;** o treinador troca o GIF e escreve o texto.

### E5. Dificuldade escrita sem acento na embutida (3)
"avancado" na biblioteca embutida passa a "avançado", igual ao editor. É só código, sem risco para os dados (a comparação já ignora acento).

## Decisões sobre fichas

### F1. Quatro fichas de demonstração: apagar (recomendado, depois da conferência)
Criadas em 10/10/2026 pelo `scripts/seed-demo.cjs --apply` para o treinador demo `bDDFE2kKpDagWh18OiNKMJojGbR2`. Usam ids `demo_ex_*` que não existem no catálogo; 17 dos 18 itens aparecem sem imagem para o aluno (só o Tríceps Corda do "Treino A" é achado pelo nome).

| Ficha | id | Itens |
| --- | --- | --- |
| Treino A — Peito e Tríceps | `demo_training_a` | 5 |
| Treino B — Costas e Bíceps | `demo_training_b` | 5 |
| Treino C — Pernas e Ombros | `demo_training_c` | 5 |
| Full Body Express | `demo_training_fb` | 4 |

Operação: `delete_training` com prévia, depois `apply:true` e `confirm:true`, uma por vez. **Só depois** de confirmar que nenhum aluno tem uma delas como ficha atual. Se algum tiver, a ficha fica e o aluno é reatribuído primeiro.

### F2. "TREINO COSTAS" (`uAzzdFsdjU5s5AYe286h`): decisão do treinador
Foi criada em 12/10/2026 pelo treinador `seB4s8Dal7WGN0UBeS4vpfmDCBp2` (conteúdo real, não demo). Tem 2 de peito (supino inclinado e reto com halteres), 1 de ombro (crucifixo inverso) e 1 de costas (remada curvada). Opções:
- **A (recomendada):** renomear para "Treino Peito e Costas" (sem mexer nos exercícios, que passam a combinar com o nome).
- **B:** trocar os dois supinos por exercícios de costas (puxada, remada) e manter o nome.
- **C:** deixar como está.

### F3. As três fichas do pacote Split ABC: sem mudança
Todos os itens resolvem no catálogo.

## O que não está nesta limpeza
- Fichas da academia (Gestão), que ainda só têm séries e repetições.
- Troca de GIFs e vídeos (depende de conteúdo novo).
- Ampliar o catálogo (peso livre, cardio, alongamento).

## Resumo do que mudaria se você aprovar tudo
- **Firestore, exercícios:** 4 escritas (Canivete: dificuldade; Extensão Lombar: grupo; 2 renomeações).
- **Firestore, fichas:** até 4 apagadas (F1) e 1 renomeada (F2 A).
- **Código:** biblioteca embutida alinhada (dificuldades, grupo do Crucifixo Inverso, "avançado" com acento) em uma PR.
