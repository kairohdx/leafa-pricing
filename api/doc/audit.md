# Consultas de auditoria

O histórico é consultável por administradores da própria empresa. Operadores recebem 403 e requisições não autenticadas recebem 401. Alterações nos cadastros continuam registrando eventos internamente, na transação da operação.

| Método e rota | Operação |
| --- | --- |
| `GET /audit-events` | Listar eventos paginados e filtrados |
| `GET /audit-events/{id}` | Consultar evento da própria empresa |

Não há POST, PATCH ou DELETE público para eventos. Acesso ao ID de outra empresa retorna 404. O contrato retorna empresa, ator opcional, ação, entidade/ID, alterações, request ID e data UTC.

## Filtros

Parâmetros `page` e `page_size` (máximo 100), mais:

- `start` e `end`: datas com fuso, início inclusivo e fim exclusivo; início deve preceder fim.
- `actor_user_id`: UUID do usuário responsável.
- `entity_type` e `entity_id`: tipo e/ou UUID da entidade alterada.
- `action`: ação exata, como `create`, `update`, `archive` ou `status_change`.
- `request_id`: identificador exato de uma requisição, também retornado em `X-Request-ID`.

Filtros são combinados com AND e aplicados dentro da empresa autenticada. Um filtro com referência de outra empresa retorna lista vazia. Ordenação por `occurred_at` decrescente e ID; o total considera todos os filtros. Tipos/ações não são enums fechados, permitindo os eventos específicos dos módulos.

## Campos sensíveis

Ao atribuir `AuditEvent.changes` pelo ORM, o conteúdo é copiado e campos estruturados de senha, hash, token, authorization, secret e API key são substituídos por `[REDACTED]`, recursivamente em objetos e listas. A normalização reconhece variantes como `password_hash`, `accessToken` e `api-key`. Indicadores como `password_changed` permanecem disponíveis.

A mesma limpeza é aplicada na serialização de respostas, protegendo a leitura de eventos antigos sem reescrever o banco. Os serviços continuam responsáveis por selecionar os campos apropriados; esta limpeza não detecta segredos inseridos em texto livre nem sob nomes arbitrários. Não forneça credenciais em nomes, descrições ou parâmetros de negócio.

SQL direto e mutações internas de um JSON já atribuído não passam pelo validador ORM; use atribuição de um novo objeto e os serviços da aplicação. Auditoria é append-only pela API, não por trigger ou permissão do banco. Quem administra o banco pode modificar os dados. Não há expurgo, exportação ou alteração retroativa nesta entrega.

Manutenção do catálogo global de unidades não gera eventos empresariais, pois não pertence a uma empresa. Login/logout também não são eventos de negócio atualmente; a auditoria de segurança completa é uma extensão separada.

## Validação

`tests/test_audit.py` cobre consultas, filtros, limites de período, isolamento entre empresas, permissão administrativa, ausência de escrita HTTP e limpeza de credenciais na persistência/serialização. Os testes dos CRUDs existentes cobrem a auditoria e rollback das operações. Próximo módulo: indicadores e análises.
