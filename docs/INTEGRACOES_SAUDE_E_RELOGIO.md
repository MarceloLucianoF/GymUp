# Saúde (Samsung Health / Health Connect) e relógio (Wear OS)

Estado em 21/10/2026. Objetivo do dono: ler dados do relógio e gravar o treino no Samsung Health.

## O que já existe (sem app nativo)
- **Controles no relógio:** a notificação do treino em andamento (botões Concluir/Desfazer série, Pular descanso/+30 s) aparece espelhada no relógio Galaxy/Wear OS pareado, como qualquer notificação com botões. O antigo controle de mídia (MediaSession, cadeado) foi retirado em 22/10/2026: não aparecia com o Chrome e brigava com a música.
- **Exportar treino para Saúde:** na tela de histórico do treino, "Exportar para Saúde (JSON)" baixa o treino no formato de uma sessão de exercício do Health Connect (`toHealthConnectSession` em `src/utils/healthExport.js`), para quem for importar por um app/atalho. Não envia nada para a nuvem.

## O que não dá para fazer só com a web
- **Health Connect (API do Android) não existe no navegador.** Ler frequência cardíaca, passos ou sono, ou gravar `ExerciseSessionRecord`, exige app Android (Kotlin) com permissões declaradas e revisão da Google Play para dados de saúde. O Samsung Health sincroniza com o Health Connect, então um app Android é o caminho único.
- **Wear OS com app próprio** (frequência cardíaca ao vivo no treino, vibração no fim do descanso) exige um módulo Wear em Kotlin/Compose, publicado junto com o app Android.

## Caminho recomendado
1. Empacotar o PWA como app Android (TWA/Bubblewrap) para ter presença na Play Store.
2. Módulo Kotlin mínimo: ponte JS ↔ Health Connect para gravar o check-in como `ExerciseSessionRecord` + `ActiveCaloriesBurnedRecord` e ler `HeartRateRecord` do período do treino.
3. Só depois, app Wear OS (FC ao vivo, descanso com vibração).
4. Antes de ler dados de saúde: base legal e consentimento específico (LGPD, dado sensível), política de privacidade atualizada e exclusão na "excluir conta". Os dados lidos ficam no aparelho do aluno; só vão ao Firestore se ele pedir.

## Decisões
- Nada de saúde entra no feed social nem no ranking (ver `docs/PLANO_SOCIAL.md`).
- Sem teste em aparelho físico até existir o app Android.
