# Inicialização da API — passo 0

A API agora inicia com configuração por ambiente, banco, migração inicial, autenticação por sessão e dependências de autorização. Esta entrega não publica o serviço no Render e não implementa os CRUDs de negócio.

## Executar em Linux ou Windows

Pré-requisito: Python 3.13. Na raiz do projeto, crie um ambiente virtual com `python -m venv .venv`. Ative com `.venv\Scripts\Activate.ps1` no PowerShell ou `source .venv/bin/activate` no Linux. Depois, os comandos são iguais:

```sh
python -m pip install -r api/requirements-dev.txt
python -m alembic -c api/alembic.ini upgrade head
python -m uvicorn app.main:app --app-dir api --host 127.0.0.1 --port 8000
```

Copie `.env.example` para `.env` para personalizar o ambiente. A configuração lê o `.env` da raiz independentemente do diretório de execução; variáveis do processo têm precedência. O arquivo real não é versionado. Por padrão, o SQLite fica em `data/leafa.db`, na raiz, e sua pasta é criada automaticamente.

Acesse `/health` para verificar conexão com o banco, `/docs` para Swagger e `/openapi.json` para os contratos HTTP. O health check não atesta que todas as migrações foram aplicadas; execute a migração antes de iniciar o servidor. Não são criadas tabelas automaticamente no startup.

| Variável | Uso |
| --- | --- |
| `APP_ENV` | `development` (padrão), `test` ou `production` |
| `DATABASE_URL` | URL SQLAlchemy; SQLite por padrão, PostgreSQL via `psycopg` também configurado |
| `DEMO_MODE` | Padrão `false`; exige aceite explícito para SQLite em produção; não executa seed |
| `SESSION_HOURS` | Expiração de sessão: 24 horas por padrão, entre 1 e 720 |
| `CORS_ORIGINS` | Lista JSON de origens explícitas; padrão vazio; exemplo `["http://localhost:5173"]` |

URLs `postgresql://` são normalizadas para o driver `postgresql+psycopg` na criação do engine. O driver consta nas dependências; a integração com servidor PostgreSQL ainda precisa ser validada. URLs SQLite relativas são resolvidas pelo diretório de execução, enquanto o valor padrão usa caminho absoluto.

## Banco e migrações

O Alembic carrega o registro central dos 14 models. A revisão inicial `ae50cbdd2270` cria tabelas, índices e constraints explicitamente. `upgrade head` pode ser repetido sem recriar tabelas. Para conferir divergência entre models e migrações:

```sh
python -m alembic -c api/alembic.ini check
```

O teste de migração usa banco temporário, aplica upgrade, repete upgrade, verifica ausência de divergência e executa downgrade. Não use downgrade em dados reais sem avaliar perda de dados. A migração inicial destina-se a banco novo; um banco criado manualmente com `create_all` exige conciliação antes de adotar Alembic.

Cada conexão SQLite ativa `PRAGMA foreign_keys=ON`. A dependência `get_session` fornece uma sessão por requisição e executa rollback em falhas. Os Application Services devem efetuar `commit` explicitamente antes de retornar sucesso; gravação de dados e futura auditoria devem compartilhar essa transação. Fechar uma sessão não confirma alterações pendentes.

## Autenticação e permissões

| Método/rota | Comportamento |
| --- | --- |
| `POST /auth/login` | Recebe `email` e `password`; retorna token Bearer e expiração |
| `GET /auth/me` | Retorna o usuário da sessão, sem senha ou hash |
| `POST /auth/logout` | Revoga a sessão atual e retorna 204 |

Envie `Authorization: Bearer <access_token>` nas rotas autenticadas. Tokens são aleatórios, com 32 bytes de entropia; só seu SHA-256 é persistido. Senhas usam Argon2 via pwdlib. Não há segredo de assinatura JWT porque este fluxo usa sessões opacas persistidas. Respostas de login e perfil usam `Cache-Control: no-store`.

Cada acesso valida expiração, revogação, usuário ativo e empresa ativa. Login inválido ou conta desativada usa a mesma resposta genérica 401. A expiração é absoluta; não há renovação automática.

`CurrentAuth` fornece usuário, sessão e `company_id` autorizado. `AdminAuth` restringe administradores; `require_roles` permite declarar conjuntos de papéis, inclusive operador. As permissões específicas de cada CRUD serão definidas junto da operação. Papel e ativação são lidos do banco em cada requisição.

Use `tenant_statement(model, auth)` para listagens e `get_tenant_record(db, model, id, auth)` para acesso por ID. Ambos restringem pela empresa autenticada; registro inexistente ou de outra empresa retorna 404 indistinguível. Esses helpers são para models com `company_id`, não para `Company`, sessões ou catálogo global de unidades. Os futuros serviços continuam responsáveis por usar os filtros em todas as operações.

Não há conta ou senha padrão no banco de execução. Os dados desta etapa são fixtures de teste: duas empresas e três usuários (administrador e operador na primeira, administrador na segunda). Cadastro/provisionamento inicial e seed de demonstração permanecem nas próximas entregas.

## Erros

Erros HTTP retornam `code`, `message`, `field_errors` e `request_id`. Validação usa 422; credenciais inválidas 401; falta de papel 403; registro ausente 404; violação de integridade 409. Falhas inesperadas retornam 500 genérico, sem SQL, parâmetros ou traceback na resposta. Erros de validação não repetem os dados recebidos, evitando expor senhas. Um ID é gerado por requisição e enviado em `X-Request-ID` nas respostas tratadas.

## Validação da entrega

```sh
python -m pytest api/tests -q
```

49 testes passaram no Windows: suíte anterior, login/logout, hashes de token, expiração/revogação, contas desativadas, papéis, isolamento de leituras entre duas empresas, erros HTTP, health check, OpenAPI, configuração e ciclo de migração SQLite. O ambiente apresentou avisos de depreciação de dependências de testes e permissão do cache pytest; não houve falha de teste na execução final. Linux e servidor PostgreSQL serão verificados na infraestrutura/CI planejados.

## Destino hospedado

Render está escolhido para o passo 0.1. A API será configurada como **Web Service**, conforme o [guia oficial de FastAPI](https://render.com/docs/deploy-fastapi), com bind em `0.0.0.0` e porta indicada por `PORT`. A publicação, os comandos definitivos de deploy, o banco hospedado e o CD ainda serão implementados nessa etapa.

O [filesystem padrão do Render é efêmero](https://render.com/docs/deploys). SQLite com `DEMO_MODE=true` permanece uma opção de demonstração com perda de dados aceita; durabilidade exige planejamento de banco/persistência. O frontend ainda não existe.
