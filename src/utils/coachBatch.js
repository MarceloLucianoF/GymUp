// Execução em lotes: o Firestore limita "in" a 30 valores e as regras limitam get() por requisição.
export const chunk = (list, size) => {
  const n = Math.max(1, Math.floor(size) || 1);
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
};

// Roda `worker(item)` em lotes sequenciais de `size` itens (paralelos dentro do lote).
// Nunca lança: devolve { ok: [item], failed: [{ item, error }] } para mostrar o resumo ao usuário.
export const runInChunks = async (items, size, worker) => {
  const ok = [];
  const failed = [];
  for (const group of chunk(items, size)) {
    const results = await Promise.allSettled(group.map((item) => worker(item)));
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') ok.push(group[i]);
      else failed.push({ item: group[i], error: res.reason });
    });
  }
  return { ok, failed };
};

// Prévia de uma atribuição em lote: quem muda, quem já tem a ficha e de qual ficha sai.
export const planBulkAssign = (students, trainingId, trainings = []) => {
  const nameOf = (id) => trainings.find((t) => t.id === id)?.name || 'Ficha removida';
  const change = [];
  const same = [];
  students.forEach((s) => {
    if (s.currentTrainingId === trainingId) same.push(s);
    else change.push({ student: s, from: s.currentTrainingId ? nameOf(s.currentTrainingId) : null });
  });
  return { change, same };
};
