// Predefinições de séries/reps/descanso por objetivo e utilitários do editor de fichas.
export const WORKOUT_PRESETS = [
  { id: 'hipertrofia', label: 'Hipertrofia', sets: '4', reps: '8-12', rest: 75 },
  { id: 'forca', label: 'Força', sets: '5', reps: '3-5', rest: 150 },
  { id: 'resistencia', label: 'Resistência', sets: '3', reps: '15-20', rest: 40 }
];

export const getPreset = (id) => WORKOUT_PRESETS.find((p) => p.id === id) || null;

export const applyPreset = (exercise, preset) => (preset
  ? { ...exercise, sets: preset.sets, reps: preset.reps, rest: preset.rest }
  : exercise);

// Move o item `from` para a posição `to` sem mutar a lista (índices fora do intervalo são ignorados).
export const reorder = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const formatMinutes = (minutes) => {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${String(rest).padStart(2, '0')} min` : `${h} h`;
};
