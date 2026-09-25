# Dimensões e unidades

O catálogo é global, compartilhado por empresas, e não recebe `company_id`. Todos os usuários autenticados podem consultá-lo. Administradores de empresa não podem modificá-lo pela API.

| GET | Resultado |
| --- | --- |
| `/unit-dimensions` | Dimensões paginadas |
| `/unit-dimensions/{id}` | Dimensão por UUID |
| `/units` | Unidades paginadas, filtro opcional `dimension_id` |
| `/units/{id}` | Unidade por UUID |
| `/units/code/{code}` | Unidade por código, respeitando maiúsculas/minúsculas |

Listagens usam `page` e `page_size` (máximo 100), com ordenação por nome e ID. Não existem rotas HTTP de escrita. Registros ausentes retornam 404 e parâmetros inválidos retornam 422.

## Manutenção no servidor

Com ambiente virtual ativo e migrações aplicadas, execute de `api/` no Linux ou Windows:

```sh
python -m app.scripts.units_catalog seed
python -m app.scripts.units_catalog create --kind dimension --file dimension.json
python -m app.scripts.units_catalog create --kind unit --file unit.json
python -m app.scripts.units_catalog update --kind unit --id UUID --file patch.json
python -m app.scripts.units_catalog delete --kind unit --id UUID
```

`--kind dimension` também admite update/delete. Arquivos são JSON UTF-8 e seguem os schemas `UnitDimensionCreate/Update` ou `UnitOfMeasureCreate/Update`. Exemplo de dimensão: `{"code":"custom","name":"Dimensão customizada","storage_scale":6}`. Exemplo de unidade: `{"code":"custom-unit","name":"Unidade customizada","symbol":"cu","dimension_id":"UUID"}`. Os fatores têm padrão 1/1; para frações, informe inteiros positivos `factor_numerator` e `factor_denominator`.

Execute a manutenção com as escritas da aplicação pausadas e um único administrador operando. As verificações de uso na camada de aplicação não eliminam corrida com gravações concorrentes, especialmente para mudanças de fatores. Foreign keys continuam protegendo exclusões/referências no banco.

Cada comando é transacional. Dados inválidos, conflitos ou arquivo inacessível resultam em código de saída 1 e rollback. Sucesso imprime o registro JSON ou confirmação somente após commit. O acesso ao host e seu log operacional são o controle administrativo; não são criados eventos empresariais de auditoria para alterações globais, pois `AuditEvent` exige empresa.

## Proteções

- Dimensão com unidades vinculadas não pode alterar código/escala nem ser excluída. Nome pode ser corrigido.
- Unidade usada em compra de material, embalagem, composição ou linha de venda não pode alterar código, dimensão ou fatores nem ser excluída. Inclui referências arquivadas/históricas. Nome e símbolo podem ser corrigidos.
- Registros sem referências podem ser alterados/excluídos. Novas dimensões referenciadas devem existir, códigos são únicos e fatores/escala são validados.

## Seed inicial

Cinco dimensões: `count` (escala 0), `mass`, `length`, `area` e `volume` (escala 6). Unidades: `un`, `kg`, `g`, `m`, `cm`, `mm`, `m2`, `L` e `mL`. Bases respectivas: unidade, quilograma, metro, metro quadrado e litro. Grama, milímetro e mililitro usam 1/1000 da base; centímetro usa 1/100.

O seed não exige modo de demonstração: são dados do catálogo, sem contas. Pode ser repetido preservando IDs, nomes e símbolos existentes. Conflitos de escala, dimensão ou fatores interrompem a transação, em vez de modificar dados silenciosamente. Com `DEMO_MODE=true`, `app.scripts.start` executa o seed automaticamente depois das migrações, antes de servir a API. Fora do modo demo, execute explicitamente após a migração inicial.

O catálogo armazena e publica fatores. Os CRUDs de materiais e produtos validam compatibilidade de dimensões; o motor de precificação usa esses fatores para conversões e custos (veja [precificação](pricing.md)).

Atualização da integração com o frontend: a CLI passou a importar o registro completo dos models para funcionar também em processo novo, sem depender de imports prévios da aplicação/testes. Um teste de subprocesso valida migração, seed repetido e preservação dos IDs.

## Verificação

`tests/test_units.py` cobre consulta autenticada, paginação, filtro, catálogo compartilhado, inexistência de escrita pública, manutenção, proteção de registros referenciados, exclusão de registros livres e seed idempotente com rejeição de conflitos. Próximo CRUD: materiais e embalagens.
