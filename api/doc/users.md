# Usuários e sessões

Implementados em `identity/users_router.py` e `identity/users_service.py`, usando as tabelas existentes, sem nova migração.

| Método e rota | Acesso | Operação |
| --- | --- | --- |
| `POST /users` | Administrador | Criar usuário na empresa autenticada |
| `GET /users` | Administrador | Listar usuários da empresa |
| `GET /users/{id}` | Administrador | Consultar usuário da empresa |
| `PATCH /users/{id}` | Administrador | Editar dados, papel, ativação ou redefinir senha |
| `GET /users/me` | Autenticado | Consultar próprio perfil |
| `PATCH /users/me` | Autenticado | Editar username, nome, email e telefone próprios |
| `POST /users/me/password` | Autenticado | Trocar senha confirmando a atual |
| `GET /users/me/sessions` | Autenticado | Listar próprias sessões, inclusive expiradas/revogadas |
| `DELETE /users/me/sessions/{id}` | Autenticado | Revogar sessão própria |

`GET /auth/me` continua disponível. Não há exclusão física de usuário: use `is_active=false` na atualização administrativa para preservar referências e histórico.

## Cadastro e edição

O cadastro recebe `username`, `name`, `email`, `phone` opcional, `password` e `role` opcional (padrão `operator`). A empresa vem da sessão, o usuário inicia ativo e a senha é armazenada como hash Argon2. Retorna 201, sem senha/hash.

PATCH aplica somente campos enviados. Email é único globalmente e username por empresa; conflitos retornam 409 com rollback dos dados e auditoria. IDs de outra empresa retornam 404, tanto na leitura quanto na escrita. Operadores gerenciam apenas seu perfil, não o cadastro de terceiros.

Um administrador não pode alterar o próprio papel ou desativar a própria conta: essas operações retornam 409 e precisam ser realizadas por outro administrador. A administração do servidor continua responsável por recuperação operacional de contas. O perfil próprio não aceita papel, ativação, empresa nem senha no PATCH; campos desconhecidos retornam 422.

## Listagens

`GET /users` recebe `page`, `page_size` (máximo 100), `search` opcional (nome, username ou email) e `active` opcional. Ordenação estável por nome e ID. A busca trata `%` e `_` como caracteres literais. A contagem usa os mesmos filtros por empresa e busca.

Sessões usam os mesmos parâmetros de paginação, ordenadas por criação decrescente e ID. O retorno omite `token_hash`. Uma sessão de outro usuário retorna 404 mesmo que seja da mesma empresa.

## Senhas e sessões

Troca própria recebe `current_password` e `new_password`. Senha atual incorreta retorna 403; sucesso retorna 204 e revoga todas as sessões, inclusive a atual. É necessário novo login.

Administrador pode redefinir a senha de um usuário pelo PATCH administrativo. Redefinição, mudança de papel ou ativação revogam todas as sessões desse usuário. Reativação não recupera tokens antigos. Revogar a sessão atual pelo DELETE também encerra seu acesso; revogação de sessão já revogada não duplica evento, desde que a requisição use outra sessão válida.

Gravações e auditoria compartilham a transação. Eventos registram campos alterados, IDs e indicador de mudança de senha, nunca senha, hash ou token. Atualização sem mudança não gera evento.

## Validação

`tests/test_users.py` cobre cadastro, paginação/busca, isolamento, perfil, permissões, conflitos com rollback, troca/redefinição de senha, ativação e propriedade das sessões. Suíte completa: 69 aprovados, 1 PostgreSQL ignorado localmente; Ruff aprovado. Validação E2E permanece para a etapa do produto.
