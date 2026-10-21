// Conteúdo da landing, em linguagem de dono de academia. Só descreve o que o produto FAZ hoje; o que não existe ainda diz "vem aí".

export const CAPS = [
  ['Mensalidades', 'Planos, cobrança do mês, baixa manual e quem está atrasado.'],
  ['Alunos', 'Quem está matriculado, em qual plano e com qual professor.'],
  ['Professores', 'Cada um vê só os alunos que aceitaram o vínculo.'],
  ['Equipe', 'A recepção cobra, o administrador organiza, o dono vê tudo.'],
  ['Resumo do mês', 'Quanto entrou, quanto falta e uma planilha para o contador.'],
  ['Histórico', 'Toda mudança fica anotada: quem fez e quando.']
];

export const STEPS = [
  ['Primeiro, cadastre os planos.', 'Nome e valor mensal. Gold, Mensal, Trimestral: do jeito que a sua academia vende.'],
  ['Depois, matricule os alunos.', 'Cada aluno entra num plano, com o dia de vencimento e a data de início.'],
  ['Todo mês, gere as cobranças.', 'Você vê a prévia antes de confirmar. Nada é cobrado duas vezes no mesmo mês.'],
  ['E dê baixa quando pagarem.', 'Pix, dinheiro, cartão ou transferência. O resumo do mês se atualiza na hora.']
];

export const ROLES = [
  ['Recepção cobra.', 'Vê as cobranças e dá baixa no pagamento. Não mexe em planos nem em valores.'],
  ['Professor treina.', 'Vê só os alunos que aceitaram o vínculo. Não vê dinheiro nenhum.'],
  ['Dono decide.', 'Planos, valores, equipe e o resumo de tudo. Ninguém fica sem dono.']
];

export const SHOTS = [
  { img: '/landing/membros.jpg', w: 716, h: 860, alt: 'Lista de membros com papel, status e professor responsável', title: 'Membros', text: 'Filtre por papel, situação ou professor e mude o papel de alguém com confirmação.' },
  { img: '/landing/professor-celular.jpg', w: 780, h: 1688, alt: 'Tela do professor no celular com a lista dos seus alunos', title: 'Professor no celular', text: 'Os alunos dele e as propostas de vínculo, nada além disso.' },
  { img: '/landing/resumo.jpg', w: 716, h: 600, alt: 'Indicadores da academia: membros, convites, professores e alunos sem professor', title: 'Painel do dia', text: 'Membros ativos, convites pendentes e alunos sem professor.' },
  { img: '/landing/vinculos.jpg', w: 716, h: 494, alt: 'Vínculos aguardando aprovação e aceite do aluno', title: 'Vínculo com professor', text: 'O aluno aceita o professor antes de ele ver qualquer coisa.' }
];

export const SOON = ['Pix para o aluno pagar', 'Cobrança gerada sozinha todo mês', 'Aviso de atraso para o aluno'];

export const FAQ = [
  ['Quanto custa?', 'Ainda não há preço: a Gestão está em testes fechados. Os planos serão definidos antes da oferta pública.'],
  ['Ela cobra o aluno no cartão?', 'Não. O registro é manual: você recebe como já recebe (Pix, dinheiro, cartão na maquininha) e dá baixa. Nenhum dado de cartão passa pela Gestão.'],
  ['Meus alunos precisam usar o app BohTreinar?', 'Para treinar, sim: a ficha chega ao app do aluno. Para a cobrança, não: quem registra o pagamento é a sua equipe.'],
  ['O professor vê o aluno antes de ele aceitar?', 'Não. O vínculo começa como proposta e só o aceite do aluno libera o acesso. Se o professor perde o papel, o acesso termina na hora.'],
  ['A Gestão mostra peso, medidas ou cargas?', 'Nunca. Esses dados ficam só no app do aluno. Aqui ficam nome, plano, vínculos e o histórico de mudanças da academia.'],
  ['Onde ficam os dados?', 'Em um banco próprio da Cloudflare, separado dos dados pessoais do aluno. O local exato será definido com a revisão jurídica antes do uso comercial.']
];

// Demonstração do herói: valores de exemplo, não são dados reais de ninguém.
export const DEMO = [
  { id: 1, name: 'Ana Souza', plan: 'Gold', cents: 15000, due: '05', late: true },
  { id: 2, name: 'Bruno Lima', plan: 'Mensal', cents: 9990, due: '05', late: true },
  { id: 3, name: 'Carla Dias', plan: 'Gold', cents: 15000, due: '10', late: false },
  { id: 4, name: 'Diego Reis', plan: 'Trimestral', cents: 24000, due: '15', late: false },
  { id: 5, name: 'Elisa Prado', plan: 'Mensal', cents: 9990, due: '20', late: false }
];
