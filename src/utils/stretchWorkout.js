// Pedido de alongamento, mobilidade ou aquecimento: a ficha vem dos exercícios do grupo "mobilidade" da biblioteca, em séries de segundos.
import { catalogGroup } from './exerciseCatalog';

const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const isStretchRequest = (text) => /alongament|mobilidade|aquecimento|soltar o corpo/.test(plain(text));

// Ordem que faz sentido numa sessão: costas e coluna, quadril e pernas, tronco, braços e ombros.
const ORDER = [/gato|crianca/, /flexor|posterior|quadriceps|panturrilha|quadril/, /peitoral|ombro|triceps|bracos/];
const rank = (name) => { const i = ORDER.findIndex((re) => re.test(plain(name))); return i < 0 ? ORDER.length : i; };

export function buildStretchWorkout(library = []) {
  const pool = library.filter((e) => catalogGroup(e) === 'mobilidade');
  if (pool.length < 4) return null;
  const picked = [...pool].sort((a, b) => rank(a.name) - rank(b.name)).slice(0, 8);
  const exercises = picked.map((e, i) => ({
    firestoreId: e.firestoreId || e.id || `stretch-${i}`, name: e.name, muscleGroup: 'Alongamento e mobilidade', kind: 'timed',
    sets: String(e.sets > 0 ? e.sets : 2), reps: String(e.reps > 0 ? e.reps : 30), rest: e.rest ?? 15,
    machineImage: e.machineImage || e.demoUrl || null, videoUrl: e.videoUrl || null, description: e.description || 'Segure a posição pelo tempo indicado.'
  }));
  return {
    name: 'Alongamento e mobilidade', category: 'Mobilidade', description: 'Sequência de alongamentos e aquecimentos de corpo inteiro. Segure cada posição sem dor, respirando fundo.',
    estimatedTime: `${Math.max(10, exercises.length * 2)} min`, exercises, createdAt: new Date().toISOString(), isAIGenerated: true,
    composition: { focus: 'Mobilidade', requestedFocus: 'Mobilidade', source: 'regras', division: null, reason: null }
  };
}
