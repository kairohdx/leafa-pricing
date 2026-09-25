# Regras de precificação e vendas

[Frontend](README.md) · [Motor e contratos](../../api/doc/pricing.md) · [Vendas](../../api/doc/sales.md)

## Regras

Administradores criam/editam regras; operadores consultam. Listagem, busca, paginação, arquivamento, restauração e conflitos de versão continuam disponíveis. Arquivar remove o padrão; restaurar não o reaplica.

O formulário apresenta “Como você quer calcular o preço?” com cinco cards: Acréscimo sobre custo, Margem desejada, Margem + taxas, Multiplicar o custo e Valor fixo sobre o custo. Só os campos da estratégia escolhida ficam visíveis. Nomes técnicos e edição livre de JSON foram removidos dessa interface. A configuração inicial é acréscimo de 30%, editável, sem representar recomendação comercial. Não foi adicionada uma galeria separada de presets.

Percentuais são informados como 30 para 30%. Campos decimais aceitam vírgula, enviada como ponto em strings. O servidor valida obrigatoriedade, parâmetros extras, limites, multiplicador positivo e margem + taxas menor que 100%. Erros de domínio são apresentados no simulador.

Arredondamentos: sem ajuste comercial, inteiro para cima, terminação ,90 ou ,99. A adequação a centavos nunca reduz o preço bruto. Fórmulas e exemplos estão no contrato do motor.

## Teste sua regra

Disponível na criação, edição e consulta. Aceita custo hipotético e chama `POST /pricing-rules/preview` após 300 ms sem alterações. Exibe custo, preço bruto, ajuste, preço sugerido, taxas e margem após os custos modelados. Não duplica fórmulas no navegador e descarta respostas de requisições antigas. Resultado indisponível não aparece como zero. Campos inválidos impedem cálculo válido; não são convertidos silenciosamente em zero.

PATCH mantém `expected_version`; conflito 409 preserva edição e exige recarregar com confirmação. Regras antigas desconhecidas continuam consultáveis, mas precisam de configuração válida para calcular. Atualização não reescreve snapshots de vendas.

## Produtos

O painel da composição consulta `GET /products/{id}/cost`, mostrando custo total, custo proporcional por componente, quantidade/unidade consumida, custo e quantidade de compra e embalagens disponíveis com custo proporcional. Atualizações na composição recarregam o custo.

As embalagens existentes representam quantidades de material; não adicionam um custo próprio. A composição continua expressa em quantidade/unidade. Produto sem composição mostra indisponibilidade. Materiais com custo zero são válidos.

## Vendas

Rascunhos mantêm descrição, data, total final manual e regra opcional. A regra padrão não é aplicada automaticamente. Selecionar itens, mudar quantidades ou regra consulta `POST /sales/preview` e mostra custo total e sugestão por item/total. “Usar total sugerido” apenas preenche o campo manual; o usuário pode alterá-lo antes de salvar.

Produtos e materiais recebem custo calculado e sugestão da regra. Unidades compatíveis são convertidas. Serviços usam o preço cadastrado, sem inventar custo. Se uma parcela estiver indisponível, seu total correspondente também fica indisponível. O total final manual continua aceitando zero e não precisa coincidir com a sugestão.

O detalhe mostra valores capturados, regra/versão e memória do cálculo em linguagem legível. O backend preserva detalhes completos no snapshot. Moeda permanece a da venda; mudar moeda da empresa não converte históricos.

Editar descrição/data/total preserva itens e cálculos. Trocar somente a regra usa custos capturados. Reenviar o mesmo ID preserva a versão histórica da regra. Alterar os itens envia a lista completa, recaptura custos/composição do catálogo e cria novos IDs; o formulário avisa. Referências arquivadas precisam ser removidas/restauradas para substituir itens. Sem regra, custos ainda ficam registrados, mas produtos/materiais não recebem sugestão.

Somente rascunhos são editáveis; conclusão exige itens e confirmação. Administradores cancelam. Conclusão e cancelamento não recalculam nem permitem reabrir a venda.

## Limites mantidos

- Datas de entrada usam ISO com fuso explícito; exibição usa o fuso da empresa.
- Vendas ainda não possuem controle otimista de versão; a última edição válida prevalece nos campos enviados.
- O preço editável continua sendo o total da venda, conforme contrato existente. Não há preço final manual individual por linha; totais de linha representam a sugestão.
- Não há conversão cambial nem custo de mão de obra para serviços.
- Preview não reserva preços: uma alteração de catálogo antes de salvar novos itens pode mudar a sugestão capturada.
- Mobile é validado em viewport Chromium, não Safari/dispositivo físico.

## Testes

`PricingCalculator.test.tsx` verifica chamadas ao backend com strings decimais, campos por estratégia, indisponibilidade e descarte de respostas atrasadas. `e2e/trading.spec.ts` cobre simulador, conflitos, permissões, histórico e vendas; `e2e/pricing.spec.ts` exercita composição, conversão, sugestão, substituição manual do preço e histórico após alterar material/regra. Consulte o README frontend para os resultados reais da entrega.
