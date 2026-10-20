-- ============================================================================
-- Desistencia contestada: tipo da contestacao e destino da carta (#501)
-- ============================================================================
-- POR QUE (decisao do Du, 20/10/2026): na desistencia contestada, "improcedente"
-- deixava a loja com o dinheiro E com a carta que voltou. Regra nova:
--   - a loja diz O QUE voltou errado:
--       'dano'  = a carta certa, com dano novo -> so estorno total ou parcial
--                 (art. 49 do CDC: desistir nao depende de motivo; a loja so
--                 cobra o prejuizo). A carta fica com a loja.
--       'troca' = carta trocada, de menor valor ou envelope vazio -> pode ser
--                 improcedente. VIDEO DA ABERTURA OBRIGATORIO (sem ele e a
--                 palavra da loja contra a do comprador).
--   - no improcedente de desistencia a Bynx registra o destino do que chegou:
--       'devolver_comprador' (frete por conta do comprador) ou 'retida_prova'.
-- A regra "improcedente so em troca" mora no TS (planejarDecisao, com
-- autoteste), porque a excecao do chargeback (pedidos.em_disputa) esta em
-- outra tabela. O banco garante o que da para garantir por linha.
--
-- Rollback:
--   alter table public.pedido_reclamacoes
--     drop constraint if exists pedido_reclamacoes_improcedente_destino_ck,
--     drop constraint if exists pedido_reclamacoes_troca_video_ck,
--     drop column if exists destino_carta,
--     drop column if exists contestacao_tipo;
-- ============================================================================

alter table public.pedido_reclamacoes
  add column if not exists contestacao_tipo text
    check (contestacao_tipo is null or contestacao_tipo in ('dano', 'troca')),
  add column if not exists destino_carta text
    check (destino_carta is null or destino_carta in ('devolver_comprador', 'retida_prova'));

alter table public.pedido_reclamacoes
  add constraint pedido_reclamacoes_troca_video_ck
    check (contestacao_tipo is distinct from 'troca' or contestacao_video_url is not null);

-- O destino e gravado ANTES do pedido_reclamacao_resolver (rota do admin);
-- resolver um improcedente de desistencia sem ele falha aqui.
alter table public.pedido_reclamacoes
  add constraint pedido_reclamacoes_improcedente_destino_ck
    check (motivo <> 'arrependimento' or decisao is distinct from 'improcedente' or destino_carta is not null);

comment on column public.pedido_reclamacoes.contestacao_tipo is
  'Desistencia contestada: dano (carta certa com dano novo, so estorno total/parcial) ou troca (carta trocada/vazio, pode ser improcedente; video obrigatorio).';
comment on column public.pedido_reclamacoes.destino_carta is
  'Desistencia improcedente: o que a loja faz com o que chegou. devolver_comprador (frete do comprador) ou retida_prova.';
