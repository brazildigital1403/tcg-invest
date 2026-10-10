-- pokemon_historias -- Fase 3 do epico #490, item 5 (09/10/2026).
--
-- Uma historia curta por ESPECIE (nunca por carta), em portugues, escrita a
-- partir de fatos com fonte: PokeAPI (categoria, geracao, tipos, evolucao,
-- lendario/mitico) e o catalogo da Bynx (cartas, primeiro set, mais valiosa).
-- Voz enciclopedica por padrao (decisao do Du, 09/10); a voz dele entra como
-- paragrafo a parte nas especies que ele escolher. Numeros nao vao no texto:
-- entram na montagem da pagina. Piloto: Geracao 1 (151).
--
-- Nasce fechada (regra da casa): leitura publica so por policy de select,
-- escrita so com a chave de servico.
-- Rollback: drop table public.pokemon_historias.

create table if not exists public.pokemon_historias (
  dex             integer primary key,
  slug            text not null unique,
  nome            text not null,
  texto           text not null check (char_length(texto) <= 600),
  primeira_frase  text not null check (char_length(primeira_frase) <= 220),
  voz             text not null default 'enciclopedica' check (voz in ('enciclopedica')),
  texto_du        text,
  fatos           jsonb,
  fonte           text not null default 'pokeapi+bynx',
  gerado_em       timestamptz not null default now(),
  revisado_em     timestamptz,
  revisado_por    text
);

comment on table public.pokemon_historias is 'Historia curta por especie (hub do Pokemon + 1a frase na carta). #490 Fase 3, 10/2026.';

alter table public.pokemon_historias enable row level security;
revoke all on public.pokemon_historias from public, anon, authenticated;
grant select on public.pokemon_historias to anon, authenticated;
grant all on public.pokemon_historias to service_role;

drop policy if exists pokemon_historias_select_publico on public.pokemon_historias;
create policy pokemon_historias_select_publico
  on public.pokemon_historias for select
  to anon, authenticated
  using (true);
