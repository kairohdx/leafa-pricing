# Produtos e composição

Implementados em `products/router.py` e `products/service.py`, sem nova migração. Administradores da empresa escrevem; usuários autenticados consultam.

| Método e rota | Operação |
| --- | --- |
| `POST /products` | Criar produto; retorna 201 com composição vazia |
| `GET /products` | Resumos paginados com busca e filtro de arquivamento |
| `GET /products/{id}` | Detalhe com composição carregada por `selectinload` |
| `PATCH /products/{id}` | Editar nome, SKU e descrição |
| `POST /products/{id}/archive` | Arquivar produto |
| `POST /products/{id}/restore` | Restaurar produto |
| `GET /products/{id}/materials` | Composição completa, sem paginação |
| `POST /products/{id}/materials` | Adicionar material; retorna 201 e o componente |
| `PATCH /products/{id}/materials/{component_id}` | Editar quantidade e unidade |
| `DELETE /products/{id}/materials/{component_id}` | Remover componente; retorna 204 |

Listagem recebe `page`, `page_size` (máximo 100), `search` por nome/SKU e `archived` (padrão false). Ordena por nome e ID; busca trata `%` e `_` literalmente. Retorna `Page[ProductSummary]`, sem composição; detalhe retorna `ProductRead`. `archived=true` lista somente arquivados.

## Exemplos

Produto:

```json
{"name":"Peça A","sku":"PA","description":"Peça de resina"}
```

Componente enviado à rota do produto:

```json
{"material_id":"UUID_DO_MATERIAL","quantity":"120","unit_code":"g"}
```

SKU é opcional e único por empresa quando preenchido, inclusive em produtos arquivados. Descrição e SKU podem ser limpos com nulo; campos omitidos no PATCH são preservados. IDs e empresa vêm da rota/sessão, não do corpo de criação.

## Composição e histórico

O produto e o material precisam estar ativos e pertencer à mesma empresa para adicionar/editar um componente. Quantidade deve ser positiva e a unidade deve existir e ter a mesma dimensão da unidade de compra do material. Não há conversão automática, cálculo de custos ou arredondamento nesta etapa.

Um material aparece no máximo uma vez na composição. Duplicação retorna 409 com rollback. `material_id` não é editável: para substituir material, remova o componente e adicione outro. `component_id` é o ID de `ProductMaterial`, não o ID do material. Todas as operações validam também que o componente pertence ao produto informado.

Produto arquivado continua consultável, mas bloqueia edição e mudanças na composição. Arquivamento não remove componentes e restauração os preserva. Um componente cujo material foi arquivado ainda pode ser removido de um produto ativo, permitindo corrigir a composição, mas não pode ser editado nem adicionado novamente até restaurar o material.

Não há exclusão física do produto pela API. Remoção de componente afeta apenas a composição atual; não modifica snapshots de vendas. Mudanças efetivas na composição atualizam `updated_at` do produto.

Cadastro, edição, arquivamento e mudanças de composição registram auditoria na mesma transação. Quantidades são strings decimais na auditoria. PATCH sem mudança e repetição de archive/restore não duplicam eventos. Repetir remoção de componente já removido retorna 404.

## Verificação

`tests/test_products.py` cobre cadastro, SKU, detalhe/composição, listagem resumida, paginação, inclusão/edição/remoção, material duplicado, unidades incompatíveis, isolamento por empresa e produto, arquivamento e permissões. Próximo módulo: regras de precificação; fórmulas permanecem uma entrega separada.
