-- Trend GTA VI: as capas passam a ser a arte inteira de cada post (3:4 ou 4:5, em alta),
-- em trends/gta-vi/post/NN.webp, no lugar da previa quadrada. Pedido do Du em 22/11/2026:
-- "as imagens igualzinhas do post de cada um". A posicao 8 e reel e usa o quadro vertical.
--
-- Rollback:
--   update public.club_trend_posts set capa_path = replace(capa_path, 'trends/gta-vi/post/', 'trends/gta-vi/inteira/')
--    where trend_id = (select id from public.club_trends where slug = 'trend-gta-vi-2026');
update public.club_trend_posts
   set capa_path = 'trends/gta-vi/post/' || lpad(posicao::text, 2, '0') || '.webp'
 where trend_id = (select id from public.club_trends where slug = 'trend-gta-vi-2026')
   and capa_path like 'trends/gta-vi/inteira/__.webp';
