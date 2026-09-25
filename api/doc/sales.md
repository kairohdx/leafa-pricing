# Vendas

Implementadas em `sales/router.py` e `sales/service.py`, usando as tabelas existentes, sem nova migração. O total final permanece manual; custos e sugestões são calculados pelo [motor de precificação](pricing.md).

| Método e rota | Operação | Permissão |
| --- | --- | --- |
| `POST /sales` | Criar rascunho com itens | Administrador ou operador |
| `GET /sales` | Listar vendas paginadas | Administrador ou operador |
| `GET /sales/{id}` | Detalhe com itens e snapshots | Administrador ou operador |
| `PATCH /sales/{id}` | Editar rascunho | Administrador ou operador |
| `POST /sales/{id}/complete` | Concluir rascunho | Administrador ou operador |
| `POST /sales/{id}/cancel` | Cancelar rascunho ou venda concluída | Administrador |

As permissões valem para todas as vendas da própria empresa, não apenas para as criadas pelo usuário. IDs de outra empresa retornam 404. Empresa, autor, moeda e snapshots são definidos no backend.

## Criação

```json
{
  "description":"Instalação de peça",
  "occurred_at":"2026-09-15T12:00:00-03:00",
  "final_total":"45.00",
  "lines":[{"kind":"service","service_id":"UUID_DO_SERVICO","quantity":"1"}]
}
```

`pricing_rule_id` é opcional e explícito: a regra padrão não é aplicada automaticamente. Rascunhos podem começar sem itens; conclusão exige pelo menos um. Cada item deve conter exatamente uma referência compatível com `kind`: `service`, `product` ou `material`. Registros novos precisam estar ativos e pertencer à empresa da venda.

Materiais aceitam unidades da mesma dimensão da unidade de compra; omitir a unidade usa a unidade de compra atual. Produtos e serviços aceitam unidade omitida ou unidade de dimensão `count` cujo fator seja 1. Quantidades são positivas; há conversão entre unidades compatíveis para custos; não há imposição de quantidade inteira.

## Histórico e valores

- Descrição do catálogo é copiada para `description_snapshot`.
- Serviço copia seu preço base para `unit_price_snapshot`, respeitando o limite de seis casas da coluna; preço acima da faixa retorna 422.
- Produtos/materiais recebem custos e sugestões quando calculáveis. Serviços usam seu preço cadastrado e não possuem custo modelado. Totais por linha representam sugestões, não distribuição do total final manual.
- `pricing_snapshot` preserva regra/versão/parâmetros quando selecionada, além de composição, custos e memória do cálculo em `calculation`, inclusive sem regra.
- `final_total` é o valor informado, não negativo, em decimal de duas casas. Não precisa coincidir com os preços cadastrados ou o total sugerido.
- Moeda é copiada da empresa na criação. Alterar empresa, catálogo ou regra depois não modifica a venda existente.

Nulos significam indisponibilidade; zero continua sendo um valor manual válido. Cálculo indisponível não impede uma venda com total manual. Consulte as fórmulas, limites e política de arredondamento em [precificação](pricing.md).

## Edição e transições

Somente `draft` permite PATCH de descrição, data, total, regra e itens. Campos omitidos são preservados. `pricing_rule_id=null` remove a referência e a chave `rule` do snapshot, preservando os custos; trocar o ID captura a configuração atual da nova regra e recalcula sobre os custos históricos. Reenviar o mesmo ID preserva o snapshot existente.

`lines` substitui toda a composição da venda dentro da transação. IDs dos itens são recriados e snapshots são capturados novamente; `lines=[]` remove todos os itens do rascunho. Omissão de `lines` preserva os itens e custos; a sugestão é recalculada somente se houver troca de regra. Não há edição isolada de item nesta API. Uma referência inválida desfaz toda a escrita.

Transições permitidas: `draft → completed`, `draft → cancelled`, `completed → cancelled`. Concluídas não podem ser editadas; canceladas não são reabertas. Repetir complete/cancel no mesmo estado retorna o registro sem duplicar auditoria. Não há exclusão física HTTP nem recálculo ao concluir. Catálogo arquivado após captura não invalida snapshots já existentes.

Escritas de vendas são serializadas por empresa, inclusive edição e status. Não há controle de versão otimista do formulário de venda nesta etapa; duas edições válidas de rascunho seguem a ordem em que forem processadas. Aplicação e eventos de auditoria compartilham a transação. Criação/edição registram snapshots completos antes/depois; status registra a transição.

## Listagem

`GET /sales` recebe `page`, `page_size` (máximo 100), `status`, `start` e `end`. Datas exigem fuso; filtro usa `occurred_at`, início inclusivo e fim exclusivo. Quando ambos existem, início deve preceder fim. Ordenação por data da venda decrescente e ID. A lista omite itens, disponíveis no detalhe.

## Preview e verificação

`POST /sales/preview` simula sem gravar. Recebe `pricing_rule_id`, `lines` e opcionalmente `sale_id`. Sem `lines`, usa custos históricos da venda indicada; ao manter a regra da venda, preserva sua versão histórica. Todas as referências exigem a mesma empresa.

`tests/test_sales.py` cobre permissões, estados, filtros, rollback e histórico. `tests/test_pricing_engine.py` acrescenta custos, previews, regra histórica, recálculo e isolamento. Não há recálculo retroativo nem alteração de infraestrutura nesta entrega.
