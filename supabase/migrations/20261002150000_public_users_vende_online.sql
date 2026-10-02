-- ============================================================================
-- public_users.vende_online -- o Mercado precisa saber que a PESSOA vende
-- ============================================================================
-- ★ O BUG QUE ISTO FECHA (02/10/2026). A Barbara ficou com o recebimento
--   ATIVO as 11:03 (primeira pessoa fisica da Bynx), a pagina do anuncio
--   passou a mostrar "Comprar agora" -- e o MERCADO continuou oferecendo
--   "Tenho interesse" nos 13 anuncios dela.
--
--   Nao era cache. A `/anuncio/[slug]` roda no SERVIDOR com service role e
--   enxerga `users` inteiro; o `/marketplace` roda no NAVEGADOR com a chave
--   anon e so sabe consultar `lojas`. Quem nao tem loja nunca vira
--   "pode comprar", por mais ativo que esteja o Connect dele.
--
-- ★ POR QUE O NAVEGADOR NAO SABIA. A migration 20260924210000 colocou o
--   Connect em `users` e registrou, de proposito, que `public_users` ENUMERA
--   colunas -- entao coluna nova nao entra nela sozinha. Aquilo protegeu o
--   account_id e o CEP, e de quebra escondeu o unico fato que a vitrine
--   precisava.
--
-- ★ O QUE ESTA COLUNA REVELA, E O QUE NAO. So o booleano: esta pessoa
--   consegue fechar venda online. NAO expoe `stripe_connect_account_id`,
--   NAO expoe o CEP, NAO expoe status nem requisitos pendentes. E o mesmo
--   fato que a pagina publica do anuncio ja anuncia ao desenhar o botao
--   "Comprar agora" -- nao ha exposicao nova, so a mesma chegando onde
--   faltava.
--
-- ★ O CEP ENTRA NA CONTA porque frete de pessoa fisica e sempre CALCULADO
--   (ver `src/lib/vendedorRecebimento.ts`): sem CEP de origem a cotacao nao
--   sai e o checkout quebraria DEPOIS do clique. Prometer "Comprar" ali
--   seria oferecer o que nao fecha.
--
-- ★ A COLUNA VAI NO FIM: `create or replace view` so aceita acrescentar no
--   final, nunca reordenar ou retipar o que ja existe.
--
-- A view segue SEM `security_invoker` (como esta hoje, reloptions null): e
-- ela que permite ao anon ler nome de terceiro apesar da RLS de `users`.
-- Grants ficam como estao -- anon e authenticated com SELECT apenas.
-- ============================================================================

create or replace view public.public_users as
  select
    id,
    name,
    username,
    case when perfil_publico then city else null::text end as city,
    is_pro,
    created_at,
    perfil_publico,
    perfil_ocultar_valores,
    (
      connect_charges_enabled is true
      and length(regexp_replace(coalesce(cep, ''), '\D', '', 'g')) = 8
    ) as vende_online
  from users;

comment on view public.public_users is
  'Colunas publicas de users, enumeradas uma a uma. `vende_online` diz apenas se a pessoa fecha venda online (Connect liberado + CEP de origem valido) -- nunca a conta, o status ou o CEP.';
