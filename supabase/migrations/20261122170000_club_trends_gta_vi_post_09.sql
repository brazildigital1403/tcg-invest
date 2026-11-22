-- Trend GTA VI: entra o post da posicao 9, do Matheus (@carteadodomat), que estava reservada.
-- O post e uma colaboracao e o Instagram nao o entrega sem login; a capa veio do Du em
-- 22/11/2026 e esta em trends/gta-vi/post/09.webp. Com ele a trend fecha em 14 de 14.
--
-- Rollback:
--   delete from public.club_trend_posts
--    where trend_id = (select id from public.club_trends where slug = 'trend-gta-vi-2026') and posicao = 9;
insert into public.club_trend_posts (trend_id, posicao, nome, pessoa, tipo, link_url, status, capa_path)
select t.id, 9, 'Carteadodomat', 'Matheus', 'post', 'https://www.instagram.com/p/Df4iXJaSZo1/', 'publicado', 'trends/gta-vi/post/09.webp'
from public.club_trends t
where t.slug = 'trend-gta-vi-2026'
  and not exists (select 1 from public.club_trend_posts p where p.trend_id = t.id and p.posicao = 9);
