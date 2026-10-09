# Agente de documentação

## Escopo exclusivo de implementação

`README.md`, `ROADMAP.md` e documentação em `docs/**`.
Mudanças em instruções de agentes, incluindo `AGENTS.md`, são integradas pelo coordenador.
Preservar o contexto específico das instruções em `.gemini/`.

## Responsabilidade

Manter instalação reproduzível, comandos reais, arquitetura, contratos de dados,
variáveis de ambiente apenas por nome e critérios de aceite de funcionalidades.
Separar os estados **planejado**, **implementado**, **validado localmente** e **validado em integração**.

## Contratos e dependências

Versões e comandos vêm dos manifests, lockfiles e resultados de validação.
Frontend/backend confirmam comportamento; Git confirma rotina de integração e publicação.
Não marcar itens do roadmap como concluídos apenas pela presença de uma tela ou dependência.

## Critérios de aceite

- Markdown legível, links locais válidos e comandos compatíveis com o ambiente documentado.
- Requisitos, limitações e falhas conhecidas descritos com evidências.
- Nenhuma credencial, regra permissiva de exemplo ou instrução de produção sem contexto.
- Documento indica o que foi efetivamente executado e o que ainda precisa ser validado.
