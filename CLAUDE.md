# CLAUDE.md — AcademyUp (workout-app)

React (CRA) em `src/`, Firebase Auth/Firestore/Hosting, Cloud Functions em `functions/` (proxy de IA).
Coordenação por frentes: ver [AGENTS.md](AGENTS.md) e `docs/agents/`. Diagnóstico: `docs/DIAGNOSTICO.md`.

## Comandos

| Ação | Comando |
| --- | --- |
| Instalar | `make install` (usa `--legacy-peer-deps`) |
| Dev | `npm start` |
| Build | `npm run build` |
| Testes | `CI=true npm test -- --watchAll=false` |
| Testes das functions | `(cd functions && node --test test/*.test.js)` |
| Sintaxe das functions | `node --check functions/index.js` |

Prefixe comandos verbosos com `rtk` (git, npm, lint, testes). Falhou? `rtk recall <id>` em vez de reexecutar.

## Economia de tokens

- Delegue buscas amplas a `explorador-economico`, verificações a `executor-compacto` e revisão de diff a `revisor-diff` (`.claude/agents/`).
- Leia trechos, não arquivos inteiros. Nunca leia `package-lock.json`, `build/`, `.firebase/`, `node_modules/`.

## Segurança (inegociável)

- Nunca ler, imprimir ou commitar `.env*`, `serviceAccountKey.json` ou chaves de API. Segredo de IA fica só no backend (`functions/`), nunca no bundle React.
- Antes de commitar, buscar segredos no diff: `git diff --cached | grep -nE "nvapi-|private_key|BEGIN PRIVATE|AIza"`. Se achar, parar e avisar sem reproduzir o valor.
- Papéis (`role`) vêm do Firestore e não podem ser autoalterados pelo cliente; mudanças em `firestore.rules` exigem revisão de autorização e isolamento de dados (aluno só vê o próprio; treinador só seus alunos).
- Validação local não chama APIs pagas nem altera dados remotos; use mocks/emuladores. Nunca rodar `make seed` sem pedido explícito.

## Validações antes de commit

1. `git status` — preservar alterações do usuário que não fazem parte da tarefa.
2. `npm run build` — aprovado (avisos existentes são aceitos; erros não).
3. Testes (web e `functions/`) — aprovados, ou declarar "não executada" com a limitação.
4. Varredura de segredos no diff (acima).
5. Mudou regras/functions? Revisar com `revisor-diff`.

Reportar cada verificação como **aprovada**, **reprovada** ou **não executada**. Compilar não prova autorização, offline ou integração externa.

## Git: commit, push e merge

- Nunca commitar direto em `main` por iniciativa própria: criar branch `tipo/descricao-curta` (`feat/`, `fix/`, `docs/`, `chore/`).
- Mensagens no estilo do histórico (`feat: ...`, `fix: ...`, `refactor: ...`), um assunto por commit; adicionar arquivos pelo nome (evitar `git add -A`; não incluir `.firebase/` nem `build/`).
- Commit, push e merge só quando o usuário pedir ("commita", "sobe", "merge"). Esse pedido autoriza o commit + `git push -u origin <branch>`; o merge em `main` (preferir PR via `gh pr create` + `gh pr merge`) só se o pedido incluir merge.
- Nada de `--force`, `reset --hard` ou reescrita de histórico sem pedido explícito.
- Push em `main` dispara o workflow `.github/workflows/deploy.yml` (build + testes): confirmar que os checks passam (`rtk gh run list`).

## Deploy no Firebase

Só quando o usuário pedir ("sobe pro firebase", "deploy"). Ordem:

1. Validações acima aprovadas e árvore commitada/pushada.
2. Mostrar ao usuário o que será publicado (hosting, rules, functions) e o projeto alvo: `firebase use`.
3. Publicar apenas o necessário:
   - Front: `make deploy-hosting`
   - Regras: `make deploy-rules` (e índices: `firebase deploy --only firestore:indexes`)
   - Functions: `make deploy-functions` (segredos via `firebase functions:secrets:set`, nunca em arquivo versionado)
   - Tudo: `make deploy-all`
4. Pós-deploy: informar URL do hosting e o resultado de cada alvo (aprovada/reprovada/não executada). Smoke test manual de login e papéis; o deploy sozinho não comprova autorização.

Regras e functions primeiro quando o front depende delas; hosting por último. Deploy é irreversível para os usuários: sem pedido explícito, apenas preparar e descrever.

## Documentação

Ao fim de cada entrega, atualizar `docs/DIAGNOSTICO.md` (achados resolvidos/pendentes) e o README quando o comportamento mudar.
