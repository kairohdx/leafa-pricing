# Empresas — primeiro CRUD

Implementado em `modules/companies/router.py` (HTTP) e `service.py` (casos de uso). Não requer nova migração: usa as tabelas existentes.

| Operação | Rota | Acesso |
| --- | --- | --- |
| Cadastrar empresa e administrador | `POST /companies` | Público, cadastro inicial |
| Consultar própria empresa | `GET /companies/me` | Administrador ou operador autenticado |
| Editar própria empresa | `PATCH /companies/me` | Administrador da empresa |

Cadastro retorna 201 e a empresa criada. Depois, faça login em `/auth/login` com o email e senha informados. Exemplo do corpo de cadastro:

```json
{
  "company": {"name": "Minha Empresa", "slug": "minha-empresa"},
  "admin": {
    "username": "admin",
    "name": "Administrador",
    "email": "admin@example.com",
    "password": "uma-senha-de-exemplo"
  }
}
```

O papel do primeiro usuário é sempre `admin` e ambos os registros começam ativos. O cliente não pode fornecer IDs, papel, hash ou ativação. Slug único e email globalmente único são garantidos pelo banco. Conflitos retornam 409 e desfazem a transação inteira, inclusive empresa, usuário e auditoria.

O PATCH aceita nome, slug, moeda e fuso. Campos omitidos são preservados; nulos em campos obrigatórios e propriedades desconhecidas são rejeitados. Atualização sem mudança não cria evento. Moeda afeta a configuração da empresa: não converte valores nem altera snapshots de vendas existentes.

Todas as consultas de painel usam `/me`, derivando a empresa da sessão. Não há listagem global paginada, acesso por ID arbitrário ou exclusão de empresa no painel. Operador não edita. Cadastro e alterações registram auditoria na mesma transação, com request ID e campos explícitos, sem senhas/hashes.

## Ativação e desativação

A ativação pertence à administração da plataforma, por acesso ao servidor e banco, não ao papel `admin` de uma empresa. Uma empresa desativada não consegue autenticar para reativar a si própria.

Com ambiente virtual ativo, a partir de `api/`, em Linux ou Windows:

```sh
python -m app.scripts.company_status UUID_DA_EMPRESA deactivate
python -m app.scripts.company_status UUID_DA_EMPRESA activate
```

O comando registra evento com `actor_user_id=null` e `source=host_cli`; a identidade humana de quem tem acesso ao host deve ser controlada na operação da infraestrutura. Desativação revoga sessões existentes. Reativação exige novo login; tokens anteriores continuam revogados. Repetir o mesmo estado não duplica auditoria. Não há rota pública de ativação ou exclusão física.

## Testes

`tests/test_companies.py` verifica cadastro/login, consulta, edição, isolamento, permissão de operador, rejeição de campos internos, rollback de conflitos de slug/email, auditoria sem segredos, atualização vazia, desativação e reativação.

O cadastro público não implementa verificação de email, convite, cobrança ou proteção contra abuso. Esses fluxos não fazem parte deste CRUD inicial. O próximo módulo é usuários, conforme o checklist da raiz.
