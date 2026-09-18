# Execução e deploy

| Modo | Guia | Estado |
| --- | --- | --- |
| Local | [Execução local](execucao-local.md) | API + SQLite + frontend com launcher Python; início e parada testados no Windows |
| Docker | [Docker](deploy-docker.md) | Dockerfiles e Compose para frontend + API + PostgreSQL; execução ainda não validada |
| Hospedado | [Render](deploy-hospedado.md) | Blueprint para Static Site + API + PostgreSQL; ainda não publicado |

O frontend inclui contas, catálogo, regras, vendas, indicadores e auditoria, com execução local integrada. Configuração de container/Static Site e testes de produção no CI estão preparados. Docker não está instalado no ambiente local desta entrega; execução dos containers e publicação continuam pendentes. Veja o [estado da validação frontend](../front/doc/README.md).

Validação desta entrega: 52 testes aprovados no Windows, incluindo início/parada real do launcher, porta ocupada, migração e seed idempotente. YAML de Compose e Render lido localmente; não validado pelos respectivos serviços.

Guias por componente: [API](../api/doc/deploy.md), [frontend](../front/doc/deploy.md) e [banco](banco.md). O [CI/CD](ci-cd.md) está configurado em arquivos; publicação começa desabilitada e a proteção da main depende da disponibilidade do recurso no plano GitHub.
