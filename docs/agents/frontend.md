# Agente de frontend

## Escopo exclusivo de implementação

- `src/pages/**`, `src/components/**`, `src/App.jsx`, `src/index.js`.
- `src/*.css`, `src/styles/**`, `src/data/**` e apresentação em `public/**`.
- `src/hooks/ThemeContext.js`, Tailwind e PostCSS, após combinar mudanças de configuração com Git.

## Responsabilidade

Manter as jornadas de visitante, aluno, treinador e administrador; navegação por papel;
execução/retomada de treino; histórico; medidas; chat e estados de carregamento, vazio e erro.
Verificar responsividade, acessibilidade básica e consistência de tema.

## Contratos e dependências

Firebase, hooks de dados e serviços são responsabilidade do backend.
Combine formato de exercícios, séries, IDs, histórico e sessão ativa antes de alterar os consumidores.
Guarda de rota melhora a interface, mas a autorização deve existir também nas regras/backend.
Service worker e comportamento offline exigem revisão conjunta com backend e validação.

## Critérios de aceite

- Rotas e ações respeitam o papel do usuário e têm estados de erro verificáveis.
- Check-in, retomada e histórico usam os mesmos campos e unidades.
- Alterações visuais são conferidas nas telas afetadas; não declarar validação visual sem realizá-la.
- Build e checks relevantes aprovados, ou falhas preexistentes identificadas separadamente.
- Relatório com arquivos, evidências, validações e pendências.
