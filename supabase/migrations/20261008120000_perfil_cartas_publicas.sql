-- ============================================================================
-- Perfil publico: leitura das cartas por RPC, com os valores mascarados.
-- Parte A (aditiva) do fechamento do #485. A parte B e a policy, em
-- 20261008120100_user_cards_policy_valores_ocultos.sql -- so depois que o app
-- passar a ler por aqui.
--
-- Preparada em 08/10/2026 para revisao do Du. NAO aplicada.
--
-- O QUE FECHA: a opcao "ocultar valores" escondia na tela, nao no dado. O
-- payload do perfil foi corrigido no app (2b0fb84); sobrou a REST direta:
-- qualquer visitante, com a chave publica, lia user_cards de um perfil com
-- valores ocultos e recebia valor_graduada de cada carta (medido: 65 linhas
-- do rmgcards07, content-range 0-64/65). Decisao do Du (08/10): a opcao
-- esconde TUDO que tem valor. Cartas, quantidade e progresso continuam
-- publicos -- e o que o perfil sempre mostrou.
--
-- DESENHO: duas funcoes, mesmo molde de is_profile_public e pasta_publica
-- (security definer, search_path fixo, stable).
--   perfil_valores_ocultos(uid)       -> a flag do dono, legivel sem abrir users.
--   perfil_cartas_publicas(p_user_id) -> as colunas que o perfil publico usa;
--                                        valor_graduada vem NULL quando o dono
--                                        esconde valores e quem le nao e ele.
--                                        Perfil privado devolve zero linhas
--                                        para terceiros, como a policy de hoje.
--
-- ★ CUSTO DE IO: dezenas de buffers. E um `where user_id = $1` em user_cards
--   (7,5 mil linhas, indice em user_id), o mesmo que a policy atual ja faz.
--   Nada toca a pokemon_cards_all.
--
-- ROLLBACK: drop function public.perfil_cartas_publicas(uuid);
--           drop function public.perfil_valores_ocultos(uuid);
-- ============================================================================

create or replace function public.perfil_valores_ocultos(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select perfil_ocultar_valores from public.users where id = uid), false)
$$;

revoke all on function public.perfil_valores_ocultos(uuid) from public;
grant execute on function public.perfil_valores_ocultos(uuid) to anon, authenticated, service_role;

create or replace function public.perfil_cartas_publicas(p_user_id uuid)
returns table (
  card_name text,
  variante text,
  quantity integer,
  card_image text,
  set_name text,
  set_id text,
  pokemon_api_id text,
  card_link text,
  graduada boolean,
  valor_graduada numeric,
  origem text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    uc.card_name,
    uc.variante,
    uc.quantity,
    uc.card_image,
    uc.set_name,
    uc.set_id,
    uc.pokemon_api_id,
    uc.card_link,
    uc.graduada,
    -- O dono ve o proprio valor; terceiro so ve quando o dono nao esconde.
    case
      when auth.uid() = p_user_id then uc.valor_graduada
      when public.perfil_valores_ocultos(p_user_id) then null
      else uc.valor_graduada
    end as valor_graduada,
    uc.origem
  from public.user_cards uc
  where uc.user_id = p_user_id
    and (auth.uid() = p_user_id or public.is_profile_public(p_user_id))
$$;

revoke all on function public.perfil_cartas_publicas(uuid) from public;
grant execute on function public.perfil_cartas_publicas(uuid) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- /destaque (ranking de maior colecao e set mais completo) lia user_cards
-- inteira pelo client anonimo, filtrado pela policy publica. Com a parte B,
-- quem esconde valores sumiria do ranking -- e o ranking e de CONTAGEM, nao
-- de dinheiro, entao nao e isso que a opcao promete esconder. Esta RPC
-- devolve so o que o ranking usa (user_id, set_id, quantity) dos perfis
-- publicos, com ou sem valores ocultos. Sem valor_graduada, sem nome.
--
-- ★ CUSTO DE IO, medido em producao em 08/10 (explain analyze, buffers):
--   `where is_profile_public(user_id)` -- o que a policy publica faz hoje por
--   linha -- da 23.088 buffers e 74 ms quente: a subconsulta em users roda
--   7,5 mil vezes. O semi-join abaixo da 378 buffers e 4,9 ms (hash join,
--   users 23 buffers + user_cards 355). Mesma semantica: is_profile_public e
--   coalesce(perfil_publico, false). Roda uma vez a cada revalidate do
--   /destaque, nao por visita.
-- ROLLBACK: drop function public.perfil_destaque_cartas();
-- ----------------------------------------------------------------------------

create or replace function public.perfil_destaque_cartas()
returns table (user_id uuid, set_id text, quantity integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select uc.user_id, uc.set_id, uc.quantity
  from public.user_cards uc
  where uc.user_id in (select u.id from public.users u where u.perfil_publico = true)
$$;

revoke all on function public.perfil_destaque_cartas() from public;
grant execute on function public.perfil_destaque_cartas() to anon, authenticated, service_role;
