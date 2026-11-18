-- Fecha a Trend Sombria (17/11/2026): Memel, Dede e CasalTCG postaram (capas ja no bucket
-- club-fotos, trends/sombria/27..29.webp) e Doisll sai da lista de quem falta. Sem mudanca de schema.
--
-- Rollback:
--   update public.club_trend_posts set link_url = null, status = 'aguardando', capa_path = null
--     where trend_id = (select id from public.club_trends where slug = 'trend-sombria-halloween-2026') and posicao in (27, 28, 29);
--   insert into public.club_trend_posts (trend_id, posicao, nome, pessoa, tipo, status)
--     select id, 15, 'Doisll', 'Pedro', 'post', 'aguardando' from public.club_trends where slug = 'trend-sombria-halloween-2026';
with t as (select id from public.club_trends where slug = 'trend-sombria-halloween-2026')
update public.club_trend_posts p
   set nome      = v.nome,
       link_url  = v.link,
       status    = 'publicado',
       capa_path = 'trends/sombria/' || lpad(p.posicao::text, 2, '0') || '.webp'
  from t,
       (values (27, 'Memel_tcg', 'https://www.instagram.com/p/DfpeCRKpv6d/'),
               (28, 'Dede_tcg',  'https://www.instagram.com/p/DfqGVkcORGo/'),
               (29, 'CasalTCG',  'https://www.instagram.com/p/Dfx4uv3RMGC/')) as v(posicao, nome, link)
 where p.trend_id = t.id and p.posicao = v.posicao and p.status = 'aguardando';

delete from public.club_trend_posts
 where trend_id = (select id from public.club_trends where slug = 'trend-sombria-halloween-2026')
   and posicao = 15 and nome = 'Doisll';
