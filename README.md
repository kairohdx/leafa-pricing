# Leafa Pricing

Sistema de precificação e gestão de vendas para empresas que trabalham com materiais, produtos e serviços. O objetivo é organizar os custos e a composição dos produtos, apoiar a definição de preços e oferecer relatórios para acompanhar a operação.

O projeto será um SaaS com dados isolados por empresa. Cada usuário pertence a uma única empresa, e cada empresa pode ter vários usuários.

## Funcionalidades previstas

- Cadastro de materiais com diferentes unidades de medida e custos de aquisição.
- Cadastro de produtos compostos por materiais.
- Cadastro de serviços com seus preços.
- Vendas formadas por serviço, produto ou material de reposição opcional, descrição e valor editável.
- Regras de precificação configuráveis e preservação dos valores históricos das vendas.
- Indicadores e relatórios para os usuários, histórico de atividades e telemetria técnica para análise e debug.
- Painel pensado primeiro para o celular, com informações resumidas nas listagens e detalhes acessíveis em telas próprias.

## Organização e documentação

Cada parte do projeto mantém sua documentação na própria pasta `doc/`, com um `README.md` como ponto de entrada. Este arquivo concentra a visão geral; os detalhes de cada parte ficam nos links abaixo.

| Parte | Responsabilidade | Documentação |
| --- | --- | --- |
| API | Backend em FastAPI, persistência, autenticação, regras e análises | [README da API](api/doc/README.md) |
| Frontend | Painel web em React + Vite | [README do frontend](front/doc/README.md) |

```text
leafa-pricing/
├── README.md
├── api/
│   ├── doc/README.md
│   ├── app/
│   ├── migrations/
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-dev.txt
└── front/
    └── doc/README.md
```

## Estado atual

O projeto está em estruturação. A API possui models, schemas, paginação, configuração, migração inicial, health check e autenticação por sessão, com dependências de permissões e isolamento por empresa. A suíte possui 49 testes aprovados. Os CRUDs de negócio, fórmulas e frontend ainda serão implementados. Render é o destino escolhido para a próxima etapa de publicação.

A arquitetura prevista é uma API modular com SQLAlchemy e Alembic, usando SQLite inicialmente e preparada para evoluir para PostgreSQL. A demonstração no Render poderá usar armazenamento efêmero, com perda dos dados aceita nesse ambiente.

## Como rodar

Os modos de execução estão no [índice de deploy](doc/README.md): [local](doc/execucao-local.md), [Docker](doc/deploy-docker.md) e [Render](doc/deploy-hospedado.md). Para banco + API local, use `python manage.py setup` e `python manage.py local`. O frontend está pendente; Docker e Render possuem configuração, mas ainda precisam de validação nos respectivos ambientes.

Siga o [guia de inicialização da API](api/doc/inicializacao.md), com comandos para Linux/Windows, configuração, migrações e testes. Ainda não há conta padrão ou seed de execução; as duas empresas desta etapa existem somente nas fixtures de teste.

Os comandos específicos serão mantidos nos READMEs da [API](api/doc/README.md) e do [frontend](front/doc/README.md).
