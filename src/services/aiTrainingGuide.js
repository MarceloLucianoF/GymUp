// Base de conhecimento de treino do Coach IA: entra no system prompt do chat, no pedido do gerador de fichas e na Semana.
// Texto curto de propósito (teto de ~1.200 tokens, conferido em teste): cada linha é uma regra que a IA pode citar.
// Os mínimos de peito e costas também valem no gerador local (utils/exerciseSlots.js), então ficha sem IA segue o mesmo guia.

export const TRAINING_GUIDE = `GUIA DE TREINO DO BOHTREINAR (siga ao montar, ajustar ou comentar treinos)
Divisão por dias na semana:
- 2-3 dias: corpo todo em dias alternados ou superior/inferior. Iniciante começa aqui.
- 4 dias: superior/inferior 2x ou ABCD (peito e tríceps; costas e bíceps; pernas; ombros e abdômen).
- 5-6 dias: PPL (empurrar, puxar, pernas) ou ABCDE, para quem treina há mais de 6 meses e recupera bem.
- Hipertrofia de iniciante ou intermediário natural: não junte dois grupos grandes no mesmo dia (peito+costas, pernas+costas, peito+pernas), a menos que a pessoa peça. Antagonistas no mesmo dia são opção para avançados.
Volume e sessão:
- Séries por semana: 10-20 para peito, costas e pernas; 6-10 para bíceps, tríceps e panturrilha. Iniciante fica perto do mínimo.
- Dia de grupo grande: 5-7 exercícios dele + 2 do grupo menor (ex.: 6 de costas + 2 de bíceps). Iniciante: 4-6 no total.
- Costas: ao menos 1 puxada vertical (barra fixa ou puxada), 2 remadas e 1 isolador (pullover ou crucifixo inverso).
- Peito: ao menos 1 inclinado, 1 reto/horizontal e 1 crucifixo, crossover ou voador.
- Pernas: agachamento ou leg press, cadeia posterior (stiff ou flexora), isoladores (extensora, abdutora) e panturrilha.
- Ordem: multiarticulares primeiro, isoladores no fim.
- Hipertrofia: 6-12 repetições (isoladores até 15), descanso de 60-120 s. Força: 3-6 repetições, 2-3 min. Resistência e emagrecimento: 12-20 repetições, 30-60 s. Termine as séries a 1-3 repetições da falha.
- Progressão: ao fechar o topo da faixa em todas as séries com boa técnica, suba a carga 2-5% e registre.
Ênfase por região (exemplos da biblioteca):
- Peito superior: Supino Inclinado (halter, barra ou máquina). Médio: Supino Reto, Chest Press, Peck Deck. Inferior: Supino Declinado, Mergulho nas Paralelas, crossover de cima para baixo.
- Costas largura: Barra Fixa, Puxada Aberta, Pullover. Espessura: Remada Curvada, Remada Cavalinho, Remada Máquina ou Articulada. Lombar: Extensão Lombar.
- Deltoide anterior: Desenvolvimento, Elevação Frontal. Lateral: Elevação Lateral, Remada Alta. Posterior: Crucifixo Inverso, Face Pull.
- Quadríceps: Agachamento, Hack, Leg Press, Extensora. Posterior: Stiff, Mesa ou Cadeira Flexora, Bom Dia. Glúteo: Hip Thrust, Elevação Pélvica, Búlgaro, Abdutora.
Variação:
- Mantenha a base e troque 1-2 exercícios ou ângulos (inclinação, pegada, halter x máquina) a cada 4-6 semanas.
- Não repita a ficha que a pessoa já tem: havendo fichas recentes, mude pelo menos 2 exercícios mantendo o grupo.`;

// Estimativa grosseira usada no teste de tamanho (português fica perto de 3,5 caracteres por token).
export const estimateTokens = (text) => Math.ceil(String(text || '').length / 3.5);
