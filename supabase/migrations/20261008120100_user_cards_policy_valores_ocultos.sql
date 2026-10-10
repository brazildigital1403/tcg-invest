-- ============================================================================
-- user_cards: a leitura publica passa a respeitar "ocultar valores".
-- Parte B do fechamento do #485. Depende da parte A
-- (20261008120000_perfil_cartas_publicas.sql) JA aplicada e do app JA lendo
-- o perfil por perfil_cartas_publicas -- senao o perfil de quem esconde
-- valores hidrata com 0 cartas e sem progresso por set.
--
-- Preparada em 08/10/2026 para revisao do Du. NAO aplicada.
--
-- ANTES: "Public read cards of public profiles" = is_profile_public(user_id).
--        Perfil publico com valores ocultos entregava tudo pela REST.
-- DEPOIS: a mesma policy, e mais a condicao de nao esconder valores. Quem
--        esconde continua com perfil publico (nome, cartas, progresso) --
--        so que esses dados saem pela RPC, que mascara o valor_graduada.
--        O dono segue lendo as proprias cartas por "Users can see their cards".
--
-- QUEM MAIS LIA user_cards de terceiro pela policy publica (mapeado 08/10):
--   /perfil (PerfilClient)   -> muda para a RPC (app).
--   /destaque (ranking)      -> muda para a chave de servico (server-only,
--                               agregado publico de contagem, nao de valor).
--   /perfil layout metadata  -> ja usa supabaseAdmin, nao muda.
--   pasta_publica / perfil_pastas_publicas -> security definer, nao mudam.
--
-- ★ CUSTO DE IO: zero. Policy e so texto; nenhuma varredura.
--
-- ROLLBACK (uma linha de cada):
--   drop policy "Public read cards of public profiles" on public.user_cards;
--   create policy "Public read cards of public profiles" on public.user_cards
--     for select using (public.is_profile_public(user_id));
-- ============================================================================

drop policy if exists "Public read cards of public profiles" on public.user_cards;

create policy "Public read cards of public profiles"
  on public.user_cards
  for select
  using (
    public.is_profile_public(user_id)
    and not public.perfil_valores_ocultos(user_id)
  );
