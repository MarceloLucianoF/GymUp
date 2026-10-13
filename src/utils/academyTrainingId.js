// A execução usa o mesmo caminho /execution/:trainingId dos treinos comuns. A ficha da academia vira
// "ac~<academyId>~<versionId>": o versionId é o da atribuição do aluno (nunca o rascunho nem uma versão mais nova).
const SEP = '~';

export const academyTrainingId = (academyId, versionId) => `ac${SEP}${academyId}${SEP}${versionId}`;

export function parseAcademyTrainingId(value) {
  const parts = String(value || '').split(SEP);
  if (parts.length !== 3 || parts[0] !== 'ac' || !/^[a-z0-9]{16,28}$/.test(parts[1]) || !/^[A-Za-z0-9]+_\d+$/.test(parts[2])) return null;
  return { academyId: parts[1], versionId: parts[2] };
}
