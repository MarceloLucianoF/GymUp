// Biblioteca de exercícios do app do aluno (mesmo arquivo), usada só para sugerir nomes e preencher grupo, séries, repetições e descanso.
// Exercício fora da lista continua valendo (nome livre). Imagens e vídeos ficam no app do aluno.
import { exercises } from '../../../src/data/exercises.js';

const plain = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const LIBRARY = exercises.map((e) => ({ name: e.name, muscleGroup: e.muscleGroup || '', sets: String(e.sets ?? 3), reps: String(e.reps ?? 10), rest: Number(e.rest) || 60 }));
const byName = new Map(LIBRARY.map((e) => [plain(e.name), e]));

/** Exercício da biblioteca com este nome (sem acento ou caixa), ou null. */
export const fromLibrary = (name) => byName.get(plain(name)) || null;
