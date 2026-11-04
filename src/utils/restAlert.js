// Fim do descanso: um aviso só, pelo melhor canal disponível (antes, com a aba escondida, podiam chegar três de uma vez:
// o push do servidor, a notificação fixa do treino vibrando e o aviso local "Descanso concluído").
// 1) aba escondida e push do servidor agendado → só o push (a notificação do treino só atualiza o texto, em silêncio);
// 2) notificação do treino ligada → ela toca e vibra;
// 3) nenhuma das duas → o aviso local (se a pessoa deixou "Avisar quando o descanso acabar" ligado e a aba está escondida).
export function restAlertPlan({ hidden, serverPush, workoutNotif }) {
  const pushCovers = hidden && serverPush;
  return {
    workoutAlert: workoutNotif && !pushCovers,
    local: hidden && !serverPush && !workoutNotif
  };
}
