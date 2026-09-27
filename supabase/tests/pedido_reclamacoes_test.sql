-- ============================================================================
-- Roteiro de prova da fatia 7 (20260928140000_pedido_reclamacoes.sql).
--
-- ★ TEM DE RODAR COMO TRANSACAO UNICA: `psql -1 -v ON_ERROR_STOP=1 -f` ou o
--   arquivo inteiro num unico execute_sql (um texto so). Rodado comando a
--   comando (autocommit), as fixtures FICAM no banco e o raise do fim nao
--   desfaz nada.
-- SEM begin/rollback de proposito: o ultimo comando e
-- `raise exception 'PEDIDO_RECLAMACOES_TODOS_OK'` -- a excecao desfaz tudo e
-- nao deixa rastro. Chegar nela = tudo passou. Qualquer outra excecao
-- ("FALHOU Tn: ...") para antes e aponta o bloco.
--
-- Rodar SO na branch de prova, como `postgres`, com o motor (20260928090000),
-- a fatia do pedido (20260928100000) e esta migration ja aplicados NA BRANCH.
-- Nunca em producao.
--
-- Usuarios: a700...01 vendedor (dono da loja) | a700...02 comprador | a700...03 outro
-- Loja:     f700...01 (pedidos.loja_id e NOT NULL)
-- Lote:     b700...01 (so para dar leilao_id aos pedidos)
-- Pedidos:  e700...01 leilao enviado          | e700...02 leilao entregue ha 10 dias
--           e700...03 SEM leilao, enviado     | e700...04 leilao pago (nao enviado)
--           e700...05 leilao enviado (vira entregue no T1)
--           e700...06 leilao so pelo ITEM (pedido_itens.leilao_id), enviado
-- ============================================================================

-- ─── Fixtures ───────────────────────────────────────────────────────────────

insert into public.users (id, name, email, username, cpf, cep) values
  ('a7000000-0000-4000-8000-000000000001', 'Vendedor Recl', 'recl-01@teste.invalid', 'vendedorrecl', '99999999971', '01001000'),
  ('a7000000-0000-4000-8000-000000000002', 'Comprador Recl', 'recl-02@teste.invalid', 'compradorrecl', '99999999972', '01001000'),
  ('a7000000-0000-4000-8000-000000000003', 'Outro Recl', 'recl-03@teste.invalid', 'outrorecl', '99999999973', '01001000')
on conflict (id) do update set cpf = excluded.cpf, cep = excluded.cep, username = excluded.username;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado)
values ('f7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
        'reclamacao-loja-teste', 'Loja Teste Reclamacao', 'Sao Paulo', 'SP')
on conflict (id) do nothing;

insert into public.leiloes (id, vendedor_user_id, loja_id, card_name, slug, lance_inicial_cents,
                            preco_atual_cents, lider_user_id, lider_maximo_cents, n_lances,
                            duracao_seg, status, inicia_em, termina_em, encerrado_em, pagar_ate)
values ('b7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
        'f7000000-0000-4000-8000-000000000001', 'Charizard', 'charizard-recl-1', 1000,
        5000, 'a7000000-0000-4000-8000-000000000002', 5000, 3, 60, 'aguardando_pagamento',
        now() - interval '30 days', now() - interval '29 days', now() - interval '29 days', now() + interval '1 day');

insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, frete_cents, acrescimo_cents, total_comprador_cents,
                            comissao_bynx_cents, liquido_loja_cents, metodo, repasse_prazo,
                            status, leilao_id, pago_em, enviado_em, entregue_em)
values
  ('e7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Charizard',
   5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'enviado', 'b7000000-0000-4000-8000-000000000001',
   now() - interval '10 days', now() - interval '8 days', null),
  ('e7000000-0000-4000-8000-000000000002', 'f7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Charizard',
   5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'entregue', 'b7000000-0000-4000-8000-000000000001',
   now() - interval '20 days', now() - interval '18 days', now() - interval '10 days'),
  ('e7000000-0000-4000-8000-000000000003', 'f7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Carta sem leilao',
   5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'enviado', null,
   now() - interval '10 days', now() - interval '8 days', null),
  ('e7000000-0000-4000-8000-000000000004', 'f7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Charizard',
   5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'pago', 'b7000000-0000-4000-8000-000000000001',
   now() - interval '1 day', null, null),
  ('e7000000-0000-4000-8000-000000000005', 'f7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Charizard',
   5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'enviado', 'b7000000-0000-4000-8000-000000000001',
   now() - interval '5 days', now() - interval '4 days', null),
  ('e7000000-0000-4000-8000-000000000006', 'f7000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Carrinho com lote',
   5000, 2000, 490, 7490, 880, 6610, 'cartao', 30, 'enviado', null,
   now() - interval '5 days', now() - interval '4 days', null);

insert into public.pedido_itens (pedido_id, leilao_id, nome, tipo, preco_cents, quantidade)
values ('e7000000-0000-4000-8000-000000000006', 'b7000000-0000-4000-8000-000000000001',
        'Charizard', 'carta', 5000, 1);


-- ─── T0: estrutura e grants ─────────────────────────────────────────────────
do $$
declare v_pub boolean;
begin
  assert (select relrowsecurity from pg_class where oid = 'public.pedido_reclamacoes'::regclass),
    'FALHOU T0a: RLS desligada';
  assert has_table_privilege('authenticated', 'public.pedido_reclamacoes', 'select'),
    'FALHOU T0b: authenticated sem select';
  assert not has_table_privilege('authenticated', 'public.pedido_reclamacoes', 'insert'),
    'FALHOU T0c: authenticated com insert';
  assert not has_table_privilege('authenticated', 'public.pedido_reclamacoes', 'update'),
    'FALHOU T0d: authenticated com update';
  assert not has_table_privilege('anon', 'public.pedido_reclamacoes', 'select'),
    'FALHOU T0e: anon le reclamacoes';
  assert not has_function_privilege('authenticated',
    'public.pedido_reclamacao_abrir(uuid, uuid, text, text, text[], text, timestamptz, timestamptz)', 'execute'),
    'FALHOU T0f: authenticated executa abrir';
  assert not has_function_privilege('authenticated',
    'public.pedido_reclamacao_resolver(uuid, text, text, integer, text, text, text)', 'execute'),
    'FALHOU T0g: authenticated executa resolver';
  select public into v_pub from storage.buckets where id = 'reclamacoes';
  assert v_pub is not null and v_pub = false, format('FALHOU T0h: bucket reclamacoes public=%s', v_pub);
  assert not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                      and (qual ilike '%reclamacoes%' or with_check ilike '%reclamacoes%')),
    'FALHOU T0i: policy de storage abrindo o bucket reclamacoes';
end $$;


-- ─── T1: trigger grava prazo de reclamacao so em pedido de leilao ───────────
update public.pedidos set status = 'entregue', entregue_em = now() - interval '1 day'
 where id in ('e7000000-0000-4000-8000-000000000005', 'e7000000-0000-4000-8000-000000000003');

do $$
declare v_prazo timestamptz; v_ent timestamptz;
begin
  select prazo_reclamacao_ate, entregue_em into v_prazo, v_ent
    from public.pedidos where id = 'e7000000-0000-4000-8000-000000000005';
  assert v_prazo = v_ent + interval '7 days', format('FALHOU T1a: prazo %s entregue %s', v_prazo, v_ent);
  select prazo_reclamacao_ate into v_prazo from public.pedidos where id = 'e7000000-0000-4000-8000-000000000003';
  assert v_prazo is null, format('FALHOU T1b: pedido sem leilao ganhou prazo %s', v_prazo);
end $$;

-- T1c: leilao so pelo item tambem ganha prazo. (volta para enviado depois)
update public.pedidos set status = 'entregue', entregue_em = now()
 where id = 'e7000000-0000-4000-8000-000000000006';
do $$
begin
  assert (select prazo_reclamacao_ate is not null from public.pedidos
           where id = 'e7000000-0000-4000-8000-000000000006'),
    'FALHOU T1c: pedido com lote no item sem prazo';
end $$;
update public.pedidos set status = 'enviado', entregue_em = null, prazo_reclamacao_ate = null
 where id = 'e7000000-0000-4000-8000-000000000006';

-- T1d: defaults das colunas novas.
do $$
declare r record;
begin
  select reclamacao_aberta, recebido_automatico, valor_reembolsado_cents, aviso_recebimento_em into r
    from public.pedidos where id = 'e7000000-0000-4000-8000-000000000001';
  assert r.reclamacao_aberta = false and r.recebido_automatico = false
     and r.valor_reembolsado_cents = 0 and r.aviso_recebimento_em is null,
    format('FALHOU T1d: defaults %s', r);
end $$;


-- ─── T2: abrir em pedido enviado (nao_chegou, sem foto) ─────────────────────
do $$
declare v_id uuid; r record;
begin
  v_id := public.pedido_reclamacao_abrir(
    'e7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002',
    'nao_chegou', 'O rastreio parou ha uma semana.', '{}', null,
    now() + interval '3 days', now() + interval '10 days');
  assert v_id is not null, 'FALHOU T2a: sem id';
  select * into r from public.pedido_reclamacoes where id = v_id;
  assert r.status = 'aguardando_loja', format('FALHOU T2b: status %s', r.status);
  assert r.loja_id = 'f7000000-0000-4000-8000-000000000001'
     and r.vendedor_user_id = 'a7000000-0000-4000-8000-000000000001',
    'FALHOU T2c: loja/vendedor nao vieram do pedido';
  assert (select reclamacao_aberta from public.pedidos where id = 'e7000000-0000-4000-8000-000000000001'),
    'FALHOU T2d: trava do pedido nao ligou';
end $$;

-- T3: segunda reclamacao aberta no mesmo pedido -> ja_existe.
do $$
begin
  perform public.pedido_reclamacao_abrir(
    'e7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002',
    'nao_chegou', 'Tentando abrir de novo.', '{}', null, now() + interval '3 days', null);
  raise exception 'FALHOU T3: aceitou a segunda reclamacao';
exception when raise_exception then
  if sqlerrm <> 'ja_existe' then raise exception 'FALHOU T3: erro %', sqlerrm; end if;
end $$;

-- T3b: o indice unico parcial segura mesmo sem a funcao (insert direto).
do $$
begin
  insert into public.pedido_reclamacoes (pedido_id, comprador_user_id, loja_id, vendedor_user_id,
                                         motivo, descricao, prazo_loja_ate)
  values ('e7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002',
          'f7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
          'nao_chegou', 'Insert direto duplicado.', now());
  raise exception 'FALHOU T3b: indice unico parcial nao segurou';
exception when unique_violation then null;
end $$;


-- ─── T4: recusas ────────────────────────────────────────────────────────────
do $$
declare
  casos text[][] := array[
    array['e7000000-0000-4000-8000-000000000003', 'a7000000-0000-4000-8000-000000000002', 'nao_e_leilao'],
    array['e7000000-0000-4000-8000-000000000004', 'a7000000-0000-4000-8000-000000000002', 'status_invalido'],
    array['e7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000002', 'prazo_encerrado'],
    array['e7000000-0000-4000-8000-000000000005', 'a7000000-0000-4000-8000-000000000003', 'nao_e_comprador'],
    array['e7000000-0000-4000-8000-000000000099', 'a7000000-0000-4000-8000-000000000002', 'pedido_nao_encontrado']
  ];
  i int;
begin
  for i in 1 .. array_length(casos, 1) loop
    begin
      perform public.pedido_reclamacao_abrir(
        casos[i][1]::uuid, casos[i][2]::uuid, 'nao_chegou', 'Descricao de teste.', '{}', null, now(), null);
      raise exception 'FALHOU T4 (%): aceitou', casos[i][3];
    exception when raise_exception then
      if sqlerrm <> casos[i][3] then
        raise exception 'FALHOU T4: esperava %, veio %', casos[i][3], sqlerrm;
      end if;
    end;
  end loop;
end $$;

-- T5: motivo com foto exige 3 fotos (check da tabela).
do $$
begin
  perform public.pedido_reclamacao_abrir(
    'e7000000-0000-4000-8000-000000000005', 'a7000000-0000-4000-8000-000000000002',
    'danificado', 'Chegou com a quina amassada.', array['p/c/frente.webp', 'p/c/verso.webp'], null,
    now() + interval '3 days', null);
  raise exception 'FALHOU T5a: aceitou 2 fotos';
exception when check_violation then null;
end $$;

-- T5b: com 3 fotos passa (pedido entregue ontem, dentro dos 7 dias).
do $$
declare v_id uuid;
begin
  v_id := public.pedido_reclamacao_abrir(
    'e7000000-0000-4000-8000-000000000005', 'a7000000-0000-4000-8000-000000000002',
    'danificado', 'Chegou com a quina amassada.',
    array['p/c/frente.webp', 'p/c/verso.webp', 'p/c/embalagem.webp'], 'https://youtu.be/abc',
    now() + interval '3 days', now() + interval '10 days');
  assert v_id is not null, 'FALHOU T5b: sem id';
end $$;

-- T5c: video sem https e recusado.
do $$
begin
  update public.pedido_reclamacoes set video_url = 'javascript:alert(1)'
   where pedido_id = 'e7000000-0000-4000-8000-000000000005';
  raise exception 'FALHOU T5c: aceitou video sem https';
exception when check_violation then null;
end $$;

-- T5d: pedido com lote so no item tambem abre.
do $$
begin
  perform public.pedido_reclamacao_abrir(
    'e7000000-0000-4000-8000-000000000006', 'a7000000-0000-4000-8000-000000000002',
    'nao_chegou', 'Carrinho com lote nao chegou.', '{}', null, now() + interval '3 days', null);
end $$;


-- ─── T6: RLS ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.pedido_reclamacoes
   where loja_id = 'f7000000-0000-4000-8000-000000000001';
  assert n = 3, format('FALHOU T6a: comprador ve %s (esperava 3)', n);
  begin
    insert into public.pedido_reclamacoes (pedido_id, comprador_user_id, loja_id, vendedor_user_id,
                                           motivo, descricao, prazo_loja_ate)
    values ('e7000000-0000-4000-8000-000000000003', 'a7000000-0000-4000-8000-000000000002',
            'f7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
            'nao_chegou', 'Insert pela REST.', now());
    raise exception 'FALHOU T6b: comprador inseriu direto';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.pedido_reclamacoes set status = 'resolvida'
     where pedido_id = 'e7000000-0000-4000-8000-000000000001';
    raise exception 'FALHOU T6c: comprador atualizou direto';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.pedido_reclamacoes
   where loja_id = 'f7000000-0000-4000-8000-000000000001';
  assert n = 0, format('FALHOU T6d: estranho ve %s', n);
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.pedido_reclamacoes
   where loja_id = 'f7000000-0000-4000-8000-000000000001';
  assert n = 3, format('FALHOU T6e: dono da loja ve %s (esperava 3)', n);
end $$;
reset role;

-- T6f: anon nao le.
set local role anon;
do $$
begin
  perform 1 from public.pedido_reclamacoes limit 1;
  raise exception 'FALHOU T6f: anon leu';
exception when insufficient_privilege then null;
end $$;
reset role;


-- ─── T7: resolver com estorno parcial ───────────────────────────────────────
do $$
declare v_rid uuid; v_res text; r record; p record;
begin
  select id into v_rid from public.pedido_reclamacoes
   where pedido_id = 'e7000000-0000-4000-8000-000000000005' and status = 'aguardando_loja';
  v_res := public.pedido_reclamacao_resolver(v_rid, 'resolvida', 'estorno_parcial', 1500, 're_test_1', 'admin', 'Quina amassada');
  assert v_res = 'resolvida', format('FALHOU T7a: %s', v_res);
  select * into r from public.pedido_reclamacoes where id = v_rid;
  assert r.status = 'resolvida' and r.valor_estornado_cents = 1500 and r.stripe_refund_id = 're_test_1'
     and r.decidido_em is not null, format('FALHOU T7b: %s', r);
  select status, reclamacao_aberta, valor_reembolsado_cents into p
    from public.pedidos where id = 'e7000000-0000-4000-8000-000000000005';
  assert p.status = 'entregue' and not p.reclamacao_aberta and p.valor_reembolsado_cents = 1500,
    format('FALHOU T7c: pedido %s', p);

  -- Idempotente: mesmo refund devolve ja_resolvida e nao soma de novo.
  v_res := public.pedido_reclamacao_resolver(v_rid, 'resolvida', 'estorno_parcial', 1500, 're_test_1', 'admin', null);
  assert v_res = 'ja_resolvida', format('FALHOU T7d: %s', v_res);
  assert (select valor_reembolsado_cents from public.pedidos where id = 'e7000000-0000-4000-8000-000000000005') = 1500,
    'FALHOU T7e: somou duas vezes';

  -- Outro refund numa reclamacao fechada: recusa.
  begin
    perform public.pedido_reclamacao_resolver(v_rid, 'resolvida', 'estorno_total', 5990, 're_test_2', 'admin', null);
    raise exception 'FALHOU T7f: reabriu fechada';
  exception when raise_exception then
    if sqlerrm <> 'reclamacao_fechada' then raise exception 'FALHOU T7f: %', sqlerrm; end if;
  end;
end $$;


-- ─── T8: devolucao em dois passos -> pedido reembolsado ─────────────────────
do $$
declare v_rid uuid; v_res text; p record;
begin
  select id into v_rid from public.pedido_reclamacoes
   where pedido_id = 'e7000000-0000-4000-8000-000000000001' and status = 'aguardando_loja';

  v_res := public.pedido_reclamacao_resolver(v_rid, 'aguardando_devolucao', 'devolucao', 0, null, 'admin', 'Devolver a carta');
  assert v_res = 'aguardando_devolucao', format('FALHOU T8a: %s', v_res);
  assert (select reclamacao_aberta from public.pedidos where id = 'e7000000-0000-4000-8000-000000000001'),
    'FALHOU T8b: trava soltou antes da devolucao';
  v_res := public.pedido_reclamacao_resolver(v_rid, 'aguardando_devolucao', 'devolucao', 0, null, 'admin', null);
  assert v_res = 'ja_aguardando_devolucao', format('FALHOU T8c: %s', v_res);

  v_res := public.pedido_reclamacao_resolver(v_rid, 'resolvida', 'devolucao', 7490, 're_test_3', 'admin', null);
  assert v_res = 'resolvida', format('FALHOU T8d: %s', v_res);
  select status, reclamacao_aberta, valor_reembolsado_cents, cancelado_por, stripe_refund_id into p
    from public.pedidos where id = 'e7000000-0000-4000-8000-000000000001';
  assert p.status = 'reembolsado' and not p.reclamacao_aberta and p.valor_reembolsado_cents = 7490
     and p.cancelado_por = 'bynx' and p.stripe_refund_id = 're_test_3',
    format('FALHOU T8e: pedido %s', p);
end $$;


-- ─── T9: improcedente (sem dinheiro) e nova reclamacao depois de fechada ────
do $$
declare v_rid uuid; v_res text; v_novo uuid;
begin
  select id into v_rid from public.pedido_reclamacoes
   where pedido_id = 'e7000000-0000-4000-8000-000000000006' and status = 'aguardando_loja';
  v_res := public.pedido_reclamacao_resolver(v_rid, 'improcedente', 'improcedente', 0, null, 'admin', 'Rastreio mostra entregue');
  assert v_res = 'improcedente', format('FALHOU T9a: %s', v_res);
  assert (select status = 'enviado' and not reclamacao_aberta and valor_reembolsado_cents = 0
            from public.pedidos where id = 'e7000000-0000-4000-8000-000000000006'),
    'FALHOU T9b: pedido mudou no improcedente';

  -- Fechada a anterior, o indice parcial deixa abrir outra.
  v_novo := public.pedido_reclamacao_abrir(
    'e7000000-0000-4000-8000-000000000006', 'a7000000-0000-4000-8000-000000000002',
    'nao_chegou', 'Continua sem chegar.', '{}', null, now() + interval '3 days', null);
  assert v_novo is not null and v_novo <> v_rid, 'FALHOU T9c: nao abriu a segunda';
end $$;

-- T9d: parametros invalidos no resolver.
do $$
declare v_rid uuid;
begin
  select id into v_rid from public.pedido_reclamacoes
   where pedido_id = 'e7000000-0000-4000-8000-000000000006' and status = 'aguardando_loja';
  begin
    perform public.pedido_reclamacao_resolver(v_rid, 'aberta', 'improcedente', 0, null, 'admin', null);
    raise exception 'FALHOU T9d: aceitou status invalido';
  exception when raise_exception then
    if sqlerrm <> 'status_invalido' then raise exception 'FALHOU T9d: %', sqlerrm; end if;
  end;
  begin
    perform public.pedido_reclamacao_resolver(v_rid, 'resolvida', 'sorteio', 0, null, 'admin', null);
    raise exception 'FALHOU T9e: aceitou decisao invalida';
  exception when raise_exception then
    if sqlerrm <> 'decisao_invalida' then raise exception 'FALHOU T9e: %', sqlerrm; end if;
  end;
end $$;

-- ─── Fim: desfaz tudo ───────────────────────────────────────────────────────
do $$ begin raise exception 'PEDIDO_RECLAMACOES_TODOS_OK'; end $$;
