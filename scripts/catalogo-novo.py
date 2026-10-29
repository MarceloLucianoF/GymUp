"""Amplia a biblioteca embutida: baixa a mídia do Free Exercise DB (domínio público, Unlicense), monta foto (public/exercicios/<slug>.jpg)
e GIF de 2 quadros (public/exercises/<slug>.gif) e acrescenta os exercícios novos em src/data/exercises.js (ids ex71 em diante).
Uso: python3 scripts/catalogo-novo.py            -> baixa a mídia, mostra o plano e NÃO altera exercises.js
     python3 scripts/catalogo-novo.py --write    -> também acrescenta os exercícios em src/data/exercises.js
Textos em português escritos para o BohTreinar; a mídia vem de github.com/yuhonas/free-exercise-db (ver docs/BIBLIOTECA.md)."""
import io, json, re, sys, unicodedata, urllib.request
from pathlib import Path
from PIL import Image

BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
ROOT = Path(__file__).resolve().parent.parent
STILL, GIFS = ROOT / 'public' / 'exercicios', ROOT / 'public' / 'exercises'
DATA = ROOT / 'src' / 'data' / 'exercises.js'

# (nome, id no Free Exercise DB, grupo, equipamento, tipo, dificuldade, séries, repetições|segundos|minutos, descanso, descrição, execução)
S, T, C = 'strength', 'timed', 'cardio'
NEW = [
 ('Supino Reto com Barra', 'Barbell_Bench_Press_-_Medium_Grip', 'peito', 'barra', S, 'intermediário', 4, 8, 90,
  'Exercício base para peito, ombros e tríceps, com carga alta e boa progressão.',
  'Deite no banco com os pés firmes no chão e as escápulas juntas. Segure a barra um pouco além da largura dos ombros, desça até tocar de leve o meio do peito e empurre de volta sem tirar o quadril do banco. Peça um parceiro para acompanhar nas séries pesadas.'),
 ('Supino Inclinado com Barra', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'peito', 'barra', S, 'intermediário', 4, 8, 90,
  'Foca a parte superior do peitoral, com ajuda dos ombros e tríceps.',
  'Ajuste o banco entre 30 e 45 graus. Com a pegada um pouco mais larga que os ombros, desça a barra até a parte alta do peito e empurre em linha reta. Mantenha os pés apoiados e o quadril colado no banco.'),
 ('Crucifixo com Halteres', 'Dumbbell_Flyes', 'peito', 'halter', S, 'iniciante', 3, 12, 60,
  'Isolador de peito que alonga bem o peitoral no movimento de abrir os braços.',
  'Deite no banco com um halter em cada mão acima do peito e os cotovelos levemente flexionados. Abra os braços em arco até sentir o peito alongar e volte juntando os halteres. Use carga moderada e não desça abaixo da linha do banco.'),
 ('Flexão de Braço', 'Pushups', 'peito', 'livre', S, 'iniciante', 3, 12, 60,
  'Exercício com o peso do corpo para peito, ombros, tríceps e core. Dá para fazer em qualquer lugar.',
  'Apoie as mãos um pouco além dos ombros e mantenha o corpo reto da cabeça aos calcanhares. Desça até o peito quase tocar o chão e empurre de volta. Se estiver difícil, apoie os joelhos no chão.'),
 ('Mergulho nas Paralelas (Peito)', 'Dips_-_Chest_Version', 'peito', 'livre', S, 'avançado', 3, 8, 90,
  'Exercício com o peso do corpo que trabalha a parte baixa do peito e os tríceps.',
  'Segure as barras paralelas com os braços estendidos e incline o tronco levemente à frente. Desça flexionando os cotovelos até sentir o peito alongar e empurre de volta. Pare se sentir dor nos ombros.'),
 ('Remada Curvada com Barra', 'Bent_Over_Barbell_Row', 'costas', 'barra', S, 'intermediário', 4, 8, 90,
  'Exercício completo para costas, com carga alta, que também exige lombar e posterior firmes.',
  'Com a barra nas mãos, incline o tronco à frente com a coluna reta e os joelhos levemente flexionados. Puxe a barra em direção ao abdômen aproximando as escápulas e volte controlando. Não balance o tronco para ajudar.'),
 ('Levantamento Terra', 'Barbell_Deadlift', 'costas', 'barra', S, 'avançado', 4, 5, 120,
  'Exercício de corpo inteiro com foco em costas, glúteos e posterior de coxa. Exige técnica.',
  'Com os pés na largura do quadril e a barra sobre o meio dos pés, segure a barra, estufe o peito e mantenha a coluna neutra. Empurre o chão com as pernas e estenda o quadril até ficar em pé; desça com a barra rente às pernas. Comece leve e peça orientação do professor.'),
 ('Barra Fixa Supinada (Chin-Up)', 'Chin-Up', 'costas', 'livre', S, 'intermediário', 3, 6, 90,
  'Puxada com o peso do corpo e pegada supinada, que trabalha costas e bíceps.',
  'Segure a barra com as palmas voltadas para você, na largura dos ombros. Puxe o corpo até o queixo passar da barra e desça de forma controlada até estender os braços. Se não conseguir, use um elástico de apoio.'),
 ('Remada Invertida', 'Inverted_Row', 'costas', 'livre', S, 'iniciante', 3, 10, 60,
  'Remada com o peso do corpo, boa para quem ainda não faz barra fixa.',
  'Deitado sob uma barra baixa, segure-a com as mãos na largura dos ombros e mantenha o corpo reto. Puxe o peito em direção à barra aproximando as escápulas e desça devagar. Dobre os joelhos para facilitar.'),
 ('Superman', 'Superman', 'costas', 'livre', S, 'iniciante', 3, 12, 45,
  'Fortalece a lombar e os glúteos, sem equipamento.',
  'Deite de bruços com os braços estendidos à frente. Levante ao mesmo tempo braços e pernas poucos centímetros do chão, segure um segundo e volte devagar. Mantenha o pescoço alinhado, sem olhar para cima.'),
 ('Encolhimento com Halteres', 'Dumbbell_Shrug', 'ombros', 'halter', S, 'iniciante', 3, 12, 60,
  'Trabalha o trapézio, a parte alta das costas ao lado do pescoço.',
  'Em pé, com um halter em cada mão ao lado do corpo, suba os ombros em direção às orelhas e segure um segundo. Desça devagar. Não gire os ombros nem incline a cabeça à frente.'),
 ('Desenvolvimento Arnold', 'Arnold_Dumbbell_Press', 'ombros', 'halter', S, 'intermediário', 3, 10, 75,
  'Variação do desenvolvimento com giro dos punhos, que trabalha as três partes do ombro.',
  'Sentado, comece com os halteres na frente do peito e as palmas voltadas para você. Empurre para cima girando as palmas para a frente e volte fazendo o giro ao contrário. Use carga menor que a do desenvolvimento comum.'),
 ('Elevação Frontal com Halteres', 'Front_Dumbbell_Raise', 'ombros', 'halter', S, 'iniciante', 3, 12, 60,
  'Isola a parte da frente do ombro.',
  'Em pé, com os halteres à frente das coxas, levante os braços estendidos até a altura dos ombros e desça devagar. Mantenha o tronco parado e evite balançar o corpo para subir a carga.'),
 ('Rosca Martelo', 'Hammer_Curls', 'biceps', 'halter', S, 'iniciante', 3, 12, 60,
  'Rosca com pegada neutra que trabalha bíceps e antebraço.',
  'Em pé, com os halteres ao lado do corpo e as palmas voltadas uma para a outra, flexione os cotovelos até os halteres chegarem perto dos ombros e desça devagar. Mantenha os cotovelos junto ao tronco.'),
 ('Tríceps Testa com Barra W', 'EZ-Bar_Skullcrusher', 'triceps', 'barra', S, 'intermediário', 3, 10, 75,
  'Isolador de tríceps feito deitado, com boa carga.',
  'Deitado no banco, segure a barra W com os braços estendidos acima do peito. Flexione só os cotovelos levando a barra em direção à testa e estenda de volta. Mantenha os cotovelos parados e apontados para o teto.'),
 ('Mergulho no Banco', 'Bench_Dips', 'triceps', 'livre', S, 'iniciante', 3, 12, 60,
  'Exercício com o peso do corpo para tríceps, feito em um banco.',
  'Apoie as mãos na borda do banco atrás de você, com as pernas à frente. Desça flexionando os cotovelos até cerca de 90 graus e empurre de volta. Mantenha as costas perto do banco e os ombros longe das orelhas.'),
 ('Supino Fechado com Barra', 'Close-Grip_Barbell_Bench_Press', 'triceps', 'barra', S, 'intermediário', 3, 8, 90,
  'Variação do supino que dá mais trabalho aos tríceps.',
  'Deitado no banco, segure a barra com as mãos na largura dos ombros. Desça até o meio do peito mantendo os cotovelos próximos ao corpo e empurre para cima. Não feche demais a pegada para poupar os punhos.'),
 ('Stiff (Levantamento Romeno)', 'Romanian_Deadlift', 'pernas', 'barra', S, 'intermediário', 3, 10, 90,
  'Trabalha posterior de coxa e glúteos, com a coluna firme.',
  'Em pé com a barra à frente das coxas, leve o quadril para trás mantendo as pernas quase estendidas e a coluna reta. Desça a barra rente às pernas até sentir a parte de trás da coxa alongar e volte estendendo o quadril.'),
 ('Agachamento Goblet', 'Goblet_Squat', 'pernas', 'halter', S, 'iniciante', 3, 12, 60,
  'Agachamento com um halter à frente do peito, ótimo para aprender o movimento.',
  'Segure um halter verticalmente junto ao peito, com os pés um pouco mais abertos que os ombros. Agache mantendo o tronco ereto e os joelhos acompanhando a direção dos pés, e suba empurrando o chão.'),
 ('Avanço com Barra', 'Barbell_Lunge', 'pernas', 'barra', S, 'intermediário', 3, 10, 75,
  'Exercício unilateral para coxas e glúteos.',
  'Com a barra apoiada nos ombros, dê um passo largo à frente e desça até o joelho de trás quase tocar o chão. Empurre com a perna da frente para voltar e alterne os lados. Mantenha o tronco ereto.'),
 ('Agachamento Búlgaro com Halteres', 'Split_Squat_with_Dumbbells', 'pernas', 'halter', S, 'intermediário', 3, 10, 60,
  'Agachamento unilateral com o pé de trás apoiado em um banco, para coxas e glúteos.',
  'Apoie o peito do pé de trás em um banco e segure um halter em cada mão, com o pé da frente afastado. Desça flexionando o joelho da frente, mantendo-o alinhado com o pé e o tronco ereto, e suba empurrando o chão. Troque a perna depois de completar as repetições.'),
 ('Subida no Banco com Halteres', 'Dumbbell_Step_Ups', 'pernas', 'halter', S, 'intermediário', 3, 10, 60,
  'Exercício unilateral que trabalha coxa e glúteos de forma parecida com a subida de escada.',
  'Com um halter em cada mão, apoie um pé inteiro em um banco firme e suba empurrando com a perna de cima, sem se impulsionar com a de baixo. Desça devagar e alterne as pernas.'),
 ('Bom Dia com Barra (Good Morning)', 'Stiff_Leg_Barbell_Good_Morning', 'pernas', 'barra', S, 'intermediário', 3, 10, 75,
  'Fortalece posterior de coxa, glúteos e lombar.',
  'Com a barra nos ombros e os joelhos levemente flexionados, leve o quadril para trás inclinando o tronco à frente com a coluna reta, até sentir a parte de trás da coxa. Volte estendendo o quadril. Use pouca carga.'),
 ('Ponte de Glúteo', 'Butt_Lift_Bridge', 'gluteos', 'livre', S, 'iniciante', 3, 15, 45,
  'Ativa os glúteos com o peso do corpo.',
  'Deitado de costas com os joelhos flexionados e os pés no chão, suba o quadril contraindo os glúteos até o corpo formar uma linha dos ombros aos joelhos. Segure um segundo e desça devagar.'),
 ('Ponte de Glúteo Unilateral', 'Single_Leg_Glute_Bridge', 'gluteos', 'livre', S, 'intermediário', 3, 10, 45,
  'Versão com uma perna só, mais difícil, que também exige equilíbrio do quadril.',
  'Deitado de costas, estenda uma perna e apoie o outro pé no chão. Suba o quadril empurrando com o pé apoiado, sem deixar o quadril girar, e desça devagar. Faça todas as repetições de um lado e troque.'),
 ('Abdominal no Solo (Crunch)', 'Crunches', 'core', 'livre', S, 'iniciante', 3, 15, 45,
  'Exercício básico para a parte da frente do abdômen.',
  'Deitado com os joelhos flexionados e as mãos junto às orelhas, levante apenas a parte de cima das costas contraindo o abdômen e volte devagar. Não puxe o pescoço com as mãos.'),
 ('Prancha Lateral', 'Side_Bridge', 'core', 'livre', T, 'iniciante', 3, 30, 45,
  'Fortalece os oblíquos e a estabilidade do tronco. Mantenha a posição pelo tempo indicado.',
  'Deite de lado apoiado no antebraço, com o cotovelo sob o ombro. Levante o quadril até o corpo formar uma linha reta e segure pelo tempo indicado, respirando normalmente. Repita dos dois lados.'),
 ('Russian Twist', 'Russian_Twist', 'core', 'livre', S, 'intermediário', 3, 20, 45,
  'Rotação do tronco que trabalha oblíquos e core.',
  'Sentado, incline o tronco para trás e levante levemente os pés. Com as mãos juntas à frente do peito, gire o tronco para um lado e para o outro. Mantenha as costas retas e faça o movimento controlado.'),
 ('Elevação de Pernas na Barra', 'Hanging_Leg_Raise', 'core', 'livre', S, 'avançado', 3, 10, 60,
  'Exercício avançado para o abdômen inferior e para a pegada.',
  'Pendurado em uma barra fixa, levante as pernas juntas até a altura do quadril ou mais, sem balançar o corpo, e desça devagar. Para facilitar, dobre os joelhos ao subir.'),
 ('Dead Bug', 'Dead_Bug', 'core', 'livre', S, 'iniciante', 3, 10, 45,
  'Treina o controle do abdômen mantendo a lombar protegida.',
  'Deitado de costas, com braços estendidos para o teto e joelhos a 90 graus, estenda lentamente um braço e a perna oposta sem deixar a lombar sair do chão. Volte e alterne os lados.'),
 ('Bicicleta Ergométrica', 'Bicycling_Stationary', 'cardio', 'cardio', C, 'iniciante', 1, 25, 0,
  'Cardio de baixo impacto, bom para quem quer poupar as articulações.',
  'Ajuste o banco para que o joelho fique levemente flexionado no ponto mais baixo do pedal. Mantenha um ritmo em que ainda consiga conversar e, se quiser, alterne trechos mais fortes e mais leves.'),
 ('Elíptico', 'Elliptical_Trainer', 'cardio', 'cardio', C, 'intermediário', 1, 20, 0,
  'Cardio de baixo impacto que usa pernas e braços ao mesmo tempo.',
  'Suba com os pés bem apoiados e segure as alças. Mantenha a postura ereta e um ritmo constante, empurrando as alças e os pedais de forma coordenada.'),
 ('Escada (Stairmaster)', 'Stairmaster', 'cardio', 'cardio', C, 'intermediário', 1, 15, 0,
  'Cardio intenso que trabalha coxas e glúteos como se subisse degraus.',
  'Suba na máquina e escolha uma velocidade em que consiga manter a postura reta. Apoie as mãos de leve no corrimão, sem carregar o peso do corpo nele, e pise com o pé inteiro em cada degrau.'),
 ('Remo Ergométrico', 'Rowing_Stationary', 'cardio', 'cardio', C, 'intermediário', 1, 15, 0,
  'Cardio de corpo inteiro que trabalha pernas, costas e braços.',
  'Empurre com as pernas, depois incline o tronco levemente e puxe a alça até o abdômen. Volte na ordem inversa: braços, tronco e por último as pernas. Mantenha as costas retas.'),
 ('Pular Corda', 'Rope_Jumping', 'cardio', 'cardio', C, 'intermediário', 1, 10, 0,
  'Cardio de alta intensidade que melhora o fôlego e a coordenação.',
  'Segure a corda na altura do quadril e gire os punhos, saltando pouco do chão a cada volta, com os joelhos levemente flexionados. Faça pausas curtas quando precisar.'),
 ('Caminhada na Esteira', 'Walking_Treadmill', 'cardio', 'cardio', C, 'iniciante', 1, 30, 0,
  'Cardio leve, indicado para iniciantes e para recuperação entre treinos.',
  'Comece com ritmo leve por alguns minutos e aumente a velocidade ou a inclinação até sentir a respiração mais forte, mas ainda conseguindo conversar. Evite se apoiar nas barras laterais.'),
 ('Corrida na Esteira', 'Running_Treadmill', 'cardio', 'cardio', C, 'iniciante', 1, 20, 0,
  'Cardio de alta intensidade para condicionamento e gasto calórico.',
  'Aqueça caminhando por alguns minutos, aumente a velocidade até o ritmo de corrida e mantenha a postura ereta, pisando de leve. Termine reduzindo a velocidade aos poucos.'),
 ('Rosca Scott Martelo com Halteres', 'Preacher_Hammer_Dumbbell_Curl', 'biceps', 'halter', S, 'intermediário', 3, 8, 90,
  'Rosca no banco Scott com pegada neutra (martelo): trabalha bíceps e braquial, com o braço apoiado e sem balanço.',
  'Apoie a parte de cima dos dois braços no banco Scott, segurando um halter em cada mão com as palmas voltadas uma para a outra. Flexione os cotovelos até os halteres chegarem perto dos ombros e desça devagar, sem soltar o peso embaixo. Pode fazer os dois braços juntos. Para um drop-set: depois das repetições, reduza cerca de 30% da carga e continue até a falha.'),
 ('Tríceps Francês na Polia Unilateral', 'Cable_Rope_Overhead_Triceps_Extension', 'triceps', 'polia', S, 'intermediário', 3, 12, 60,
  'Extensão de tríceps acima da cabeça na polia, feita com um braço de cada vez. Dá mais alongamento à cabeça longa do tríceps.',
  'De costas para a polia baixa, segure a pegada com uma mão atrás da cabeça, com o cotovelo apontado para cima e junto à cabeça. Estenda o braço até o alto, sem mexer o cotovelo, e volte devagar até sentir o tríceps alongar. Faça todas as repetições de um lado e troque. A imagem mostra a versão com a corda, feita com as duas mãos; o movimento é o mesmo.'),
 ('Alongamento de Posterior de Coxa', 'Hamstring_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a parte de trás das coxas. Segure a posição pelo tempo indicado, sem insistir até doer.',
  'Deitado de costas, estenda uma perna para cima com o quadril a 90 graus e passe uma faixa ou toalha na sola do pé. Puxe a faixa de leve até sentir a parte de trás da coxa alongar, mantendo a outra perna esticada no chão. Respire fundo e troque de perna.'),
 ('Alongamento de Quadríceps', 'Quad_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a frente da coxa. Segure a posição pelo tempo indicado.',
  'Deitado de lado, dobre o joelho de cima e segure o pé com a mão ou com uma faixa, levando o calcanhar em direção ao glúteo e estendendo o quadril. Puxe de leve até sentir a frente da coxa alongar e troque de lado.'),
 ('Alongamento de Peitoral', 'Chest_And_Front_Of_Shoulder_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Abre o peito e a frente dos ombros. Segure a posição pelo tempo indicado.',
  'Em pé, segure um cabo de vassoura ou uma barra leve com as palmas para baixo, em pegada um pouco mais larga que os ombros. Levante o cabo à frente e leve-o devagar para trás da cabeça, até sentir o peito alongar. Pare se sentir desconforto nos ombros.'),
 ('Alongamento de Ombro', 'Shoulder_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a parte de trás do ombro. Segure a posição pelo tempo indicado.',
  'Leve um braço estendido para o lado oposto do corpo e puxe-o com o outro braço junto ao peito, sem girar o tronco. Mantenha o ombro baixo e troque de lado.'),
 ('Alongamento de Tríceps', 'Triceps_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a parte de trás do braço. Segure a posição pelo tempo indicado.',
  'Leve um braço para cima e dobre o cotovelo, deixando a mão atrás da cabeça. Com a outra mão, empurre o cotovelo de leve para trás da cabeça até sentir o alongamento. Troque de lado.'),
 ('Alongamento de Panturrilha na Parede', 'Calf_Stretch_Hands_Against_Wall', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga as panturrilhas. Segure a posição pelo tempo indicado.',
  'Apoie as mãos em uma parede, mantenha uma perna à frente dobrada e a outra atrás, estendida, com o calcanhar no chão. Leve o quadril à frente até sentir a panturrilha de trás alongar. Troque de perna.'),
 ('Alongamento do Flexor do Quadril', 'Kneeling_Hip_Flexor', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a frente do quadril, importante para quem passa muito tempo sentado.',
  'Ajoelhe uma perna e apoie o pé da outra à frente, com o joelho a 90 graus. Contraia o glúteo da perna de trás e leve o quadril levemente à frente até sentir o alongamento. Troque de lado.'),
 ('Gato (Cat Stretch)', 'Cat_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Mobiliza a coluna e alivia a lombar. Repita o movimento devagar pelo tempo indicado.',
  'Em quatro apoios, com as mãos sob os ombros e os joelhos sob o quadril, arredonde as costas levando o queixo ao peito e depois volte à posição neutra, alternando devagar. Respire fundo a cada movimento.'),
 ('Postura da Criança', 'Childs_Pose', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Relaxa a lombar e alonga as costas. Segure a posição pelo tempo indicado.',
  'Ajoelhe-se, sente sobre os calcanhares e leve o tronco à frente, estendendo os braços no chão. Relaxe o pescoço e respire fundo, sentindo as costas alongarem.'),
 ('Círculos com os Braços (Aquecimento)', 'Arm_Circles', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aquecimento para os ombros antes de treinar peito, costas e ombros.',
  'Em pé, com os braços estendidos para os lados na altura dos ombros, faça círculos pequenos e depois maiores, primeiro para a frente e depois para trás. Mantenha o tronco parado.'),
 ('Círculos de Quadril em Pé (Aquecimento)', 'Standing_Hip_Circles', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aquecimento para o quadril antes de treinar pernas e glúteos.',
  'Em pé sobre uma perna, segurando em um apoio, levante o outro joelho a 90 graus e abra o quadril fazendo um círculo grande com o joelho, devagar, para dentro e para fora. Troque de perna na metade do tempo.'),
 # ---- lote 2 (21/10/2026): panturrilha, glúteos, trapézio, antebraço e mobilidade lombar/quadril ----
 ('Panturrilha no Leg Press', 'Calf_Press_On_The_Leg_Press_Machine', 'panturrilha', 'maquina', S, 'iniciante', 4, 15, 45,
  'Trabalha a panturrilha no leg press, com carga alta e boa segurança para a coluna.',
  'Sente no leg press com só a ponta dos pés na plataforma e os joelhos quase estendidos. Empurre a plataforma esticando os tornozelos, segure um segundo no alto e volte devagar até alongar a panturrilha. Não flexione os joelhos durante o movimento.'),
 ('Panturrilha Sentado Unilateral com Halter', 'Dumbbell_Seated_One-Leg_Calf_Raise', 'panturrilha', 'halter', S, 'iniciante', 3, 15, 45,
  'Foca o sóleo, o músculo mais profundo da panturrilha, com uma perna de cada vez.',
  'Sentado, apoie a ponta de um pé em um step ou anilha e coloque um halter sobre o joelho dessa perna. Suba o calcanhar o máximo que puder, segure um segundo e desça alongando. Termine as repetições e troque de perna.'),
 ('Panturrilha no Smith', 'Smith_Machine_Calf_Raise', 'panturrilha', 'maquina', S, 'intermediário', 4, 12, 60,
  'Panturrilha em pé com a barra guiada do Smith, boa para progredir a carga com segurança.',
  'Posicione a barra sobre os ombros e apoie a ponta dos pés em um step, com os calcanhares livres. Suba o máximo possível nas pontas dos pés, segure um segundo e desça até sentir a panturrilha alongar. Mantenha o tronco reto e os joelhos estendidos.'),
 ('Panturrilha Burrinho', 'Donkey_Calf_Raises', 'panturrilha', 'livre', S, 'intermediário', 3, 15, 45,
  'Panturrilha com o tronco inclinado, que alonga bastante o gastrocnêmio.',
  'Apoie as mãos em um banco ou barra, incline o tronco à frente com as costas retas e a ponta dos pés em um degrau. Suba o máximo que puder nos pés, segure um segundo e desça alongando. Pode usar um parceiro ou anilha sobre o quadril para mais carga.'),
 ('Hip Thrust com Barra', 'Barbell_Hip_Thrust', 'gluteos', 'barra', S, 'intermediário', 4, 10, 90,
  'Principal exercício para glúteos, com carga alta e bom estímulo na contração.',
  'Apoie as costas altas em um banco, com a barra sobre o quadril (use uma almofada). Pés no chão na largura dos ombros. Empurre o quadril para cima até o corpo ficar alinhado do ombro ao joelho, aperte os glúteos no alto e desça devagar. Queixo levemente para baixo, sem arquear a lombar.'),
 ('Chute de Glúteo na Polia', 'One-Legged_Cable_Kickback', 'gluteos', 'polia', S, 'iniciante', 3, 12, 60,
  'Isola o glúteo com tensão constante da polia, uma perna de cada vez.',
  'Prenda a tornozeleira na polia baixa e apoie as mãos na máquina. Leve a perna para trás com o joelho quase estendido, aperte o glúteo no final e volte devagar. Mantenha o quadril parado e não arqueie a lombar. Faça todas as repetições e troque de lado.'),
 ('Coice de Glúteo (Quatro Apoios)', 'Glute_Kickback', 'gluteos', 'livre', S, 'iniciante', 3, 15, 45,
  'Exercício com o peso do corpo que ativa os glúteos, bom para aquecer ou para treinar em casa.',
  'Em quatro apoios, com as mãos sob os ombros e os joelhos sob o quadril, estenda uma perna para trás e para cima apertando o glúteo. Volte sem encostar o joelho no chão. Mantenha o abdômen firme e a lombar neutra. Troque de lado ao terminar.'),
 ('Ponte de Glúteo na Bola Suíça', 'Physioball_Hip_Bridge', 'gluteos', 'livre', S, 'intermediário', 3, 12, 45,
  'Variação da ponte que exige equilíbrio e ativa glúteos e posterior de coxa.',
  'Deite com as costas altas apoiadas no chão e os calcanhares sobre a bola suíça. Suba o quadril até alinhar ombros, quadril e joelhos, aperte os glúteos e desça devagar sem encostar o quadril no chão. Se estiver instável, apoie os pés mais perto do quadril.'),
 ('Encolhimento com Barra', 'Barbell_Shrug', 'ombros', 'barra', S, 'iniciante', 4, 10, 60,
  'Trabalha o trapézio superior com carga alta, na região entre o pescoço e os ombros.',
  'Em pé, segure a barra à frente das coxas na largura dos ombros. Suba os ombros em direção às orelhas, segure um segundo e desça devagar. Mantenha os braços estendidos e não gire os ombros nem incline a cabeça à frente.'),
 ('Remada Alta com Barra', 'Upright_Barbell_Row', 'ombros', 'barra', S, 'intermediário', 3, 10, 75,
  'Trabalha trapézio e deltoides laterais. Fazer com carga moderada protege os ombros.',
  'Em pé, segure a barra com as mãos na largura dos ombros. Puxe a barra rente ao corpo até a altura do peito, com os cotovelos acima das mãos, e desça controlando. Não suba além do peito e pare se sentir incômodo no ombro.'),
 ('Remada Alta na Polia', 'Upright_Cable_Row', 'ombros', 'polia', S, 'intermediário', 3, 12, 60,
  'Remada alta com tensão constante, que pega o trapézio e os ombros com carga mais suave para as articulações.',
  'Na polia baixa com barra reta, puxe a barra rente ao corpo até a altura do peito, com os cotovelos mais altos que as mãos, e volte devagar. Mantenha o tronco parado e os ombros longe das orelhas.'),
 ('Encolhimento na Polia', 'Cable_Shrugs', 'ombros', 'polia', S, 'iniciante', 3, 12, 60,
  'Encolhimento com tensão contínua da polia, bom para o trapézio superior.',
  'Em pé diante da polia baixa, segure a barra com os braços estendidos. Suba os ombros em direção às orelhas, segure um segundo e desça devagar. Evite puxar com os braços: o movimento é só dos ombros.'),
 ('Rosca de Punho com Halter', 'Seated_Dumbbell_Palms-Up_Wrist_Curl', 'biceps', 'halter', S, 'iniciante', 3, 15, 45,
  'Fortalece o antebraço (flexores do punho), importante para pegada e para os exercícios de puxar.',
  'Sentado, apoie o antebraço na coxa ou no banco com as palmas para cima e o punho para fora do apoio. Deixe o halter descer até os dedos e então flexione o punho para subir. Use carga leve e movimento amplo e controlado.'),
 ('Rosca de Punho Inversa', 'Seated_Dumbbell_Palms-Down_Wrist_Curl', 'biceps', 'halter', S, 'iniciante', 3, 15, 45,
  'Trabalha os extensores do antebraço, que equilibram a força de pegada e ajudam a proteger os cotovelos.',
  'Sentado, apoie o antebraço na coxa com as palmas para baixo e o punho livre. Desça o halter alongando o punho e suba estendendo o punho. Use carga bem leve, com movimento controlado.'),
 ('Rosca Inversa com Halteres', 'Standing_Dumbbell_Reverse_Curl', 'biceps', 'halter', S, 'intermediário', 3, 12, 60,
  'Rosca com pegada pronada, que trabalha antebraço e braquiorradial além do bíceps.',
  'Em pé, com um halter em cada mão e as palmas voltadas para baixo, flexione os cotovelos até os halteres chegarem perto dos ombros e desça devagar. Mantenha os cotovelos junto ao tronco e os punhos firmes.'),
 ('Caminhada do Fazendeiro', 'Farmers_Walk', 'biceps', 'halter', T, 'intermediário', 3, 40, 60,
  'Caminhar segurando carga pesada: treina pegada, antebraço, trapézio e core.',
  'Segure um peso pesado em cada mão (halteres ou as barras de fazendeiro mostradas na imagem), com os braços estendidos ao lado do corpo, ombros para trás e abdômen firme. Caminhe com passos curtos e controlados pelo tempo indicado, sem deixar o tronco inclinar. Solte os pesos com cuidado ao terminar.'),
 ('Alongamento Lombar (Joelho ao Peito)', 'One_Knee_To_Chest', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alivia a tensão da lombar e do glúteo, bom depois de treinos de perna e de agachamento.',
  'Deitado de costas, puxe um joelho em direção ao peito com as duas mãos, mantendo a outra perna estendida no chão. Segure sem forçar e respire devagar. Troque de lado.'),
 ('Alongamento de Glúteo Sentado (Piriforme)', 'Seated_Glute', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga glúteo e piriforme, que costumam ficar tensos em quem senta muito.',
  'Sentado, apoie o tornozelo de uma perna sobre o joelho da outra. Mantenha a coluna reta e incline o tronco à frente até sentir o alongamento no glúteo. Segure respirando e troque de lado.'),
 ('Alongamento de Glúteo Deitado', 'Lying_Glute', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alongamento suave para glúteo e lateral do quadril, deitado.',
  'Deitado de costas, cruze o tornozelo de uma perna sobre o joelho da outra e puxe a coxa de baixo em direção ao peito com as mãos. Segure sem forçar e troque de lado.'),
 ('Alongamento de Antebraço', 'Kneeling_Forearm_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga os músculos do antebraço, bom depois de treinos de puxar, rosca e pegada.',
  'Ajoelhado, apoie as palmas no chão com os dedos voltados para os joelhos. Leve o quadril devagar para trás até sentir o antebraço alongar. Mantenha a pressão leve e pare se sentir dor no punho.'),
 ('Inclinação Pélvica (Ponte Suave)', 'Pelvic_Tilt_Into_Bridge', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Mobiliza a lombar e ativa o abdômen, bom no aquecimento ou para aliviar a região lombar.',
  'Deitado de costas com os joelhos dobrados, achate a lombar contra o chão contraindo o abdômen e depois eleve o quadril em uma ponte baixa. Desça vértebra por vértebra, com respiração calma.'),
 # ---- lote 3 (29/10/2026): mobilidade (torácica, escápula, ombro, quadril, tornozelo, punho) e alongamento geral de corpo inteiro ----
 ('Mobilidade Torácica em Pé (Rotação de Tronco)', 'Middle_Back_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Solta a coluna torácica (meio das costas), que costuma ficar rígida em quem passa o dia sentado.',
  'Em pé, com os pés na largura dos ombros e as mãos na cintura, gire o tronco devagar para um lado até sentir o meio das costas alongar, mantendo o quadril de frente. Segure alguns segundos, volte ao centro e gire para o outro lado, alternando durante o tempo.'),
 ('Mobilidade Torácica Sentado', 'Spinal_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Rotação da coluna torácica sentado, com o quadril parado, boa antes de treinos de ombro e costas.',
  'Sente na ponta de um banco ou cadeira com a coluna reta e os pés firmes no chão. Entrelace os dedos atrás da cabeça com os cotovelos abertos. Gire o tronco devagar para um lado o máximo que conseguir sem mexer o quadril, volte e gire para o outro lado.'),
 ('Rolar os Ombros (Mobilidade de Escápula)', 'Shoulder_Circles', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Movimenta as escápulas em todas as direções e solta o trapézio, bom no aquecimento de membros superiores.',
  'Em pé ou sentado, com os braços soltos ao lado do corpo, faça círculos amplos com os ombros: para a frente, para cima, para trás e para baixo. Na metade do tempo, inverta o sentido. Mantenha o pescoço relaxado.'),
 ('Retração de Escápula (Cotovelos para Trás)', 'Elbows_Back', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aproxima as escápulas e abre o peito, contrapondo a postura de ombros para a frente.',
  'Em pé, com a coluna reta, apoie as mãos na parte baixa das costas, dedos para baixo e cotovelos para fora. Leve os cotovelos para trás devagar, tentando aproximá-los, e sinta as escápulas se juntarem. Segure dois segundos, solte e repita durante o tempo.'),
 ('Alongamento de Costas Altas (Abrir as Escápulas)', 'Upper_Back_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Afasta as escápulas e alonga a parte alta das costas, bom depois de remadas e puxadas.',
  'Em pé, entrelace os dedos à frente do corpo com os polegares para baixo. Empurre as mãos para a frente arredondando os ombros e as costas altas, como se abraçasse uma bola grande. Segure respirando fundo, sem prender o ar.'),
 ('Círculos de Cotovelo (Rotação de Ombro)', 'Elbow_Circles', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aquece a articulação do ombro com rotações controladas, antes de supino, desenvolvimento e puxadas.',
  'Em pé ou sentado, apoie as pontas dos dedos nos ombros com os cotovelos na altura dos ombros. Desenhe círculos grandes e lentos com os cotovelos, primeiro para a frente e depois para trás. Solte o ar no começo do círculo e puxe no final.'),
 ('Deslizamento na Parede (Wall Slide)', 'Upward_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Treina subir os braços acima da cabeça com as escápulas bem posicionadas. Ótimo para ombros rígidos.',
  'Encoste costas, cabeça e glúteos na parede, com os pés um pouco à frente. Coloque os braços em W, com cotovelos e costas das mãos encostados na parede. Deslize os braços para cima até esticar acima da cabeça, sem tirar a lombar da parede, e desça devagar de volta ao W. A imagem mostra o movimento dos braços; faça encostado na parede.'),
 ('Deslocamento de Ombro com Bastão', 'Round_The_World_Shoulder_Stretch', 'mobilidade', 'livre', T, 'intermediário', 2, 30, 20,
  'Leva os ombros por toda a amplitude, da frente para trás do corpo, com um bastão ou cabo de vassoura.',
  'Em pé, segure um bastão ou cabo de vassoura com as mãos bem afastadas. Com os braços estendidos, leve o bastão da frente das coxas, por cima da cabeça, até atrás do corpo, e volte. Se travar no meio do caminho, afaste mais as mãos. Movimento lento, sem dor.'),
 ('Rotação Externa de Ombro com Elástico (Aquecimento)', 'External_Rotation_with_Band', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Ativa os músculos do manguito rotador, que estabilizam o ombro, antes dos treinos de peito e ombros.',
  'Prenda um elástico leve na altura do cotovelo e fique de lado para ele. Segure a ponta com a mão de fora, cotovelo colado na cintura e dobrado a 90 graus. Gire o antebraço para fora, afastando a mão do corpo, e volte devagar. Faça repetições lentas durante o tempo e troque de lado.'),
 ('Círculos de Quadril em Quatro Apoios', 'Hip_Circles_prone', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Mobiliza a rotação do quadril em todas as direções, bom antes de agachamento e treino de pernas.',
  'Em quatro apoios, mãos sob os ombros e joelhos sob o quadril. Tire um joelho do chão, mantendo-o dobrado, e desenhe um círculo grande com ele: para a frente, para o lado e para trás. Mantenha o tronco parado e o abdômen firme. Troque de lado na metade do tempo.'),
 ('Rotação de Quadril Deitado (Joelho Cruzado)', 'Knee_Across_The_Body', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Rotação suave de quadril e lombar, alonga o glúteo e a lateral do quadril.',
  'Deitado de costas com uma perna estendida, dobre a outra e cruze o joelho por cima do corpo em direção ao chão, segurando-o com a mão oposta. Estenda o outro braço para o lado e mantenha os ombros no chão. Segure respirando e troque de lado.'),
 ('Rotação de Quadril e Tronco Deitado (Moinho)', 'Windmills', 'mobilidade', 'livre', T, 'intermediário', 2, 30, 15,
  'Mobilização dinâmica do quadril e da coluna, boa para aquecer antes de treinos de perna e de corpo inteiro.',
  'Deitado de costas, braços abertos e pernas estendidas. Levante uma perna e cruze-a por cima do corpo, tentando levar o pé perto da mão oposta, e volte. Alterne os lados com movimento controlado, mantendo os ombros no chão.'),
 ('Maior Alongamento do Mundo', 'Worlds_Greatest_Stretch', 'mobilidade', 'livre', T, 'intermediário', 2, 40, 20,
  'Junta em um só movimento quadril, posterior de coxa e rotação da coluna torácica. Ótimo aquecimento de corpo inteiro.',
  'Dê um passo longo à frente em avanço e apoie a mão do mesmo lado do pé da frente no chão, por dentro do pé. Leve o cotovelo em direção ao tornozelo, depois gire o tronco abrindo esse braço para o teto. Volte, apoie as duas mãos e estique a perna da frente, levando o quadril para trás. Troque de lado.'),
 ('Círculos de Tornozelo', 'Ankle_Circles', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aquece e solta o tornozelo antes de corrida, saltos, agachamento e panturrilha.',
  'Em pé, segurando em um apoio, tire um pé poucos centímetros do chão. Desenhe círculos grandes com a ponta do pé, devagar, nos dois sentidos. Troque de pé na metade do tempo.'),
 ('Mobilidade de Tornozelo (Dorsiflexão em Pé)', 'Standing_Soleus_And_Achilles_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Melhora a dobra do tornozelo (dorsiflexão), que ajuda a agachar mais fundo sem levantar o calcanhar.',
  'Em pé, com um pé um pouco à frente do outro, dobre os dois joelhos levando o joelho da frente para a frente, por cima dos dedos, sem tirar o calcanhar do chão. Sinta a parte baixa da panturrilha e o tendão alongarem. Vá e volte devagar e troque de lado.'),
 ('Círculos de Punho', 'Wrist_Circles', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aquece os punhos antes de flexões, supino, pranchas e exercícios com barra.',
  'Em pé, com os braços estendidos para os lados na altura dos ombros (ou à frente), feche as mãos e gire os punhos fazendo círculos amplos. Na metade do tempo, inverta o sentido. Mantenha os ombros relaxados.'),
 ('Caminhada com as Mãos (Inchworm)', 'Inchworm', 'mobilidade', 'livre', T, 'intermediário', 2, 40, 20,
  'Aquecimento dinâmico que alonga o posterior de coxa e ativa ombros e abdômen.',
  'Em pé, com as pernas o mais esticadas possível, incline o tronco e apoie as mãos no chão à frente dos pés. Caminhe com as mãos para a frente até ficar em posição de prancha, depois caminhe com os pés em direção às mãos. Repita durante o tempo, sem pressa.'),
 ('Alongamento de Corpo Inteiro (Braços para Cima)', 'Overhead_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga o tronco inteiro, dos braços à lombar. Bom para começar e terminar qualquer treino.',
  'Em pé, entrelace os dedos e vire as palmas para o teto. Estique os braços acima da cabeça, mantendo os ombros longe das orelhas e o abdômen firme. Cresça o máximo que puder e respire fundo durante o tempo.'),
 ('Alongamento Lateral de Tronco em Pé', 'Standing_Lateral_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a lateral do tronco, o grande dorsal e o quadrado lombar.',
  'Em pé, com os pés um pouco mais afastados que o quadril e os joelhos levemente dobrados, apoie uma mão na cintura e leve o outro braço para cima. Incline o tronco devagar para o lado da mão apoiada, sem girar o corpo. Segure respirando e troque de lado.'),
 ('Alongamento de Posterior em Pé (Mãos aos Pés)', 'Standing_Toe_Touches', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a parte de trás das pernas e relaxa a lombar, sem precisar deitar.',
  'Em pé, com os pés juntos ou na largura do quadril, incline o tronco à frente a partir do quadril e deixe os braços pendurados em direção aos pés. Joelhos esticados, mas sem travar. Relaxe o pescoço e respire. Suba devagar, vértebra por vértebra.'),
 ('Alongamento do Corredor', 'Runners_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga o posterior de coxa da perna da frente e o flexor do quadril da perna de trás ao mesmo tempo.',
  'Em pé, leve uma perna para trás e desça o tronco até apoiar as mãos no chão, ao lado do pé da frente. Mantenha o calcanhar da frente no chão e a perna de trás estendida. Segure respirando e troque de lado.'),
 ('Alongamento de Adutores Sentado (Pernas Afastadas)', 'The_Straddle', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga a parte interna das coxas e o posterior, sentado.',
  'Sente no chão com as pernas estendidas e afastadas em V. Com a coluna reta e as mãos no chão à frente, incline o tronco para a frente até sentir a parte interna das coxas alongar. Segure sem balançar o corpo.'),
 ('Alongamento de Virilha Sentado (Borboleta)', 'Groin_and_Back_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga virilha e adutores, e solta a lombar. Bom depois de treinos de perna.',
  'Sente no chão, dobre os joelhos e junte as solas dos pés, deixando os joelhos caírem para os lados. Com as mãos atrás da cabeça ou segurando os pés, incline o tronco à frente levando os cotovelos para dentro das coxas. Segure respirando e volte devagar.'),
 ('Alongamento Lateral de Pescoço', 'Side_Neck_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 20, 10,
  'Alivia a tensão do pescoço e do trapézio, comum em quem trabalha sentado.',
  'Com os ombros relaxados, incline a cabeça devagar em direção a um ombro. Se quiser, apoie a mão por cima da cabeça para ajudar, sem puxar com força. Segure respirando e troque de lado.'),
 ('Alongamento de Peito e Ombro com Bastão', 'Chest_And_Front_Of_Shoulder_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga o peitoral e a frente dos ombros usando um bastão ou cabo de vassoura.',
  'Em pé, segure um bastão à frente do corpo com as mãos um pouco mais afastadas que os ombros e as palmas para baixo. Suba o bastão por cima da cabeça e leve-o um pouco para trás até sentir o peito e a frente dos ombros alongarem. Segure sem arquear a lombar.'),
 ('Alongamento de Grande Dorsal na Parede', 'One_Arm_Against_Wall', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Alonga o grande dorsal, o músculo largo das costas, bom depois de puxadas e remadas.',
  'Em pé ao lado de uma parede ou batente de porta, apoie o antebraço dobrado acima da cabeça. Incline o corpo devagar em direção à parede até sentir a lateral das costas alongar. Segure respirando e troque de lado.'),
 ('Abertura de Peito Dinâmica (Aquecimento)', 'Dynamic_Chest_Stretch', 'mobilidade', 'livre', T, 'iniciante', 2, 30, 15,
  'Aquecimento dinâmico para peito e ombros antes de supino, flexões e crucifixo.',
  'Em pé, com os braços estendidos à frente e as mãos juntas, abra os braços para trás o máximo que conseguir, como um abraço ao contrário, e volte juntando as mãos. Faça em ritmo contínuo e controlado, aumentando a amplitude aos poucos.'),
]

def slug(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', s))

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'bohtreinar-midia'})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()

def frame(data, width=360):
    im = Image.open(io.BytesIO(data)).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    return im

def js_block(i, e, s):
    name, fid, group, equip, kind, diff, sets, reps, rest, desc, exe = e
    esc = lambda t: t.replace('\\', '\\\\').replace('"', '\\"')
    return f'''  {{
    id: "ex{i}",
    name: "{esc(name)}",
    equipment: "{equip}",
    kind: "{kind}",
    sets: {sets},
    reps: {reps},
    rest: {rest},
    description: "{esc(desc)}",
    execution: "{esc(exe)}",
    machineImage: "/exercises/{s}.gif",
    videoUrl: '',
    muscleGroup: "{group}",
    difficulty: "{diff}"
  }}'''

def main():
    write = '--write' in sys.argv
    STILL.mkdir(parents=True, exist_ok=True); GIFS.mkdir(parents=True, exist_ok=True)
    src = DATA.read_text(encoding='utf8')
    existing = set(re.findall(r'name:\s*"([^"]+)"', src))
    last = max(int(x) for x in re.findall(r'id:\s*"ex(\d+)"', src))
    blocks, failed = [], []
    n = last
    for e in NEW:
        name, fid = e[0], e[1]
        if name in existing:
            print('já existe, pulando:', name); continue
        s = slug(name)
        try:
            a = get(f'{BASE}/{fid}/0.jpg'); b = get(f'{BASE}/{fid}/1.jpg')
        except Exception as ex:
            print('FALHA', name, fid, ex); failed.append(name); continue
        fa, fb = frame(a), frame(b)
        fa.save(STILL / f'{s}.jpg', quality=82, optimize=True)
        fb = fb.resize(fa.size)
        pa = fa.convert('P', palette=Image.ADAPTIVE, colors=96)
        pb = fb.convert('RGB').quantize(palette=pa)
        pa.save(GIFS / f'{s}.gif', save_all=True, append_images=[pb], duration=900, loop=0, optimize=True)
        n += 1
        blocks.append(js_block(n, e, s))
        print('ok', f'ex{n}', name, '<-', fid)
    print(len(blocks), 'novos;', len(failed), 'falhas', failed)
    if write and blocks and not failed:
        end = src.rstrip().rfind('];')
        head = src[:end].rstrip()
        DATA.write_text(head + ',\n' + ',\n'.join(blocks) + '\n];\n', encoding='utf8')
        print('exercises.js atualizado')
    elif write:
        print('NÃO gravei exercises.js: houve falhas')

if __name__ == '__main__':
    main()
