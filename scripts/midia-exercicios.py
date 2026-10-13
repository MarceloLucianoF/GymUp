"""Baixa a mídia de TODOS os exercícios da biblioteca a partir do Free Exercise DB (domínio público, Unlicense) e
monta, para cada exercício: public/exercicios/<slug>.jpg (foto) e public/exercises/<slug>.gif (GIF animado de 2 quadros: início e fim).
Não usa mídia da Gym visual (licença própria, não livre). Uso: python3 scripts/midia-exercicios.py"""
import io, json, re, sys, unicodedata, urllib.request
from pathlib import Path
from PIL import Image

BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
ROOT = Path(__file__).resolve().parent.parent
STILL = ROOT / 'public' / 'exercicios'
GIFS = ROOT / 'public' / 'exercises'

# nome no BohTreinar -> id no Free Exercise DB (mesmo movimento; onde o banco não tem a máquina, o movimento equivalente)
MAP = {
  'Supino Máquina': 'Machine_Bench_Press', 'Chest Press Convergente': 'Leverage_Chest_Press',
  'Supino Inclinado Máquina': 'Leverage_Incline_Chest_Press', 'Supino Declinado Máquina': 'Leverage_Decline_Chest_Press',
  'Crossover na Polia': 'Cable_Crossover', 'Crucifixo no Cabo': 'Flat_Bench_Cable_Flyes',
  'Puxada Aberta Máquina': 'Wide-Grip_Lat_Pulldown', 'Puxada Neutra Máquina': 'Close-Grip_Front_Lat_Pulldown',
  'Remada Articulada': 'Leverage_Iso_Row', 'Remada Cavalinho Máquina': 'Lying_T-Bar_Row', 'Remada Neutra Máquina': 'Leverage_High_Row',
  'Face Pull na Polia': 'Face_Pull', 'Desenvolvimento Máquina': 'Leverage_Shoulder_Press',
  'Crucifixo Inverso Máquina': 'Reverse_Machine_Flyes', 'Tríceps Máquina': 'Machine_Triceps_Extension',
  'Rosca Scott Máquina': 'Machine_Preacher_Curls', 'Rosca Martelo na Polia': 'Cable_Hammer_Curls_-_Rope_Attachment',
  'Rosca Alternada Máquina': 'Machine_Bicep_Curl', 'Hack Squat': 'Hack_Squat', 'Cadeira Flexora': 'Seated_Leg_Curl',
  'Cadeira Extensora': 'Leg_Extensions', 'Cadeira Adutora': 'Thigh_Adductor', 'Cadeira Abdutora': 'Thigh_Abductor',
  'Panturrilha Sentado Máquina': 'Seated_Calf_Raise', 'Abdominal Máquina': 'Ab_Crunch_Machine', 'Crunch na Polia': 'Cable_Crunch',
  'Mesa Flexora': 'Lying_Leg_Curls', 'Extensão Lombar Y + W': 'Hyperextensions_Back_Extensions',
  'Abdominal trocando bola suíça': 'Exercise_Ball_Crunch', 'Agachamento com Halteres': 'Dumbbell_Squat',
  'Crucifixo Inverso no Banco Inclinado': 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench',
  'Remada Curvada com Halteres (Pegada Neutra)': 'Bent_Over_Two-Dumbbell_Row_With_Palms_In',
  'Panturrilha em pé com Halteres': 'Standing_Dumbbell_Calf_Raise', 'Tríceps Supinado com Halteres': 'Lying_Dumbbell_Tricep_Extension',
  'Flexão Nórdica Inversa': 'Weighted_Sissy_Squat', 'Rosca Direta Banco Inclinado': 'Incline_Dumbbell_Curl',
  'Rosca Scott com Barra W': 'Preacher_Curl', 'Afundo Livre com Halteres': 'Dumbbell_Lunges',
  'Supino Inclinado com Halteres': 'Incline_Dumbbell_Press', 'Barra Fixa (Em pé)': 'Pullups',
  'Supino Reto com Halteres': 'Dumbbell_Bench_Press', 'Abdominal Canivete Alternado': 'Jackknife_Sit-Up',
  'Elevação Lateral Sentado com Halteres': 'Seated_Side_Lateral_Raise', 'Desenvolvimento Barra Reta': 'Barbell_Shoulder_Press',
  'Tríceps Barra Encostado na Polia': 'Triceps_Pushdown', 'Rosca Direta na Polia Baixa com Corda': 'High_Cable_Curls',
  'Tríceps Unilateral na Polia': 'Cable_One_Arm_Tricep_Extension', 'Elevação Lateral Máquina': 'Side_Lateral_Raise',
  'Hip Thrust Máquina': 'Barbell_Hip_Thrust', 'Glúteo Máquina': 'Glute_Kickback', 'Pullover Máquina': 'Straight-Arm_Pulldown',
}

# Exercícios padrão embutidos no app (src/data/exercises.js): antes apontavam para imagens de via.placeholder.com (serviço desativado).
DEFAULTS = {
  'Supino Reto Máquina': 'Machine_Bench_Press', 'Supino Inclinado Halter': 'Incline_Dumbbell_Press', 'Peck Deck (Voador)': 'Butterfly',
  'Desenvolvimento Halter': 'Dumbbell_Shoulder_Press', 'Elevação Lateral': 'Side_Lateral_Raise', 'Tríceps Corda': 'Triceps_Pushdown_-_Rope_Attachment',
  'Tríceps Barra (Pushdown)': 'Triceps_Pushdown', 'Puxada Aberta (Lat Pulldown)': 'Wide-Grip_Lat_Pulldown', 'Remada Máquina (Sentado)': 'Seated_Cable_Rows',
  'Puxada Triângulo (Pegada Fechada)': 'Close-Grip_Front_Lat_Pulldown', 'Rosca Direta Barra': 'Barbell_Curl', 'Rosca Alternada Halter': 'Dumbbell_Alternate_Bicep_Curl',
  'Rosca Concentrada': 'Concentration_Curls', 'Agachamento Livre ou Hack': 'Barbell_Full_Squat', 'Leg Press': 'Leg_Press', 'Mesa Flexora': 'Lying_Leg_Curls',
  'Cadeira Extensora': 'Leg_Extensions', 'Elevação Pélvica (Glúteo)': 'Barbell_Hip_Thrust', 'Panturrilha em Pé (Máquina)': 'Standing_Calf_Raises',
  'Esteira / Bike / Escada': 'Jogging_Treadmill', 'HIIT (Cardio de Alta Intensidade)': 'Mountain_Climbers', 'Prancha Abdominal': 'Plank',
  'Abdominal Infra': 'Flat_Bench_Lying_Leg_Raise', 'Abdominal Oblíquo (Bicicleta)': 'Air_Bike',
}

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

def main():
    STILL.mkdir(parents=True, exist_ok=True); GIFS.mkdir(parents=True, exist_ok=True)
    out = {}
    for name, fid in {**DEFAULTS, **MAP}.items():
        try:
            a = get(f'{BASE}/{fid}/0.jpg'); b = get(f'{BASE}/{fid}/1.jpg')
        except Exception as e:
            print('FALHA', name, fid, e); continue
        fa, fb = frame(a), frame(b)
        s = slug(name)
        fa.save(STILL / f'{s}.jpg', quality=82, optimize=True)
        fb = fb.resize(fa.size)
        pa = fa.convert('P', palette=Image.ADAPTIVE, colors=96)
        pb = fb.convert('RGB').quantize(palette=pa)
        pa.save(GIFS / f'{s}.gif', save_all=True, append_images=[pb], duration=900, loop=0, optimize=True)
        out[name] = {'slug': s, 'source': fid}
        print('ok', name, fid)
    json.dump(out, open(ROOT / 'scripts' / 'midia-exercicios.json', 'w'), ensure_ascii=False, indent=1)
    print(len(out), 'de', len({**DEFAULTS, **MAP}))

if __name__ == '__main__':
    main()
