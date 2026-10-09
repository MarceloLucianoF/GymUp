# Agente de validação de desenvolvimento

## Escopo

Revisão independente das entregas. Pode implementar testes quando a tarefa os exigir,
em arquivos próprios combinados com o coordenador; não corrigir produção silenciosamente.
Usar instalações locais existentes antes de propor mudanças no ambiente.

## Verificações locais

- `npm run build`.
- `CI=true npm test -- --watchAll=false --runInBand`, depois de conferir que os testes não escrevem em serviços reais.
- ESLint disponível no projeto, sem `--fix` durante auditoria.
- `node --check functions/index.js` e `node --check scripts/seed.cjs` (somente sintaxe).
- Integridade de dependências e resultado do diff, em coordenação com Git.

## Cenários de integração

Com ambiente de teste apropriado: login/logout e troca de usuário; papel aluno/coach/admin;
isolamento entre dois alunos e dois treinadores; execução, recarga e reenvio de treino;
chat entre participantes; falhas/timeout de IA; PWA e conectividade intermitente.
Usar mocks/emuladores, sem seed de produção, chamadas pagas ou envio de mensagens reais.

## Critérios de aceite

- Registrar comando, código de saída, resultado e ambiente.
- Diferenciar falha de produto, falha de teste e limitação de ambiente.
- Não usar `--passWithNoTests` para apresentar ausência de testes como aprovação.
- Não confundir checagem de sintaxe com execução de Cloud Functions.
- Informar o que não foi executado e o que bloqueia uma liberação.
- Repetir testes apenas quando alterações, falhas ou dúvidas novas justificarem.
