# Documentação da API

[Voltar ao README do projeto](../../README.md)

Backend do Leafa Pricing, organizado por funcionalidade para atender várias empresas com isolamento de dados. Cada usuário pertence a exatamente uma empresa.

## Tecnologias previstas

- FastAPI para a API HTTP e Pydantic para os contratos de dados.
- SQLAlchemy para persistência e Alembic para migrações.
- SQLite na etapa inicial, com evolução futura para PostgreSQL.
- pytest e HTTPX para testes.

As dependências estão em [requirements.txt](../requirements.txt) e [requirements-dev.txt](../requirements-dev.txt).

## Estrutura

| Caminho | Responsabilidade prevista |
| --- | --- |
| `app/main.py` | Inicialização da aplicação |
| `app/core/` | Configuração, segurança, dependências, erros e logs |
| `app/db/` | Base dos models, sessões e tipos de persistência |
| `app/modules/identity/` | Usuários e sessões de autenticação |
| `app/modules/companies/` | Empresas e gestão de seus usuários |
| `app/modules/materials/` | Materiais e unidades de medida |
| `app/modules/units/` | Dimensões e catálogo global de unidades |
| `app/modules/products/` | Produtos e composição por materiais |
| `app/modules/services/` | Serviços e preços cadastrados |
| `app/modules/pricing/` | Configurações e futuras regras de precificação |
| `app/modules/sales/` | Vendas, itens e valores históricos |
| `app/modules/analytics/` | Consultas de indicadores e relatórios |
| `app/modules/audit/` | Histórico de atividades e alterações |
| `app/scripts/` | Scripts auxiliares e dados de demonstração |
| `migrations/` | Evolução do schema do banco |
| `tests/` | Testes da API |
| `doc/` | Documentação da API, indexada neste README |

## Estado atual

[Indicadores e séries de vendas](analytics.md) implementados, com período, moeda, dias no fuso da empresa e cobertura de custos. Suíte atual: 99 testes aprovados e 1 ignorado localmente.

[Consultas de auditoria](audit.md) implementadas: leitura administrativa por empresa, paginação, filtros e limpeza de campos estruturados de credenciais.

[Vendas](sales.md) implementadas com rascunhos, itens, snapshots, total manual, conclusão/cancelamento e paginação. Suíte atual: 93 testes aprovados e 1 ignorado localmente.

[Regras de precificação](pricing.md) implementadas como cadastro de configurações, com versionamento e regra padrão por empresa; fórmulas e validações específicas de estratégias permanecem pendentes.

[Produtos e composição](products.md) implementados, com listagem resumida, detalhe com materiais, validação dimensional, arquivamento e auditoria.

[Serviços](services.md) implementados, com preço base, paginação, busca, arquivamento/restauração e auditoria.

[Materiais e embalagens](materials.md) implementados, com paginação, arquivamento/restauração, validação dimensional e auditoria.

Catálogo de [Dimensões e unidades](units.md) implementado: consultas autenticadas e paginadas, manutenção administrativa por CLI e seed inicial idempotente.

Primeiro CRUD implementado: [Empresas](companies.md), com cadastro e administrador inicial, consulta/edição da própria empresa, auditoria e comando de ativação no servidor.

Segundo CRUD implementado: [Usuários e sessões](users.md), com paginação, administração por empresa, perfil, troca de senha e revogação de sessões. Suíte atual: 69 testes aprovados e 1 PostgreSQL ignorado localmente.

Models e schemas estão implementados para todos os módulos previstos, com constraints de integridade, referências compostas por empresa, decimais exatos e datas UTC. A API agora inicia com configuração, migração inicial, health check, login/logout e perfil autenticado. Dependências de papéis e filtros por empresa estão disponíveis para os futuros CRUDs. A suíte possui 49 testes aprovados; CRUDs de negócio, fórmulas e publicação permanecem pendentes.

Veja [Models e schemas](models-e-schemas.md) para os campos, relacionamentos, contratos, precisão, testes e limitações desta entrega.

Veja [Paginação](paginacao.md) para os contratos de listagem e o helper SQLAlchemy.

## Datas e fusos horários

`app/db/types.py` centraliza o tipo `UTCDateTime` e a função `utc_now()`.

- A aplicação fornece datas com fuso; valores sem fuso são rejeitados na gravação.
- SQLite armazena UTC sem informação de fuso, e o tipo recoloca UTC ao ler.
- PostgreSQL usa `TIMESTAMP WITH TIME ZONE`; entradas e saídas são normalizadas para UTC.
- `TimestampMixin` gera `created_at` e `updated_at` na aplicação com `default=utc_now`; atualizações pelo SQLAlchemy usam `onupdate=utc_now`.
- `AuthSession.expires_at` e `revoked_at` usam o mesmo tipo. A duração é configurada por `SESSION_HOURS` e a expiração é verificada em cada requisição autenticada.
- SQL direto deve fornecer timestamps explicitamente, pois não há default ou trigger de horário no servidor. Atualizações sem alteração efetiva não necessariamente emitem UPDATE.
- O fuso cadastrado na empresa é usado para apresentação e períodos de relatórios.

Exemplo do cálculo de expiração de sessão:

```python
from datetime import timedelta
from app.db.types import utc_now

expires_at = utc_now() + timedelta(hours=24)
```

Testes em `tests/test_datetime_types.py`: cinco casos aprovados com SQLite em memória e verificação do dialect PostgreSQL. Integração com servidor PostgreSQL ainda não executada.

## Como rodar

O launcher local e as configurações Docker/Render estão descritos em [Deploy da API](deploy.md). Há seed opcional explícito de demonstração; veja o [guia local](../../doc/execucao-local.md).

O passo 0 está implementado. Consulte [Inicialização da API](inicializacao.md) para instalação em Linux/Windows, variáveis, migrações, autenticação, permissões e testes. A suíte atual possui 49 testes aprovados; a publicação no Render será feita no passo 0.1.

## Documentação a adicionar

- Migrações e integração dos models com os serviços da aplicação.
- Autenticação, permissões e isolamento por empresa.
- Endpoints e contratos de entrada e saída.
- Regras de negócio e precificação.
- Relatórios, auditoria e telemetria técnica.
- Configuração e publicação do ambiente de demonstração.

Novos documentos da API deverão ficar em `api/doc/` e ser vinculados neste README.
