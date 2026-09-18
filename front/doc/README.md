# Frontend — Leafa Pricing

[Voltar ao projeto](../../README.md) · [Arquitetura e sessão](arquitetura.md) · [Empresa, perfil e usuários](contas.md) · [Catálogo](catalogo.md) · [Vendas e precificação](vendas-precificacao.md) · [Indicadores e auditoria](indicadores-auditoria.md) · [Execução e deploy](deploy.md)

Painel React + Vite + TypeScript, com prioridade para celular. Inclui login, cadastro público de empresa, edição de empresa/perfil, senha/sessões, administração de usuários e catálogo de materiais/embalagens, serviços e produtos com composição. Catálogos possuem busca, paginação, arquivamento/restauração e permissões.

Inclui também regras de precificação com controle de versão e vendas com total manual, itens, snapshots, conclusão e cancelamento. Indicadores apresentam resumo e série diária por período/moeda; auditoria administrativa oferece filtros e detalhe do histórico. O painel inicial apresenta atalhos. Fórmulas, conversões automáticas e custos calculados não estão disponíveis.

## Executar

Pré-requisitos: Python 3.13, Node.js 22.12+ da linha 22 e npm. Dependências exatas estão no lockfile. Veja também o [requisito oficial do Vite](https://vite.dev/guide/).

Na raiz, em Windows ou Linux:

```sh
python manage.py setup
python manage.py local
```

Frontend: http://127.0.0.1:5173. API: http://127.0.0.1:8000. Ctrl+C encerra ambos. Use `--port` e `--front-port` para alterar as portas. O frontend usa proxy local `/api`, configurado pelo launcher.

Sem conta existente, use “Criar minha empresa” na tela de login (`/cadastro`) ou o [seed explícito](../../doc/execucao-local.md). Para ingressar em uma empresa existente, peça ao administrador que cadastre seu usuário. Nenhuma conta/senha é criada automaticamente.

Antes de cadastrar materiais, prepare explicitamente as unidades padrão com o [guia do catálogo](catalogo.md). O frontend informa quando não há unidades e não simula opções de seleção.

Para terminais separados:

```sh
python manage.py local --api-only
# Em outro terminal:
cd front
npm ci
npm run dev
```

No Windows PowerShell com bloqueio de scripts, use `npm.cmd` e `npx.cmd`. Consulte `front/.env.example` para outra URL de API.

## Verificação

Na pasta `front/`:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

O E2E prepara migrações/unidades e inicia frontend/API nas portas 5179/8019 com SQLite temporário separado. Testa contas, catálogo, regras e vendas com operações reais, paginação, permissões, decimais, arquivamento, snapshots e isolamento entre empresas. Requer dependências Python instaladas e Chromium do Playwright. `e2e/start_server.py` exige ambiente de teste e URL explícita de banco descartável.

Validação da terceira entrega: 42 testes de frontend (componentes e decimais), 16 cenários E2E (Chromium desktop e viewport móvel), 18 testes da API relacionados ao catálogo, lint e build aprovados no Windows. Os 4 testes do launcher foram validados na primeira entrega; o launcher de produção não mudou nesta etapa. Emulação móvel não representa validação em Safari/iPhone físico. Linux e CI remoto pendentes.

No ambiente restrito do agente, o Playwright precisou de permissão para encerrar processos no Windows; a repetição fora do sandbox concluiu com sucesso.

Quarta entrega (regras e vendas): 61 testes de frontend, 24 cenários E2E com API real em desktop/móvel, lint e build aprovados no Windows. Inclui regressão dos módulos anteriores. Backend sem alterações nesta etapa. Linux, CI remoto e publicação permanecem pendentes. Veja [fluxos e limites de vendas/precificação](vendas-precificacao.md).

Quinta entrega (indicadores e auditoria): 68 testes de frontend, 30 cenários E2E com API real em desktop/móvel, lint e build aprovados no Windows, incluindo regressão dos módulos anteriores. Revisão visual das telas móveis. Backend sem alterações. Veja [fluxos e limites de indicadores/auditoria](indicadores-auditoria.md). Próxima etapa: infraestrutura e validação de publicação, sem afirmar execução remota/Linux.

Sexta entrega (infraestrutura preparada): Dockerfile/Nginx, Compose de três serviços, Static Site no Blueprint e CD opcional após a API. Validados 75 testes frontend, 7 testes simulados do deploy, lint, builds padrão/hospedado e sintaxe YAML. Na regressão completa E2E, 29 cenários passaram, um timeout de login móvel não se reproduziu na repetição dos 8 cenários de catálogo; 2 testes exclusivos de Nginx foram ignorados. Docker ausente localmente: containers, CI remoto/Linux, CORS hospedado e publicação real continuam pendentes. [Configuração, diagnóstico e rollback](deploy.md).
