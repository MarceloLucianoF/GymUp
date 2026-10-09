# Plano de reforma — AcademyUp

| Fase | Entrega | Responsável | Critério de aceite |
| --- | --- | --- | --- |
| 1. Segurança | Chave fora do bundle, regras Firestore com isolamento (leitura aluno/treinador vinculado; escrita só do dono), role não autoelevável, painel do treinador por `userId` | Backend/coordenador | Testes das functions; revisão `revisor-diff`; regras publicadas |
| 2. IA | Gemini via Firebase AI Logic + function calling + saída estruturada + fallback local; proxy NVIDIA preservado para Blaze | Backend/IA | Teste real de function calling e JSON schema; ver `docs/IA.md` |
| 3. Frontend | Tema `brand`, lint zerado, `Modal`/`ConfirmDialog`, estados loading/erro/vazio, lazy loading, divisão de `TrainingExecutionPage`/`Home` | Frontend | `CI=true npm run build` sem erros |
| 4. Infra | `firebase.json` compatível com Spark, cabeçalhos de segurança, índices | Backend | Deploy de hosting + firestore |
| 5. Entrega | Commit em branch, deploy, validação em produção | Git/Validação | Site responde 200; regras publicadas |

Pendências assumidas: leitura de `trainings` continua catálogo compartilhado (mudar exige reescrever consultas); rotação da chave NVIDIA e upgrade para Blaze são ações do titular da conta; testes automatizados do frontend ainda não existem.
