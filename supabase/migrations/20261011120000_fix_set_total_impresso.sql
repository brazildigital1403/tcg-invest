-- #505: set_total guarda o total COM secretas nas cartas vindas da API
-- internacional e o total IMPRESSO nas demais. A carta fisica diz o impresso
-- (Dragonite 290/217), entao o catalogo passa a guardar o impresso em todas.
-- O total com secretas continua em pokemon_sets.total, que e quem deve ser o
-- 100% de qualquer barra de "colecao completa".
--
-- Molde do #113: tabela de trabalho + funcao de lote atomica pela PK, chamada
-- a cada 60 s por bynx-scan/scripts/atualizar-set-total.mjs na Servidor.
-- Promos com impresso > total (svp, swshp, dp2jp) ficam fora de proposito.

create table if not exists public.fix_set_total_rows (
  id        text primary key,
  set_id    text not null,
  de        integer,
  para      integer not null,
  feito_em  timestamptz
);

insert into public.fix_set_total_rows (id, set_id, de, para)
select c.id, c.set_id, c.set_total, s.printed_total
  from public.pokemon_cards_all c
  join public.pokemon_sets s on s.id = c.set_id
 where s.printed_total is not null
   and s.total is not null
   and s.printed_total < s.total
   and c.set_total is distinct from s.printed_total
on conflict (id) do nothing;

alter table public.fix_set_total_rows enable row level security;
revoke all on public.fix_set_total_rows from anon, authenticated;

create or replace function public.fix_set_total_lote(p_tamanho integer default 2000)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n int;
  restam int;
begin
  with alvo as (
    select id, para from public.fix_set_total_rows where feito_em is null order by id limit p_tamanho
  ), up as (
    update public.pokemon_cards_all p
       set set_total = alvo.para
      from alvo
     where p.id = alvo.id
    returning p.id
  )
  update public.fix_set_total_rows r set feito_em = now() from up where r.id = up.id;
  get diagnostics n = row_count;

  select count(*) into restam from public.fix_set_total_rows where feito_em is null;
  if restam > 0 then
    return format('lote %s linhas; restam %s', n, restam);
  end if;
  return format('FIM: lote %s linhas; restam 0', n);
end
$$;

revoke all on function public.fix_set_total_lote(integer) from public, anon, authenticated;
grant execute on function public.fix_set_total_lote(integer) to service_role;
