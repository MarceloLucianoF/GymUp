# MCP do AcademyUp (`mcp/`)

Servidor MCP (stdio) para gerenciar fichas e alunos direto no Firestore, quando importar não resolve.
Registrado em `.mcp.json`; reinicie o Claude Code e aprove o servidor `academyup`.

## Credenciais
Usa `serviceAccountKey.json` na raiz (ignorado pelo git) ou `GOOGLE_APPLICATION_CREDENTIALS`.
Com `FIRESTORE_EMULATOR_HOST` define o emulador (sem credencial). **Ignora as regras do Firestore** (acesso admin): trate como operação de produção.

## Ferramentas
| Ferramenta | Tipo | Observação |
| --- | --- | --- |
| `list_trainings`, `get_training` | leitura | filtro por `coachId` |
| `list_exercises` | leitura | busca por nome/grupo |
| `list_students`, `get_student_history` | leitura | alunos de um treinador; últimos check-ins |
| `upsert_training` | escrita | cria/atualiza, valida formato, avisa exercícios fora da biblioteca |
| `duplicate_training` | escrita | copia com novo nome |
| `assign_training` | escrita | define `currentTrainingId` do aluno |
| `delete_training` | escrita | exige `apply:true` **e** `confirm:true` |

Toda escrita é **prévia por padrão** (`apply:false`). Só grava com `apply:true`, e registra em `mcp/audit.log` (ignorado pelo git).

## Testes
`cd mcp && npm test` (validação de fichas). Sem emulador, os testes de escrita não tocam o Firestore.
