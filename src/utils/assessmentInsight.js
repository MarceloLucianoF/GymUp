// "Análise da avaliação" (Evolução › Avaliações e anamnese): fatos calculados aqui a partir da avaliação mais recente e da anterior,
// um texto local para o aluno ou para o professor e, a pedido, uma versão escrita pela IA que só vale com os mesmos números.
// Para a IA vão só números, sexo, idade e objetivo: nada de nome, datas, observações ou textos da anamnese.

const DAY = 24 * 3600 * 1000;
const round = (n, d = 1) => { const f = 10 ** d; return Math.round(n * f) / f; };
const br = (n, d = 1) => (typeof n === 'number' ? n.toFixed(d).replace(/\.?0+$/, '').replace('.', ',') : '');
const br2 = (n) => n.toFixed(2).replace('.', ',');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const fatOf = (a) => (isNum(a?.bodyFat) ? a.bodyFat : isNum(a?.bioimpedance?.bodyFat) ? a.bioimpedance.bodyFat : undefined);
const fatSource = (a) => (isNum(a?.bodyFat) ? 'dobras cutâneas' : isNum(a?.bioimpedance?.bodyFat) ? 'bioimpedância' : '');
const dayOf = (a) => new Date(`${String(a?.date || a?.createdAt || '').slice(0, 10)}T12:00:00`).getTime();

// Referências gerais (OMS) para leitura, não para diagnóstico.
export const BMI_BANDS = [[18.5, 'abaixo do peso'], [25, 'adequada'], [30, 'sobrepeso'], [Infinity, 'obesidade']];
export const WHR_LIMIT = { male: 0.9, female: 0.85 };
export const WHT_LIMIT = 0.5;

const bmiBand = (bmi) => BMI_BANDS.find(([max]) => bmi < max)[1];

const DELTA_KEYS = [
  ['weight', 'peso', 'kg', (a) => a?.weight],
  ['fat', 'gordura', 'pontos percentuais', fatOf],
  ['leanMass', 'massa magra', 'kg', (a) => a?.bioimpedance?.leanMass],
  ['waist', 'cintura', 'cm', (a) => a?.perimeters?.waist],
  ['hip', 'quadril', 'cm', (a) => a?.perimeters?.hip],
  ['arm', 'braço', 'cm', (a) => a?.perimeters?.arm],
  ['thigh', 'coxa', 'cm', (a) => a?.perimeters?.thigh]
];

/**
 * @param assessments do aluno, mais recente primeiro (como listAssessments devolve)
 * @param anamnesis versão mais recente (ou null); @param goal objetivo do perfil
 */
export function buildAssessmentFacts({ assessments = [], anamnesis = null, goal = '' }) {
  const latest = assessments[0];
  if (!latest) return { hasData: false };
  const height = latest.height || assessments.find((a) => a.height)?.height;
  const f = { hasData: true, sex: latest.sex, age: latest.age, goal: String(goal || '').slice(0, 40) };
  if (isNum(latest.weight)) f.weight = latest.weight;
  if (isNum(latest.weight) && isNum(height)) f.bmi = round(latest.weight / (height / 100) ** 2);
  const fat = fatOf(latest);
  if (isNum(fat)) { f.fat = fat; f.fatSource = fatSource(latest); }
  if (isNum(latest.bioimpedance?.leanMass)) f.leanMass = latest.bioimpedance.leanMass;
  if (isNum(latest.bioimpedance?.visceralFat)) f.visceralFat = latest.bioimpedance.visceralFat;
  const waist = latest.perimeters?.waist;
  const hip = latest.perimeters?.hip;
  if (isNum(waist)) f.waist = waist;
  if (isNum(waist) && isNum(hip)) f.whr = round(waist / hip, 2);
  if (isNum(waist) && isNum(height)) f.wht = round(waist / height, 2);

  // Anterior: a primeira avaliação mais antiga que tenha pelo menos um número em comum com a atual.
  const previous = assessments.slice(1).find((a) => DELTA_KEYS.some(([, , , get]) => isNum(get(a)) && isNum(get(latest))));
  f.deltas = [];
  if (previous) {
    const days = Math.round((dayOf(latest) - dayOf(previous)) / DAY);
    if (Number.isFinite(days) && days > 0) f.daysBetween = days;
    DELTA_KEYS.forEach(([key, label, unit, get]) => {
      if (isNum(get(latest)) && isNum(get(previous))) f.deltas.push({ key, label, unit, delta: round(get(latest) - get(previous)) });
    });
  }
  f.parqYes = (anamnesis?.parq || []).some((answer) => answer === true);
  f.hasInjuries = !!String(anamnesis?.injuries || '').trim();
  f.hasAnamnesis = !!anamnesis;
  return f;
}

const deltaOf = (f, key) => f.deltas.find((d) => d.key === key)?.delta;

function deltaSentence(f, you) {
  if (!f.deltas.length) return '';
  const parts = f.deltas.map(({ label, unit, delta }) => (delta === 0 ? `${label} igual` : `${label} ${delta > 0 ? 'subiu' : 'caiu'} ${br(Math.abs(delta))} ${unit}`));
  const since = f.daysBetween ? `Em ${f.daysBetween} dias desde a avaliação anterior` : 'Desde a avaliação anterior';
  return `${since}${you ? '' : ' do aluno'}: ${parts.join(', ')}.`;
}

/** Leitura da mudança de composição (o que o par peso/gordura sugere). */
function trendSentence(f) {
  const w = deltaOf(f, 'weight');
  const fat = deltaOf(f, 'fat');
  const waist = deltaOf(f, 'waist');
  if (isNum(fat) && fat <= -0.5 && isNum(w) && w >= -0.5) return 'Gordura caiu sem perda de peso: sinal de ganho de massa magra (recomposição corporal).';
  if (isNum(fat) && fat <= -0.5) return 'Peso e gordura caíram juntos: a perda veio principalmente de gordura.';
  if (isNum(fat) && fat >= 0.5 && isNum(w) && w > 0) return 'Peso e gordura subiram juntos: vale rever alimentação e regularidade dos treinos.';
  if (isNum(fat) && fat >= 0.5) return 'A gordura subiu: vale rever alimentação e regularidade dos treinos.';
  if (!isNum(fat) && isNum(waist) && waist <= -1) return 'A cintura diminuiu, um bom sinal de redução de gordura abdominal.';
  if (!isNum(fat) && isNum(waist) && waist >= 1) return 'A cintura aumentou: acompanhe junto com a alimentação.';
  return '';
}

function snapshotSentence(f, you) {
  const bits = [];
  if (isNum(f.weight)) bits.push(`peso ${br(f.weight)} kg`);
  if (isNum(f.bmi)) bits.push(`IMC ${br(f.bmi)} (faixa ${bmiBand(f.bmi)})`);
  if (isNum(f.fat)) bits.push(`gordura ${br(f.fat)}% (${f.fatSource})`);
  if (isNum(f.leanMass)) bits.push(`massa magra ${br(f.leanMass)} kg`);
  if (isNum(f.waist)) bits.push(`cintura ${br(f.waist)} cm`);
  if (isNum(f.whr)) bits.push(`relação cintura-quadril ${br2(f.whr)}`);
  if (!bits.length) return you ? 'Sua avaliação mais recente não tem números para analisar.' : 'A avaliação mais recente não tem números para analisar.';
  return `${you ? 'Na sua avaliação mais recente' : 'Na avaliação mais recente'}: ${bits.join(', ')}.`;
}

function riskSentences(f) {
  const out = [];
  if (isNum(f.bmi) && f.bmi >= 25 && isNum(f.fat)) out.push('O IMC não separa músculo de gordura; o percentual de gordura é a referência mais fiel.');
  const limit = WHR_LIMIT[f.sex];
  if (isNum(f.whr) && limit && f.whr >= limit) out.push(`A relação cintura-quadril está acima da referência da OMS (${br2(limit)}).`);
  else if (isNum(f.wht) && f.wht >= WHT_LIMIT) out.push(`A cintura passa da metade da altura (relação ${br2(f.wht)}; referência abaixo de ${br2(WHT_LIMIT)}).`);
  return out;
}

/** Texto local em frases. audience: 'student' (segunda pessoa) ou 'coach' (com pontos para o treino). */
export function assessmentLines(f, audience = 'student') {
  if (!f?.hasData) return [audience === 'coach' ? 'O aluno ainda não tem avaliação física registrada.' : 'Lance uma avaliação física para ver a análise.'];
  const you = audience !== 'coach';
  const lines = [snapshotSentence(f, you), deltaSentence(f, you), trendSentence(f), ...riskSentences(f)].filter(Boolean);
  if (!f.deltas.length) lines.push(you ? 'Com uma segunda avaliação em 30 a 60 dias, dá para ver a evolução.' : 'Sugira uma reavaliação em 30 a 60 dias para medir a evolução.');
  if (audience === 'coach') {
    if (f.parqYes) lines.push('PAR-Q com resposta "sim": peça liberação médica antes de aumentar a intensidade.');
    if (f.hasInjuries) lines.push('Há lesões registradas na anamnese: adapte exercícios e amplitude.');
    if (!f.hasAnamnesis) lines.push('O aluno ainda não preencheu a anamnese.');
  }
  lines.push(you ? 'É uma leitura dos números, não um diagnóstico: converse com seu professor ou médico.' : 'Leitura dos números como ponto de partida: a decisão é sua.');
  return lines;
}

export const assessmentText = (f, audience) => assessmentLines(f, audience).join(' ');

const SYSTEM = {
  student: 'Você é um profissional de educação física explicando uma avaliação física ao próprio aluno. Escreva em português do Brasil, em segunda pessoa, em 4 a 6 frases curtas: o que os números mostram, o que mudou desde a avaliação anterior e uma ou duas sugestões práticas de treino e hábitos coerentes com o objetivo.',
  coach: 'Você ajuda um personal trainer a interpretar a avaliação física de um aluno. Escreva em português do Brasil, na terceira pessoa, em 4 a 6 frases curtas: leitura objetiva dos números, o que mudou desde a avaliação anterior e até três sugestões práticas de ajuste no treino coerentes com o objetivo.'
};
const RULES = ' Use SOMENTE os números do JSON: não calcule, não arredonde, não converta e não invente valores nem datas. Sem diagnóstico, sem citar doenças, sem dieta ou remédio, sem emojis, sem julgamento sobre o corpo. Se "parq_sim" for verdadeiro, recomende liberação médica antes de aumentar a intensidade. O IMC não separa músculo de gordura.';

/** Mensagens para a IA: só números, sexo, idade e objetivo (sem nome, datas, observações ou textos da anamnese). */
export function assessmentAiMessages(f, audience = 'student') {
  const payload = {
    sexo: f.sex === 'male' ? 'masculino' : f.sex === 'female' ? 'feminino' : undefined,
    idade: f.age, objetivo: f.goal || undefined,
    peso_kg: f.weight, imc: f.bmi, faixa_imc: isNum(f.bmi) ? bmiBand(f.bmi) : undefined,
    gordura_pct: f.fat, gordura_metodo: f.fatSource || undefined, massa_magra_kg: f.leanMass, gordura_visceral: f.visceralFat,
    cintura_cm: f.waist, relacao_cintura_quadril: f.whr, referencia_rcq_oms: WHR_LIMIT[f.sex] ? br2(WHR_LIMIT[f.sex]) : undefined,
    relacao_cintura_altura: f.wht, dias_desde_anterior: f.daysBetween,
    variacao_desde_anterior: f.deltas?.length ? Object.fromEntries(f.deltas.map((d) => [`${d.label} (${d.unit})`, d.delta])) : undefined,
    parq_sim: f.parqYes,
    lesoes_registradas: audience === 'coach' ? f.hasInjuries : undefined
  };
  return [
    { role: 'system', content: SYSTEM[audience === 'coach' ? 'coach' : 'student'] + RULES },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

const numbersIn = (text) => (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));

/** A resposta da IA só vale se cada número dela estiver nos fatos (ou no texto local). */
export function assessmentMatches(text, f, audience = 'student') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 40 || clean.length > 1200) return false;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean)) return false;
  const allowed = new Set([...numbersIn(assessmentText(f, audience)), ...numbersIn(assessmentAiMessages(f, audience)[1].content)]);
  return numbersIn(clean).every((n) => allowed.has(n));
}
