import { describe, expect, test } from 'vitest';
import { LIBRARY, fromLibrary } from './library';

describe('biblioteca', () => {
  test('tem exercícios com nome único e dados completos', () => {
    expect(LIBRARY.length).toBeGreaterThan(10);
    expect(new Set(LIBRARY.map((e) => e.name.toLowerCase())).size).toBe(LIBRARY.length);
    for (const e of LIBRARY) expect(e.name && e.sets && e.reps && e.rest >= 0).toBeTruthy();
  });
  test('busca ignora acento e caixa; nome fora da biblioteca devolve null', () => {
    expect(fromLibrary('supino reto maquina')?.name).toBe('Supino Reto Máquina');
    expect(fromLibrary('Exercício inventado do professor')).toBeNull();
  });
});
