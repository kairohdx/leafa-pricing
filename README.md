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

O projeto está em estruturação. A API possui models SQLAlchemy e schemas Pydantic para empresas, identidade, unidades, materiais, produtos, serviços, precificação, vendas, auditoria e análises, com 31 testes aprovados. [Veja os contratos, garantias e limites implementados](api/doc/models-e-schemas.md). Endpoints, migrações e regras de negócio ainda estão pendentes. O frontend ainda não foi desenvolvido.

A arquitetura prevista é uma API modular com SQLAlchemy e Alembic, usando SQLite inicialmente e preparada para evoluir para PostgreSQL. A demonstração no Render poderá usar armazenamento efêmero, com perda dos dados aceita nesse ambiente.

## Como rodar

A preencher quando a aplicação estiver executável.

- Pré-requisitos e versões: a definir.
- Instalação e variáveis de ambiente: a documentar.
- Banco de dados, migrações e dados de demonstração: a documentar.
- Execução da API e do frontend: a documentar.
- Execução dos testes: a documentar.

Os comandos específicos serão mantidos nos READMEs da [API](api/doc/README.md) e do [frontend](front/doc/README.md).
