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

Somente a estrutura e os arquivos de dependências foram criados. Os arquivos de código, configuração e testes estão vazios; a API ainda não pode ser iniciada. Os models, a autenticação, o isolamento por empresa e as regras ainda não estão implementados.

## Como rodar

A preencher após a implementação da inicialização e da configuração da API.

Serão documentados os pré-requisitos, a instalação, as variáveis de ambiente, as migrações, os dados de demonstração, o comando de execução e os testes.

## Documentação a adicionar

- Models e relacionamentos.
- Autenticação, permissões e isolamento por empresa.
- Endpoints e contratos de entrada e saída.
- Regras de negócio e precificação.
- Relatórios, auditoria e telemetria técnica.
- Configuração e publicação do ambiente de demonstração.

Novos documentos da API deverão ficar em `api/doc/` e ser vinculados neste README.
