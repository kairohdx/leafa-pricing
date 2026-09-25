# Acabamento de UX

Implementação do levantamento `_temp_ux.md`, em 24/09/2026. Mantidos o motor no backend, os contratos decimais, o histórico e a identidade visual.

## Campos e valores

- Moeda: opções Real, Dólar americano e Euro, com preservação de códigos existentes fora da lista. A venda usa sua moeda histórica.
- Dinheiro: `MoneyField` trabalha com strings e BigInt. Digitar `1234` acumula centavos (`12,34`); colar `1234` informa uma quantia inteira (`1234,00`). Colagem formatada aceita `R$ 1.234,56`, `US$ 1.234,56`, `€ 1.234,56` e `1234,56`. Formatos ambíguos são rejeitados com mensagem.
- A vírgula explícita permite digitar `12,34`. Foco não altera o valor existente. Vazio não equivale a zero. Valores negativos, excesso de casas e estouro de limite geram erro.
- Edição de trechos conserva a posição do cursor; colagem sobre uma seleção parcial substitui esse trecho. A seleção total permite substituir toda a quantia.
- Quantidades mantêm entrada decimal natural, até seis casas. Percentuais e multiplicadores não usam máscara monetária. Estados intermediários permanecem editáveis.
- Valores monetários usam símbolo e duas casas; quantidades perdem zeros finais. Custos positivos inferiores a um centavo são identificados como tal. Detalhes preservam a precisão original; o texto abreviado nunca é enviado ao motor.

## Fluxos

- Empresa: sugestão de endereço a partir do nome até personalização; fusos comuns com nomes de cidades e preservação de valores existentes. Telefones brasileiros recebem apresentação com DDD no blur; números com `+` são preservados.
- Datas: venda usa campo visual no fuso da empresa. Filtros incluem o último dia por meio da meia-noite seguinte nesse fuso, sem somar 24 horas. Atalhos Hoje, 7 dias, mês e 30 dias. Horários inexistentes durante mudança de horário são rejeitados.
- Estratégias: clicar na atual não muda dados; a troca preserva rascunhos por estratégia. Erros de margem, taxas e multiplicador têm orientação específica.
- Preview: conserva o resultado anterior apenas na mesma identidade e endpoint, identifica atualização e impede aplicar sugestão antiga. Entradas incompletas não solicitam cálculo.
- Venda: valor cobrado em destaque, subtotais identificados como sugestões, aplicação explícita do total sugerido e da regra padrão, confirmação com valor e moeda ao concluir, memória recolhida.
- Home: atalhos de material, produto e regra para administradores; registro de venda disponível para operadores. Catálogo vazio oferece cadastro inicial.
- Picker: busca com debounce de 300 ms e contexto de preço, unidade ou SKU. Adição de item direciona foco para a quantidade.
- Formulários de empresa, catálogo, composição, embalagens, regras e vendas protegem navegação/recarregamento com alterações. Cancelamento de edição local confirma descarte.
- Auditoria: seletores de entidade e ação; filtros por IDs ficam em detalhes avançados.
- Confirmações positivas mantêm a confirmação e usam intenção visual positiva. Erros de submit direcionam foco para campo inválido. Movimento local respeita a preferência por redução.

## Verificação

Resultado final: **88 testes frontend e 34 E2E aprovados**, além de build, TypeScript e lint.

Os testes de componentes cobrem máscara, vazio/zero, limites, precisão acima do inteiro seguro de JavaScript, seleção parcial, colagem, Home/Delete/Backspace/setas, quantidade mínima, conversão de fuso e dia com 23 horas. Os testes do preview cobrem resposta antiga, resposta atrasada, troca de empresa e clique na estratégia atual.

E2E em Chromium desktop e viewport de iPhone cobre cadastro, catálogo/composição, regras, vendas, relatórios, proteção de saída, moeda histórica e navegador em Tóquio com empresa em Brasília. Capturas são produzidas em `front/test-results/` pelos testes, incluindo BRL, EUR e USD. Não equivale a execução em Safari ou iPhone físico.

Contraste medido nos pares de texto revisados: ajuda `#65745e`/branco ≈ 4,98:1; prefixo monetário `#52665b`/branco ≈ 6,16:1; erro `#983b32`/branco ≈ 6,98:1. Textos secundários da home e rodapé foram escurecidos. Não foi realizada auditoria integral de contraste de todas as telas.

Permanece recomendado o teste humano do documento original, com alguém sem contexto executando material → composição → regra → venda. Automação valida funcionamento, não compreensão.
