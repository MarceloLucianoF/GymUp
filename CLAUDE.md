# CLAUDE.md — BohTreinar (workout-app)

React (CRA) em `src/`; app e proxy de IA na Cloudflare (`worker/`, `wrangler.jsonc`); Firebase só para Auth e Firestore.
Coordenação por frentes: ver [AGENTS.md](AGENTS.md) e `docs/agents/`. Diagnóstico: `docs/DIAGNOSTICO.md`.

## Comandos

| Ação | Comando |
| --- | --- |
| Instalar | `make install` (usa `--legacy-peer-deps`) |
| Dev | `npm start` |
| Build | `npm run build` |
| Testes | `CI=true npm test -- --watchAll=false` |
| Testes do Worker | `(cd worker && node --test test/*.test.js)` |
| Regras Firestore (emulador, requer Java) | `make test-rules` (antes: `npm ci` em `rules-test/`) |
| Regras do Firestore (emulador, requer Java) | `make test-rules` |

Prefixe comandos verbosos com `rtk` (git, npm, lint, testes). Falhou? `rtk recall <id>` em vez de reexecutar.

## Economia de tokens

- Delegue buscas amplas a `explorador-economico`, verificações a `executor-compacto` e revisão de diff a `revisor-diff` (`.claude/agents/`).
- Leia trechos, não arquivos inteiros. Nunca leia `package-lock.json`, `build/`, `.firebase/`, `node_modules/`.

## MCP do projeto

`.mcp.json` registra o servidor `academyup` (`mcp/`, ver `docs/MCP.md`) para gerenciar fichas, alunos e atribuições no Firestore. Use-o para ajustes que o import não resolve. Ele ignora as regras do Firestore: sempre rode a prévia (`apply:false`), mostre-a ao usuário e só então use `apply:true`; apagar exige `confirm:true`.

## Segurança (inegociável)

- Nunca ler, imprimir ou commitar `.env*`, `serviceAccountKey.json` ou chaves de API. Segredo de IA fica só no Worker (`wrangler secret`), nunca no bundle React.
- Antes de commitar, buscar segredos no diff: `git diff --cached | grep -nE "nvapi-|private_key|BEGIN PRIVATE|AIza"`. Se achar, parar e avisar sem reproduzir o valor.
- Papéis (`role`) vêm do Firestore e não podem ser autoalterados pelo cliente; mudanças em `firestore.rules` exigem revisão de autorização e isolamento de dados (aluno só vê o próprio; treinador só seus alunos).
- Validação local não chama APIs pagas nem altera dados remotos; use mocks/emuladores. Nunca rodar `make seed` sem pedido explícito.

## Validações antes de commit

1. `git status` — preservar alterações do usuário que não fazem parte da tarefa.
2. `npm run build` — aprovado (avisos existentes são aceitos; erros não).
3. Testes (web, `worker/` e regras) — aprovados, ou declarar "não executada" com a limitação.
4. Varredura de segredos no diff (acima).
5. Mudou regras ou o Worker? Revisar com `revisor-diff`.

Reportar cada verificação como **aprovada**, **reprovada** ou **não executada**. Compilar não prova autorização, offline ou integração externa.

## Git: commit, push e merge

- Nunca commitar direto em `main` por iniciativa própria: criar branch `tipo/descricao-curta` (`feat/`, `fix/`, `docs/`, `chore/`).
- Mensagens no estilo do histórico (`feat: ...`, `fix: ...`, `refactor: ...`), um assunto por commit; adicionar arquivos pelo nome (evitar `git add -A`; não incluir `.firebase/` nem `build/`).
- Commit, push e merge só quando o usuário pedir ("commita", "sobe", "merge"). Esse pedido autoriza o commit + `git push -u origin <branch>`; o merge em `main` (preferir PR via `gh pr create` + `gh pr merge`) só se o pedido incluir merge.
- Nada de `--force`, `reset --hard` ou reescrita de histórico sem pedido explícito.
- Push em `main` dispara o workflow `.github/workflows/deploy.yml` (build + testes): confirmar que os checks passam (`rtk gh run list`).

## Deploy

Só quando o usuário pedir ("sobe", "deploy"). O app roda na Cloudflare (https://bohtreinar.marcelo-labs.workers.dev); o Firebase fica com Auth e Firestore.

1. Validações acima aprovadas e árvore commitada/pushada.
2. App + proxy de IA: `make deploy` (build com `REACT_APP_NVIDIA_PROXY=true REACT_APP_AI_PRIMARY=nvidia` + `wrangler deploy`). Segredos do Worker via `wrangler secret put`, nunca em arquivo versionado.
3. Regras e índices do Firestore: `make deploy-rules` (mostrar o diff das regras antes). Regras primeiro quando o front depende delas.
4. Firebase Hosting só redireciona para o endereço novo (`hosting-redirect/`): não publicar o app lá. Não excluir o site (o `authDomain` serve `/__/auth/handler`).
5. Pós-deploy: informar a URL e o resultado de cada alvo (aprovada/reprovada/não executada) e conferir login e papéis; o deploy sozinho não comprova autorização.

Deploy é irreversível para os usuários: sem pedido explícito, apenas preparar e descrever.

## Documentação

Ao fim de cada entrega, atualizar `docs/DIAGNOSTICO.md` (achados resolvidos/pendentes) e o README quando o comportamento mudar.
