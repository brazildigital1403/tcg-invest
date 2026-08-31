# Baseline do schema (22/08/2026)

`00000000000000_baseline_schema.sql` e um retrato do schema `public` (+ buckets e policies de
`storage`) do projeto de producao (PG17), gerado **so com consultas de leitura aos catalogos**
(`pg_catalog`, `pg_policies`, `storage.buckets`) — nao havia `pg_dump` disponivel. Nenhum
`select` foi feito em tabela de dados.

O arquivo e **idempotente**: `create ... if not exists`, `create or replace`, `drop policy /
drop trigger if exists` antes de recriar, do-blocks para constraints. Serve para subir um banco
novo (branch, staging, recuperacao) ou como ponto zero para as migrations seguintes.

## O que tem

| Objeto | Qtd |
|---|---|
| Extensoes (alem de plpgsql) | 7 (pg_cron, pg_stat_statements, pg_trgm, pgcrypto, supabase_vault, unaccent, uuid-ossp) |
| Tabelas | 72 |
| Views | 3 (`pokemon_cards` com `security_invoker=true`, `public_users`, `v_auditoria_liga_link`) |
| Matviews | 6 (3 ativas + 3 `_v1_old`), criadas `with no data` |
| Indices | 232 no total; 138 nao-constraint estao no arquivo, os outros nascem das PK/UNIQUE |
| Funcoes | 101 de usuario (as 35 de pg_trgm/unaccent nascem com a extensao) |
| Triggers | 10 |
| Policies | 71 em public + 9 em storage.objects |
| Buckets | 7 |

Nao existem enums, tipos compostos, domains nem schema `private`.

## Limitacoes conhecidas

1. **Sem dados.** Tabelas de referencia que precisam de seed separado (linhas aprox. por
   `pg_class.reltuples`; `-1` = nunca analisada, provavelmente pequena):
   `pokemon_sets` (~259), `pokemon_species` (~1.025), `pokemon_pokedex` (~1.025),
   `liga_set_edids` (~688), `liga_editions_master` (~796), `liga_set_mapping` (~167),
   `master_sets` (~33), `set_aliases` (?), `busca_glossario` (?), `ml_afiliado_links` (?),
   `ml_afiliado_produtos` (~39), `rewards` (?), `conteudo_config`/`conteudo_checklist` (?),
   `liga_scan_estado` (1 linha, id=1). O catalogo `pokemon_cards_all` (~69k) e os historicos
   (`price_snapshots` ~143k, `price_history` ~100k, `card_ultima_venda_historico` ~46k) tambem
   ficam de fora.
2. **Matviews nascem vazias.** Depois do seed: `refresh materialized view public.mv_set_index_stats;`
   (sem `concurrently` na primeira vez), idem `mv_price_movers` e `mv_base_pokemon_tipos`.
3. **pg_cron NAO e recriado** (infra, fica fora do baseline). Jobs existentes em `cron.job`:
   - `daily-price-snapshots` · `0 10 * * *` · `select public.capture_price_snapshots();`
   - `refresh_set_index_stats` · `17 * * * *` · `refresh materialized view concurrently public.mv_set_index_stats`
   - `refresh-price-movers` · `15 10 * * *` · `refresh materialized view concurrently public.mv_price_movers`
   - `refresh_base_pokemon_tipos` · `32 * * * *` · `refresh materialized view concurrently public.mv_base_pokemon_tipos`
   - `card_sinal_rollup_am` · `26 7 * * *` · `select public.card_sinal_rollup(2)`
   - `card_sinal_rollup_pm` · `26 19 * * *` · `select public.card_sinal_rollup(2)`
   - `card_sinal_purge` · `48 8 * * *` · `select public.card_sinal_purge()`
4. **Roles.** O papel `mia_readonly` (SELECT em tudo) e o default privilege `postgres public r`
   que inclui ele nao sao recriados. Os grants do arquivo cobrem so `anon`, `authenticated` e
   `service_role`, reproduzindo o estado real com `revoke all` + `grant` exato.
5. **Ordem de execucao.** As funcoes (secao 8) vem antes dos indices de tabela (secao 7b)
   porque os indices gin de busca dependem de `f_unaccent()`. A secao 7 e so um aviso.
6. **`alter sequence ... owned by`** para as 4 sequences `nextval()` e repetido a cada
   aplicacao (no-op). As identity columns geram a sequence sozinhas.
7. Triggers sao reconstruidos via `pg_get_triggerdef` (nao incluem `ENABLE/DISABLE` — todos
   estao habilitados hoje). Policies vem de `pg_policies` com o texto ja deparseado do PG.
8. `comment on index lancamentos_stripe_pi_unique` foi ajustado manualmente (o catalogo reporta
   como relkind i).

## Segredos / dados sensiveis

- Varredura por `sk_`, `whsec_`, `Bearer`, `token=`, JWT nos 101 corpos de funcao: **nada encontrado**.
  Nenhuma funcao precisou de `<REDACTED>`.
- A policy `stripe_events_processed_admin_read` tem o **e-mail do admin** cravado no `using`
  (`users.email = '...'`). Nao e segredo, mas e identidade num repo publico — avaliar se troca
  por um check de role/claim.
- Dois URLs aparecem, ambos em comentario/indice e ja publicos: `images.pokemontcg.io` e
  `ligapokemon.com.br/?view=cards/edicoes` (comentario da tabela `liga_editions_master`).
  Lembrete: a regra de nao nomear fornecedor vale para slug/UI; nomes de objeto como
  `liga_*` ja existem no codigo.

9. **Trigger `handle_new_user` vive em `auth.users`** — o baseline cobre so `public`,
   entao cadastro via auth NAO cria a linha espelho em `public.users` num banco novo.
   O `seed-prova.mjs` contorna criando a linha na mao; recriar o trigger exige acesso
   ao schema auth (fazer via dashboard/SQL se o ambiente de prova precisar de signup real).

10. **Configuracao de Auth nao e schema** — captcha (Turnstile), SMTP, templates de
    email e redirect URLs vivem na config do projeto, fora do baseline. Numa branch
    nova o captcha veio habilitado sem o secret valido (login falhava com
    `invalid-input-secret`); resolvido desabilitando captcha na branch. Conferir
    essa aba sempre que nascer ambiente novo.

## Conferir manualmente antes de usar

- Rodar num branch Supabase vazio e comparar as contagens da secao 15 (`-- VERIFICACAO`).
- `pokemon_cards` precisa continuar `with (security_invoker = true)` e **sem** grant para
  `anon`/`authenticated` (ACL real: so `postgres` e `service_role`). `pokemon_cards_all` so
  da `maintain` para anon/authenticated — sem `select`. Grant vence policy.
- `price_snapshots_quarentena` e a unica tabela sem RLS (fiel ao estado atual; decidir se fica).
- As 3 matviews `_v1_old` leem `pokemon_cards_all` direto (contam set oculto). Estao aqui por
  fidelidade; candidatas a `drop`.
- `supabase_vault` e `pg_cron` podem exigir privilegio de superuser no `create extension`;
  no Supabase ja vem instaladas.
