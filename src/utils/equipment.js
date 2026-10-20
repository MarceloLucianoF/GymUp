// Equipamento de cada exercício e o filtro "o que tem na minha academia".
// O equipamento é um campo explícito do exercício (`equipment`, um valor ou uma lista de alternativas); só exercícios antigos,
// sem o campo, são deduzidos pelo nome. Perfil sem escolha (lista vazia) significa "tenho tudo": nada é filtrado.
const plain = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const EQUIPMENT = ['maquina', 'polia', 'halter', 'barra', 'livre', 'cardio'];
export const EQUIPMENT_LABELS = {
  maquina: 'Máquinas (articuladas, leg press, cadeiras)',
  polia: 'Polias e cabos',
  halter: 'Halteres',
  barra: 'Barras e anilhas',
  livre: 'Peso do corpo, banco e colchonete',
  cardio: 'Esteira, bicicleta e escada'
};
const ALIASES = { maquina: 'maquina', maquinas: 'maquina', aparelho: 'maquina', polia: 'polia', cabo: 'polia', halter: 'halter', halteres: 'halter', barra: 'barra', barras: 'barra', livre: 'livre', 'peso do corpo': 'livre', 'peso corporal': 'livre', corpo: 'livre', nenhum: 'livre', cardio: 'cardio', esteira: 'cardio', bike: 'cardio' };

const fromName = (n) => {
  if (/esteira|\bbike\b|bicicleta ergom|escada|eliptico|hiit|corrida/.test(n)) return 'cardio';
  if (/halter/.test(n)) return 'halter';
  if (/barra reta|barra w|barra fixa|barra\b/.test(n) && !/maquina/.test(n)) return 'barra';
  if (/polia|cabo|crossover|corda|pulldown/.test(n)) return 'polia';
  if (/maquina|cadeira|mesa|hack|leg press|articulada|convergente|peck|voador/.test(n)) return 'maquina';
  return 'livre';
};

/** Lista de equipamentos que servem ao exercício (qualquer um deles basta). */
export function equipmentOptions(ex) {
  const raw = Array.isArray(ex?.equipment) ? ex.equipment : (ex?.equipment ? [ex.equipment] : []);
  const mapped = raw.map((e) => ALIASES[plain(e)]).filter(Boolean);
  if (mapped.length) return [...new Set(mapped)];
  return [fromName(plain(ex?.name))];
}

/** Equipamento principal (o primeiro): usado nas restrições do pedido por texto ("somente máquina"). */
export const equipmentOf = (ex) => equipmentOptions(ex)[0];

/** `owned` vazio ou ausente = tudo disponível. Exercício serve se algum dos seus equipamentos estiver na lista. */
export const isAvailable = (ex, owned) => {
  const have = (Array.isArray(owned) ? owned : []).filter((e) => EQUIPMENT.includes(e));
  if (!have.length) return true;
  return equipmentOptions(ex).some((e) => have.includes(e));
};

export const filterByEquipment = (list, owned) => (list || []).filter((ex) => isAvailable(ex, owned));
export const sanitizeEquipment = (owned) => [...new Set((Array.isArray(owned) ? owned : []).filter((e) => EQUIPMENT.includes(e)))];
export const describeEquipment = (owned) => {
  const have = sanitizeEquipment(owned);
  return have.length ? have.map((e) => EQUIPMENT_LABELS[e].split(' (')[0].split(',')[0].toLowerCase()).join(', ') : 'todos os equipamentos';
};
