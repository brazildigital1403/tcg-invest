-- Trend GTA VI: as capas passam a apontar para a imagem inteira (sem recorte), em
-- trends/gta-vi/inteira/NN.webp. O card desta trend virou 4:5 (decisao do Du em 22/11/2026)
-- e o corte fica por conta do CSS. As capas antigas (recortadas em 9:16) seguem no bucket.
--
-- Rollback:
--   update public.club_trend_posts set capa_path = replace(capa_path, 'trends/gta-vi/inteira/', 'trends/gta-vi/')
--    where trend_id = (select id from public.club_trends where slug = 'trend-gta-vi-2026');
update public.club_trend_posts
   set capa_path = 'trends/gta-vi/inteira/' || lpad(posicao::text, 2, '0') || '.webp'
 where trend_id = (select id from public.club_trends where slug = 'trend-gta-vi-2026')
   and capa_path like 'trends/gta-vi/__.webp';
