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

Models e schemas estão implementados para todos os módulos previstos, com constraints de integridade, referências compostas por empresa, decimais exatos e datas UTC. A suíte possui 31 testes aprovados. A API ainda não pode ser iniciada; migrações, autenticação, autorização, filtros de leitura por empresa e regras de negócio permanecem pendentes.

Veja [Models e schemas](models-e-schemas.md) para os campos, relacionamentos, contratos, precisão, testes e limitações desta entrega.

Veja [Paginação](paginacao.md) para os contratos de listagem e o helper SQLAlchemy. Com essa entrega, a suíte completa possui 40 testes aprovados.

## Datas e fusos horários

`app/db/types.py` centraliza o tipo `UTCDateTime` e a função `utc_now()`.

- A aplicação fornece datas com fuso; valores sem fuso são rejeitados na gravação.
- SQLite armazena UTC sem informação de fuso, e o tipo recoloca UTC ao ler.
- PostgreSQL usa `TIMESTAMP WITH TIME ZONE`; entradas e saídas são normalizadas para UTC.
- `TimestampMixin` gera `created_at` e `updated_at` na aplicação com `default=utc_now`; atualizações pelo SQLAlchemy usam `onupdate=utc_now`.
- `AuthSession.expires_at` e `revoked_at` usam o mesmo tipo. A duração e a validação de expiração ainda precisam ser implementadas.
- SQL direto deve fornecer timestamps explicitamente, pois não há default ou trigger de horário no servidor. Atualizações sem alteração efetiva não necessariamente emitem UPDATE.
- O fuso cadastrado na empresa é usado para apresentação e períodos de relatórios.

Exemplo para definir uma expiração na futura criação de sessão:

```python
from datetime import timedelta
from app.db.types import utc_now

expires_at = utc_now() + timedelta(hours=24)
```

Testes em `tests/test_datetime_types.py`: cinco casos aprovados com SQLite em memória e verificação do dialect PostgreSQL. Integração com servidor PostgreSQL ainda não executada.

## Como rodar

A preencher após a implementação da inicialização e da configuração da API.

Serão documentados os pré-requisitos, a instalação, as variáveis de ambiente, as migrações, os dados de demonstração, o comando de execução e os testes.

## Documentação a adicionar

- Migrações e integração dos models com os serviços da aplicação.
- Autenticação, permissões e isolamento por empresa.
- Endpoints e contratos de entrada e saída.
- Regras de negócio e precificação.
- Relatórios, auditoria e telemetria técnica.
- Configuração e publicação do ambiente de demonstração.

Novos documentos da API deverão ficar em `api/doc/` e ser vinculados neste README.
