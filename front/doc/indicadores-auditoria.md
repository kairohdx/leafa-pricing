# Indicadores e auditoria

[Frontend](README.md) · [Contrato de indicadores](../../api/doc/analytics.md) · [Contrato de auditoria](../../api/doc/audit.md)

## Indicadores

`/indicadores` está disponível para administradores e operadores, pelo menu e pelo atalho na visão geral. Consulta resumo e série diária da própria empresa. O período inicial cobre os últimos 30 dias até a abertura da tela, em instantes UTC; não representa um mês calendário. Filtros na URL permitem escolher período e moeda histórica explicitamente.

Datas usam ISO com fuso obrigatório, como `2026-09-01T00:00:00-03:00`, seguindo a entrada das vendas. O início é inclusivo e o fim exclusivo. O período deve ser positivo e ter até 366 dias. Os dias são agrupados pela API no fuso IANA da empresa, incluindo alterações de horário de verão. Não há conversão por deslocamento fixo no navegador. Primeiro e último dias podem representar períodos parciais.

Somente vendas concluídas entram no resumo. Rascunhos e canceladas ficam de fora. A moeda é um filtro, sem soma de moedas diferentes ou câmbio; começa na moeda atual da empresa. Os valores monetários continuam strings, inclusive somas maiores que o limite de uma venda individual. A escala visual das barras usa razões calculadas com BigInt; a tabela mantém os valores exatos.

O resumo apresenta quantidade de vendas, total final, custo conhecido e cobertura (vendas com custo conhecido / vendas concluídas). Custo nulo aparece como “Indisponível”; custo conhecido igual a zero aparece como valor monetário. Cobertura incompleta identifica custo parcial. Não se calcula lucro a partir de custos ausentes.

A série tem barras por dia e tabela textual com os mesmos pontos, incluindo dias sem vendas. As áreas de gráfico/tabela têm rolagem própria para períodos longos. Resumo e série são exibidos juntos somente após sucesso das duas consultas; erros oferecem repetição. A API não fornece uma transação compartilhada entre as duas consultas, então não há promessa de um snapshot atômico durante gravações concorrentes.

Ao navegar de vendas para indicadores, as consultas são executadas novamente, sem cache persistente. “Atualizar indicadores” repete a consulta do período exibido para mudanças em outra aba. Não há atualização contínua/polling nem avanço automático do fim do período enquanto a página permanece aberta.

## Auditoria

`/auditoria` e `/auditoria/:id` ficam dentro da guarda administrativa, antes de qualquer consulta. Operadores não veem o acesso no menu e recebem acesso restrito por URL; a API continua responsável pela autorização efetiva.

A listagem tem paginação e filtros combinados por período, ator (UUID), tipo/ID da entidade, ação e request ID. Tipo e ação são campos livres de correspondência exata, pois não são enums fechados. Alterar filtros reinicia a página; navegar ao detalhe e voltar preserva os filtros na URL.

O detalhe apresenta data no fuso da empresa, instante UTC, IDs de evento/empresa/ator/entidade, request ID e alterações. Ator e request ID nulos são indicados como não informados. Alterações são agrupadas pelas chaves retornadas: `before`/`after` aparecem como Antes/Depois quando presentes; eventos podem retornar campos diretamente ou diferenças por campo. Objetos/listas permanecem JSON formatado, renderizado como texto, sem interpretação de HTML. A interface preserva `[REDACTED]` recebido da API e não consulta informações atuais para reconstruir o passado.

Não há ações de alteração ou exclusão de eventos. Login/logout não integram esse histórico de negócio. Filtros sem resultados, falha de consulta e evento ausente possuem estados explícitos.

## Validação e limites

Testes de frontend cobrem custo parcial/zero/indisponível, grandes agregados, limite de período, falha parcial das consultas e guarda administrativa. Cenários com API real cobrem moeda histórica, estados de venda, atualização após cancelamento, dia no fuso da empresa, dias sem vendas, filtros/paginação de auditoria, detalhe, isolamento entre empresas e acesso de operador.

Validação local em Windows, Chromium desktop e viewport móvel. Emulação não equivale a Safari ou dispositivo físico. Sem alterações no backend nesta entrega. Publicação, Docker, execução Linux e CI remoto permanecem na etapa de infraestrutura; não há exportação ou comparação de períodos no contrato atual.
