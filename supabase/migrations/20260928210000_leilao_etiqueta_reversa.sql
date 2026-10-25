-- ============================================================================
-- Desistencia: etiqueta reversa pelo Melhor Envio, paga pela Bynx (#500)
-- ============================================================================
-- POR QUE (decisao do Du, opcao A de 10/10; desenho aprovado em 25/10): na
-- etapa 1 o comprador postava por conta propria e digitava o rastreio. Agora a
-- Bynx compra a logistica reversa dos Correios no Melhor Envio
-- (POST /api/v2/me/cart/reverse -> checkout -> generate): o comprador recebe
-- um CODIGO DE POSTAGEM, sem imprimir etiqueta, e o rastreio da devolucao
-- chega sozinho (o cron consulta o pedido no Melhor Envio).
--
-- Regras novas embutidas no desenho:
--   - o prazo de 7 dias para postar so comeca quando o codigo fica pronto
--     (postar_ate e regravado nessa hora; enquanto a etiqueta nao esta
--     pronta a desistencia nao expira -- acaoDevolucao);
--   - a entrega na loja passa a ser marcada pelo rastreio (o botao do admin
--     vira plano B);
--   - o custo da etiqueta (etiqueta_custo_cents) sai da comissao que voltaria
--     para a loja no estorno (lib/custoEstorno), e o que a comissao nao cobrir
--     vira debito da loja (vendedor_debitos).
--
-- etiqueta_status:
--   null      fluxo da etapa 1 (sem etiqueta: o comprador informa o rastreio)
--   gerando   pedido de etiqueta em andamento (ou a ser repetido pelo cron)
--   pronta    codigo de postagem disponivel
--   falhou    o Melhor Envio recusou; etiqueta_erro diz por que. O cron tenta
--             de novo ate 5 vezes; depois disso so o admin.
-- etiqueta_resposta guarda a ultima resposta do Melhor Envio: a documentacao
-- nao diz em que campo o codigo de postagem vem, e o sandbox nao gera o codigo.
--
-- Rollback:
--   alter table public.pedido_reclamacoes
--     drop column if exists etiqueta_status, drop column if exists etiqueta_me_id,
--     drop column if exists etiqueta_protocolo, drop column if exists etiqueta_codigo,
--     drop column if exists etiqueta_servico, drop column if exists etiqueta_custo_cents,
--     drop column if exists etiqueta_paga_em, drop column if exists etiqueta_gerada_em,
--     drop column if exists etiqueta_erro, drop column if exists etiqueta_tentativas,
--     drop column if exists etiqueta_resposta, drop column if exists etiqueta_rastreio_em;
-- ============================================================================

alter table public.pedido_reclamacoes
  add column if not exists etiqueta_status text
    check (etiqueta_status is null or etiqueta_status in ('gerando', 'pronta', 'falhou')),
  add column if not exists etiqueta_me_id text check (etiqueta_me_id is null or char_length(etiqueta_me_id) <= 64),
  add column if not exists etiqueta_protocolo text check (etiqueta_protocolo is null or char_length(etiqueta_protocolo) <= 64),
  add column if not exists etiqueta_codigo text check (etiqueta_codigo is null or char_length(etiqueta_codigo) <= 64),
  add column if not exists etiqueta_servico smallint,
  add column if not exists etiqueta_custo_cents integer check (etiqueta_custo_cents is null or etiqueta_custo_cents >= 0),
  add column if not exists etiqueta_paga_em timestamptz,
  add column if not exists etiqueta_gerada_em timestamptz,
  add column if not exists etiqueta_erro text check (etiqueta_erro is null or char_length(etiqueta_erro) <= 500),
  add column if not exists etiqueta_tentativas integer not null default 0 check (etiqueta_tentativas >= 0),
  add column if not exists etiqueta_resposta jsonb,
  add column if not exists etiqueta_rastreio_em timestamptz;

alter table public.pedido_reclamacoes
  add constraint pedido_reclamacoes_etiqueta_pronta_ck
    check (etiqueta_status is distinct from 'pronta' or etiqueta_codigo is not null);

comment on column public.pedido_reclamacoes.etiqueta_status is
  'Desistencia com etiqueta reversa (Melhor Envio, paga pela Bynx): gerando | pronta | falhou. null = etapa 1 (comprador informa o rastreio).';
comment on column public.pedido_reclamacoes.etiqueta_custo_cents is
  'Quanto a Bynx pagou pela etiqueta reversa. Sai da comissao devolvida a loja no estorno (lib/custoEstorno).';
