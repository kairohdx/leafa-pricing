# Docker — API e PostgreSQL

Pré-requisitos: Docker com Compose v2 e engine iniciado; Python apenas para usar `manage.py`. Os comandos são comuns a Linux e Windows com containers Linux disponíveis.

No `.env` da raiz, configure `POSTGRES_PASSWORD` com uma senha longa gerada usando letras, números, `-` e `_`. A restrição evita caracteres reservados na URL do banco. Você pode gerar uma senha com `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Não versione o `.env`.

```sh
python manage.py docker-up
python manage.py docker-logs
python manage.py docker-down
```

Equivalentes: `docker compose up --build -d --wait`, `docker compose logs --follow --tail 100` e `docker compose down`. O primeiro constrói a imagem da API, obtém a imagem oficial PostgreSQL e aguarda os health checks. Repeti-lo permite rebuild/atualização. Use `docker compose restart` para reiniciar sem rebuild.

API disponível em `http://127.0.0.1:8000`; `API_PORT` permite mudar a porta publicada. O PostgreSQL não expõe porta no host: a API usa `db:5432` pela rede interna. O volume `postgres_data` preserva dados após `down` e reinício. Senha em variável de ambiente é configuração local, não um cofre: usuários com acesso ao Docker podem inspecioná-la.

O container da API roda como usuário sem privilégios, aguarda o banco, aplica migrações e inicia um servidor. Mantenha uma única réplica enquanto migrações ocorrerem no start; para múltiplas réplicas, separar a migração em job único antes de escalar.

Para seed manual, configure `DEMO_MODE=true` antes de subir o ambiente e exporte `DEMO_PASSWORD` no shell conforme o guia local. Execute `docker compose exec -e DEMO_PASSWORD api python -m app.scripts.seed_demo`. O seed não roda automaticamente em reinícios.

O frontend está pendente; há **dois containers**, não três. A imagem e o serviço de frontend serão adicionados com sua implementação.

## Dados e limpeza

Parar serviços não apaga dados. `docker compose down --volumes` remove explicitamente os volumes e destrói o banco: use apenas quando quiser descartar os dados. Trocar `POSTGRES_PASSWORD` no `.env` não troca a senha de um banco já inicializado; faça a alteração no PostgreSQL e atualize a API coordenadamente.

Veja [Banco](banco.md) para backup e restauração. Configuração YAML foi lida com sucesso; Docker não está instalado no ambiente desta entrega, portanto build, inicialização e persistência real dos containers ainda não foram validados.

Referências: [imagem oficial PostgreSQL](https://hub.docker.com/_/postgres) e [uso da imagem e health checks](https://www.docker.com/blog/how-to-use-the-postgres-docker-official-image/).
