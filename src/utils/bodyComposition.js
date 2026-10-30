// Composição corporal por dobras cutâneas (Jackson & Pollock) com a equação de Siri.
// Densidade corporal (DC) pela soma das dobras em mm (S) e idade (anos); % de gordura = 495 / DC - 450.
//
// Pollock 3 dobras
//   homem:  peito, abdome, coxa             DC = 1.10938 - 0.0008267 S + 0.0000016 S² - 0.0002574 idade
//   mulher: tríceps, suprailíaca, coxa      DC = 1.0994921 - 0.0009929 S + 0.0000023 S² - 0.0001392 idade
// Pollock 7 dobras (peito, axilar média, tríceps, subescapular, abdome, suprailíaca, coxa)
//   homem:  DC = 1.112 - 0.00043499 S + 0.00000055 S² - 0.00028826 idade
//   mulher: DC = 1.097 - 0.00046971 S + 0.00000056 S² - 0.00012828 idade

export const SKINFOLD_SITES = {
  chest: 'Peitoral',
  midaxillary: 'Axilar média',
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  abdomen: 'Abdominal',
  suprailiac: 'Suprailíaca',
  thigh: 'Coxa'
};

export const PROTOCOLS = {
  pollock3: { label: 'Pollock 3 dobras', male: ['chest', 'abdomen', 'thigh'], female: ['triceps', 'suprailiac', 'thigh'] },
  pollock7: {
    label: 'Pollock 7 dobras',
    male: ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'],
    female: ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh']
  }
};

const COEF = {
  pollock3: { male: [1.10938, 0.0008267, 0.0000016, 0.0002574], female: [1.0994921, 0.0009929, 0.0000023, 0.0001392] },
  pollock7: { male: [1.112, 0.00043499, 0.00000055, 0.00028826], female: [1.097, 0.00046971, 0.00000056, 0.00012828] }
};

/** Dobras exigidas pelo protocolo e sexo ([] se inválido). */
export function requiredSites(protocol, sex) {
  return PROTOCOLS[protocol]?.[sex] || [];
}

const positive = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};

/** Densidade corporal (g/cm³) ou null quando falta dado. */
export function bodyDensity({ protocol, sex, age, skinfolds = {} }) {
  const coef = COEF[protocol]?.[sex];
  const years = positive(age);
  if (!coef || !years) return null;
  const sites = requiredSites(protocol, sex);
  const values = sites.map((site) => positive(skinfolds[site]));
  if (values.some((v) => v === null)) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const [a, b, c, d] = coef;
  return a - b * sum + c * sum * sum - d * years;
}

/** Siri: % de gordura a partir da densidade. */
export const siri = (density) => (density > 0 ? 495 / density - 450 : null);

/** % de gordura (1 casa) pelo protocolo; null quando falta dado ou o resultado sai do plausível (2 a 70%). */
export function bodyFatPercent(input) {
  const pct = siri(bodyDensity(input));
  if (pct === null || !Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return Math.round(pct * 10) / 10;
}

/** Massa gorda e magra (kg) a partir do peso e do % de gordura. */
export function fatAndLeanMass(weight, fatPct) {
  const w = positive(weight);
  const f = positive(fatPct);
  if (!w || !f) return null;
  const fat = Math.round(w * f) / 100;
  return { fat: Math.round(fat * 10) / 10, lean: Math.round((w - fat) * 10) / 10 };
}
