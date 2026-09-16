# Execução e deploy

| Modo | Guia | Estado |
| --- | --- | --- |
| Local | [Execução local](execucao-local.md) | API + SQLite com comando Python; início e parada testados no Windows |
| Docker | [Docker](deploy-docker.md) | Dockerfile e Compose para API + PostgreSQL; execução ainda não validada |
| Hospedado | [Render](deploy-hospedado.md) | Blueprint para API + PostgreSQL; ainda não publicado |

O frontend não existe; os três modos estão explicitamente incompletos quanto a esse componente. Não há container ou tela fictícia para simular sua conclusão.

Validação desta entrega: 52 testes aprovados no Windows, incluindo início/parada real do launcher, porta ocupada, migração e seed idempotente. YAML de Compose e Render lido localmente; não validado pelos respectivos serviços.

Guias por componente: [API](../api/doc/deploy.md), [frontend](../front/doc/deploy.md) e [banco](banco.md). O [CI/CD](ci-cd.md) está configurado em arquivos; publicação começa desabilitada e a proteção da main depende da disponibilidade do recurso no plano GitHub.
