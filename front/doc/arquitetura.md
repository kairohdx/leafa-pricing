# Arquitetura, interface e sessão

## Organização

- `src/api/client.ts`: chamadas JSON, Bearer, erros tipados e respostas sem conteúdo.
- `src/auth/`: contratos de identidade e ciclo de vida da sessão.
- `src/components/`: estrutura responsiva, feedback e limite de erros.
- `src/pages/`: login, visão geral e fluxos de empresa/perfil/usuários em `account/`.
- `src/pages/catalog/`: listagens, formulários, embalagens, composição, unidades e decimais exatos.
- `src/api/hooks.ts`: consultas por identidade/URL, cancelamento, ações de formulário e PATCH de diferenças.
- `src/App.tsx`: rotas públicas/protegidas e recuperação de falha de carregamento.
- `src/styles.css`: cores, tipografia, componentes e breakpoints.
- `src/test/`, testes próximos aos módulos e `e2e/`: testes dos fluxos.

React Router cuida da navegação e retorno à URL protegida após login. Lucide fornece ícones. Formulários usam estado React, validação nativa e erros de campo da API. Vitest/Testing Library cobrem comportamento; Playwright valida a integração real. npm e lockfile fixam versões. ESLint e TypeScript validam código; Vite gera `dist/`.

A interface aproveita a organização do DueFlow (sidebar, cabeçalho, cards e feedback), com identidade verde do Leafa. DM Sans/Manrope vêm do Google Fonts, com fallback local sans-serif. Menu móvel usa diálogo nativo, Escape e retorno de foco. Rotas movem foco ao conteúdo sem deslocar a rolagem.

## Sessão

`POST /auth/login` retorna Bearer e expiração. O token fica em memória e em `sessionStorage`, para recarga da mesma aba. Senhas, usuário e empresa não são persistidos. Se o armazenamento estiver bloqueado, a sessão fica apenas em memória.

Essa escolha acompanha o contrato Bearer existente. Não é cookie HttpOnly: scripts da mesma origem podem acessar o token. Cookie seguro exigiria suporte e proteção CSRF no backend; não faz parte desta entrega.

A aplicação consulta `/auth/me` e `/companies/me` antes de revelar o painel. Falhas transitórias oferecem nova tentativa; 401/403 eliminam a sessão. Um temporizador aplica a expiração e o retorno à aba revalida o acesso. Logout chama a API e limpa identidade/armazenamento após sucesso ou 401. Em falha de rede, informa o erro e permite repetir, sem afirmar revogação inexistente.

Requisições de restauração são canceladas ao desmontar; respostas antigas não substituem a identidade atual. Revalidação em segundo plano preserva formulários não salvos. O painel é desmontado ao perder sessão. `useResource` identifica consultas por empresa, usuário, URL e revisão, sem cache persistente; descarta respostas de consultas antigas. O cliente autenticado centraliza 401 e impede que respostas de outra sessão atualizem a conta atual. A autorização efetiva permanece na API.

## Rotas

| Rota | Acesso | Comportamento |
| --- | --- | --- |
| `/login` | Público | Login com email/senha |
| `/cadastro` | Público | Empresa e administrador inicial |
| `/` | Autenticado | Boas-vindas e atalhos, sem indicadores fictícios |
| `/empresa` | Autenticado | Consulta; edição administrativa |
| `/perfil` | Autenticado | Consulta e edição do próprio perfil |
| `/perfil/senha` | Autenticado | Troca com senha atual e revogação de sessões |
| `/perfil/sessoes` | Autenticado | Consulta paginada e revogação de sessões próprias |
| `/usuarios`, `/usuarios/novo`, `/usuarios/:id` | Administrador | Listagem, cadastro, edição e gestão de acesso |
| `/materiais`, `/servicos`, `/produtos` e seus detalhes | Autenticado | Listagens com filtros, paginação e consulta |
| Rotas `/novo` do catálogo e ações de edição/arquivamento | Administrador | Gravação conforme estado do registro |
| `/materiais/:id/embalagens/nova`, `/materiais/:id/embalagens/:packageId` | Conforme operação | Cadastro administrativo e detalhe de embalagem |
| `/precificacao`, `/precificacao/:id` | Autenticado | Consulta; edição e arquivo administrativos, com versão |
| `/precificacao/nova` | Administrador | Cadastro de regra e parâmetros JSON |
| `/vendas`, `/vendas/nova`, `/vendas/:id` | Autenticado | Consulta, criação/edição de rascunho e conclusão; cancelamento administrativo |
| `/indicadores` | Autenticado | Resumo e série diária por período e moeda |
| `/auditoria`, `/auditoria/:id` | Administrador | Eventos com filtros, paginação e detalhe somente de leitura |
| Outras | Autenticado | Página não encontrada |

Operadores não veem entradas administrativas de usuários/auditoria. Rotas de usuários têm guarda administrativa antes de montar consultas/formulários. O catálogo permite consulta aos operadores e restringe formulários/ações a administradores, respeitando o arquivamento do registro e de seus pais.

Paginação, filtros, erros de campo, confirmações e operações de gravação foram integrados aos fluxos de conta e catálogo. Decimais usam strings e validação por BigInt, sem arredondamento binário. O catálogo carrega todas as páginas de unidades e filtra compatibilidade por dimensão. Não há cálculo de precificação no navegador. Veja [Fluxos de conta](contas.md) e [Catálogo](catalogo.md).
