# CI/CD no GitHub

Workflow: `.github/workflows/ci.yml`. Executa em pull requests, pushes na `main`, merge queue e disparo manual. Não usa filtros de caminhos: alterações apenas em documentação também recebem o check necessário.

## Verificações

| Job | Responsabilidade |
| --- | --- |
| `Python (ubuntu-latest)` / `Python (windows-latest)` | Instalação via launcher, testes SQLite/HTTP, início/parada real da API local e lint |
| `Frontend` | Node 22, instalação integrada, ESLint, Vitest, TypeScript/build e Playwright com API/SQLite temporários |
| `PostgreSQL integration` | Banco descartável, migração inicial, divergência model/schema, precisão decimal, UTC e isolamento de referências; downgrade ao final |
| `Docker frontend, API and database` | Validar Compose, construir frontend/API, subir os três serviços, preparar unidades e executar Playwright contra Nginx/PostgreSQL; limpar volumes descartáveis ao final |
| `CI required` | Exige sucesso de todos os jobs acima; falha, cancelamento ou job ignorado não são aceitos |
| `Deploy Render` | Somente push na main, depois do CI e com publicação habilitada |

Ruff verifica erros de sintaxe e referências indefinidas (`E9`, `F63`, `F7`, `F82`). Isso não é análise completa de tipos da API; adoção de type checker e regras adicionais fica pendente. Frontend e E2E foram incluídos em 16/09/2026, com validação local Windows. Docker/PG/Linux e o novo job frontend ainda dependem de validação no GitHub.

Localmente:

```sh
python -m pip install -r api/requirements-dev.txt
python -m ruff check api manage.py scripts
python -m pytest api/tests -q
```

59 testes passaram no Windows; um teste de PostgreSQL foi ignorado por ausência de `TEST_POSTGRES_URL`. Esse teste executa migração e downgrade, portanto a variável deve apontar **somente para um banco descartável**, nunca para dados de uso real. O workflow cria o banco especificamente para isso.

## Bloqueio de PRs

O nome estável do check a exigir na proteção da `main` é **`CI required`**. Quando disponível no plano GitHub, configure:

1. Exigir pull request antes de merge.
2. Exigir status checks, incluindo `CI required`, e branch atualizada.
3. Bloquear force push/exclusão e aplicar as regras aos administradores sem bypass, conforme política do projeto.

**Pendência externa confirmada:** consultas à API GitHub para rulesets e proteção clássica retornaram HTTP 403 para `kairohdx/leafa-pricing`: o plano atual não oferece essas proteções no repositório privado e exige GitHub Pro ou repositório público. Nenhuma configuração de visibilidade ou plano foi alterada. Enquanto isso, o workflow mostra falhas e bloqueia o seu job de deploy, mas não impede tecnicamente merge manual ou push direto.

Depois de habilitar o recurso, configurar a proteção e executar um PR deliberadamente com teste falhando para confirmar o bloqueio. Esse teste remoto continua pendente.

## Habilitar publicação no Render

O CD já está definido, mas começa desabilitado. Depois de criar o serviço Render e validar o CI na main, configure o environment GitHub `production`:

- Secret `RENDER_API_KEY`: chave da conta Render.
- Variable `RENDER_SERVICE_ID`: identificador `srv-...` do Web Service.
- Variable `RENDER_HEALTH_URL`: URL HTTPS completa, terminando em `/health`.

No nível do **repositório**, configure a variable `RENDER_DEPLOY_ENABLED=true` apenas quando quiser ativar a publicação. Ela é avaliada antes de iniciar o job. Credenciais não são fornecidas a jobs de PR, nem são necessários secrets para testes/build. Senhas do PostgreSQL no CI são descartáveis.

Mantenha `autoDeployTrigger: "off"` no Render, inclusive no painel, e controle Auto Sync do Blueprint para não criar outra via automática de publicação. Disparo manual do workflow executa verificações, mas não publica.

O script `scripts/deploy_render.py` envia `commitId=github.sha`, aguarda o deploy ficar `live`, confirma o commit retornado e verifica saúde HTTP sem enviar credenciais Render à aplicação. Falha ou timeout falham o job; timeout não cancela um deploy remoto já iniciado. Inspecione o Render antes de repetir. Deploys usam um grupo de concorrência único e não cancelam publicação em andamento.

## Falhas e rollback

O Static Site possui uma etapa opcional após a API, reutilizando `scripts/deploy_render.py` com o mesmo `github.sha`. Exige a repository variable `RENDER_FRONTEND_DEPLOY_ENABLED=true` e, no environment `production`, `RENDER_FRONTEND_SERVICE_ID` e `RENDER_FRONTEND_HEALTH_URL` (terminando em `/health.json`). O flag geral `RENDER_DEPLOY_ENABLED` continua obrigatório. Configurar esses valores antes de habilitar a etapa; API e frontend não são publicados atomicamente. Se a etapa estática falhar, a API pode já estar atualizada. Veja [configuração e rollback do frontend](../front/doc/deploy.md).

Falha em testes/lint/integração/build impede o deploy deste workflow. Falha no Render ou saúde posterior deixa a execução vermelha; não há rollback automático de schema. Para voltar código, use o procedimento do [guia Render](deploy-hospedado.md), conferindo compatibilidade das migrações e backups. Publicação real e recuperação serão validadas com o produto.

Workflows e scripts foram criados no workspace. Ainda precisam ser enviados ao GitHub para executar. Não houve publicação ou gravação de secrets nesta entrega.

Referências: [status checks e proteção de branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [eventos de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) e [Render deploy por commit](https://render.com/docs/deploys).
