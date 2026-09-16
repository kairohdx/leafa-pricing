# Execução e publicação da API

- [Local](../../doc/execucao-local.md): `python manage.py setup` e `python manage.py local`, a partir da raiz. Migra antes de iniciar; logs no terminal.
- [Docker](../../doc/deploy-docker.md): `api/Dockerfile`, build pela raiz e Compose com PostgreSQL. Start em `app.scripts.start`.
- [Render](../../doc/deploy-hospedado.md): build instala dependências, pre-deploy migra, start executa Uvicorn. Configuração no `render.yaml` da raiz.

Variáveis e autenticação: [Inicialização](inicializacao.md). Health check `/health`, Swagger `/docs`. Configure URLs e CORS por ambiente. A aplicação não cria conta padrão; use seed explícito apenas em demonstração.

Status: execução local Windows validada; execução Docker, Linux e publicação Render pendentes. Frontend não implementado.
