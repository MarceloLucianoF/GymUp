// Funções puras das ferramentas da academia.

const num = (v) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? n : 0;
};
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

// ---- 1RM ----
export const epley1RM = (weight, reps) => {
    const w = num(weight), r = Math.floor(num(reps));
    if (w <= 0 || r <= 0) return 0;
    return r === 1 ? w : round1(w * (1 + r / 30));
};

export const brzycki1RM = (weight, reps) => {
    const w = num(weight), r = Math.floor(num(reps));
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    if (r >= 37) return 0; // fórmula diverge
    return round1(w * 36 / (37 - r));
};

export const PERCENT_STEPS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

export const percentTable = (oneRm) => {
    const rm = num(oneRm);
    if (rm <= 0) return [];
    return PERCENT_STEPS.map(pct => ({ pct, weight: round1(rm * pct / 100) }));
};

// ---- Anilhas ----
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

// Anilhas por lado (guloso). `remainder` = carga que não pode ser montada (por lado).
export const calcPlates = (target, bar = 20, plates = PLATES) => {
    const t = num(target), b = num(bar);
    if (t <= 0 || b < 0) return { perSide: [], remainder: 0, total: 0, valid: false, reason: 'invalid' };
    if (t < b) return { perSide: [], remainder: 0, total: b, valid: false, reason: 'below-bar' };
    let left = round2((t - b) / 2);
    const perSide = [];
    [...plates].filter(p => p > 0).sort((a, c) => c - a).forEach(p => {
        while (left + 1e-9 >= p) {
            perSide.push(p);
            left = round2(left - p);
        }
    });
    const remainder = round2(left);
    const total = round2(b + perSide.reduce((a, p) => a + p, 0) * 2);
    return { perSide, remainder, total, valid: true, reason: null };
};

// ---- Conversão ----
const KG_PER_LB = 0.45359237;
export const kgToLb = (kg) => round2(num(kg) / KG_PER_LB);
export const lbToKg = (lb) => round2(num(lb) * KG_PER_LB);

// ---- IMC / hidratação ----
export const calcBMI = (weightKg, heightCm) => {
    const w = num(weightKg), h = num(heightCm) / 100;
    if (w <= 0 || h <= 0) return 0;
    return round1(w / (h * h));
};

export const bmiCategory = (bmi) => {
    if (!bmi || bmi <= 0) return '';
    if (bmi < 18.5) return 'Abaixo do peso';
    if (bmi < 25) return 'Peso normal';
    if (bmi < 30) return 'Sobrepeso';
    if (bmi < 35) return 'Obesidade grau I';
    if (bmi < 40) return 'Obesidade grau II';
    return 'Obesidade grau III';
};

// ml/dia (35 ml por kg)
export const dailyWaterMl = (weightKg, mlPerKg = 35) => {
    const w = num(weightKg);
    return w <= 0 ? 0 : Math.round(w * mlPerKg);
};

export const formatClock = (seconds) => {
    const s = Math.max(0, Math.floor(num(seconds)));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
