# Regras de precificação e vendas

[Frontend](README.md) · [Contrato de regras](../../api/doc/pricing.md) · [Contrato de vendas](../../api/doc/sales.md)

## Regras

`/precificacao` lista regras com busca, paginação e filtro de arquivamento. Administradores cadastram em `/precificacao/nova` e editam em `/precificacao/:id`; operadores consultam. Arquivar/restaurar exige confirmação. Arquivar remove o padrão e restaurar não o reaplica. Definir uma regra como padrão desmarca a anterior na API.

O formulário aceita nome, descrição, identificador livre de estratégia, objeto JSON de parâmetros e definição de padrão. Não há estratégias executáveis ou cálculo de preço nesta etapa. JSON deve ser um objeto; números não finitos e inteiros fora da faixa segura do JavaScript são recusados. Para valores decimais exatos, use strings, por exemplo `{"margem":"0.30"}`. Alterar os parâmetros substitui o objeto inteiro.

Atualizações enviam `expected_version`. Em conflito 409, o formulário preserva a edição e bloqueia novo envio. A ação “Recarregar regra” pede confirmação para descartar a edição e consultar a versão atual. O usuário pode copiar o texto antes de recarregar; não há mesclagem automática nem repetição silenciosa com uma versão mais nova.

## Vendas

`/vendas` oferece paginação e filtros de status/período. `/vendas/nova` cria rascunho e `/vendas/:id` consulta o histórico. Administradores e operadores criam/editam rascunhos e concluem vendas. Somente administradores cancelam. A conclusão exige ao menos um item; o total manual aceita zero. Vendas concluídas só podem ser canceladas; canceladas não podem ser reabertas. Não há exclusão.

O formulário inclui descrição, instante com fuso explícito, total manual e seleção opcional de regra. A regra padrão nunca é aplicada automaticamente. Seletores de regras e itens consultam apenas registros ativos, com busca e paginação. Materiais usam unidades da mesma dimensão, sem conversão. Produtos e serviços novos omitem unidade, conforme permitido pela API. Quantidades e dinheiro permanecem strings e passam pela validação exata do catálogo.

Nesta versão, a entrada de datas é textual no formato ISO com deslocamento obrigatório (`2026-09-16T14:30:00-03:00`) ou UTC (`2026-09-16T17:30:00Z`). O rascunho começa no instante atual em UTC. As datas exibidas no detalhe/listagem usam o fuso IANA da empresa; o fuso do navegador não é assumido. O período tem início inclusivo e fim exclusivo. Um seletor de calendário com tratamento de horário de verão pode substituir essa entrada futuramente.

Editar apenas descrição/data/total/regra omite `lines` e preserva os itens históricos. Mudanças efetivas de itens enviam a lista completa, inclusive `[]` para remover todos, e a API recaptura nomes/preços e recria IDs. Mudar somente a formatação de uma quantidade equivalente não substitui os itens. O formulário avisa sobre a recaptura; referências arquivadas precisam ser removidas/restauradas para substituir a lista. Erros preservam a edição. O total não é recalculado.

O detalhe usa nomes, preços unitários, regra/versão/parâmetros e moeda persistidos na venda. Nenhum valor histórico é reconstruído pelo catálogo atual. Custos, totais de itens e sugestões nulos aparecem como “Indisponível”; zero é exibido como valor monetário. Trocar a moeda da empresa não altera a moeda de vendas anteriores. Selecionar novamente o mesmo ID de regra mantém seu snapshot antigo; remover a regra envia `null`.

Vendas ainda não têm controle de versão otimista. Edições concorrentes usam a última gravação recebida para os campos enviados. O formulário informa essa limitação. Conclusão/cancelamento exigem confirmação e retornam o estado persistido pela API.

## Validação

Testes de validação cobrem JSON, datas com fuso, formato dos itens e quantidades equivalentes. Os cenários Playwright com API real cobrem conflitos de regra, padrão, arquivamento/restauração, vendas dos três tipos de item, precisão monetária, snapshots, moeda histórica, total zero, estados, filtros, paginação, permissões, referências arquivadas e isolamento entre empresas. São executados em Chromium desktop e viewport móvel. Não equivalem a validação em Safari ou dispositivo físico.

Fórmulas, custos calculados, sugestões e conversões continuam dependentes do backend. [Indicadores e auditoria](indicadores-auditoria.md) estão disponíveis na entrega seguinte.
