-- Trend Sombria: todos os cards como Reel (pedido do Du, 18/11/2026). Sem mudanca de schema.
--
-- Rollback (os 21 que eram post, pelo tipo de link; os 7 reels originais ficam como reel):
--   update public.club_trend_posts set tipo = 'post'
--     where trend_id = (select id from public.club_trends where slug = 'trend-sombria-halloween-2026')
--       and link_url ~ '/p/';
update public.club_trend_posts
   set tipo = 'reel'
 where trend_id = (select id from public.club_trends where slug = 'trend-sombria-halloween-2026')
   and tipo <> 'reel';
