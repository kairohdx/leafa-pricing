# Paginação de listagens

As listagens do painel usam páginas numeradas. Os contratos compartilhados estão em `app/pagination.py`; o helper SQLAlchemy está em `app/db/pagination.py`.

## Contrato

Parâmetros de consulta: `page` começa em 1 (padrão 1, máximo 2147483647) e `page_size` aceita de 1 a 100 (padrão 20). Strings numéricas recebidas por HTTP são convertidas e validadas pelo Pydantic.

A resposta `Page[ServiceRead]`, ou `Page` parametrizada com outro schema de leitura, tem este formato:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20,
  "total_pages": 0,
  "has_next": false,
  "has_previous": false
}
```

`total` conta todos os registros que atendem aos filtros, antes do limite da página. Uma página além da última retorna uma lista vazia e preserva os metadados e o número solicitado. `has_previous` indica que há resultados e que o número solicitado é maior que 1; não garante que a página imediatamente anterior tenha itens quando o número solicitado excede muito o total. Sem resultados, o total de páginas é zero e ambos os indicadores são falsos.

## Uso no serviço

```python
from sqlalchemy import select
from app.db.pagination import paginate
from app.modules.services.models import Service
from app.modules.services.schemas import ServiceRead
from app.pagination import PaginationParams

def list_services(session, authorized_company_id, params: PaginationParams):
    statement = select(Service).where(
        Service.company_id == authorized_company_id,
        Service.archived_at.is_(None),
    )
    return paginate(
        session,
        statement,
        params,
        ServiceRead,
        order_by=(Service.name.asc(), Service.id.asc()),
    )
```

O futuro router deve receber `PaginationParams` dos query parameters e declarar `Page[ServiceRead]` como resposta. A empresa vem do contexto autenticado. O helper preserva os filtros recebidos tanto na contagem quanto na busca; ele não determina permissões nem acrescenta filtros por empresa ou arquivamento automaticamente.

São executadas duas consultas: `COUNT` e busca com `LIMIT/OFFSET`. A ordenação é obrigatória; inclua uma coluna única como `id` para desempatar. A ordenação e limites prévios do statement são substituídos pelos argumentos de paginação.

O statement deve selecionar uma entidade e produzir uma linha por registro. Para filtros em coleções, prefira `EXISTS`; para carregar coleções na resposta, use `selectinload`. Joins que multiplicam linhas produzem contagens duplicadas e não são suportados pelo helper.

## Limites e testes

Endpoints ainda não estão implementados; esta entrega fornece contratos e consulta reutilizável. Paginação por offset pode ficar mais lenta em páginas profundas e pode mudar de composição entre requisições com inserções/exclusões concorrentes. Contagem e itens não têm garantia de snapshot conjunto sem isolamento transacional apropriado.

Testes em `tests/test_pagination.py` cobrem limites, parâmetros HTTP, contagem filtrada por empresa, desempate, última página, página excedente, listagem vazia e serialização. Suíte completa: 40 testes aprovados em SQLite.
