# Trabalho dos agentes — AcademyUp

## Contexto

Aplicação React em `src/`, com Firebase Auth/Firestore e proxy HTTP em `functions/`.
Leia `package.json`, `firebase.json` e os arquivos da área antes de implementar.
O diagnóstico inicial e suas limitações estão em `docs/DIAGNOSTICO.md`.
As instruções existentes em `.gemini/` continuam preservadas.

## Frentes separadas

| Frente | Instruções | Responsabilidade |
| --- | --- | --- |
| Frontend | [frontend](docs/agents/frontend.md) | Páginas, componentes, navegação, estilos e experiência de uso |
| Backend | [backend](docs/agents/backend.md) | Firebase, autorização, dados, serviços e Cloud Functions |
| Documentação | [documentação](docs/agents/documentacao.md) | Guias, contratos documentados e estado das funcionalidades |
| Git | [Git](docs/agents/git.md) | Diff, dependências, branches, commits e integração contínua |
| Validação | [validação](docs/agents/validacao.md) | Evidências independentes de build, testes e comportamento |
| Tokens | [tokens](docs/agents/tokens.md) | Economia de contexto: RTK e subagentes compactos em `.claude/agents/` |

## Coordenação

- O coordenador define escopo, contrato, responsável pelos arquivos e critério de aceite antes de delegar.
- Distribua frentes independentes em paralelo, respeitando as vagas disponíveis; execute as demais em etapas.
- Cada arquivo tem um único agente responsável pela escrita em cada etapa. Mudanças compartilhadas são serializadas.
- Frontend e backend combinam campos, tipos, permissões, timestamps e respostas antes de mudar contratos.
- O coordenador revisa autorização, isolamento de dados, concorrência e outras alterações críticas.
- Documentação registra o resultado integrado; validação diferencia implementação existente de comportamento comprovado.

## Preservação e segurança

- Inspecione `git status` antes de editar e preserve alterações locais do usuário.
- Não leia nem reproduza valores de `.env*` ou chaves de conta de serviço em relatórios. Se um segredo aparecer no código, redija as evidências sem o valor.
- Validações locais não devem chamar APIs pagas nem alterar dados remotos. Use mocks ou emuladores para testes de escrita.
- Não execute seed, deploy, push, exclusões ou reescrita de histórico como parte de uma simples leitura/validação. Siga o escopo autorizado pelo usuário.

## Entrega de cada frente

Informe arquivos lidos/alterados, achados com evidências, contratos afetados, comandos executados e resultados.
Classifique cada verificação como **aprovada**, **reprovada** ou **não executada**, com a limitação correspondente.
Não considere compilação suficiente para comprovar autorização, funcionamento offline ou integração externa.
