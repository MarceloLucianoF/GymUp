# Seed de demonstração (`scripts/seed-demo.cjs`)

Aditivo e idempotente: usa IDs fixos `demo_*`, **nunca apaga nada** e só grava com `--apply`.

```bash
node scripts/seed-demo.cjs           # prévia
node scripts/seed-demo.cjs --apply   # grava no projeto da serviceAccountKey.json
```

Cria: 4 fichas (coachId do treinador real), 8 alunos fictícios vinculados a ele (contas Auth `<nome>.demo@academyup.com`, senha `DEMO_PASSWORD`, padrão `123456`), ~120 check-ins, ~64 medições, status de mensalidade variados, uma conversa de exemplo e o perfil público do treinador (`publicCoachProfiles`).

> O antigo `scripts/seed.cjs` **apaga** `users`, `checkIns`, `measurements`, `chats` e outras coleções e recria perfis sem `role`. Não use em um banco com dados reais.
> Antes de abrir o app ao público, remova as contas demo (senha fraca) e os documentos `demo_*`.
