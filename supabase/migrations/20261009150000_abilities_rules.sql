-- abilities + rules -- Fase 3 do epico #490, item 4 (09/10/2026).
--
-- As duas colunas NAO existiam nem na tabela base: das 20.366 cartas
-- oficiais, 2.783 Treinador e 392 Energia nao tem ataque -- o texto delas e o
-- `rules` -- e a habilidade dos Pokemon nunca entrou. Nulas, instantaneas.
--
-- ★ A view pokemon_cards e recriada porque coluna nova na base NAO aparece
-- nela sozinha (regra da casa, 28/07/2026). Mesmas 83 colunas na mesma ordem
-- + as 2 novas no fim (CREATE OR REPLACE so aceita acrescentar no fim),
-- mesmo `security_invoker = true` (e o que mantem a RLS da base valendo e o
-- anon sem leitura), mesmo filtro de `oculto`. ACL e preservada pelo REPLACE.
--
-- O preenchimento e feito pelo script bynx-scan/scripts/backfill-abilities-
-- rules.mjs, na Mia Servidor, em lotes de 2.000 pela PK com 60 s de espaco
-- (molde do #113), em outro dia pelo orcamento de IO.
-- Rollback: drop view + recriar sem as 2 colunas; alter table ... drop column.

alter table public.pokemon_cards_all
  add column if not exists abilities jsonb,
  add column if not exists rules text[];

comment on column public.pokemon_cards_all.abilities is 'Habilidades da carta (API oficial: [{name, text, type}]). Backfill 10/2026.';
comment on column public.pokemon_cards_all.rules is 'Texto de regra da carta (Treinador, Energia, ex/V/VMAX). API oficial. Backfill 10/2026.';

create or replace view public.pokemon_cards
with (security_invoker = true)
as
select
  id, name, number, rarity, artist, image_small, image_large, set_id, set_name, set_series, set_release_date, set_total, set_logo, set_symbol, hp, types, supertype, subtypes, attacks, weaknesses, resistances, retreat_cost, flavor_text, legalities, price_usd_normal, price_usd_holofoil, price_usd_reverse, price_usd_1st_edition, price_eur_normal, price_eur_holofoil, price_eur_reverse, liga_cid, liga_link, preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball, preco_min, preco_medio, preco_max, preco_foil_min, preco_foil_medio, preco_foil_max, preco_promo_min, preco_promo_medio, preco_promo_max, preco_reverse_min, preco_reverse_medio, preco_reverse_max, tcg_updated_at, liga_updated_at, created_at, preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max, base_pokemon_names, outras_variantes, excluded_from_scan, excluded_reason, excluded_at, number_norm, is_canary, regiao, slug, idioma, liga_last_attempt_at, liga_fail_streak, name_pt, set_name_pt, oculto, ultima_venda_cents, ultima_venda_variante, ultima_venda_condicao, ultima_venda_idioma, ultima_venda_atualizado_em, liga_range_min, liga_range_max, vendas_3m_qtd_label, vendas_3m_min_cents, vendas_3m_medio_cents, vendas_3m_max_cents, vendas_3m_capturado_em,
  abilities,
  rules
from public.pokemon_cards_all
where not oculto;
