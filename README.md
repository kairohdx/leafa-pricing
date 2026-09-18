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

Os CRUDs e consultas da API estão implementados, com autenticação por sessão, permissões e isolamento por empresa. O frontend inclui contas, administração de usuários, catálogo de materiais/embalagens, serviços e produtos com composição, regras de precificação, vendas com total manual e histórico, indicadores por período/moeda e auditoria administrativa, com navegação responsiva. Fórmulas de precificação e validação de publicação continuam pendentes. Render é o destino escolhido para publicação.

A arquitetura prevista é uma API modular com SQLAlchemy e Alembic, usando SQLite inicialmente e preparada para evoluir para PostgreSQL. A demonstração no Render poderá usar armazenamento efêmero, com perda dos dados aceita nesse ambiente.

## Como rodar

Os modos de execução estão no [índice de deploy](doc/README.md): [local](doc/execucao-local.md), [Docker](doc/deploy-docker.md) e [Render](doc/deploy-hospedado.md). Com Python 3.13 e Node.js 22.12+ da linha 22, use `python manage.py setup` e `python manage.py local` para banco + API + frontend. Abra `http://127.0.0.1:5173`. Use `--api-only` para instalar/rodar apenas a API. Docker/Render agora têm configuração do frontend; execução dos containers e publicação hospedada ainda precisam ser validadas.

Siga o [guia de inicialização da API](api/doc/inicializacao.md), com comandos para Linux/Windows, configuração, migrações e testes. Ainda não há conta padrão ou seed de execução; as duas empresas desta etapa existem somente nas fixtures de teste.

Os comandos específicos serão mantidos nos READMEs da [API](api/doc/README.md) e do [frontend](front/doc/README.md).
