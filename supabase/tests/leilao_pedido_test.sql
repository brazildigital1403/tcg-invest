-- ============================================================================
-- Roteiro de prova da fatia 2 (20260928100000_leilao_pedido.sql).
--
-- ★ TEM DE RODAR COMO TRANSACAO UNICA: `psql -1 -v ON_ERROR_STOP=1 -f` ou o
--   arquivo inteiro num unico execute_sql (um texto so). Rodado comando a
--   comando (autocommit), as fixtures FICAM no banco e o raise do fim nao
--   desfaz nada.
-- SEM begin/rollback de proposito: o ultimo comando e
-- `raise exception 'LEILAO_PEDIDO_TODOS_OK'` -- a excecao desfaz tudo e nao
-- deixa rastro. Chegar nela = tudo passou. Qualquer outra excecao
-- ("FALHOU Tn: ...") para antes e aponta o bloco.
--
-- Rodar SO na branch de prova, como `postgres`, com o motor
-- (20260928090000) e esta migration ja aplicados NA BRANCH. Nunca em producao.
--
-- Usuarios: a100...01 vendedor | a100...02 comprador | a100...03 authenticated qualquer
-- Loja:     f100...01 (pedidos.loja_id pode ser NOT NULL na branch)
-- Lotes:    b100...01 aguardando_pagamento | b100...02 calote | b100...03 cancelado
--           b100...04 vira calote no T10 (e volta a vendido no T11)
--           b100...05 calote (T8g)
-- Pedidos:  e100...01..07
-- ============================================================================

-- ─── Fixtures ───────────────────────────────────────────────────────────────

insert into public.users (id, name, email, username, cpf, cep) values
  ('a1000000-0000-4000-8000-000000000001', 'Vendedor Pedido', 'leilao-p01@teste.invalid', 'vendedorpedido', '99999999911', '01001000'),
  ('a1000000-0000-4000-8000-000000000002', 'Comprador Pedido', 'leilao-p02@teste.invalid', 'compradorpedido', '99999999912', '01001000')
on conflict (id) do update set cpf = excluded.cpf, cep = excluded.cep, username = excluded.username;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado)
values ('f1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
        'leilao-pedido-loja', 'Loja Teste Pedido', 'Sao Paulo', 'SP')
on conflict (id) do nothing;

insert into public.leiloes (id, vendedor_user_id, loja_id, card_name, slug, lance_inicial_cents,
                            preco_atual_cents, lider_user_id, lider_maximo_cents, n_lances,
                            duracao_seg, status, inicia_em, termina_em, encerrado_em, pagar_ate)
values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'Pikachu', 'pikachu-pedido-1', 1000,
   5000, 'a1000000-0000-4000-8000-000000000002', 5000, 3, 60, 'aguardando_pagamento',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', now() + interval '47 hours'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'Eevee', 'eevee-pedido-2', 1000,
   3000, 'a1000000-0000-4000-8000-000000000002', 3000, 2, 60, 'calote',
   now() - interval '60 hours', now() - interval '50 hours', now() - interval '50 hours', now() - interval '2 hours'),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'Mew', 'mew-pedido-3', 1000,
   null, null, null, 0, 60, 'cancelado',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', null),
  ('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'Ditto', 'ditto-pedido-5', 1000,
   2000, 'a1000000-0000-4000-8000-000000000002', 2000, 1, 60, 'calote',
   now() - interval '60 hours', now() - interval '50 hours', now() - interval '50 hours', now() - interval '2 hours');

-- Pedido 01: checkout aberto do lote 01.
insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, frete_cents, acrescimo_cents, total_comprador_cents,
                            comissao_bynx_cents, liquido_loja_cents, metodo, repasse_prazo,
                            stripe_session_id, status, leilao_id)
values ('e1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Pikachu',
        5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'cs_test_leilao_p01', 'aguardando_pagamento',
        'b1000000-0000-4000-8000-000000000001');

-- ─── T1: item de leilao entra; sem origem ou com duas origens nao ───────────
insert into public.pedido_itens (pedido_id, leilao_id, nome, tipo, preco_cents, quantidade)
values ('e1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
        'Pikachu', 'carta', 5000, 1);

do $$
begin
  insert into public.pedido_itens (pedido_id, nome, tipo, preco_cents, quantidade)
  values ('e1000000-0000-4000-8000-000000000001', 'Sem origem', 'carta', 100, 1);
  raise exception 'FALHOU T1: aceitou item sem origem';
exception when check_violation then null;
end $$;

-- T1b: a definicao das duas CHECKs, independente de haver anuncio na branch.
do $$
declare d text;
begin
  select pg_get_constraintdef(c.oid) into d from pg_constraint c
   where c.conname = 'pedido_itens_origem_chk' and c.conrelid = 'public.pedido_itens'::regclass;
  assert d is not null, 'FALHOU T1b: pedido_itens_origem_chk nao existe';
  assert d ~ 'num_nonnulls\(marketplace_id, produto_id, leilao_id\) = 1',
    format('FALHOU T1b: pedido_itens_origem_chk = %s', d);
  select pg_get_constraintdef(c.oid) into d from pg_constraint c
   where c.conname = 'pedidos_item_origem_chk' and c.conrelid = 'public.pedidos'::regclass;
  assert d is not null, 'FALHOU T1b: pedidos_item_origem_chk nao existe';
  assert d ~ 'num_nonnulls\(marketplace_id, produto_id, leilao_id\) <= 1',
    format('FALHOU T1b: pedidos_item_origem_chk = %s', d);
end $$;

do $$
declare v_mp uuid;
begin
  select id into v_mp from public.marketplace limit 1;
  if v_mp is null then
    raise notice 'T1c pulado: marketplace vazio na branch (a definicao ja foi conferida no T1b)';
    return;
  end if;
  begin
    insert into public.pedido_itens (pedido_id, marketplace_id, leilao_id, nome, tipo, preco_cents, quantidade)
    values ('e1000000-0000-4000-8000-000000000001', v_mp, 'b1000000-0000-4000-8000-000000000001',
            'Duas origens', 'carta', 100, 1);
    raise exception 'FALHOU T1c: aceitou item com duas origens';
  exception when check_violation then null;
  end;
end $$;

-- ─── T2: um checkout aberto por lote ────────────────────────────────────────
do $$
begin
  insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                              valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                              stripe_session_id, status, leilao_id)
  values ('e1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001',
          'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Pikachu',
          5000, 7490, 'cartao', 30, 'cs_test_leilao_p02', 'aguardando_pagamento',
          'b1000000-0000-4000-8000-000000000001');
  raise exception 'FALHOU T2: aceitou segundo pedido aberto do mesmo lote';
exception when unique_violation then null;
end $$;

-- Pedido cancelado do mesmo lote nao conta (historico permitido).
insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            stripe_session_id, status, leilao_id, cancelado_em)
values ('e1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Pikachu',
        5000, 7490, 'cartao', 30, 'cs_test_leilao_p03', 'cancelado',
        'b1000000-0000-4000-8000-000000000001', now());

-- ─── T3: pedido ainda nao pago nao vende o lote ─────────────────────────────
do $$
declare r text; l record;
begin
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'pedido_invalido', format('FALHOU T3: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000001';
  assert l.status = 'aguardando_pagamento', format('FALHOU T3b: status %s', l.status);
end $$;

-- ─── T4: pagamento confirmado -> vendido, pedido_id, versao, evento ─────────
update public.pedidos set status = 'pago', pago_em = now()
 where id = 'e1000000-0000-4000-8000-000000000001';

do $$
declare r text; l record; v0 int; n int;
begin
  select versao into v0 from public.leiloes where id = 'b1000000-0000-4000-8000-000000000001';
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'vendido', format('FALHOU T4: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000001';
  assert l.status = 'vendido', format('FALHOU T4b: status %s', l.status);
  assert l.pedido_id = 'e1000000-0000-4000-8000-000000000001', 'FALHOU T4c: pedido_id';
  assert l.versao = v0 + 1, format('FALHOU T4d: versao %s <> %s', l.versao, v0 + 1);
  select count(*) into n from public.leilao_eventos
   where leilao_id = l.id and tipo = 'pago' and processado_em is not null;
  assert n = 1, format('FALHOU T4e: eventos pago = %s', n);

  -- T5: re-entrega do webhook nao mexe em nada
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'ja_vendido', format('FALHOU T5: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000001';
  assert l.versao = v0 + 1, format('FALHOU T5b: versao mudou (%s)', l.versao);
  select count(*) into n from public.leilao_eventos where leilao_id = l.id and tipo = 'pago';
  assert n = 1, format('FALHOU T5c: evento duplicado (%s)', n);

  -- T5d: outro pedido nao rouba o lote vendido
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003');
  assert r = 'vendido_por_outro_pedido', format('FALHOU T5d: %s', r);
end $$;

-- ─── T6: pagamento que chega com o lote em calote volta para vendido ────────
insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            stripe_session_id, status, pago_em)
values ('e1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Eevee',
        3000, 4000, 'cartao', 30, 'cs_test_leilao_p04', 'pago', now());
-- So pelo item (pedidos.leilao_id null): a funcao aceita o elo por pedido_itens.
insert into public.pedido_itens (pedido_id, leilao_id, nome, tipo, preco_cents, quantidade)
values ('e1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000002',
        'Eevee', 'carta', 3000, 1);

do $$
declare r text; l record;
begin
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000004');
  assert r = 'vendido', format('FALHOU T6: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000002';
  assert l.status = 'vendido', format('FALHOU T6b: status %s', l.status);
  assert l.pedido_id = 'e1000000-0000-4000-8000-000000000004', 'FALHOU T6c: pedido_id';
end $$;

-- ─── T7: lote cancelado nao volta por pagamento (fica para o Du) ────────────
insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            stripe_session_id, status, pago_em, leilao_id)
values ('e1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Mew',
        1000, 1500, 'cartao', 30, 'cs_test_leilao_p05', 'pago', now(),
        'b1000000-0000-4000-8000-000000000003');
do $$
declare r text;
begin
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000005');
  assert r = 'ignorado:cancelado', format('FALHOU T7: %s', r);
end $$;

-- ─── T8: estorno integral -> cancelado / reembolsado, so do pedido que vendeu ─
do $$
declare r text; l record; v0 int;
begin
  r := public.leilao_marcar_reembolsado('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003');
  assert r = 'outro_pedido', format('FALHOU T8: %s', r);

  select versao into v0 from public.leiloes where id = 'b1000000-0000-4000-8000-000000000001';
  r := public.leilao_marcar_reembolsado('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'cancelado', format('FALHOU T8b: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000001';
  assert l.status = 'cancelado', format('FALHOU T8c: status %s', l.status);
  assert l.cancelado_motivo = 'reembolsado', format('FALHOU T8d: motivo %s', l.cancelado_motivo);
  assert l.versao = v0 + 1, 'FALHOU T8e: versao';

  r := public.leilao_marcar_reembolsado('b1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'ja_cancelado', format('FALHOU T8f: %s', r);

  -- T8g: lote em calote (nunca vendido) nao e cancelado por estorno
  select versao into v0 from public.leiloes where id = 'b1000000-0000-4000-8000-000000000005';
  r := public.leilao_marcar_reembolsado('b1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'ignorado:calote', format('FALHOU T8g: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000005';
  assert l.status = 'calote' and l.versao = v0, format('FALHOU T8g: lote mexido (%s, v%s)', l.status, l.versao);

  -- T8h: lote vendido por OUTRO pedido nao e cancelado pelo estorno deste
  r := public.leilao_marcar_reembolsado('b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001');
  assert r = 'outro_pedido', format('FALHOU T8h: %s', r);
end $$;

-- ─── T9: as duas funcoes sao so do service_role ─────────────────────────────
do $$
begin
  assert not has_function_privilege('anon', 'public.leilao_marcar_vendido(uuid, uuid)', 'execute'),
    'FALHOU T9: anon executa leilao_marcar_vendido';
  assert not has_function_privilege('authenticated', 'public.leilao_marcar_vendido(uuid, uuid)', 'execute'),
    'FALHOU T9b: authenticated executa leilao_marcar_vendido';
  assert not has_function_privilege('authenticated', 'public.leilao_marcar_reembolsado(uuid, uuid)', 'execute'),
    'FALHOU T9c: authenticated executa leilao_marcar_reembolsado';
  assert has_function_privilege('service_role', 'public.leilao_marcar_vendido(uuid, uuid)', 'execute'),
    'FALHOU T9d: service_role sem execute';
  assert has_function_privilege('service_role', 'public.leilao_marcar_reembolsado(uuid, uuid)', 'execute'),
    'FALHOU T9e: service_role sem execute';
end $$;

-- ─── T10: o tick nao marca calote com checkout aberto do lote ───────────────
-- Lote 01 ja cancelado; monta um lote novo vencido com pedido aberto.
-- pagar_ate - 20 min: passou a carencia (15) e a sessao ainda pode estar
-- aberta (checkout so conta ate pagar_ate + 30 min).
insert into public.leiloes (id, vendedor_user_id, loja_id, card_name, slug, lance_inicial_cents,
                            preco_atual_cents, lider_user_id, lider_maximo_cents, n_lances,
                            duracao_seg, status, inicia_em, termina_em, encerrado_em, pagar_ate)
values ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001',
        'f1000000-0000-4000-8000-000000000001', 'Snorlax', 'snorlax-pedido-4', 1000,
        2000, 'a1000000-0000-4000-8000-000000000002', 2000, 1, 60, 'aguardando_pagamento',
        now() - interval '60 hours', now() - interval '50 hours', now() - interval '50 hours',
        now() - interval '20 minutes');
insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            stripe_session_id, status, leilao_id)
values ('e1000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Snorlax',
        2000, 2700, 'cartao', 30, 'cs_test_leilao_p06', 'aguardando_pagamento',
        'b1000000-0000-4000-8000-000000000004');
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000004';
  assert l.status = 'aguardando_pagamento', format('FALHOU T10: tick marcou %s com checkout aberto', l.status);
end $$;

-- Sessao expirada (webhook cancela o pedido) -> o proximo tick marca calote.
update public.pedidos set status = 'cancelado', cancelado_em = now()
 where id = 'e1000000-0000-4000-8000-000000000006';
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000004';
  assert l.status = 'calote', format('FALHOU T10b: status %s <> calote', l.status);
end $$;

-- ─── T11: calote -> vendido marca os eventos 'calote' como processados ─────
do $$
declare n int;
begin
  select count(*) into n from public.leilao_eventos
   where leilao_id = 'b1000000-0000-4000-8000-000000000004' and tipo = 'calote' and processado_em is null;
  assert n = 1, format('FALHOU T11 (pre): eventos calote pendentes = %s', n);
end $$;

insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            stripe_session_id, status, pago_em, leilao_id)
values ('e1000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Snorlax',
        2000, 2700, 'pix', 30, 'cs_test_leilao_p07', 'pago', now(),
        'b1000000-0000-4000-8000-000000000004');

do $$
declare r text; l record; n int; pl jsonb;
begin
  r := public.leilao_marcar_vendido('b1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000007');
  assert r = 'vendido', format('FALHOU T11: %s', r);
  select * into l from public.leiloes where id = 'b1000000-0000-4000-8000-000000000004';
  assert l.status = 'vendido', format('FALHOU T11b: status %s', l.status);
  select count(*) into n from public.leilao_eventos
   where leilao_id = l.id and tipo = 'calote' and processado_em is null;
  assert n = 0, format('FALHOU T11c: %s evento(s) calote ainda pendente(s)', n);
  select payload into pl from public.leilao_eventos
   where leilao_id = l.id and tipo = 'pago' order by id desc limit 1;
  assert pl->>'de' = 'calote' and (pl->>'reverteu_calote')::boolean,
    format('FALHOU T11d: payload do pago %s', pl);
end $$;

-- T11e: pagamento normal (sem calote) registra reverteu_calote = false.
do $$
declare pl jsonb;
begin
  select payload into pl from public.leilao_eventos
   where leilao_id = 'b1000000-0000-4000-8000-000000000001' and tipo = 'pago' limit 1;
  assert pl->>'reverteu_calote' = 'false', format('FALHOU T11e: payload %s', pl);
end $$;

-- ─── Fim: desfaz tudo ───────────────────────────────────────────────────────
do $$ begin raise exception 'LEILAO_PEDIDO_TODOS_OK'; end $$;
