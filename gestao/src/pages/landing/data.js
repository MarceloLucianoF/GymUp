// Conteúdo da landing. Tudo aqui descreve o que o produto FAZ hoje; o que não existe ainda diz "em breve".
// A matriz de acesso espelha shared/academy-contracts (papéis) e a política do Worker.

export const ROLE_ORDER = ['owner', 'admin', 'coach', 'reception', 'student'];
export const ROLE_NAMES = { owner: 'Proprietário', admin: 'Administrador', coach: 'Professor', reception: 'Recepção', student: 'Aluno' };

// state: 'yes' | 'part' | 'no'
export const AREAS = ['Dados da academia', 'Convites', 'Membros e papéis', 'Vínculo com professor', 'Auditoria', 'Peso, medidas e cargas'];

export const ACCESS = {
  owner: [['yes', 'edita tudo'], ['yes', 'todos os papéis'], ['yes', 'todos'], ['yes', 'propõe e aprova'], ['yes', 'lê tudo'], ['no', 'nunca chega']],
  admin: [['part', 'descrição e contato'], ['part', 'sem criar admin'], ['part', 'sem mexer no dono'], ['yes', 'propõe e aprova'], ['yes', 'lê tudo'], ['no', 'nunca chega']],
  coach: [['no', 'sem acesso'], ['no', 'sem acesso'], ['part', 'só seus alunos'], ['part', 'propõe, não aprova'], ['no', 'sem acesso'], ['no', 'nunca chega']],
  reception: [['no', 'sem acesso'], ['part', 'só de aluno'], ['part', 'só alunos'], ['no', 'sem acesso'], ['no', 'sem acesso'], ['no', 'nunca chega']],
  student: [['no', 'sem acesso'], ['no', 'sem acesso'], ['no', 'sem acesso'], ['part', 'aceita o professor'], ['no', 'sem acesso'], ['no', 'só no app']]
};

export const STAGES = [
  { name: 'Convite', clause: 'Convide pelo papel certo' },
  { name: 'Aceite', clause: 'A pessoa confere e entra' },
  { name: 'Professor', clause: 'O aluno aceita o professor' },
  { name: 'Ficha', clause: 'A ficha chega ao aluno' }
];

export const FACTS = [
  ['5', 'papéis, cada um com o seu alcance'],
  ['1', 'professor ativo por aluno'],
  ['30', 'dias no máximo de validade por convite'],
  ['0', 'dados de peso, medidas ou cargas'],
  ['21', 'tipos de ação registrados na auditoria'],
  ['20', 'exercícios por ficha']
];

export const FAQ = [
  ['O professor vê o aluno antes de ele aceitar?', 'Não. O vínculo começa como proposta, a equipe aprova e só o aceite do aluno libera o acesso. Se o professor perder o papel ou for suspenso, o acesso termina na hora.'],
  ['A Gestão mostra peso, medidas ou cargas?', 'Nunca. Esses dados ficam só no app do aluno. A Gestão guarda nome, papel, status, vínculos e o registro de mudanças administrativas.'],
  ['O que acontece quando alguém sai da academia?', 'O vínculo com o professor e o consentimento são encerrados na mesma operação. Quem saiu por conta própria pode voltar com um novo convite; quem foi removido pela equipe só volta pelo proprietário.'],
  ['Onde ficam os dados?', 'Os dados da academia ficam em um banco próprio da Cloudflare, separados dos dados pessoais do aluno. O local de armazenamento será definido com a revisão jurídica antes do uso comercial.'],
  ['Quanto custa?', 'Ainda não há preço: esta é uma versão de homologação. Os planos serão definidos antes da oferta pública.']
];
