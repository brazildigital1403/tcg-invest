-- Carga da Trend Sombria (Halloween), 11/11/2026: os links na ordem que o Du mandou.
-- 25 creators ja postaram; Doisll (sem link ainda), Memmel, Dede e CasalTCG aguardam.
-- Capas: trends/sombria/NN.webp no bucket club-fotos (NN = posicao), baixadas do preview
-- publico de cada post em 11/11/2026. Quem nao postou fica sem capa (inicial do nome).
with t as (
  insert into public.club_trends (slug, titulo, tema, status, ordem, publicado_em)
  values ('trend-sombria-halloween-2026', 'Trend Sombria', 'Halloween', 'publicado', 1, now())
  returning id
)
insert into public.club_trend_posts (trend_id, posicao, nome, pessoa, tipo, link_url, status, capa_path)
select t.id, v.posicao, v.nome, v.pessoa, v.tipo, v.link_url, v.status,
       case when v.status = 'publicado' then 'trends/sombria/' || lpad(v.posicao::text, 2, '0') || '.webp' end
from t, (values
    (1, 'Minadosloots', 'Mika', 'reel', 'https://www.instagram.com/reel/Dezusfyt-0v/', 'publicado'),
    (2, 'Tocadozard', 'Toca do Zard', 'reel', 'https://www.instagram.com/reel/De0Bo5svPXW/', 'publicado'),
    (3, 'Luctcg', null, 'post', 'https://www.instagram.com/p/De0MdwlR_Xc/', 'publicado'),
    (4, 'Zubatbebado', 'Zuba', 'post', 'https://www.instagram.com/p/De11BuGRDnk/', 'publicado'),
    (5, 'Carteadodomat', 'Mat', 'post', 'https://www.instagram.com/p/De2C4Cttz6x/', 'publicado'),
    (6, 'Meilli', 'Meili', 'post', 'https://www.instagram.com/p/De9jSpTBAPD/', 'publicado'),
    (7, 'Hitcouple', 'Lucas e Ju', 'post', 'https://www.instagram.com/p/DfAxns5stHL/', 'publicado'),
    (8, 'Kyoube', 'Augusto', 'reel', 'https://www.instagram.com/reel/DfA05hoBlSQ/', 'publicado'),
    (9, 'Pixelandia', 'Edu', 'post', 'https://www.instagram.com/p/DfCvgBEhoB8/', 'publicado'),
    (10, 'Jeff', null, 'post', 'https://www.instagram.com/p/DfC14iGhwK3/', 'publicado'),
    (11, 'Larita.tcg', 'Lara', 'post', 'https://www.instagram.com/p/DfHsUHUR6aj/', 'publicado'),
    (12, 'Nai', null, 'post', 'https://www.instagram.com/p/DfIpibzxX01/', 'publicado'),
    (13, 'Jess', null, 'post', 'https://www.instagram.com/p/DfI4Ij9R_Jc/', 'publicado'),
    (14, 'Ochicodotcg', 'Renan', 'post', 'https://www.instagram.com/p/DfKF6SixR6r/', 'publicado'),
    (15, 'Doisll', 'Pedro', 'post', null, 'aguardando'),
    (16, 'Nateil', null, 'post', 'https://www.instagram.com/p/DfLWnMvgmEp/', 'publicado'),
    (17, 'Binx', 'Edu', 'post', 'https://www.instagram.com/p/DfLb9ggxJid/', 'publicado'),
    (18, 'Mr.Oliver', null, 'reel', 'https://www.instagram.com/reel/DfQQSlxBIwX/', 'publicado'),
    (19, 'Ju Costa', null, 'reel', 'https://www.instagram.com/reel/DfPPtLoRYKj/', 'publicado'),
    (20, 'PokeCézar', 'Cesar', 'reel', 'https://www.instagram.com/reel/DfSZdHmPM_U/', 'publicado'),
    (21, 'Zubatscave', 'Tiago', 'reel', 'https://www.instagram.com/reel/DfUty2jg2Wb/', 'publicado'),
    (22, 'Pspjoao', 'João Pires', 'post', 'https://www.instagram.com/p/DfaQa_kJE8E/', 'publicado'),
    (23, 'MassaFerri', null, 'post', 'https://www.instagram.com/p/Dfcks0qojpb/', 'publicado'),
    (24, 'CardsdoVictor', 'Victor', 'post', 'https://www.instagram.com/p/DfhmnoYhSvf/', 'publicado'),
    (25, 'Safarizonebinder', null, 'post', 'https://www.instagram.com/p/DfiCEPkxPI5/', 'publicado'),
    (26, 'GeekLau', null, 'post', 'https://www.instagram.com/p/DfiNo9Yv2lG/', 'publicado'),
    (27, 'Memmel', null, 'post', null, 'aguardando'),
    (28, 'Dedé', null, 'post', null, 'aguardando'),
    (29, 'CasalTCG', null, 'post', null, 'aguardando')
) as v(posicao, nome, pessoa, tipo, link_url, status);
