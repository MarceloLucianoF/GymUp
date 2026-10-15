# BohTreinar Gestão (console)

Console web para donos, administradores, professores e recepção de academias. Vite + React; fala só com o Worker `gestao-worker/` (nunca com o banco).

```bash
cd gestao && npm install
cp .env.example .env.local   # preencha com o projeto Firebase de homologação (valores públicos)
npm run dev                  # http://localhost:5174
npm test                     # Vitest
npm run build
```

Variáveis: `VITE_API_URL` (Worker), `VITE_FIREBASE_*` (config web pública). Nenhum segredo vai no bundle.

Rotas: `/` landing; `/login`; `/convite/:codigo`; `/app/...` painel, `academia/:id` (perfil), `academia/:id/{membros,alunos,fichas,convites,auditoria}`, `academia/:id/fichas/:fichaId`; `/termos`, `/privacidade`.

Arquitetura, endpoints, papéis, consentimento e limites: `docs/GESTAO_FUNDACAO.md` e `docs/GESTAO_ARQUITETURA.md`. Worker e migrações: `gestao-worker/` (`node --test test/*.test.js`).

Homologação: https://bohtreinar-gestao-hml.marcelo-labs.workers.dev (não publicar em produção sem pedido explícito).
