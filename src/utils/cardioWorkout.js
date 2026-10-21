import { exerciseKind } from './exerciseKind';
// Treino aeróbico (esteira, bicicleta, elíptico, remo...). A biblioteca de musculação não tem cardio, então a ficha vem de regras fixas:
// aquecimento, blocos por modalidade e volta à calma, com a intensidade em percepção de esforço (PSE de 1 a 10). Não usa IA nem rede.
const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MODALITIES = [
  { id: 'esteira', re: /esteira|corrida|correr|caminhada|caminhar|treadmill/, label: 'Esteira', warm: 'caminhada leve', work: 'corrida leve ou caminhada inclinada', fast: 'corrida forte' },
  { id: 'bicicleta', re: /bicicleta|bike|ciclo|spinning|pedal/, label: 'Bicicleta', warm: 'pedal leve', work: 'pedal constante com carga moderada', fast: 'pedal forte com carga alta' },
  { id: 'eliptico', re: /eliptico|transport/, label: 'Elíptico', warm: 'movimento leve', work: 'ritmo constante', fast: 'ritmo forte' },
  { id: 'remo', re: /remo ergom|remo indoor|ergometro de remo|remada ergom/, label: 'Remo ergométrico', warm: 'remada leve', work: 'remada constante', fast: 'remada forte' }
];

export const isCardioExercise = (ex) => exerciseKind(ex) === 'cardio';

export const isCardioRequest = (text) => /aerobic|aerobio|cardio|bicicleta|bike|esteira|eliptico|corrida|caminhada|spinning|hiit/.test(plain(text));

const minutesFrom = (text, fallback) => {
  const m = plain(text).match(/(\d{2,3})\s*(min|minutos)/);
  const n = m ? Number(m[1]) : fallback;
  return Math.min(90, Math.max(20, n || fallback));
};

export function buildCardioWorkout(text, { goal = 'Emagrecimento', durationMinutes = 40 } = {}) {
  const t = plain(text);
  let mods = MODALITIES.filter((m) => m.re.test(t));
  if (!mods.length) mods = [MODALITIES[0], MODALITIES[1]];
  const total = minutesFrom(text, durationMinutes);
  const warm = 5; const cool = 5;
  const main = total - warm - cool;
  const interval = /hiit|intervalad|tiro/.test(t) || goal === 'Emagrecimento';
  const perMod = Math.max(5, Math.round(main / mods.length / 5) * 5);
  const exercises = [];
  const add = (name, minutes, description) => exercises.push({
    firestoreId: `cardio-${exercises.length + 1}`, name, muscleGroup: 'Cardio', kind: 'cardio', cardio: true, durationMin: minutes,
    sets: '1', reps: String(minutes), rest: 0, machineImage: null, videoUrl: null, description
  });
  add(`${mods[0].label}: ${mods[0].warm}`, warm, 'Aquecimento: esforço 3 de 10 (dá para conversar sem esforço). Aumente aos poucos nos últimos minutos.');
  mods.forEach((m, i) => {
    const minutes = i === mods.length - 1 ? Math.max(5, main - perMod * (mods.length - 1)) : perMod;
    if (interval) add(`${m.label}: intervalado`, minutes, `Alterne 1 min forte (${m.fast}, esforço 8 de 10) e 2 min leve (${m.warm}, esforço 4 de 10) até completar o tempo.`);
    else add(`${m.label}: ritmo constante`, minutes, `Mantenha ${m.work}, esforço 5 a 6 de 10: dá para falar frases curtas, mas não cantar.`);
  });
  add(`${mods[mods.length - 1].label}: volta à calma`, cool, 'Reduza o ritmo até a respiração normalizar (esforço 2 de 10). Termine com alongamento leve de pernas.');
  const names = mods.map((m) => m.label.toLowerCase()).join(' e ');
  return {
    name: `Cardio: ${names} (${total} min)`,
    category: goal,
    description: `Treino aeróbico de ${total} minutos em ${names}, ${interval ? 'intervalado' : 'em ritmo constante'}. Intensidade guiada pelo esforço percebido.`,
    estimatedTime: `${total} min`,
    exercises,
    createdAt: new Date().toISOString(),
    isAIGenerated: true,
    composition: { focus: 'Cardio', requestedFocus: 'Cardio', source: 'regras', division: null, reason: null }
  };
}
