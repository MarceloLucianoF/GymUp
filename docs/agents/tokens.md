# Frente: economia de tokens

Objetivo: reduzir o contexto consumido sem perder evidência.

## Ferramentas
- **RTK** (`~/.local/bin/rtk`, hook global `rtk hook claude`): comprime saída de comandos Bash (git, npm, lint, testes). O hook só atua em chamadas Bash; Read/Grep/Glob nativos não passam por ele. Telemetria desativada (sem consentimento). Métricas: `rtk gain`; oportunidades perdidas: `rtk discover`; saída completa de falhas: `rtk recall <id>`.
- **Subagentes** em `.claude/agents/`:
  - `explorador-economico` — busca read-only, resposta ≤ 15 linhas (haiku).
  - `executor-compacto` — build/lint/testes, só veredito e falhas (haiku).
  - `revisor-diff` — revisão de segurança do diff, achados priorizados (sonnet).

## Regras
1. Delegue buscas amplas e execuções verbosas a subagentes; traga de volta só conclusões.
2. Leia trechos, não arquivos inteiros; nunca `package-lock.json`, `build`, `.firebase`, `.env*`.
3. Prefira `rtk <comando>` quando o hook não estiver ativo.
4. Cada relatório segue o formato de `AGENTS.md` (aprovada/reprovada/não executada).
