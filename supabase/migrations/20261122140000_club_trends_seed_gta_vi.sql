-- Carga da Trend GTA VI, 22/11/2026: os links na ordem que o Du mandou.
-- 13 dos 14 posts entram publicados. A posicao 9 fica reservada: o link
-- https://www.instagram.com/p/Df4iXJaSZo1/ nao devolveu previa publica (sem nome e sem capa)
-- e entra depois, quando o Du disser de quem e.
-- Capas: trends/gta-vi/NN.webp no bucket club-fotos (NN = posicao), 360x640, recortadas da
-- previa publica de cada post em 22/11/2026.
-- ordem 0: a trend nova abre a secao, na frente da Sombria (ordem 1). O slug liga a pele
-- "gta" em src/app/pokecreatorsclub/TrendsClub.tsx.
--
-- Rollback:
--   delete from public.club_trends where slug = 'trend-gta-vi-2026';  -- os posts caem em cascata
with t as (
  insert into public.club_trends (slug, titulo, tema, status, ordem, publicado_em)
  values ('trend-gta-vi-2026', 'Trend GTA VI', 'GTA VI', 'publicado', 0, now())
  returning id
)
insert into public.club_trend_posts (trend_id, posicao, nome, pessoa, tipo, link_url, status, capa_path)
select t.id, v.posicao, v.nome, v.pessoa, v.tipo, v.link_url, 'publicado',
       'trends/gta-vi/' || lpad(v.posicao::text, 2, '0') || '.webp'
from t, (values
    (1, 'Tocadozard', 'Paulo', 'post', 'https://www.instagram.com/p/Df4g5MBJSKR/'),
    (2, 'Bynx', 'Edu', 'post', 'https://www.instagram.com/p/Df4uROZRRDp/'),
    (3, 'Helotcg', 'Helô', 'post', 'https://www.instagram.com/p/Df5uuucuEIn/'),
    (4, 'Luctcg', null, 'post', 'https://www.instagram.com/p/Df4h29Dx74s/'),
    (5, 'Safarizonebinder', null, 'post', 'https://www.instagram.com/p/Df5O-Z-v-fG/'),
    (6, 'Mayytcg', 'Geovana', 'post', 'https://www.instagram.com/p/Df45aWbIDSs/'),
    (7, 'Ochicodotcg', 'Renan', 'post', 'https://www.instagram.com/p/Df5ACiqRTOh/'),
    (8, 'Zubatscave', 'Tiago', 'reel', 'https://www.instagram.com/reel/Df42C2mgoL9/'),
    (10, 'Jeffgeek', 'Jeff', 'post', 'https://www.instagram.com/p/Df4054mu0Ze/'),
    (11, 'Ourocards', null, 'post', 'https://www.instagram.com/p/Df5MEHJzbby/'),
    (12, 'Pixelandia', 'Edu', 'post', 'https://www.instagram.com/p/Df4nleWhtOy/'),
    (13, 'Trecha.colecoes', 'Kainã', 'post', 'https://www.instagram.com/p/Df4zWPOxd3I/'),
    (14, 'Thegusta.cards', 'Gustavo', 'post', 'https://www.instagram.com/p/Df5GdeWubyi/')
  ) as v(posicao, nome, pessoa, tipo, link_url);
