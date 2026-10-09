// Validação e normalização de fichas (espelha o formato gravado pelo app e as regras do Firestore).
import { z } from 'zod';

export const exerciseSchema = z.object({
  firestoreId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  muscleGroup: z.string().max(60).optional().default(''),
  sets: z.union([z.string(), z.number()]).transform((v) => String(v)),
  reps: z.union([z.string(), z.number()]).transform((v) => String(v)),
  rest: z.number().int().min(0).max(600).optional(),
  machineImage: z.string().url().nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  description: z.string().max(1000).optional()
});

export const trainingSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  category: z.string().max(40).optional(),
  difficulty: z.string().max(40).optional(),
  estimatedTime: z.string().max(20).optional(),
  coachId: z.string().min(1).optional(),
  exercises: z.array(exerciseSchema).min(1).max(30)
});

const DEFINED = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export function normalizeTraining(input) {
  const parsed = trainingSchema.parse(input);
  return DEFINED({
    ...parsed,
    exercises: parsed.exercises.map((ex) => DEFINED({ ...ex, machineImage: ex.machineImage ?? null }))
  });
}

// Avisos (não bloqueiam): exercícios que não existem na biblioteca, por nome.
export function findUnknownExercises(training, libraryNames) {
  const known = new Set(libraryNames.map((n) => String(n).trim().toLowerCase()));
  return training.exercises.filter((ex) => !known.has(ex.name.trim().toLowerCase())).map((ex) => ex.name);
}

export function summarizeTraining(doc) {
  return {
    id: doc.id,
    name: doc.name,
    coachId: doc.coachId ?? null,
    category: doc.category ?? null,
    exercises: (doc.exercises || []).length
  };
}
