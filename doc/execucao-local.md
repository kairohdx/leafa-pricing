# Execução local

Use Python 3.13, Node.js 22.12+ da linha 22 e npm no Windows ou Linux. Na raiz:

```sh
python manage.py setup
python manage.py local
```

`setup` cria `.venv` se necessário, instala dependências da API e executa `npm ci` no frontend. `local` verifica portas/dependências, inicializa SQLite, aplica migrações e inicia API e frontend. SQLite é embutido, sem processo separado. Acrescente `--api-only` para instalar/executar somente a API.

Frontend: `http://127.0.0.1:5173`. API: `http://127.0.0.1:8000`; Swagger: `/docs`; saúde: `/health`. Logs aparecem no terminal. Use `--port 8010` e `--front-port 5180` para outras portas. Ctrl+C encerra ambos. Se um processo encerrar, o outro também é encerrado.

Os comandos podem ser chamados de outra pasta usando o caminho absoluto de `manage.py`. O `.env` é sempre lido da raiz. A configuração e suas variáveis estão em [Inicialização da API](../api/doc/inicializacao.md). Com `DATABASE_URL` de PostgreSQL, inicie esse banco externamente antes do comando; o launcher espera disponibilidade, mas não instala nem inicia um serviço PostgreSQL local.

O frontend usa proxy Vite `/api`, apontado automaticamente para a porta da API. Veja [Frontend](../front/doc/README.md). Docker permanece parcial, sem container de frontend nesta entrega.

## Contas de demonstração opcionais

Sem seed, não há contas padrão. Para criar `alex@example.com` e `sam@example.com`, cada uma administradora de uma empresa diferente, use uma senha sua com pelo menos 12 caracteres. Defina as variáveis no processo:

Windows/PowerShell:

```powershell
$env:DEMO_MODE = 'true'
$env:DEMO_PASSWORD = Read-Host 'Senha de demonstracao' -MaskInput
python manage.py local --seed
Remove-Item Env:DEMO_PASSWORD
```

`-MaskInput` requer PowerShell 7. No Windows PowerShell 5.1, use `Read-Host -AsSecureString` e conversão explícita ou configure a variável pelo gerenciador do ambiente; não grave a senha no histórico de comandos.

Linux:

```bash
export DEMO_MODE=true
read -rs -p 'Senha de demonstracao: ' DEMO_PASSWORD
export DEMO_PASSWORD
python manage.py local --seed
unset DEMO_PASSWORD
```

O seed exige opt-in, roda em uma transação e pode ser repetido: não altera senhas de contas existentes. Conflito de email com outra empresa aborta a operação. Execute apenas uma instância do seed por vez. `DEMO_PASSWORD` é lida da variável do processo, não do `.env`.

## Diagnóstico e validação

Porta ocupada: encerre o serviço que conhece ou escolha outra porta. Dependências ausentes: execute `setup`. Banco indisponível: confira serviço e URL. Migração com erro: o servidor não inicia; corrija a causa sem apagar o banco.

Testados no Windows: inicialização da API e conjunta com frontend, health check pelo proxy, rota SPA direta, migrações, seed repetido, rejeição de porta ocupada e encerramento sem servidores remanescentes. Linux e instalação em máquina limpa ainda pendentes.
