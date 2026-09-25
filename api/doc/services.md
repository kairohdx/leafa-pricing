# Serviços

CRUD implementado em `services/router.py` e `services/service.py`, usando a tabela existente, sem nova migração. Administradores da empresa escrevem; todos os seus usuários autenticados consultam.

| Método e rota | Operação |
| --- | --- |
| `POST /services` | Criar serviço; retorna 201 |
| `GET /services` | Listar com paginação, busca e filtro de arquivamento |
| `GET /services/{id}` | Consultar serviço, inclusive arquivado |
| `PATCH /services/{id}` | Editar nome, descrição e preço base |
| `POST /services/{id}/archive` | Arquivar |
| `POST /services/{id}/restore` | Restaurar |

Exemplo de criação:

```json
{"name":"Instalação","description":"Instalação no local","base_price":"50.00"}
```

`base_price` é não negativo, com até duas casas decimais, enviado e retornado como string decimal. Floats e valores com precisão excessiva são rejeitados. O cadastro não executa fórmulas de precificação. Nomes iguais são permitidos, conforme o model existente.

Listagem recebe `page`, `page_size` (até 100), `search` por nome e `archived` (padrão false). `archived=true` lista somente arquivados. Ordenação por nome/ID, busca literal para `%` e `_` e total calculado dentro da empresa autenticada.

PATCH preserva campos omitidos; `description=null` limpa a descrição. Nome/preço não aceitam nulo e campos internos não são aceitos. Serviço arquivado precisa ser restaurado antes de editar. Arquivar/restaurar no mesmo estado e PATCH sem mudanças são idempotentes, sem eventos duplicados.

Cada alteração efetiva e seu evento de auditoria são persistidos na mesma transação, com ator e request ID. Preços na auditoria são strings. Alterações não recalculam vendas nem modificam snapshots existentes. Não há exclusão física HTTP; referências e histórico são preservados por arquivamento.

Todos os acessos por ID restringem pela empresa da sessão, retornando 404 para registros de outra empresa. Operadores recebem 403 em escritas e acesso sem autenticação recebe 401.

Testes em `tests/test_services.py` cobrem CRUD, auditoria, precisão de preço, busca/paginação estável com nomes repetidos, arquivamento, idempotência, isolamento e permissões. Próximo CRUD: produtos e composição.
