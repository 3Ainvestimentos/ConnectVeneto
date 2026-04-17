---
name: security-review-playbook
description: Faz review tecnico do Connect Veneto com foco em vulnerabilidades reais, regressao de autorizacao, exposicao de dados e supply chain. Usar em PR review, auditoria de codigo, revisao de endpoints, revisao de firestore.rules ou quando o usuario pedir um review de seguranca.
---

# Security Review Playbook

## Como revisar

1. Mapear a mudanca: quais arquivos, contratos, rotas e permissoes mudaram.
2. Analisar cada camada:
   - AuthN/AuthZ (client vs server)
   - Validacao de entrada e limites
   - IO externo (SSRF, allowlist, timeout)
   - Logs e redacao de segredos
   - Exposicao indevida no client (systemSettings, chaves, ids)
   - firestore.rules e menor privilegio
   - Dependencias e supply chain (`npm audit`)
3. Produzir findings usando o formato obrigatorio abaixo.
4. Indicar se a mudanca esta pronta, precisa de ajuste, ou deve ser rejeitada.

## Formato obrigatorio de finding

- Severidade: Critico | Alto | Medio | Baixo
- Hipotese de exploracao
- Pre-condicoes
- Impacto real
- Evidencia (path + simbolo)
- Por que nao e falso positivo
- Correcao minima
- Correcao robusta
- Testes recomendados

## Perguntas orientadoras durante review

- Um usuario comum consegue ler/alterar o que nao deveria?
- O endpoint confia em dado do client para decidir permissao?
- Existe caminho de fetch que burla `safeFetch`?
- Algum log pode vazar email, token, stack trace?
- Mudanca em `firestore.rules` relaxa colecao sensivel?
- Upgrade de dependencia introduziu CVE?

## Quando nao houver risco relevante

- Declarar explicitamente.
- Registrar lacunas de teste, risco residual e recomendacao futura.

## Entregavel final

Relatorio com:

- Total de findings por severidade
- Itens bloqueadores de merge
- Ajustes recomendados
- Risco residual aceito
