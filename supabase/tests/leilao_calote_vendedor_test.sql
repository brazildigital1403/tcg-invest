-- ============================================================================
-- Roteiro de teste de 20260928150000_leilao_calote_vendedor.sql.
--
-- Rodar como UMA transacao. O ultimo bloco levanta LEILAO_CALOTE_VENDEDOR_TODOS_OK
-- de proposito: a transacao inteira volta (fixtures e o tick incluidos) e o
-- banco fica como estava. Qualquer outra mensagem e falha ("FALHOU Tn").
--
-- O tick do passo T4 roda sobre o banco inteiro (outros lotes de teste tambem
-- podem mudar), mas so dentro desta transacao, que volta no final.
-- ============================================================================

begin;

-- Vendedores:
--   a1 loja ativa com conta propria e cobranca ligada, frete fixo  -> recebe
--   a2 pessoa sem loja, conta propria, cobranca ligada, com CEP     -> recebe
--   a3 loja ativa sem conta, pessoa sem conta                       -> nao recebe
-- a4 e o comprador.
insert into public.users (id, name, email, username, cpf, cep,
                          stripe_connect_account_id, stripe_connect_status, connect_charges_enabled) values
  ('a8000000-0000-4000-8000-000000000001', 'Loja Recebe', 'cv-01@teste.invalid', 'cvlojarecebe', '99999999981', '01001000', null, 'nao_iniciado', false),
  ('a8000000-0000-4000-8000-000000000002', 'Pessoa Recebe', 'cv-02@teste.invalid', 'cvpessoarecebe', '99999999982', '01001000', 'acct_teste_pessoa', 'ativo', true),
  ('a8000000-0000-4000-8000-000000000003', 'Loja Sem Conta', 'cv-03@teste.invalid', 'cvlojasemconta', '99999999983', '01001000', null, 'nao_iniciado', false),
  ('a8000000-0000-4000-8000-000000000004', 'Comprador CV', 'cv-04@teste.invalid', 'cvcomprador', '99999999984', '01001000', null, 'nao_iniciado', false)
on conflict (id) do nothing;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado, status,
                          stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, frete_modo, cep) values
  ('f8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'cv-loja-recebe', 'CV Loja Recebe', 'Sao Paulo', 'SP', 'ativa',
   'acct_teste_loja', 'ativo', true, 'fixo', '01001000'),
  ('f8000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-000000000003', 'cv-loja-sem-conta', 'CV Loja Sem Conta', 'Sao Paulo', 'SP', 'ativa',
   null, 'nao_iniciado', false, 'fixo', '01001000')
on conflict (id) do nothing;

do $$
begin
  assert not has_function_privilege('authenticated', 'public.leilao_vendedor_recebe(uuid)', 'execute'),
    'FALHOU T0a: authenticated executa leilao_vendedor_recebe';
  assert not has_function_privilege('authenticated', 'public.leilao_registrar_bloqueio(uuid)', 'execute'),
    'FALHOU T0b: authenticated executa leilao_registrar_bloqueio';
  assert not has_function_privilege('anon', 'public.leilao_registrar_bloqueio(uuid)', 'execute'),
    'FALHOU T0c: anon executa leilao_registrar_bloqueio';
  assert not has_column_privilege('anon', 'public.leiloes', 'bloqueio_vendedor_em', 'select'),
    'FALHOU T0d: anon le bloqueio_vendedor_em';
  assert not has_column_privilege('authenticated', 'public.leiloes', 'bloqueio_vendedor_em', 'select'),
    'FALHOU T0e: authenticated le bloqueio_vendedor_em';
end $$;

-- T1: leilao_vendedor_recebe espelha o podeVender do checkout.
do $$
begin
  assert public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000001'), 'FALHOU T1a: loja com conta nao recebe';
  assert public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000002'), 'FALHOU T1b: pessoa com conta nao recebe';
  assert not public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000003'), 'FALHOU T1c: loja sem conta recebe';
  assert not public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000099'), 'FALHOU T1d: vendedor inexistente recebe';

  update public.lojas set connect_charges_enabled = false where id = 'f8000000-0000-4000-8000-000000000001';
  assert not public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000001'), 'FALHOU T1e: loja com cobranca desligada recebe';
  update public.lojas set connect_charges_enabled = true where id = 'f8000000-0000-4000-8000-000000000001';

  -- Frete calculado sem CEP na loja cai no CEP do dono (mesma regra do TS).
  update public.lojas set frete_modo = 'calculado', cep = null where id = 'f8000000-0000-4000-8000-000000000001';
  assert public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000001'), 'FALHOU T1f: CEP do dono nao valeu';
  update public.users set cep = null where id = 'a8000000-0000-4000-8000-000000000001';
  assert not public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000001'), 'FALHOU T1g: frete calculado sem CEP recebe';
  update public.users set cep = '01001000' where id = 'a8000000-0000-4000-8000-000000000001';
  update public.lojas set frete_modo = 'fixo', cep = '01001000' where id = 'f8000000-0000-4000-8000-000000000001';

  -- Loja sem conta propria herda a do dono.
  update public.users set stripe_connect_account_id = 'acct_teste_dono', connect_charges_enabled = true
   where id = 'a8000000-0000-4000-8000-000000000003';
  assert public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000003'), 'FALHOU T1h: loja nao herdou a conta do dono';
  update public.users set stripe_connect_account_id = null, connect_charges_enabled = false
   where id = 'a8000000-0000-4000-8000-000000000003';

  -- Pessoa sem CEP nao recebe (frete sempre calculado).
  update public.users set cep = null where id = 'a8000000-0000-4000-8000-000000000002';
  assert not public.leilao_vendedor_recebe('a8000000-0000-4000-8000-000000000002'), 'FALHOU T1i: pessoa sem CEP recebe';
  update public.users set cep = '01001000' where id = 'a8000000-0000-4000-8000-000000000002';
end $$;

-- Lotes vencidos ha 20 min (passam da carencia de 15), todos com o mesmo comprador:
--   b1 loja que recebe, COM bloqueio registrado   -> cancelado
--   b2 loja sem conta, sem bloqueio               -> cancelado
--   b3 loja que recebe, sem bloqueio              -> calote
--   b4 loja sem conta, mas com pedido pago        -> continua aguardando (adiado)
--   b5 pessoa que recebe, sem bloqueio            -> calote
--   b6 ainda no prazo                             -> intocado
insert into public.leiloes (id, vendedor_user_id, loja_id, card_name, slug, lance_inicial_cents,
                            preco_atual_cents, lider_user_id, lider_maximo_cents, n_lances,
                            duracao_seg, status, inicia_em, termina_em, encerrado_em, pagar_ate)
select v.id, v.vend, v.loja, 'Carta CV', 'carta-cv-' || right(v.id::text, 2), 1000,
       5000, 'a8000000-0000-4000-8000-000000000004', 5000, 2, 60, 'aguardando_pagamento',
       now() - interval '3 days', now() - interval '2 days', now() - interval '2 days', v.pagar
  from (values
    ('b8000000-0000-4000-8000-000000000001'::uuid, 'a8000000-0000-4000-8000-000000000001'::uuid, 'f8000000-0000-4000-8000-000000000001'::uuid, now() - interval '20 minutes'),
    ('b8000000-0000-4000-8000-000000000002'::uuid, 'a8000000-0000-4000-8000-000000000003'::uuid, 'f8000000-0000-4000-8000-000000000003'::uuid, now() - interval '20 minutes'),
    ('b8000000-0000-4000-8000-000000000003'::uuid, 'a8000000-0000-4000-8000-000000000001'::uuid, 'f8000000-0000-4000-8000-000000000001'::uuid, now() - interval '20 minutes'),
    ('b8000000-0000-4000-8000-000000000004'::uuid, 'a8000000-0000-4000-8000-000000000003'::uuid, 'f8000000-0000-4000-8000-000000000003'::uuid, now() - interval '20 minutes'),
    ('b8000000-0000-4000-8000-000000000005'::uuid, 'a8000000-0000-4000-8000-000000000002'::uuid, null::uuid, now() - interval '20 minutes'),
    ('b8000000-0000-4000-8000-000000000006'::uuid, 'a8000000-0000-4000-8000-000000000003'::uuid, 'f8000000-0000-4000-8000-000000000003'::uuid, now() + interval '10 hours')
  ) as v(id, vend, loja, pagar);

insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, frete_cents, acrescimo_cents, total_comprador_cents,
                            comissao_bynx_cents, liquido_loja_cents, metodo, repasse_prazo,
                            status, leilao_id, pago_em)
values ('e8000000-0000-4000-8000-000000000004', 'f8000000-0000-4000-8000-000000000003',
        'a8000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-000000000004', 'Carta CV',
        5000, 0, 490, 5490, 880, 4610, 'cartao', 30, 'pago', 'b8000000-0000-4000-8000-000000000004', now() - interval '1 day');

-- T2: registrar o bloqueio grava uma vez e enfileira um aviso so.
do $$
declare n int; v_em timestamptz;
begin
  -- b1 precisa do bloqueio ANTES de vencer: volta o prazo, registra, e vence de novo.
  update public.leiloes set pagar_ate = now() + interval '1 hour' where id = 'b8000000-0000-4000-8000-000000000001';
  assert public.leilao_registrar_bloqueio('b8000000-0000-4000-8000-000000000001'), 'FALHOU T2a: primeira chamada nao registrou';
  assert not public.leilao_registrar_bloqueio('b8000000-0000-4000-8000-000000000001'), 'FALHOU T2b: segunda chamada registrou de novo';
  select bloqueio_vendedor_em into v_em from public.leiloes where id = 'b8000000-0000-4000-8000-000000000001';
  assert v_em is not null, 'FALHOU T2c: bloqueio_vendedor_em vazio';
  select count(*) into n from public.leilao_eventos
   where leilao_id = 'b8000000-0000-4000-8000-000000000001' and tipo = 'pagamento_bloqueado';
  assert n = 1, format('FALHOU T2d: %s eventos pagamento_bloqueado (esperava 1)', n);
  assert (select user_id from public.leilao_eventos
           where leilao_id = 'b8000000-0000-4000-8000-000000000001' and tipo = 'pagamento_bloqueado')
         = 'a8000000-0000-4000-8000-000000000004', 'FALHOU T2e: evento sem o comprador';
  update public.leiloes set pagar_ate = now() - interval '20 minutes' where id = 'b8000000-0000-4000-8000-000000000001';

  -- Lote que nao aguarda pagamento nao registra.
  assert not public.leilao_registrar_bloqueio('b8000000-0000-4000-8000-000000000099'), 'FALHOU T2f: lote inexistente registrou';
end $$;

-- T3: o tick separa calote de cancelamento por falha da loja.
do $$
declare v jsonb; r record;
begin
  v := public.leilao_tick();
  assert (v->>'cancelados_vendedor') is not null, format('FALHOU T3a: tick sem cancelados_vendedor: %s', v);

  select status, cancelado_motivo into r from public.leiloes where id = 'b8000000-0000-4000-8000-000000000001';
  assert r.status = 'cancelado' and r.cancelado_motivo = 'vendedor_sem_recebimento',
    format('FALHOU T3b: b1 com bloqueio ficou %s / %s', r.status, r.cancelado_motivo);

  select status, cancelado_motivo into r from public.leiloes where id = 'b8000000-0000-4000-8000-000000000002';
  assert r.status = 'cancelado' and r.cancelado_motivo = 'vendedor_sem_recebimento',
    format('FALHOU T3c: b2 loja sem conta ficou %s / %s', r.status, r.cancelado_motivo);

  assert (select status from public.leiloes where id = 'b8000000-0000-4000-8000-000000000003') = 'calote',
    'FALHOU T3d: b3 (loja recebe, sem bloqueio) nao virou calote';
  assert (select status from public.leiloes where id = 'b8000000-0000-4000-8000-000000000004') = 'aguardando_pagamento',
    'FALHOU T3e: b4 com pedido pago saiu de aguardando_pagamento';
  assert (select status from public.leiloes where id = 'b8000000-0000-4000-8000-000000000005') = 'calote',
    'FALHOU T3f: b5 (pessoa recebe) nao virou calote';
  assert (select status from public.leiloes where id = 'b8000000-0000-4000-8000-000000000006') = 'aguardando_pagamento',
    'FALHOU T3g: b6 no prazo foi mexido';

  -- Eventos: cancelado_vendedor para b1/b2 (com o comprador), calote para b3/b5, nada de calote em b1/b2.
  assert (select count(*) from public.leilao_eventos
           where tipo = 'cancelado_vendedor' and user_id = 'a8000000-0000-4000-8000-000000000004'
             and leilao_id in ('b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000002')) = 2,
    'FALHOU T3h: faltou evento cancelado_vendedor';
  assert not exists (select 1 from public.leilao_eventos
                      where tipo = 'calote'
                        and leilao_id in ('b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000002')),
    'FALHOU T3i: lote cancelado por falha da loja tambem gerou calote';
  assert (select count(*) from public.leilao_eventos
           where tipo = 'calote'
             and leilao_id in ('b8000000-0000-4000-8000-000000000003', 'b8000000-0000-4000-8000-000000000005')) = 2,
    'FALHOU T3j: faltou evento calote';
  assert (select payload ? 'bloqueio_vendedor_em' from public.leilao_eventos
           where tipo = 'cancelado_vendedor' and leilao_id = 'b8000000-0000-4000-8000-000000000001'),
    'FALHOU T3k: payload sem bloqueio_vendedor_em';

  -- Segundo tick nao duplica nada.
  v := public.leilao_tick();
  assert (select count(*) from public.leilao_eventos
           where tipo in ('cancelado_vendedor', 'calote')
             and leilao_id::text like 'b8000000-%') = 4,
    'FALHOU T3l: segundo tick duplicou eventos';

  -- Bloqueio depois de cancelado nao registra.
  assert not public.leilao_registrar_bloqueio('b8000000-0000-4000-8000-000000000002'), 'FALHOU T3m: registrou em lote cancelado';
end $$;

do $$ begin raise exception 'LEILAO_CALOTE_VENDEDOR_TODOS_OK'; end $$;

rollback;
