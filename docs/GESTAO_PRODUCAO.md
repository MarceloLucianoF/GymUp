# BohTreinar Gestão: produção (fechada, em workers.dev)

Estado em 16/10/2026. A infraestrutura de produção existe, foi testada e está **vazia e sem divulgação**; o domínio oficial entra no fim. O app público continua com `REACT_APP_ACADEMY_API` desligada.

## Recursos
| Recurso | Nome / endereço |
| --- | --- |
| API | Worker `bohtreinar-academy-worker`, https://bohtreinar-academy-worker.marcelo-labs.workers.dev |
| Console | Worker de assets `bohtreinar-gestao`, https://bohtreinar-gestao.marcelo-labs.workers.dev (`noindex`) |
| Banco | D1 `bohtreinar-gestao` (dica de localização `enam`), migrações 0001 a 0005 |
| Login | Firebase Auth do projeto do app (`workout-tracker-app-20e43`); o endereço do console foi incluído nos domínios autorizados |
| Limites | `GESTAO_IP_LIMIT` 300, `GESTAO_USER_LIMIT` 120, `GESTAO_ACADEMY_LIMIT` 120 por minuto (identificadores próprios, separados da homologação) |

Os arquivos de configuração reais (`gestao-worker/wrangler.production.jsonc`, `gestao/wrangler.production.jsonc`) ficam **fora do git**; o modelo é `gestao-worker/wrangler.production.example.jsonc` e o teste `config.test.js` impede localhost, `-hml` e o banco de homologação nele. `ALLOWED_ORIGINS` tem só o console de produção. Não há segredo em nenhum dos dois Workers.

## Operação
- **Publicar a API:** `cd gestao-worker && npx wrangler deploy --config wrangler.production.jsonc`
- **Migração nova:** exportar o banco antes (`npx wrangler d1 export bohtreinar-gestao --remote --config wrangler.production.jsonc --output backup.sql`), depois `npx wrangler d1 migrations apply bohtreinar-gestao --remote --config wrangler.production.jsonc`.
- **Publicar o console:** `cd gestao && VITE_API_URL=<URL da API de produção> VITE_FIREBASE_*=<configuração web pública do projeto do app> npx vite build && npx wrangler deploy --config wrangler.production.jsonc`. Conferir que o bundle não cita localhost nem `-hml`.
- **Desligar escritas (incidente):** publicar a API com `ADMIN_OPS_ENABLED` igual a `"false"` **no arquivo de configuração** (a opção de linha de comando `--var` não aplicou o valor neste teste). Leitura continua e sair da academia continua funcionando. Para religar, publicar de novo com `"true"`.
- **Restaurar o banco:** `npx wrangler d1 time-travel info|restore bohtreinar-gestao ...` (guardar o bookmark antes de qualquer operação arriscada) ou importar a exportação.

## O que foi verificado em produção (16/10/2026)
- E2E da API com tokens reais e usuários fictícios: 22/22 (origens permitidas, token adulterado, todos os papéis por convite, isolamento entre duas academias, professor com e sem permissão, lote com prévia e idempotência, consentimento, esquema fechado, último dono, auditoria, sair e `leave-all`).
- Console: criação de academia pela tela e 6 telas em 390 e 1280 px sem rolagem horizontal, axe WCAG 2.1 A/AA e erros de JavaScript: 27/27.
- Desligador: com `ADMIN_OPS_ENABLED=false`, escrita 503 `ops_disabled`, leitura 200 e `leave-all` 200.
- Time Travel ensaiado: 3 academias, uma escrita (4), restauração ao bookmark (3).
- Limpeza: contas fictícias apagadas (8 do primeiro teste foram recuperadas pela exportação do Auth e removidas; o script não apagava, corrigido), D1 recriado vazio (0 academias, membros e auditoria; 32 gatilhos), exportação de ensaio feita antes.

## Ainda falta
1. **Jurídico/LGPD** (bloqueador comercial): textos de privacidade e termos, controlador e operador, menores, retenção, localização do D1 e e-mail de contato (hoje "a confirmar").
2. **Produto:** exclusão de academia e exportação dos dados da academia; e-mail de suporte; decidir se a entrada da Gestão deixa de ser `noindex`.
3. **Operação:** backup agendado e alerta de erros.
4. **Ligar o app do aluno:** E2E conjunto em produção com `REACT_APP_ACADEMY_API` apontando para a API de produção; depois congelar as coleções antigas de academia no Firestore.
5. **Domínio (por último):** domínios personalizados nos dois Workers, `ALLOWED_ORIGINS`, domínios do Firebase Auth, `VITE_API_URL`, variáveis do app e DNS do e-mail.
6. Primeira academia piloto.
