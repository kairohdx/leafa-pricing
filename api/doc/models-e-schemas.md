# Models e schemas

Atualização posterior: configuração, migração inicial e autenticação básica foram entregues no passo 0. Veja [Inicialização da API](inicializacao.md) para o estado atual; as pendências abaixo registram o recorte original dos models.

Implementado em 14/09/2026. Os models usam SQLAlchemy 2 e os contratos usam Pydantic 2. Esta entrega cobre persistência e validação estrutural; não implementa endpoints nem fórmulas de negócio.

## Modelos

| Módulo | Models e responsabilidade |
| --- | --- |
| companies | `Company`: nome, slug único, moeda, fuso e ativação; relacionamento com usuários |
| identity | `User`: empresa obrigatória, email globalmente único, username único por empresa, papel e hash de senha; `AuthSession`: hash único de token, expiração e revogação |
| units | `UnitDimension`: código único e escala de armazenamento de 0 a 6; `UnitOfMeasure`: código único, símbolo, dimensão e fator racional positivo por numerador/denominador |
| materials | `Material`: SKU por empresa, quantidade/unidade de compra, custo, notas e arquivamento; `MaterialPackage`: embalagem específica de um material, quantidade e unidade |
| products | `Product` e `ProductMaterial`: cadastro e composição única por produto/material, com quantidade e unidade |
| services | `Service`: descrição, preço base e arquivamento |
| pricing | `PricingRule`: estratégia, parâmetros JSON, versão positiva e arquivamento; no máximo uma regra padrão ativa por empresa |
| sales | `Sale`: autoria, estados draft/completed/cancelled, data, moeda, totais e snapshot da regra; `SaleLine`: referência de serviço/produto/material, quantidade e snapshots de descrição, custo e preço |
| audit | `AuditEvent`: empresa, ator opcional, ação, entidade, alterações JSON, request ID e data |
| analytics | Sem tabela própria; contratos de período, resumo e série temporal |

Importe `app.db.models` antes de usar `Base.metadata`, inclusive na futura configuração do Alembic. O registro carrega as 14 tabelas. Os relacionamentos ORM incluem empresa/usuários, usuário/sessões, unidade/dimensão, embalagem/material, produto/composição e venda/linhas; as demais referências são consultáveis pelas respectivas chaves estrangeiras.

## Integridade e histórico

Os models iniciais de empresa, usuário e sessão foram padronizados com os novos módulos. `User` reutiliza `TenantMixin` e `tenant_key("users")`, centralizando a coluna de empresa e nomeando sua constraint composta como `uq_users_company_id`. `Company` é a própria empresa, e `AuthSession` pertence a ela por meio do usuário; por isso esses dois models não recebem `TenantMixin`. Foram uniformizados imports, anotações e formatação, preservando campos, defaults, enum de papéis, datas UTC e relacionamentos existentes.

Registros de negócio possuem `company_id` obrigatório. Referências entre eles usam chaves estrangeiras compostas `(company_id, id)`, impedindo vincular vendas, autores, regras, componentes, embalagens ou atores de auditoria de empresas diferentes. Os índices atendem empresa/nome nos catálogos principais, empresa/data/ID em vendas e auditoria e referências consultadas.

SQLite precisa executar `PRAGMA foreign_keys=ON` **em cada conexão**. Os testes fazem isso; a futura fábrica de conexões da aplicação deverá fazer o mesmo. Essas constraints não filtram leituras: autorização e filtros por empresa ainda precisam ser implementados.

Uma linha de venda exige exatamente uma referência correspondente ao `kind`. Totais e custos são não negativos e quantidades são positivas. Regra e versão no cabeçalho devem estar ambas ausentes ou presentes, com versão positiva. Vendas mantêm valores históricos independentes do catálogo; as referências usam `RESTRICT` para impedir exclusão dos registros utilizados. Catálogos possuem `archived_at`. Sessões podem ser removidas em cascata com o usuário; a composição pertence ao produto.

## Precisão e datas

`ScaledDecimal` persiste `Decimal` como `BIGINT`, sem arredondamento implícito:

| Dados | Casas decimais | Máximo positivo |
| --- | --- | --- |
| Custo de compra, preço base e totais | 2 | 92233720368547758.07 |
| Quantidades e custos/preços unitários de snapshots | 6 | 9223372036854.775807 |

Floats, booleanos, valores não finitos, excesso de casas e estouro de faixa são rejeitados. Exemplo: `"12.30"` chega como Decimal, é persistido como `1230` e volta no JSON como string decimal. A escala por dimensão é metadado para o futuro conversor; as colunas de quantidade têm capacidade fixa de seis casas. Fatores das unidades usam inteiros positivos de 64 bits. Conversões, compatibilidade de dimensões e arredondamento de cálculos ainda não são executados.

Datas seguem o contrato UTC já existente. Schemas exigem datas com fuso; a persistência normaliza para UTC. Empresa valida o identificador IANA do fuso e o formato de moeda com três letras maiúsculas. O ambiente precisa disponibilizar a base IANA (`tzdata` no Windows).

## Contratos

Os cadastros possuem schemas `Create`, `Update` e `Read`; composição e embalagens têm contratos próprios. Produtos são criados separadamente de seus componentes, e sua leitura pode incluir a composição. Vendas recebem linhas completas; `SaleUpdate.lines` representa substituição da lista, cuja aplicação transacional ficará no serviço. Não há edição parcial isolada de uma linha.

- Escritas rejeitam campos desconhecidos e não recebem `company_id`, IDs gerados, timestamps de sistema, autoria ou snapshots calculados.
- `Update` diferencia campo omitido de nulo explícito: use `model_dump(exclude_unset=True)`. Nulos são aceitos apenas em campos anuláveis, como notas e descrição opcional; preço/nome não podem ser apagados.
- Leituras usam `from_attributes=True`. Carregue os relacionamentos necessários antes de serializar fora da sessão.
- Senhas de entrada usam `SecretStr`; hashes de senha e token não fazem parte das respostas. `TokenResponse` é o contrato reservado para a futura emissão de credencial.
- Papéis e ativação de usuários são campos administrativos; os futuros endpoints precisam exigir autorização adequada.
- Auditoria oferece somente leitura pública. Sua gravação, seleção de campos seguros e proteção contra alteração dependem da camada de aplicação.
- Períodos analíticos exigem início anterior ao fim, com limite superior exclusivo. Custos ausentes são nulos; `cost_coverage` representa a quantidade de vendas com custo conhecido. Não há consultas ou indicadores fictícios.

## Verificação e pendências

Na raiz, com as dependências de desenvolvimento instaladas:

```powershell
$env:PYTHONPATH = 'api'
.venv/Scripts/python.exe -m pytest api/tests -q
```

31 testes aprovados: datas UTC, armazenamento decimal exato, validação de entrada, geração de JSON Schema de todos os contratos, regra padrão única, vínculos entre empresas rejeitados e preservação de snapshots com bloqueio de exclusão do catálogo. O DDL de tabelas e índices compila para PostgreSQL; não foi executado contra servidor PostgreSQL.

Permanecem pendentes: migração inicial, inicialização/configuração da API, sessões de banco em produção, autenticação e autorização, filtros de leitura por empresa, seed, conversor de unidades e validação de dimensões, cálculo/versionamento de preços, preenchimento de snapshots, transições de venda, auditoria transacional e consultas analíticas. JSON deve ser reatribuído ao model ao alterar seu conteúdo; mutações internas não são rastreadas automaticamente.
