# Vendas

Implementadas em `sales/router.py` e `sales/service.py`, usando as tabelas existentes, sem nova migração. Esta entrega usa total final manual, sem simular cálculos de precificação.

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

Materiais aceitam unidades da mesma dimensão da unidade de compra; omitir a unidade usa a unidade de compra atual. Produtos e serviços aceitam unidade omitida ou unidade de dimensão `count` cujo fator seja 1. Quantidades são positivas; não há conversão automática ou imposição de quantidade inteira nesta etapa.

## Histórico e valores

- Descrição do catálogo é copiada para `description_snapshot`.
- Serviço copia seu preço base para `unit_price_snapshot`, respeitando o limite de seis casas da coluna; preço acima da faixa retorna 422.
- Preços de produto/material, custos unitários, totais por linha, custo total e total sugerido ficam nulos: ainda não foram calculados.
- Quando informada, a regra preserva ID, nome, versão, estratégia e parâmetros em `pricing_snapshot`, com `calculation_status=unavailable`.
- `final_total` é o valor informado, não negativo, em decimal de duas casas. Não precisa coincidir com preços cadastrados ou uma soma ainda não calculada.
- Moeda é copiada da empresa na criação. Alterar empresa, catálogo ou regra depois não modifica a venda existente.

Nulos significam indisponibilidade; zero continua sendo um valor manual válido. A regra cadastrada não executa fórmula e não impede uma venda com total manual. Integração com as estratégias permanece pendente.

## Edição e transições

Somente `draft` permite PATCH de descrição, data, total, regra e itens. Campos omitidos são preservados. `pricing_rule_id=null` remove a referência e seu snapshot; trocar o ID captura a configuração atual da nova regra. Reenviar o mesmo ID preserva o snapshot existente.

`lines` substitui toda a composição da venda dentro da transação. IDs dos itens são recriados e snapshots são capturados novamente; `lines=[]` remove todos os itens do rascunho. Omissão de `lines` preserva os itens e snapshots. Não há edição isolada de item nesta API. Uma referência inválida desfaz toda a escrita.

Transições permitidas: `draft → completed`, `draft → cancelled`, `completed → cancelled`. Concluídas não podem ser editadas; canceladas não são reabertas. Repetir complete/cancel no mesmo estado retorna o registro sem duplicar auditoria. Não há exclusão física HTTP nem recálculo ao concluir. Catálogo arquivado após captura não invalida snapshots já existentes.

Escritas de vendas são serializadas por empresa, inclusive edição e status. Não há controle de versão otimista do formulário de venda nesta etapa; duas edições válidas de rascunho seguem a ordem em que forem processadas. Aplicação e eventos de auditoria compartilham a transação. Criação/edição registram snapshots completos antes/depois; status registra a transição.

## Listagem

`GET /sales` recebe `page`, `page_size` (máximo 100), `status`, `start` e `end`. Datas exigem fuso; filtro usa `occurred_at`, início inclusivo e fim exclusivo. Quando ambos existem, início deve preceder fim. Ordenação por data da venda decrescente e ID. A lista omite itens, disponíveis no detalhe.

## Verificação e pendências

`tests/test_sales.py` cobre snapshots preservados, totais manuais/nulos, alteração do catálogo, transições, substituição de itens, rollback, unidades incompatíveis, material arquivado, referências de outra empresa, permissões, filtros e remoção da regra. Suíte: 93 aprovados, 1 PostgreSQL ignorado localmente; lint aprovado.

Fórmulas, custos derivados, conversão de unidades, validação específica de estratégia e E2E permanecem pendentes. Próxima etapa: consultas de auditoria.
