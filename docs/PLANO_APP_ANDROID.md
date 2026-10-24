# Plano: app Android do BohTreinar

Estado em 23/10/2026. Objetivo: o que o site não consegue fazer bem no celular (cronômetro de descanso ao vivo na notificação, aviso confiável com a tela bloqueada, Samsung Health e relógio), sem reescrever o app.

## O que o site já entrega (e continua valendo)
- Notificação do treino com botões (Concluir/Desfazer série, Pular descanso/+30 s), espelhada no relógio pareado.
- Avisos com o app fechado (Web Push): fim do descanso, curtidas e comentários.
- Exportar treino no formato do Health Connect (arquivo).

## O que só um app resolve
| Recurso | Por quê |
| --- | --- |
| Cronômetro do descanso correndo na notificação e na tela de bloqueio | Notificação nativa com contagem regressiva (`setUsesChronometer` + `setChronometerCountDown`) e serviço em primeiro plano; no site o texto é fixo ("até 22:53"). No Android 16, "Live Updates" (notificação de progresso promovida); no One UI 8 da Samsung isso pode aparecer na Now Bar (confirmar em aparelho). |
| Aviso do fim do descanso 100% confiável | Alarme exato no aparelho, sem depender do servidor nem do navegador manter a página viva. |
| Samsung Health / Health Connect | API só existe em app Android: gravar o treino como sessão de exercício e ler frequência cardíaca do relógio durante o treino. |
| Relógio com app próprio (Wear OS) | Tile e "atividade em andamento" com o descanso no pulso, vibração no fim. |
| Presença na Play Store | Instalação e atualização como qualquer app. |

## Abordagem recomendada: Capacitor (o mesmo app React dentro de um app Android)
- O build atual (`npm run build`) vira o conteúdo do app; o código React continua o mesmo para site e app. Partes nativas entram como plugins (Kotlin) chamados do JavaScript.
- **Por que não TWA (Bubblewrap):** a TWA é só o Chrome em tela cheia, com ponte nativa muito limitada; serviria para a loja, mas não para cronômetro nativo nem Health Connect.
- **Por que não reescrever (Kotlin/Flutter):** dobraria o trabalho e a manutenção.
- **Consequências no app (não no site):**
  - Login com Google precisa de plugin nativo (o popup do navegador não funciona dentro do app); e-mail e senha funcionam como hoje.
  - Avisos do servidor passam a usar FCM (Firebase Cloud Messaging) nativo no app; o Web Push continua para o site. O Worker ganha o envio por FCM (precisa de uma chave de serviço do Firebase como segredo do Worker).
  - Service worker não roda dentro do app: o modo offline do app vem dos arquivos embutidos (já ficam no aparelho).
- **Estrutura no repositório:** `capacitor.config.json` na raiz e a pasta `android/` (projeto Gradle). Plugins próprios em `android/app/src/main/java/.../plugins/`.

## Fases
| Fase | Entrega | Quem | Esforço estimado |
| --- | --- | --- | --- |
| 0. Decisões e contas | Conta de desenvolvedor Google Play, nome do pacote, política de privacidade atualizada (LGPD, dados de saúde), testadores | Dono (eu preparo os textos) | 1 a 2 dias de espera da Google |
| 1. App base | App Capacitor carregando o BohTreinar, ícone e splash, login (e-mail e Google), links abrindo no app, avisos via FCM; APK para instalar no seu celular | Eu; você testa no aparelho | 2 a 3 dias |
| 2. Treino nativo | Notificação com cronômetro do descanso correndo, botões, vibração no fim com tela bloqueada (serviço em primeiro plano + alarme exato); Live Updates no Android 16 se o aparelho tiver | Eu; você testa | 3 a 4 dias |
| 3. Health Connect / Samsung Health | Gravar cada treino concluído como sessão de musculação; ler frequência cardíaca do relógio no período do treino e mostrar média/máxima no resumo. Tela de consentimento; nada de saúde vai para o Firestore sem você pedir | Eu; você testa com o Galaxy Watch | 3 a 5 dias |
| 4. Loja | Teste fechado na Play Store, formulário de segurança de dados, declaração de dados de saúde, revisão da Google | Você publica; eu preparo tudo | 2 a 3 semanas (ver regra dos 12 testadores) |
| 5. Relógio (opcional) | App Wear OS com tile e descanso no pulso | Eu | 5 a 8 dias |

## Custos e regras da Google Play
- **Conta de desenvolvedor:** taxa única de US$ 25.
- **Conta pessoal nova:** a Google exige um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de liberar a publicação em produção. Conta de **organização** (exige CNPJ e número D-U-N-S) não tem essa exigência.
- **Dados de saúde (Health Connect):** declaração específica no Play Console, política de privacidade pública explicando uso, e revisão da Google; pode pedir ajustes.
- **Serviço em primeiro plano** (cronômetro): declarar o tipo (`health` ou `specialUse`) e justificar na loja.
- **FCM e Health Connect:** sem custo.

## LGPD (bloqueia a fase 3 e a loja)
- Frequência cardíaca é dado de saúde (sensível): consentimento específico, finalidade clara, opção de desligar e apagar.
- Política de privacidade e termos atualizados (também listam o Web Push e o feed).
- Exclusão de conta precisa cobrir o que o app guardar no aparelho e no servidor.

## O que eu preciso de você
1. **Conta Play:** pessoal (mais rápida de abrir, exige os 12 testadores por 14 dias) ou de organização (exige CNPJ/D-U-N-S, sem essa exigência)?
2. **Nome do pacote:** sugestão `dev.marcelolabs.bohtreinar` (não dá para mudar depois de publicado).
3. **Testadores:** 12 pessoas com Android (amigos, alunos) para o teste fechado, se a conta for pessoal.
4. **Aparelhos:** seu celular Samsung e o Galaxy Watch para testar (instalo por APK ou pelo teste interno da Play).
5. **Ordem:** recomendo 1 → 2 → 3 → 4 e deixar o relógio (5) para depois, porque a notificação já aparece nele.

## Riscos
- Live Updates / Now Bar dependem da versão do Android e do One UI; confirmamos no seu aparelho na fase 2.
- A revisão da Google para dados de saúde pode demorar ou pedir mudanças.
- Manter dois "envelopes" (site e app) exige testar os dois a cada mudança grande; o código React é o mesmo.
- Ambiente: o Android SDK e o Java ainda não estão instalados nesta máquina (instalo os de linha de comando, sem Android Studio).
