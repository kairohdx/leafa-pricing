# Regras e motor de precificação

O CRUD existente mantém permissões, isolamento por empresa, arquivamento, regra padrão e controle otimista com `expected_version`. As estratégias são executadas em `pricing/engine.py` (`PricingEngine`); custos ficam em `pricing/costs.py` (`CostEngine` e adaptador de catálogo). Rotas e models não contêm fórmulas. Não foi necessária migração de banco.

## Estratégias e parâmetros

Todos os percentuais usam pontos percentuais: `"30"` representa 30%, não `"0.30"`. Envie decimais como strings; inteiros também são aceitos. Float, booleano, NaN, infinito, negativos e parâmetros desconhecidos são recusados. Entradas aceitam até 12 casas decimais e o limite monetário `92233720368547758.07`.

| Nome | strategy_key | Parâmetros obrigatórios | Fórmula |
| --- | --- | --- | --- |
| Acréscimo sobre custo | `markup_percent` | `percentage` | custo × (1 + percentage / 100) |
| Margem desejada | `target_margin` | `margin` | custo / (1 − margin / 100) |
| Margem + taxas | `margin_fees` | `margin`, `fees`, `fixed_cost` | (custo + fixed_cost) / (1 − (margin + fees) / 100) |
| Multiplicar o custo | `cost_multiplier` | `multiplier` | custo × multiplier |
| Valor fixo sobre o custo | `fixed_addition` | `addition` | custo + addition |

Margem + taxas deve ser menor que 100%. Multiplicador deve ser estritamente positivo. Acréscimos, taxas e custo adicional fixo podem ser zero. A margem resultante considera somente custo-base, custo adicional e taxas modeladas; não é lucro líquido.

Exemplos: custo 100 com acréscimo 30% resulta em 130,00; margem 30% resulta em 142,86; margem 20% e taxas 10%, sem custo adicional, resulta em 142,86; custo 40 × 2,5 resulta em 100,00; custo 80 + adicional 50 resulta em 130,00.

## Arredondamento

`parameters.rounding` é opcional e aceita:

- `none`: sem ajuste comercial; adequação monetária para centavos para cima.
- `integer`: próximo inteiro, mantendo o valor quando já inteiro.
- `ending_90`: menor valor terminado em ,90 que não seja inferior ao cálculo.
- `ending_99`: menor valor terminado em ,99 que não seja inferior ao cálculo.

47,32 resulta em 47,90 ou 47,99 conforme a terminação. 47,95 com `ending_90` resulta em 48,90. O preço bruto permanece em `price_before_adjustment`. Até no modo `none`, frações de centavo são elevadas ao centavo seguinte para não reduzir o preço necessário (142,857… → 142,86).

Operações usam `Decimal`, contexto local com precisão de 50 dígitos. Divisões periódicas são representadas nessa precisão. Não há float financeiro. Totais de linha (preço sugerido unitário × quantidade) e custo agregado são monetizados com `ROUND_HALF_UP`; o custo unitário persistido usa seis casas, enquanto o snapshot detalhado preserva o cálculo com maior precisão. Valores fora da capacidade são indisponíveis, nunca zero.

## Endpoints

| Método e rota | Uso |
| --- | --- |
| `GET /pricing-rules` | Lista paginada, filtros `search` e `archived` |
| `POST /pricing-rules` | Cria regra válida, administrador |
| `GET /pricing-rules/{id}` | Consulta, inclusive regras antigas |
| `PATCH /pricing-rules/{id}` | Atualiza com `expected_version`, administrador |
| `POST /pricing-rules/{id}/archive` | Arquiva e remove padrão |
| `POST /pricing-rules/{id}/restore` | Restaura sem reassumir padrão |
| `POST /pricing-rules/preview` | Simula configuração sem gravar; usuário autenticado |
| `GET /products/{id}/cost` | Detalha custo e composição, restrito à empresa |
| `POST /sales/preview` | Simula itens/regra ou rascunho existente sem gravar |

Preview de regra:

```json
{"strategy_key":"margin_fees","parameters":{"margin":"20","fees":"15","fixed_cost":"0","rounding":"ending_90"},"base_cost":"100"}
```

A resposta contém `status`, `reason`, `base_cost`, `strategy_key`, `parameters`, `price_before_adjustment`, `suggested_price`, `adjustment` e `details` (política, taxas em valor e margem resultante). Valores monetários/percentuais são strings. Custo ausente retorna `status=unavailable` e preço nulo; configuração inválida retorna HTTP 422 com mensagem. Margem resultante é nula quando o preço final é zero.

Criação e alteração da configuração validam estratégia e parâmetros juntos. Alteração só de metadados em regra antiga continua permitida. Regras desconhecidas já persistidas permanecem consultáveis; cálculos indicam indisponibilidade. Nenhuma regra ou venda antiga é migrada silenciosamente. Trocar estratégia exige parâmetros compatíveis.

## Custos, unidades e embalagens

Cada componente custa `custo_compra × quantidade_consumida_convertida / quantidade_compra`. O produto soma os custos dos componentes sem arredondar cada parcela para centavos. Produto sem composição é indisponível; composição com materiais gratuitos tem custo zero válido.

O conversor reutiliza dimensão e fatores racionais das unidades: `quantidade × fator_origem / fator_destino`. Suporta kg/g, L/mL e m/cm/mm conforme catálogo, inclusive no sentido inverso. Dimensões diferentes são recusadas. Não houve mudança no modelo de unidades.

`MaterialPackage` representa uma quantidade do material, não uma despesa adicional de embalagem. Seu custo proporcional é calculado e exibido junto com quantidade/unidade, sem somar novamente o mesmo material. A composição continua expressa em quantidade/unidade, sem vínculo com uma embalagem específica. Se uma caixa/sacola tiver custo próprio, deve ser cadastrada como material e incluída na composição. Materiais arquivados já presentes continuam tendo custo calculável; as restrições existentes impedem adicioná-los novamente.

## Vendas e histórico

O custo de cada produto/material é calculado por unidade vendida. A regra é aplicada por unidade (inclusive custo adicional fixo e arredondamento) e o preço sugerido é multiplicado pela quantidade. Serviços mantêm o preço cadastrado; não possuem custo modelado. Vendas com algum custo ausente têm `cost_total=null`, sem apresentar um subtotal parcial como custo total. Sugestão total só existe quando todas as linhas têm sugestão disponível.

`final_total` continua manual e editável; não é sobrescrito pelo cálculo. A regra padrão não é selecionada automaticamente.

A venda captura regra/versão/parâmetros e, em `pricing_snapshot.calculation`, custos, quantidades, composição, dados de compra, embalagens e resultados. Esse JSON também é preenchido em novas vendas sem regra para preservar custos. A remoção de uma regra elimina a chave `rule`, mas mantém os detalhes de custos.

Editar descrição, data ou total preserva cálculos. Trocar a regra recalcula sobre custos capturados; reenviar o mesmo ID mantém a versão histórica. Substituir `lines` recaptura o catálogo atual, mantendo a regra histórica caso seu ID não tenha mudado. Concluir/cancelar não recalcula. Vendas antigas não recebem custos inventados.

Preview de venda aceita `pricing_rule_id`, `lines` e opcionalmente `sale_id`. Com `sale_id` e sem `lines`, usa custos históricos; com o mesmo ID de regra, usa sua versão histórica. Novos itens usam o catálogo atual. Todas as referências são verificadas na empresa autenticada.

## Verificação

`tests/test_pricing_engine.py` cobre estratégias, decimais, custo zero, validações, limites, conversões, arredondamentos, embalagens, previews, isolamento, snapshots e substituição de regra/itens. `test_pricing.py` mantém cobertura de versionamento, padrão, permissões e auditoria. Veja também [vendas](sales.md) e [frontend](../../front/doc/vendas-precificacao.md).

Resultado final em 21/09/2026: 154 testes da API aprovados, 1 PostgreSQL ignorado; 79 testes frontend e 32 E2E aprovados, 2 cenários Nginx ignorados. Ruff, ESLint, TypeScript e build aprovados no Windows. Sem validação remota ou deploy.
