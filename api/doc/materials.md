# Materiais e embalagens

Implementação em `materials/router.py` e `materials/service.py`, com as tabelas existentes. Usuários autenticados consultam; administradores da empresa criam, editam, arquivam e restauram.

| Método e rota | Operação |
| --- | --- |
| `POST /materials` | Criar material |
| `GET /materials` | Listar com paginação, `search` por nome/SKU e `archived` |
| `GET /materials/{id}` | Consultar material, inclusive arquivado |
| `PATCH /materials/{id}` | Editar material ativo |
| `POST /materials/{id}/archive` | Arquivar |
| `POST /materials/{id}/restore` | Restaurar |
| `GET /materials/{id}/packages` | Listar embalagens do material, com paginação e `archived` |
| `POST /material-packages` | Criar embalagem, informando `material_id` |
| `GET /material-packages/{id}` | Consultar embalagem |
| `PATCH /material-packages/{id}` | Editar nome, quantidade e unidade |
| `POST /material-packages/{id}/archive` | Arquivar embalagem |
| `POST /material-packages/{id}/restore` | Restaurar embalagem |

Listagens usam `page`, `page_size` (máximo 100), ordenação por nome/ID e `archived=false` por padrão. `archived=true` lista somente arquivados. A contagem respeita todos os filtros e a empresa autenticada. A busca trata `%` e `_` como caracteres literais. Não há exclusão física via API.

## Exemplos

Material:

```json
{"name":"Resina","sku":"RES","purchase_unit_code":"kg","purchase_quantity":"1","purchase_cost":"70.00"}
```

Embalagem:

```json
{"material_id":"UUID_DO_MATERIAL","name":"Pacote 500 g","quantity":"500","unit_code":"g"}
```

Quantidades e valores são strings decimais. A unidade deve existir no catálogo global; execute seu seed antes de usar unidades iniciais. Quantidades devem ser positivas e custos não negativos. SKU é opcional, mas único por empresa quando preenchido, inclusive em materiais arquivados. Nome da embalagem é único por material e empresa, inclusive após arquivamento. Conflitos retornam 409 com rollback.

PATCH preserva campos omitidos. `notes` e `sku` aceitam nulo explícito; campos obrigatórios não. Embalagem não pode ser transferida para outro material; `material_id` não é aceito em sua atualização.

## Unidades e histórico

Embalagens exigem a mesma dimensão da unidade de compra do material. Um material existente pode trocar sua unidade de compra somente dentro da mesma dimensão; não se transforma massa em comprimento. Ao trocar kg por g, informe a quantidade correspondente explicitamente: este CRUD não calcula conversões nem custos automaticamente. Fatores, escala por dimensão e arredondamento continuam reservados ao conversor futuro.

Arquivamento não apaga registros nem modifica snapshots. Um material arquivado pode ser consultado, mas não editado nem receber novas embalagens. Suas embalagens não são arquivadas em cascata: conservam seu próprio estado, porém edição/restauração fica bloqueada enquanto o material pai estiver arquivado. Listagens de embalagens continuam disponíveis para consulta histórica. Restaurar o material não restaura embalagens arquivadas explicitamente.

Arquivar/restaurar no mesmo estado é idempotente e não duplica auditoria. Cada alteração efetiva cria evento na mesma transação, com ator, empresa, request ID e campos explícitos. Decimais são registrados como strings. Referências de outra empresa retornam 404 em leituras, atualizações, arquivamento e criação de embalagens.

## Verificação

Testes em `tests/test_materials.py`: CRUD, paginação/busca, precisão decimal, SKU/nome duplicados, auditoria, isolamento, permissões, compatibilidade dimensional, material pai arquivado e idempotência. Nenhuma migração adicional foi necessária. Próximo módulo: serviços.
