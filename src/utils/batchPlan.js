// Prévia da aplicação de uma versão em lote. Função pura: decide, para cada aluno, o que vai acontecer ANTES de gravar qualquer coisa.
// Ações: 'assign' (aluno sem ficha), 'replace' (troca a ficha ou versão atual) e 'skip' (nada a fazer, com o motivo).

export const BATCH_MODES = [
  { id: 'new', label: 'Só alunos sem ficha' },
  { id: 'outdated', label: 'Quem usa uma versão anterior desta ficha' },
  { id: 'all', label: 'Todos os alunos' },
  { id: 'selected', label: 'Alunos que eu escolher' }
];

/**
 * students: [{ userId, displayName, teacherId }]  assigned: [{ studentId, seriesId, version, versionId }]
 * target: { seriesId, version, versionId }  seriesNames: { seriesId: nome } (para dizer de qual ficha o aluno está saindo)
 */
export function planBatch({ students, assigned, target, mode, selectedIds = [], seriesNames = {} }) {
  const byStudent = new Map((assigned || []).map((a) => [a.studentId, a]));
  const chosen = new Set(selectedIds);
  return (students || []).map((s) => {
    const cur = byStudent.get(s.userId) || null;
    const row = {
      studentId: s.userId, name: s.displayName, teacherId: s.teacherId || '',
      current: cur ? { versionId: cur.versionId, seriesId: cur.seriesId, version: cur.version, label: `${seriesNames[cur.seriesId] || 'Outra ficha'} v${cur.version}` } : null,
      noTeacher: !s.teacherId, otherSeries: !!cur && cur.seriesId !== target.seriesId,
      included: false, action: 'skip', note: ''
    };
    const inMode = mode === 'all' || (mode === 'new' && !cur) || (mode === 'outdated' && !!cur && cur.seriesId === target.seriesId && cur.version < target.version)
      || (mode === 'selected' && chosen.has(s.userId));
    if (!inMode) { row.note = 'Fora da seleção'; return row; }
    if (cur && cur.versionId === target.versionId) { row.note = 'Já usa esta versão'; return row; }
    row.included = true;
    row.action = cur ? 'replace' : 'assign';
    row.note = !cur ? 'Recebe a ficha' : row.otherSeries ? `Troca ${row.current.label}` : `Atualiza de v${cur.version}`;
    return row;
  });
}

export function summarizeBatch(rows) {
  const todo = rows.filter((r) => r.included);
  return {
    total: todo.length,
    assign: todo.filter((r) => r.action === 'assign').length,
    replace: todo.filter((r) => r.action === 'replace').length,
    otherSeries: todo.filter((r) => r.otherSeries).length,
    noTeacher: todo.filter((r) => r.noTeacher).length,
    skipped: rows.filter((r) => !r.included && r.note === 'Já usa esta versão').length
  };
}
