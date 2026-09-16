# Deploy do frontend — integração pendente

O frontend ainda não possui código, `package.json` ou comando de build. Não há imagem/container executável nesta entrega.

Quando implementado, integrar:

- Local: instalação de dependências e processo do front no launcher Python, com parada conjunta da API.
- Docker: Dockerfile próprio, build estático e terceiro serviço no Compose, separado da API e do PostgreSQL.
- Render: Static Site com diretório de build definido pelo projeto e URL pública da API por ambiente.

O navegador precisa de uma URL pública/localhost para a API; `api:8000` é nome da rede Docker e não serve como URL do navegador. CORS da API deve permitir a origem do front. Não incluir segredos de banco ou credenciais privadas no bundle.

Os comandos exatos serão documentados e testados com a implementação. Consulte o [índice geral](../../doc/README.md).
