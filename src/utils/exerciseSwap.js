// Trocar um exercício durante o treino: sugere equivalentes do mesmo grupo e subgrupo, dentro dos equipamentos que o aluno tem, e
// monta o exercício novo mantendo a prescrição (séries, repetições, descanso, plano de séries e superset).
import { catalogKey } from './exerciseCatalog';
import { equipmentOf, filterByEquipment } from './equipment';
import { exerciseKind } from './exerciseKind';
import { normalizeExercise, normalizeLibrary } from './workoutComposer';

export const EQUIPMENT_SHORT = { maquina: 'Máquina', polia: 'Polia', halter: 'Halter', barra: 'Barra', livre: 'Peso do corpo', cardio: 'Cardio' };

/** Equivalentes do exercício atual, do mais parecido ao menos. `owned` vazio = sem filtro de equipamento. */
export function equivalentsFor(current, rawLibrary, { owned = [], excludeNames = [], limit = 8 } = {}) {
  const cur = normalizeExercise(current);
  const kind = exerciseKind(current);
  const exclude = new Set([...excludeNames, current.name].map(catalogKey));
  const lib = normalizeLibrary(filterByEquipment(rawLibrary, owned));
  return lib
    .filter((e) => !exclude.has(catalogKey(e.name)) && e.primaryGroup === cur.primaryGroup && e.primarySub === cur.primarySub && exerciseKind(e.ref) === kind)
    .map((e) => {
      let score = 0;
      const why = [];
      if (equipmentOf(e.ref) === equipmentOf(current)) { score += 3; why.push('mesmo equipamento'); }
      if (e.movementPattern === cur.movementPattern) { score += 2; why.push('mesmo movimento'); }
      if (e.isCompound === cur.isCompound) score += 1;
      if (e.ref?.mine) { score += 1; why.push('seu exercício'); }
      if (e.difficulty === cur.difficulty) score += 1;
      return { ref: e.ref, name: e.name, equipment: EQUIPMENT_SHORT[equipmentOf(e.ref)] || '', why: why.join(', '), score };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit);
}

/** Exercício novo no lugar do atual: o que descreve o exercício vem do novo; a prescrição fica a do atual. */
export function buildSwapped(original, ref) {
  const kind = exerciseKind(ref);
  return {
    firestoreId: ref.firestoreId || ref.id || `swap-${Date.now()}`,
    name: ref.name,
    muscleGroup: ref.muscleGroup || original.muscleGroup || 'Geral',
    ...(ref.kind ? { kind: ref.kind } : (kind !== 'strength' ? { kind } : {})),
    machineImage: ref.machineImage || ref.demoUrl || null,
    videoUrl: ref.videoUrl || null,
    description: ref.description || '',
    execution: ref.execution || '',
    sets: original.sets,
    reps: original.reps,
    rest: original.rest,
    ...(original.setTypes ? { setTypes: original.setTypes } : {}),
    ...(original.setPlan ? { setPlan: original.setPlan } : {}),
    ...(original.superset ? { superset: original.superset } : {}),
    note: original.note || '',
    swappedFrom: original.name
  };
}
