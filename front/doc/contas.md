# Empresa, perfil, usuários e sessões

Segunda entrega do frontend, em 16/09/2026. Os fluxos usam a API existente; não exigem nova migração nem alteração de contratos do backend.

## Cadastro e empresa

`/cadastro` envia empresa e administrador inicial para `POST /companies`. Após sucesso, abre o login com email preenchido e mensagem de confirmação; a senha não é persistida. O formulário inclui moeda/fuso e confirmação de senha. Conflitos de identificador/email e erros de campo mantêm os dados para correção.

`/empresa` permite consulta a todos os usuários autenticados e edição somente a administradores. O PATCH envia apenas campos alterados. Cabeçalho e menu recebem o nome atualizado. O formulário explica que alterar moeda não converte vendas antigas e que o fuso afeta os períodos da empresa. Não há ativação de empresas pelo painel.

## Perfil e senha

`/perfil` permite editar nome, username, email e telefone. Não permite mudar empresa, papel ou ativação. Sucesso atualiza a identidade do cabeçalho sem desmontar a página.

`/perfil/senha` pede senha atual, nova senha e confirmação. Senha atual incorreta mantém a sessão e informa o erro. Sucesso encerra o acesso local após a API revogar todas as sessões, conduzindo ao login.

Ao retornar à aba, a revalidação ocorre em segundo plano e preserva formulários não salvos. Respostas de consulta iniciadas antes de uma gravação não sobrescrevem a identidade atualizada. Expiração/revogação continuam desmontando as telas privadas.

## Sessões

`/perfil/sessoes` lista sessões próprias em páginas de dez, com criação, expiração, revogação, identificador e estado. Datas usam o fuso da empresa. Sessões expiradas/revogadas não oferecem ação de revogação.

A API não informa qual ID representa a sessão atual. A tela não inventa essa identificação: explica que a ação pode encerrar esta aba. Após DELETE, consulta `/auth/me`; um 401 elimina a sessão e abre o login. Revogação exige confirmação em diálogo, com cancelamento disponível antes do envio.

## Administração de usuários

`/usuarios` oferece busca por nome/username/email e filtro ativo/inativo. Filtros e página ficam na URL; aplicar filtros volta à página 1. Listagem e página usam a resposta paginada da API, sem carregar toda a base no navegador. Formulários/detalhes preservam os filtros no link de retorno.

`/usuarios/novo` cadastra usuário com senha inicial e papel. `/usuarios/:id` consulta/edita dados, muda papel/ativação e redefine senha. Operadores não veem essas entradas e não disparam consultas administrativas ao abrir as URLs diretamente. A autorização e o isolamento efetivos continuam na API; usuário de outra empresa retorna 404.

Mudanças de papel/ativação e redefinição de senha têm confirmação explícita e informam a revogação de sessões. Reativar exige novo login. Na própria conta, o administrador não pode mudar o próprio papel/desativar-se; troca de senha usa o fluxo pessoal com senha atual.

## Padrões e validação

- Campos reutilizáveis com rótulos, ajuda e erros associados via `aria-describedby`.
- Bloqueio de envio duplicado, feedback de sucesso e preservação dos dados após falha.
- PATCH apenas de campos alterados, evitando reenviar informações de acesso sem necessidade.
- Consultas identificadas por empresa, usuário, URL e revisão, sem cache persistente. Respostas de filtros antigos são descartadas e requisições desmontadas são canceladas.
- Cliente autenticado centraliza Bearer e tratamento de 401; respostas pertencentes a uma sessão anterior não atualizam a nova conta.
- Vitest cobre conflitos, campos inválidos, permissões, preservação de rascunhos, expiração e respostas atrasadas. Playwright usa API real em desktop/viewport móvel para cadastro, edição, acesso, paginação, revogação e isolamento.

Materiais, embalagens, serviços e produtos foram entregues na etapa seguinte; veja [Catálogo](catalogo.md). Convites por email, recuperação de senha por email e verificação de email não existem na API atual e não foram simulados.
