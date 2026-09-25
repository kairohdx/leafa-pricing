# Execução e deploy do frontend

## Local

`python manage.py setup` instala dependências Python e executa `npm ci` em `front/`. `python manage.py local` prepara banco/migrações e inicia API + Vite, com logs no terminal. Verifica portas/dependências; Ctrl+C encerra ambos. Se um processo falhar, o outro é encerrado. `--api-only` instala/executa somente API.

Vite encaminha `/api/*` para API, removendo o prefixo. `API_PROXY_TARGET` é configuração do servidor de desenvolvimento, ajustada pelo launcher. No modo separado, padrão: `http://127.0.0.1:8000`.

Copie `front/.env.example` para `front/.env.local` para personalizar. Os padrões dispensam essa cópia. `VITE_API_URL` define a base usada pelo navegador e entra no bundle durante build. Não inclua credenciais privadas em `VITE_*`.

## Build

Na pasta `front/`:

```sh
npm ci
npm run build
npm run preview
```

Saída: `front/dist/`. Preview inspeciona o bundle, mas não configura proxy de produção. Para integração com esse bundle, configure URL pública da API antes do build e origem do preview em `CORS_ORIGINS`.

## Docker

`front/Dockerfile` constrói o bundle com Node 22 e `npm ci`, depois serve apenas `dist` com Nginx. O contexto exclui arquivos `.env*`, dependências locais e resultados de testes. O build fixa `VITE_API_URL=/api`.

O Compose agora define banco, API e frontend. Execute `python manage.py docker-up` com Docker/Compose instalados e `POSTGRES_PASSWORD` configurado no `.env` da raiz. Abra `http://127.0.0.1:8080`; `FRONT_PORT` altera a porta. A API continua acessível em `127.0.0.1:8000` (`API_PORT`). Para preparar unidades, execute explicitamente `docker compose exec api python -m app.scripts.units_catalog seed`.

O Nginx encaminha `/api/*` para `api:8000`, removendo o prefixo, e usa o DNS interno do Docker para resolver substituições do container. O navegador usa a mesma origem do frontend; não precisa acessar nomes internos nem requer CORS nesse modo. O frontend espera a saúde da API e possui health check próprio em `/health.json`.

Rotas como `/vendas/nova` retornam `index.html`; arquivos ausentes em `/assets/` retornam 404, sem HTML falso para JavaScript. Assets com hash recebem cache longo; HTML é revalidado e respostas de API não são armazenadas pelo proxy. `health.json` verifica o servidor estático; `/api/health` verifica a integração com a API. O Compose publica portas apenas no loopback e não configura TLS público.

## Render Static Site — demonstração descartável, publicação pendente

O `render.yaml` inclui `leafa-front`, com raiz `front`, `npm ci && npm run build:hosted`, saída `dist` e rewrite `/*` para `/index.html`. O build hospedado exige `VITE_API_URL` HTTPS, sem credenciais, query ou fragmento; a configuração inválida falha antes de gerar o bundle.

A API do Blueprint usa SQLite efêmero, sem PostgreSQL. Migrações e seed básico executam no startup. `VITE_DEMO_MODE=true` no Static Site inclui o aviso de dados descartáveis em login, cadastro e painel; localmente o aviso fica desligado por padrão. Contas são criadas pelo cadastro e podem desaparecer quando o Render descartar o filesystem.

Ao criar/sincronizar o Blueprint, configure os valores marcados `sync: false`:

- No Static Site: `VITE_API_URL=https://URL-PUBLICA-DA-API`, sem `/api` adicional quando a API está na raiz.
- Na API: `CORS_ORIGINS=["https://URL-PUBLICA-DO-FRONTEND"]`, lista JSON de origens exatas, sem caminho ou barra final.

Verifique as URLs efetivamente atribuídas pelo Render e inclua domínios próprios quando usados. Alterar `VITE_API_URL` exige novo build do frontend; alterar CORS exige atualização da API. O Static Site chama diretamente a URL pública HTTPS da API: o proxy do Compose não existe nesse modo.

Depois de provisionar, validar `/health.json` no frontend, `/health` na origem pública da API, login/logout, preflight CORS com Authorization, recarga de rotas profundas e acesso de operador. Não acrescente `/api` à rota de saúde da API pública. Nenhum recurso, domínio, secret ou deploy remoto foi criado nesta entrega.

## CI

O job frontend executa lint, testes, build e E2E local. O job Docker sobe os três serviços, prepara unidades e executa Playwright contra Nginx + API + PostgreSQL, incluindo saúde, fallback SPA e 404 de assets/API. `E2E_BASE_URL=http://127.0.0.1:8080` desliga o launcher temporário e aponta os testes para o Compose **descartável do CI**. Esse modo cria contas/dados; não o use em banco de trabalho. Só aceita URL loopback. O gate `CI required` depende de ambos os jobs.

O CD mantém publicação desabilitada por padrão. Quando `RENDER_DEPLOY_ENABLED=true` estiver configurado no repositório, o job publica a API após o gate. A etapa opcional do Static Site exige também `RENDER_FRONTEND_DEPLOY_ENABLED=true`, `RENDER_FRONTEND_SERVICE_ID=srv-...` e `RENDER_FRONTEND_HEALTH_URL=https://FRONT/health.json`. IDs/URLs ficam no environment `production`; os flags devem estar nas repository variables para avaliação consistente. Reutiliza o script de deploy, com commit exato e verificação de `status: ok`, sem enviar credenciais Render ao site.

API e frontend são publicados sequencialmente, não atomicamente. Se o frontend falhar, a API já pode estar atualizada; mantenha compatibilidade entre versões. Autodeploy dos dois serviços está desligado no Blueprint. O limite de 45 minutos acomoda a espera dos dois deploys. GitHub/Render ainda não foram executados nesta etapa.

## Diagnóstico e recuperação

- Página abre, API falha: conferir `/api/health` no Compose; no Render, URL pública da API, `/health`, HTTPS e CORS da origem real.
- Recarga dá 404: conferir rewrite SPA no serviço estático; no Compose, conferir `front/nginx.conf` e reconstruir o frontend.
- URL antiga no navegador: `VITE_API_URL` entra no bundle; reconstruir/republicar, não apenas reiniciar o servidor.
- 502 no Compose: consultar `docker compose logs api front` e a saúde do banco/API. O proxy refaz DNS após substituição da API.
- Atualização: `docker compose up --build -d --wait`. `docker compose down` preserva o banco; não remover volumes para corrigir falha de build.
- Rollback: reconstruir/republicar um commit previamente validado de frontend/API, preservando compatibilidade com o schema existente. Não há downgrade de banco automático. No Render, conferir o commit e a saúde de cada serviço após rollback.

Validação local: build padrão e hospedado com URL fictícia, testes de frontend, script de deploy simulado e sintaxe YAML. Docker ausente neste Windows; Nginx/Compose/PostgreSQL e jobs Linux estão preparados para CI, mas sua execução permanece pendente. Um build com URL fictícia não valida comunicação hospedada.

Referências de configuração: [Render Blueprint](https://render.com/docs/blueprint-spec), [rewrites de Static Sites](https://render.com/docs/redirects-rewrites) e [proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

[Guia local](../../doc/execucao-local.md) · [Índice de deploy](../../doc/README.md)
