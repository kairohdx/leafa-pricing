# Catálogo — materiais, embalagens, serviços e produtos

Terceira entrega do frontend. As telas usam os contratos existentes da API, com consultas para administradores/operadores e escrita administrativa. Não há exclusão física de registros: arquivamento/restauração preservam referências e histórico.

## Rotas e navegação

| Rotas | Operações |
| --- | --- |
| `/materiais`, `/materiais/novo`, `/materiais/:id` | Listagem, criação, consulta, edição, arquivamento e restauração |
| `/materiais/:id/embalagens/nova`, `/materiais/:id/embalagens/:packageId` | Cadastro, detalhe, edição, arquivamento e restauração de embalagem |
| `/servicos`, `/servicos/novo`, `/servicos/:id` | Listagem, criação, consulta, edição de preço base, arquivamento e restauração |
| `/produtos`, `/produtos/novo`, `/produtos/:id` | Listagem, criação, consulta, edição, arquivamento, restauração e composição |

As listagens usam busca e estado ativo/arquivado, com páginas de dez registros retornadas pelo servidor. Filtros ficam na URL e sua alteração volta à primeira página. Links de detalhe e retorno preservam filtros. Embalagens têm paginação e filtro próprios dentro do material; não possuem busca no contrato atual.

Formulários enviam somente diferenças no PATCH. Limpar SKU, observações ou descrição envia `null`, conforme os contratos. Erros preservam o rascunho e enviam feedback; conflitos incluem referências arquivadas. Operadores não recebem formulários ou ações de escrita, inclusive em URLs diretas. A API continua sendo a autoridade para autorização e isolamento por empresa.

## Decimais

Quantidades e valores são mantidos como strings em campos, payloads e apresentação. A entrada aceita ponto ou vírgula decimal, sem separadores de milhar ou notação científica. Não usa `Number`/`parseFloat` para converter preços ou quantidades.

- Valores monetários: zero ou maior, até duas casas, limite `92233720368547758.07`.
- Quantidades: maior que zero, até seis casas, limite `9223372036854.775807`.
- A validação de limite usa inteiros `BigInt` escalados; valores fora do contrato são rejeitados, sem arredondamento silencioso.
- A apresentação agrupa dígitos e troca o separador decimal diretamente na string, preservando inclusive valores maiores que o inteiro seguro do JavaScript.

## Unidades

O frontend carrega todas as páginas de `/units`, sem truncar o seletor nos primeiros 100 itens. Os `dimension_id` das unidades definem compatibilidade. O catálogo global é somente leitura.

O primeiro cadastro de material pode escolher qualquer unidade existente. Na edição, a unidade precisa pertencer à dimensão da compra original. Embalagens e componentes usam a dimensão da compra do material vinculado. Trocar unidade não converte quantidade nem custo: a tela pede ajuste explícito.

Se o catálogo estiver vazio ou indisponível, a tela informa a pendência e bloqueia gravações que exigem unidade. Para preparar as unidades padrão **explicitamente**, após migração e com escritas da aplicação pausadas:

Windows/PowerShell, na raiz:

```powershell
$env:PYTHONPATH = 'api'
.venv/Scripts/python.exe -m app.scripts.units_catalog seed
```

Linux, na raiz:

```sh
PYTHONPATH=api .venv/bin/python -m app.scripts.units_catalog seed
```

O seed é idempotente, não cria contas e não roda automaticamente no banco de desenvolvimento. Consulte [Unidades da API](../../api/doc/units.md).

## Embalagens e composição

Material arquivado bloqueia cadastro, edição e restauração de suas embalagens, sem arquivá-las em cascata. O detalhe confere que o ID da embalagem pertence ao material da URL. Restaurar o material preserva o estado próprio das embalagens.

No produto, o seletor de materiais consulta registros ativos, com busca e paginação. Materiais já incluídos ficam indisponíveis para nova inclusão. Componentes usam seus próprios IDs na atualização/remoção; o material de um componente não é substituído pelo PATCH.

Produto arquivado bloqueia mudanças na composição e preserva os componentes. Material arquivado permanece visível na composição; não pode ser editado, mas pode ser removido de produto ativo. Remover componente exige confirmação e afeta somente a composição atual.

O contrato de composição retorna IDs, quantidades e unidades; o frontend consulta o detalhe de cada material para mostrar nome e estado. Custos calculados e preços sugeridos continuam indisponíveis. Não há conversor nem fórmula no frontend.

## Testes e correção de integração

Vitest cobre precisão/ranges, preservação de rascunhos em conflitos, nulos em PATCH, dimensões, múltiplas páginas de unidades, catálogo vazio, permissões e referências de embalagem. Playwright cobre os fluxos com API/SQLite reais em desktop e viewport móvel, incluindo decimais grandes, arquivos/restaurações, composição e isolamento entre empresas.

O preparador E2E aplica migrações e executa o seed de unidades apenas no SQLite temporário informado pela configuração de testes. A integração revelou que a CLI de unidades não importava o registro completo dos models em processo novo. A CLI passou a importar esse registro; um teste de subprocesso valida o seed repetido sem duplicação. Nenhum contrato ou migração mudou.

Vendas, regras de precificação, indicadores, auditoria visual e publicação permanecem nas próximas etapas.
