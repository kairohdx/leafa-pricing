# Regras de precificação

CRUD em `pricing/router.py` e `pricing/service.py`, usando a tabela existente. Administradores escrevem; usuários autenticados consultam regras da própria empresa. Esta entrega cadastra configurações e não calcula preços.

| Método e rota | Operação |
| --- | --- |
| `POST /pricing-rules` | Criar regra, versão inicial 1 |
| `GET /pricing-rules` | Listar com paginação, busca por nome e `archived` |
| `GET /pricing-rules/{id}` | Consultar regra, inclusive arquivada |
| `PATCH /pricing-rules/{id}` | Editar campos ou definir/remover padrão |
| `POST /pricing-rules/{id}/archive` | Arquivar e remover indicação de padrão |
| `POST /pricing-rules/{id}/restore` | Restaurar sem definir como padrão |

Listagens recebem `page`, `page_size` (máximo 100), `search` e `archived=false` por padrão. `archived=true` lista somente arquivadas. Ordem estável por nome/ID. Acesso a IDs de outra empresa retorna 404; não há exclusão física pela API.

## Criação e edição

```json
{"name":"Minha regra","strategy_key":"future_strategy","parameters":{},"is_default":false}
```

Campos: nome, descrição opcional, identificador de estratégia, parâmetros JSON e indicação de padrão. O cliente não escolhe `version` na criação. JSON deve ser finito (sem NaN/Infinity); nenhuma expressão é executada.

PATCH requer `expected_version`, com a versão lida pelo cliente:

```json
{"expected_version":1,"parameters":{"configuracao":"exemplo"}}
```

Versão desatualizada retorna 409 para recarregar a regra. Campos omitidos são preservados, `description=null` limpa a descrição e `parameters` substitui o objeto inteiro. Cada mudança efetiva incrementa a versão, inclusive edição de nome, troca de padrão, arquivamento e restauração. PATCH sem alterações e archive/restore repetidos no mesmo estado não incrementam nem duplicam auditoria. Archive/restore são comandos de estado, sem `expected_version`; a verificação de versão aplica-se ao PATCH.

Versões anteriores não viram linhas separadas: alterações são auditadas e vendas devem preservar sua versão/snapshot. O CRUD não altera snapshots históricos. A consulta da regra retorna a configuração atual, não reconstrói versões passadas.

## Regra padrão

Enviar `is_default=true` na criação ou PATCH remove o padrão anterior da mesma empresa em transação. A regra anterior também recebe incremento de versão e auditoria. Enviar `is_default=false` remove o padrão sem eleger outro. Pode haver zero ou uma regra padrão ativa.

As escritas são serializadas por empresa usando um UPDATE sem alteração do timestamp da empresa; a constraint parcial existente continua garantindo unicidade. A liberação do padrão anterior é persistida antes de atribuir o novo, dentro da mesma transação. Não foi realizado teste de carga concorrente nesta entrega.

Arquivar remove o padrão. Restaurar não toma o lugar da regra padrão atual. Regras arquivadas não podem ser editadas até a restauração. Alterações e auditoria compartilham a transação.

## Limites das estratégias

Ainda não há estratégias de cálculo implementadas. `strategy_key` e `parameters` são configurações preparatórias: existência da regra não significa que ela possa calcular preços. A validação atual cobre formato e JSON finito; schemas e validações específicas de cada estratégia permanecem pendentes até as fórmulas serem implementadas pelo responsável pelo projeto. O futuro cálculo deverá rejeitar estratégias desconhecidas em vez de inventar resultados.

## Testes

`tests/test_pricing.py` cobre criação, edição, versão desatualizada, auditoria, troca/remoção de padrão, arquivamento/restauração, paginação, permissões e isolamento. Próximo módulo: vendas, preservando a pendência das fórmulas.
