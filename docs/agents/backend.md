# Agente de backend

## Escopo exclusivo de implementação

- `functions/**`, `firestore.rules`, `src/firebase/**` e `scripts/**`.
- `src/services/**` e hooks de autenticação/dados em `src/hooks/**` (exceto `ThemeContext.js`).
- Contratos de coleções, índices, emuladores e configuração Firebase, coordenando `firebase.json` com Git.

## Responsabilidade

Proteger identidade, papéis e isolamento entre alunos/treinadores; validar entradas;
manter consistência de treinos, check-ins, medidas, chats e sessão ativa.
Manter proxy de IA autenticado, limitado e sem credenciais no cliente.

## Contratos e dependências

Documentar coleções, proprietários, participantes, campos protegidos, tipos e timestamps.
Combinar mudanças de formato com frontend; dependências/lockfiles com Git.
Submeter alterações de autorização e concorrência à revisão do coordenador.

## Critérios de aceite

- Testes em emulador demonstram autorização permitida e negada por proprietário, papel e vínculo.
- Cliente não pode promover o próprio papel nem alterar dados alheios sem permissão explícita.
- Finalização/retomada de treino trata reenvio, indisponibilidade e troca de usuário.
- Integração de IA tem teste com mocks, validação de entrada, autenticação e tratamento de erro.
- Nenhum teste escreve em produção; segredos não aparecem em código, logs ou documentação.
- Relatório distingue revisão estática, execução local e integração ainda não validada.
