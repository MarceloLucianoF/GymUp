// Funções puras do onboarding (validação, IMC, plano sugerido).
export const GOALS = ['Hipertrofia', 'Emagrecimento', 'Força', 'Resistência'];
export const LEVELS = ['iniciante', 'intermediario', 'avancado'];
export const LIMITS = {
  age: [12, 90],
  weight: [30, 300],
  height: [100, 230],
  weeklyGoal: [2, 7],
};
export const TOTAL_STEPS = 5;

const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return NaN;
  return Number(String(v).replace(',', '.'));
};

export function validateName(name) {
  const n = String(name || '').trim();
  if (n.length < 2) return 'Informe como podemos te chamar (mín. 2 letras).';
  if (n.length > 60) return 'Nome muito longo (máx. 60 caracteres).';
  return '';
}

export function validateGoal(goal) {
  return GOALS.includes(goal) ? '' : 'Escolha um objetivo para continuar.';
}

export function validateBody({ age, weight, height }) {
  const checks = [
    ['Idade', age, LIMITS.age, 'anos', true],
    ['Peso', weight, LIMITS.weight, 'kg', false],
    ['Altura', height, LIMITS.height, 'cm', true],
  ];
  for (const [label, raw, [min, max], unit, int] of checks) {
    const v = toNum(raw);
    if (!Number.isFinite(v)) return `Informe ${label.toLowerCase()}.`;
    if (v < min || v > max || (int && !Number.isInteger(v))) {
      return `${label} deve ficar entre ${min} e ${max} ${unit}${int ? ' (número inteiro)' : ''}.`;
    }
  }
  return '';
}

export function validateExperience({ experience, weeklyGoal }) {
  if (!LEVELS.includes(experience)) return 'Escolha seu nível de experiência.';
  const w = Number(weeklyGoal);
  const [min, max] = LIMITS.weeklyGoal;
  if (!Number.isInteger(w) || w < min || w > max) return `Escolha entre ${min} e ${max} treinos por semana.`;
  return '';
}

export function validateCoachCode(code) {
  const c = String(code || '').trim();
  if (!c) return '';
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(c)) return 'Código inválido: use apenas letras, números, - e _ (mín. 6).';
  return '';
}

export function validateStep(step, data) {
  switch (step) {
    case 0: return validateName(data.displayName);
    case 1: return validateGoal(data.goal);
    case 2: return validateBody(data);
    case 3: return validateExperience(data);
    case 4: return validateCoachCode(data.coachId);
    default: return '';
  }
}

export function calcBmi(weight, height) {
  const w = toNum(weight);
  const h = toNum(height) / 100;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

export function bmiCategory(bmi) {
  if (bmi === null || bmi === undefined) return '';
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Peso saudável';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidade';
}

const FOCUS = {
  Hipertrofia: 'Volume moderado, 8–12 repetições e progressão de carga',
  Emagrecimento: 'Treino de força combinado com ritmo alto e cardio leve',
  Força: 'Exercícios compostos, 3–6 repetições e descanso longo',
  Resistência: 'Séries longas, 15+ repetições e pouco descanso',
};
const QUOTES = {
  Hipertrofia: 'Cada série bem feita constrói o corpo que você quer.',
  Emagrecimento: 'Constância vence intensidade: apareça hoje.',
  Força: 'Força é treinada um quilo de cada vez.',
  Resistência: 'Seu fôlego de hoje é o limite que você superou ontem.',
};

export function suggestPlan({ goal, experience, weeklyGoal }) {
  const [min, max] = LIMITS.weeklyGoal;
  let days = Math.round(Number(weeklyGoal));
  if (!Number.isFinite(days)) days = 3;
  const cap = experience === 'iniciante' ? 4 : 6;
  days = Math.min(Math.max(days, min), Math.min(max, cap));
  const split = days <= 3 ? 'Full body' : days <= 5 ? 'Divisão superior/inferior ou ABC' : 'Divisão ABCD+';
  return {
    days,
    split,
    focus: FOCUS[goal] || 'Treino equilibrado para todo o corpo',
    quote: QUOTES[goal] || 'O primeiro treino é o mais importante.',
    adjusted: days !== Math.round(Number(weeklyGoal)),
  };
}

// Monta o payload exato do contrato. withCoach=false omite coachId.
export function buildPayload(data, { withCoach = true, now = new Date() } = {}) {
  const iso = now.toISOString();
  const payload = {
    displayName: String(data.displayName).trim(),
    goal: data.goal,
    age: toNum(data.age),
    weight: toNum(data.weight),
    height: toNum(data.height),
    experience: data.experience,
    weeklyGoal: Number(data.weeklyGoal),
    onboardedAt: iso,
    updatedAt: iso,
  };
  const coach = String(data.coachId || '').trim();
  if (withCoach && coach) payload.coachId = coach;
  return payload;
}

export function buildSkipPayload(now = new Date()) {
  const iso = now.toISOString();
  return { onboardedAt: iso, updatedAt: iso };
}
