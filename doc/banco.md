# Banco por ambiente

| Ambiente | Banco | Migração |
| --- | --- | --- |
| Local padrão | SQLite em `data/leafa.db` | Launcher, antes da API |
| Local customizado | PostgreSQL já iniciado externamente | Launcher aguarda conexão e migra |
| Docker | PostgreSQL 17, volume nomeado | Start da única instância de API |
| Render | Render PostgreSQL 17 | Pre-deploy |

Alterar major version do PostgreSQL requer plano próprio de migração; não basta trocar a tag sobre um volume existente. A imagem Compose fixa uma versão de manutenção, que deve ser atualizada junto da validação de integração.

## Backup e restauração

SQLite local: pare a API antes de copiar o arquivo do banco; guarde a cópia fora do diretório de execução. Para restaurar, mantenha a API parada, preserve o arquivo atual e copie o backup para o caminho configurado.

Docker, comandos iguais em Linux e Windows, evitando redirecionamento binário pelo PowerShell:

```sh
docker compose exec db pg_dump -U leafa -d leafa -Fc -f /tmp/leafa.dump
docker compose cp db:/tmp/leafa.dump ./leafa.dump
```

Restaure primeiro em um banco novo de verificação, sem sobrescrever a base em uso:

```sh
docker compose cp ./leafa.dump db:/tmp/leafa.dump
docker compose exec db createdb -U leafa leafa_restore
docker compose exec db pg_restore -U leafa -d leafa_restore --no-owner --exit-on-error /tmp/leafa.dump
```

Valide registros e migrações no banco restaurado antes de trocar conexões. O arquivo de backup contém dados da aplicação: não o versione. No Render, configure a política de backup/recuperação adequada ao plano e valide uma restauração antes de usar dados reais. Comandos PostgreSQL acima ainda não foram executados nesta entrega.
