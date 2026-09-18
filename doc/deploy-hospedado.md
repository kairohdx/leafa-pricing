# Render

O `render.yaml` da raiz define um Web Service Python para a API, um Render PostgreSQL separado e um Static Site para o frontend. O site chama diretamente a URL pública HTTPS da API. Configuração, CORS, build e CD do frontend estão no [guia de publicação](../front/doc/deploy.md).

O Blueprint seleciona planos pagos (`starter` para API e `basic-256mb` para banco), permitindo migração no pre-deploy e armazenamento separado da aplicação. Revise os planos e custos na conta antes de provisionar. Nenhum recurso foi criado nesta entrega.

## Publicar

1. Envie os arquivos ao repositório GitHub escolhido.
2. No Render, crie um Blueprint associado ao repositório e confira os recursos de `render.yaml` antes de confirmar.
3. O build instala `api/requirements.txt`; o pre-deploy executa `python -m alembic -c api/alembic.ini upgrade head`.
4. O start executa `python -m uvicorn app.main:app --app-dir api --host 0.0.0.0 --port $PORT`. O health check usa `/health`.
5. Confira os logs e teste `/health`, `/docs` e o fluxo autenticado após provisionar uma conta ou executar seed explicitamente.

O Render injeta `DATABASE_URL` a partir do banco. `APP_ENV=production` e `DEMO_MODE=false` estão definidos. `CORS_ORIGINS` na API e `VITE_API_URL` no frontend são solicitados via `sync: false`: configure a lista JSON de origens exatas do site e a URL pública HTTPS da API. O banco bloqueia acesso público por `ipAllowList: []`; conexão da API utiliza a rede interna.

Migrações ficam no pre-deploy, não no start de cada instância. Seed não é automático: para uma demonstração, habilite `DEMO_MODE`, disponibilize `DEMO_PASSWORD` temporariamente no ambiente do serviço e execute uma única vez `PYTHONPATH=api python -m app.scripts.seed_demo` pelo shell do Render. Remova a senha depois. Contas novas podem usar `/cadastro` no frontend. O catálogo global de unidades exige preparação explícita conforme o guia de unidades.

## Atualizar e recuperar

Autodeploy está desligado até o CI/CD do passo 0.2. Deploys manuais devem usar um commit testado. Confira também o Auto Sync do Blueprint para controlar alterações de infraestrutura.

Se build ou migração falhar, verifique logs antes de tentar novamente. Depois da publicação, teste saúde e autenticação. Para voltar código, use o mecanismo de rollback/deploy do commit anterior do Render; isso não desfaz migrações. Mudanças de schema devem manter compatibilidade com a versão anterior, e recuperação de dados deve usar backup validado. Não rode downgrade destrutivo como rollback automático.

## Limites

O YAML foi revisado conforme documentação e sua sintaxe foi lida localmente. Não há acesso configurado à conta Render nesta sessão: Blueprint, conexão com banco hospedado, URLs e rollback ainda não foram validados remotamente. Publicação permanece pendente no checklist.

SQLite efêmero continua permitido apenas para demonstração explícita, mas não é o banco deste Blueprint. Linux é o ambiente hospedado; o gerenciamento local pode ser feito por navegador em Linux ou Windows.

Referências: [Blueprint](https://render.com/docs/blueprint-spec), [FastAPI](https://render.com/docs/deploy-fastapi), [deploys](https://render.com/docs/deploys) e [Blueprint Auto Sync](https://render.com/docs/infrastructure-as-code).
