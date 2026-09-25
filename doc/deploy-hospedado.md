# Render — demonstração descartável

O `render.yaml` define somente uma API Python no plano `free` e um Static Site. Não provisiona PostgreSQL nem disco persistente. A API usa `sqlite:////tmp/leafa-demo.db`, com `APP_ENV=production`, `DEMO_MODE=true` e `PYTHONPATH=api`.

## Inicialização

O build instala `api/requirements.txt`. O comando `python -m app.scripts.start` aguarda o banco, executa as migrações Alembic, prepara o catálogo básico e inicia uma única instância Uvicorn em `0.0.0.0:$PORT`. Não há pre-deploy: o banco precisa ser preparado no filesystem da instância que serve a API.

Em modo demo, o seed automático cria cinco dimensões e nove unidades (`un`, `kg`, `g`, `m`, `cm`, `mm`, `m2`, `L`, `mL`), com fatores de conversão. É transacional e idempotente: inclui registros ausentes, preserva registros existentes e recusa conflitos nos fatores/dimensões. Um conflito interrompe a inicialização antes de liberar a API.

Não cria empresas, usuários, senhas, materiais, vendas ou regras comerciais. As cinco estratégias já estão no código. Para experimentar, use `/cadastro`. O seed opcional de contas (`--seed`, com `DEMO_PASSWORD`) continua separado e não é chamado pelo Render.

A inicialização não apaga um banco existente. Se o filesystem for descartado, o próximo start recria schema e catálogo básico; os cadastros anteriores não são recuperados. Não há expiração programada de 24 horas.

## Publicar

1. Envie os arquivos ao GitHub e associe um Blueprint ao repositório.
2. Confira que os únicos recursos são `leafa-api` (free) e `leafa-front` (Static Site).
3. Configure `CORS_ORIGINS=["https://URL-DO-FRONTEND"]` na API e `VITE_API_URL=https://URL-DA-API` no site, sem `/api` extra.
4. O Blueprint já define `VITE_DEMO_MODE=true`; o build do frontend inclui o aviso de dados descartáveis no login, cadastro e painel.
5. Confira logs, `/health`, `/docs`, cadastro/login e disponibilidade das unidades.

Se houver um serviço criado manualmente antes, atualize também seu start command e variáveis; alterar o arquivo local não muda o painel remoto. Não há banco remoto para criar ou configurar. Autodeploy continua desligado; o CD existente permanece opcional.

## Dados descartáveis

O plano gratuito suspende a API após 15 minutos sem tráfego. O Render documenta perda de arquivos locais em suspensão, reinício e redeploy. A próxima visita pode aguardar a API iniciar. Tráfego contínuo pode mantê-la ativa: este modo não impõe um prazo máximo de retenção ou impede tecnicamente uso continuado.

O aviso da interface é: “Ambiente de demonstração. Os dados podem ser apagados sem aviso. Use apenas dados fictícios.” Não há promessa de recuperação. Rollback recupera código, não os dados do SQLite anterior; o startup prepara o schema e catálogo na instância de destino.

## Validação

Validação local: 64 testes de startup/unidades/motor aprovados; Ruff, ESLint, TypeScript e build com `VITE_DEMO_MODE=true` aprovados; YAML lido e configuração sem banco/pre-deploy conferida. Testes cobrem banco vazio, migrações, seed sem senha, reinício sem duplicação/perda de cadastros e recriação após descarte do arquivo SQLite temporário. Blueprint e publicação não foram executados no Render nesta etapa. Docker/PostgreSQL permanecem disponíveis separadamente no Compose, sem mudanças neste ajuste.

Referências: [limites gratuitos e filesystem](https://render.com/docs/free), [comandos de deploy](https://render.com/docs/deploys) e [Blueprint](https://render.com/docs/blueprint-spec).
