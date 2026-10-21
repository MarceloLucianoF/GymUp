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
