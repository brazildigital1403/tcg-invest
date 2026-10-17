-- Master set com mais de um set_id (17/10/2026).
-- 30th Celebration = 30c (base + secretas) + 30c-c (Classic Collection) + 30c-r (RGB).
-- A RPC so contava um set_id, entao o master set mostrava 158 de 199 cartas.
--
-- Aproveita para ler o numero da coluna `number` no modo 'liga' quando o nome
-- nao traz "(n/t)": cri, m4, m5 e 30c vieram do import-liga-numbered com nome
-- limpo e estavam sem numero e sem ordem na folha.
--
-- Troca por rename: a v1 continua no banco. Rollback:
--   alter function public.master_set_card_rows(text) rename to master_set_card_rows_v2;
--   alter function public.master_set_card_rows_v1(text) rename to master_set_card_rows;
--   alter table public.master_sets drop column extra_set_ids;

alter table public.master_sets
  add column if not exists extra_set_ids text[] not null default '{}';

create or replace function public.master_set_card_rows_v2(p_set_id text)
returns table(id text, numero text, nome text, image_small text, sort_key integer)
language sql stable security definer
set search_path to 'public'
as $$
  with src as (
    select coalesce(card_source, 'official') as cs,
           coalesce(extra_set_ids, '{}') as extras
    from public.master_sets where set_id = p_set_id limit 1
  ),
  sets as (
    select p_set_id as sid, 0 as rank
    union all
    select e.sid, e.ord::int from src, unnest(src.extras) with ordinality as e(sid, ord)
  ),
  base as (
    select c.id, c.image_small, s.rank, s.sid,
      case when (select cs from src) = 'liga'
        then coalesce(substring(c.name from '\(([0-9]+/[0-9]+)\)'), c.number, '')
        else coalesce(c.number, '') end as num_txt,
      case when (select cs from src) = 'liga'
        then btrim(regexp_replace(c.name, '\s*\([0-9]+/[0-9]+\)\s*$', ''))
        else c.name end as nome_txt,
      coalesce(
        case when (select cs from src) = 'liga'
          then nullif(substring(c.name from '\(([0-9]+)/'), '')::int end,
        nullif(regexp_replace(coalesce(c.number, ''), '\D', '', 'g'), '')::int,
        0) as num_sort
    from public.pokemon_cards c
    join sets s on s.sid = c.set_id
    where case when (select cs from src) = 'liga'
            then c.id like 'liga-%' else c.id not like 'liga-%' end
  )
  select b.id,
    -- Carta de set extra leva o rotulo do set no numero ("004 CC", "RGB B"):
    -- o total impresso dela nao e o do set principal, e a pagina so poe
    -- "/total" quando o numero e so digito.
    case when b.rank = 0 then b.num_txt
         else case lower(case when b.sid like p_set_id || '-%' then substr(b.sid, length(p_set_id) + 2) else b.sid end)
                when 'c' then b.num_txt || ' CC'
                when 'r' then 'RGB ' || b.num_txt
                else b.num_txt || ' ' || upper(b.sid) end
    end,
    b.nome_txt,
    b.image_small,
    b.rank * 10000 + b.num_sort
  from base b;
$$;

alter function public.master_set_card_rows(text) rename to master_set_card_rows_v1;
alter function public.master_set_card_rows_v2(text) rename to master_set_card_rows;

update public.master_sets set extra_set_ids = '{30c-c,30c-r}' where set_id = '30c';
