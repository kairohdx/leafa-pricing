# Indicadores e séries de vendas

Consultas em `analytics/queries.py` e rotas em `analytics/router.py`, sem novas tabelas ou migrações. Administradores e operadores autenticados consultam somente dados da própria empresa.

| GET | Resposta |
| --- | --- |
| `/analytics/summary` | Resumo do período: quantidade, total final, custo conhecido e cobertura |
| `/analytics/sales-series` | Série diária no fuso da empresa |

Parâmetros obrigatórios: `start` e `end`, datas com fuso. Início inclusivo e fim exclusivo, usando `Sale.occurred_at`. O período precisa ser positivo e ter no máximo 366 dias; erro retorna 422. `currency` é opcional, com três letras maiúsculas, e usa a moeda atual da empresa por padrão.

Exemplo:

```text
/analytics/summary?start=2026-09-01T00:00:00-03:00&end=2026-10-01T00:00:00-03:00&currency=BRL
```

## Estados e moeda

Somente vendas `completed` entram nas consultas. Rascunhos e canceladas são excluídos. Usa-se o total final e os custos persistidos, sem recalcular preços pelo catálogo. A moeda filtra a moeda histórica de cada venda, não mistura moedas nem faz câmbio. Se a empresa mudar sua moeda, informe `currency` para consultar a anterior.

## Resumo e cobertura

- `sales_count`: quantidade de vendas concluídas no filtro.
- `final_total`: soma exata dos totais finais, em string decimal.
- `cost_total`: soma dos custos conhecidos. Retorna nulo quando nenhuma venda tem custo disponível; pode ser zero se existirem custos conhecidos iguais a zero.
- `cost_coverage`: quantidade de vendas com `cost_total` não nulo. Se menor que `sales_count`, a soma de custos é parcial.

Sem vendas, quantidade e total final são zero, custo é nulo e cobertura é zero. Não há indicador de lucro líquido ou cálculo fictício. Atualmente a criação de vendas não calcula custos, portanto é esperado custo indisponível até implementar a precificação.

## Série diária

Cada ponto contém `start`, quantidade e total final. `start` identifica o começo do dia no fuso IANA cadastrado na empresa, com seu offset naquela data. Dias sem vendas recebem zeros. Primeiro/último ponto podem representar dias parcialmente cobertos pelo período: somente vendas dentro do intervalo solicitado são contadas. O início do ponto é o limite do dia, podendo anteceder o início do filtro.

A série é diária, sem paginação, limitada pelo período. Mudanças de horário de verão são tratadas pelo fuso, não por subtração fixa de horas. SQLite usa função de agrupamento registrada na conexão; PostgreSQL usa conversão de timezone e data no SQL. Não são carregados todos os registros de venda em Python: o banco retorna agregados por dia, e a aplicação completa os dias vazios.

Somatórios operam sobre inteiros em centavos. No SQLite, uma função agregadora usa inteiros Python e devolve texto para evitar overflow de 64 bits; no PostgreSQL, usa-se SUM convertido para texto. O contrato de agregado permite totais maiores que o limite monetário de uma única linha, sem converter valores para float.

## Validação e limites

`tests/test_analytics.py` verifica isolamento, moeda, estados, custo parcial, período vazio, limites de datas, permissões, dias sem vendas, virada de dia/horário de verão e soma acima do limite individual de armazenamento. Suíte completa: 99 aprovados, 1 PostgreSQL ignorado localmente; lint aprovado.

Execução das consultas em servidor PostgreSQL, carga, frontend e E2E permanecem para a validação de ambientes/produto já planejada. Não há tabela de agregação, exportação, comparação de períodos ou gráficos nesta entrega.
