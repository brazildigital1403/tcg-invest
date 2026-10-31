-- ============================================================================
-- Roteiro de prova de 20260928170000_leilao_arrependimento.sql.
--
-- ★ TRANSACAO UNICA (arquivo inteiro num execute_sql so). O ultimo comando
--   levanta LEILAO_ARREPENDIMENTO_TODOS_OK de proposito: tudo volta. Qualquer
--   outra mensagem ("FALHOU Tn: ...") aponta o bloco. So na branch de prova.
--
-- Usuarios: a6..01 vendedor | a6..02 comprador | a6..03 outro
-- Pedidos:  e6..01 leilao enviado            | e6..02 leilao entregue ha 6 dias (dentro dos 7)
--           e6..03 leilao entregue ha 8 dias | e6..04 leilao pago
--           e6..05 leilao enviado em disputa | e6..06 SEM leilao, enviado
-- ============================================================================

insert into public.users (id, name, email, username, cpf, cep) values
  ('a6000000-0000-4000-8000-000000000001', 'Vendedor Arrep', 'arrep-01@teste.invalid', 'vendedorarrep', '99999999961', '01001000'),
  ('a6000000-0000-4000-8000-000000000002', 'Comprador Arrep', 'arrep-02@teste.invalid', 'compradorarrep', '99999999962', '01001000'),
  ('a6000000-0000-4000-8000-000000000003', 'Outro Arrep', 'arrep-03@teste.invalid', 'outroarrep', '99999999963', '01001000')
on conflict (id) do update set cpf = excluded.cpf, cep = excluded.cep, username = excluded.username;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado)
values ('f6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001',
        'arrependimento-loja-teste', 'Loja Teste Arrependimento', 'Sao Paulo', 'SP')
on conflict (id) do nothing;

insert into public.leiloes (id, vendedor_user_id, loja_id, card_name, slug, lance_inicial_cents,
                            preco_atual_cents, lider_user_id, lider_maximo_cents, n_lances,
                            duracao_seg, status, inicia_em, termina_em, encerrado_em, pagar_ate)
values ('b6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001',
        'f6000000-0000-4000-8000-000000000001', 'Mew', 'mew-arrep-1', 1000,
        20000, 'a6000000-0000-4000-8000-000000000002', 20000, 3, 60, 'aguardando_pagamento',
        now() - interval '30 days', now() - interval '29 days', now() - interval '29 days', now() + interval '1 day');

insert into public.pedidos (id, loja_id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, frete_cents, acrescimo_cents, total_comprador_cents,
                            comissao_bynx_cents, liquido_loja_cents, metodo, repasse_prazo,
                            status, leilao_id, pago_em, enviado_em, entregue_em, em_disputa)
select v.id::uuid, 'f6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001',
       'a6000000-0000-4000-8000-000000000002', 'Mew', 20000, 2000, 1960, 23960, 2400, 19600, 'cartao', 30,
       v.status, case when v.leilao then 'b6000000-0000-4000-8000-000000000001'::uuid end,
       now() - interval '15 days', v.enviado, v.entregue, v.disputa
  from (values
    ('e6000000-0000-4000-8000-000000000001', 'enviado',  true,  now() - interval '2 days',  null::timestamptz,        false),
    ('e6000000-0000-4000-8000-000000000002', 'entregue', true,  now() - interval '9 days',  now() - interval '6 days', false),
    ('e6000000-0000-4000-8000-000000000003', 'entregue', true,  now() - interval '11 days', now() - interval '8 days', false),
    ('e6000000-0000-4000-8000-000000000004', 'pago',     true,  null::timestamptz,          null::timestamptz,        false),
    ('e6000000-0000-4000-8000-000000000005', 'enviado',  true,  now() - interval '2 days',  null::timestamptz,        true),
    ('e6000000-0000-4000-8000-000000000006', 'enviado',  false, now() - interval '2 days',  null::timestamptz,        false)
  ) as v(id, status, leilao, enviado, entregue, disputa);

-- T0: privilegios e colunas novas nascem fechadas.
do $$
begin
  assert not has_function_privilege('authenticated', 'public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz)', 'execute'),
    'FALHOU T0a: authenticated executa pedido_arrependimento_abrir';
  assert not has_function_privilege('anon', 'public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz)', 'execute'),
    'FALHOU T0b: anon executa pedido_arrependimento_abrir';
  assert not has_function_privilege('authenticated', 'public.pedido_envio_reservar_upload(uuid, integer)', 'execute'),
    'FALHOU T0c: authenticated executa pedido_envio_reservar_upload';
  assert has_function_privilege('service_role', 'public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz)', 'execute'),
    'FALHOU T0d: service_role sem pedido_arrependimento_abrir';
  assert not has_table_privilege('authenticated', 'public.pedidos', 'update'),
    'FALHOU T0e: authenticated atualiza pedidos (poderia zerar em_disputa)';
  assert (select envio_fotos = '{}' and envio_uploads = 0 from public.pedidos where id = 'e6000000-0000-4000-8000-000000000001'),
    'FALHOU T0f: default das colunas novas';
end $$;

-- T1: os recusados, cada um com o seu codigo, e nada e gravado.
do $$
declare c text[];
begin
  foreach c slice 1 in array array[
    array['e6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003', 'nao_e_comprador'],
    array['e6000000-0000-4000-8000-000000000003', 'a6000000-0000-4000-8000-000000000002', 'prazo_encerrado'],
    array['e6000000-0000-4000-8000-000000000004', 'a6000000-0000-4000-8000-000000000002', 'status_invalido'],
    array['e6000000-0000-4000-8000-000000000005', 'a6000000-0000-4000-8000-000000000002', 'em_disputa'],
    array['e6000000-0000-4000-8000-000000000006', 'a6000000-0000-4000-8000-000000000002', 'nao_e_leilao'],
    array['e6000000-0000-4000-8000-000000000099', 'a6000000-0000-4000-8000-000000000002', 'pedido_nao_encontrado']
  ] loop
    begin
      perform public.pedido_arrependimento_abrir(c[1]::uuid, c[2]::uuid, 'Desistencia da compra (teste).', now() + interval '7 days');
      raise exception 'FALHOU T1: % abriu', c[1];
    exception when raise_exception then
      if sqlerrm <> c[3] then raise exception 'FALHOU T1 (%): esperado %, veio %', c[1], c[3], sqlerrm; end if;
    end;
  end loop;
  begin
    perform public.pedido_arrependimento_abrir('e6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002',
      'Desistencia da compra (teste).', now() - interval '1 minute');
    raise exception 'FALHOU T1p: abriu com prazo de postagem no passado';
  exception when raise_exception then
    if sqlerrm <> 'prazo_invalido' then raise exception 'FALHOU T1q: %', sqlerrm; end if;
  end;
  assert not exists (select 1 from public.pedido_reclamacoes r join public.pedidos p on p.id = r.pedido_id
                      where p.comprador_user_id = 'a6000000-0000-4000-8000-000000000002'),
    'FALHOU T1z: recusa gravou linha';
end $$;

-- T2: entregue ha 6 dias abre (janela de 7); nasce em aguardando_devolucao,
-- sem foto, com postar_ate, e liga a trava do pedido.
do $$
declare v_id uuid; r public.pedido_reclamacoes%rowtype;
begin
  v_id := public.pedido_arrependimento_abrir('e6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000002',
    'Desistencia da compra (teste).', now() + interval '7 days');
  select * into r from public.pedido_reclamacoes where id = v_id;
  assert r.motivo = 'arrependimento' and r.status = 'aguardando_devolucao', format('FALHOU T2a: %s/%s', r.motivo, r.status);
  assert cardinality(r.fotos) = 0, 'FALHOU T2b: fotos';
  assert r.postar_ate > now() + interval '6 days' and r.prazo_loja_ate = r.postar_ate, 'FALHOU T2c: prazos';
  assert (select reclamacao_aberta from public.pedidos where id = 'e6000000-0000-4000-8000-000000000002'), 'FALHOU T2d: trava';
  assert r.loja_id = 'f6000000-0000-4000-8000-000000000001' and r.vendedor_user_id = 'a6000000-0000-4000-8000-000000000001',
    'FALHOU T2e: loja/vendedor';
  -- T3: a segunda abertura (arrependimento ou reclamacao) e recusada.
  begin
    perform public.pedido_arrependimento_abrir('e6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000002',
      'Desistencia da compra (teste).', now() + interval '7 days');
    raise exception 'FALHOU T3a: abriu duas vezes';
  exception when raise_exception then
    if sqlerrm <> 'ja_existe' then raise exception 'FALHOU T3b: %', sqlerrm; end if;
  end;
  begin
    perform public.pedido_reclamacao_abrir('e6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000002',
      'nao_chegou', 'Nao chegou nada (teste).', '{}', null, now() + interval '2 days', now() + interval '4 days');
    raise exception 'FALHOU T3c: reclamacao abriu por cima do arrependimento';
  exception when raise_exception then
    if sqlerrm <> 'ja_existe' then raise exception 'FALHOU T3d: %', sqlerrm; end if;
  end;
end $$;

-- T4: a reclamacao comum nao aceita o motivo arrependimento (tem funcao propria).
do $$
begin
  perform public.pedido_reclamacao_abrir('e6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002',
    'arrependimento', 'Desistencia pela rota errada.', '{}', null, now() + interval '2 days', now() + interval '4 days');
  raise exception 'FALHOU T4a: arrependimento pela reclamacao';
exception when raise_exception then
  if sqlerrm <> 'motivo_invalido' then raise exception 'FALHOU T4b: %', sqlerrm; end if;
end $$;

-- T5: constraints das colunas da devolucao.
do $$
declare v_id uuid;
begin
  select id into v_id from public.pedido_reclamacoes where pedido_id = 'e6000000-0000-4000-8000-000000000002';
  begin
    update public.pedido_reclamacoes set devolucao_rastreio = 'ab123' where id = v_id;
    raise exception 'FALHOU T5a: rastreio fora do padrao gravou';
  exception when check_violation then null;
  end;
  begin
    update public.pedido_reclamacoes set contestacao = 'curto' where id = v_id;
    raise exception 'FALHOU T5b: contestacao curta gravou';
  exception when check_violation then null;
  end;
  begin
    update public.pedido_reclamacoes set contestacao_video_url = 'http://x.com/v' where id = v_id;
    raise exception 'FALHOU T5c: video sem https gravou';
  exception when check_violation then null;
  end;
  update public.pedido_reclamacoes
     set devolucao_rastreio = 'AA473124829BR', devolucao_postada_em = now(),
         devolucao_entregue_em = now(), contestar_ate = now() + interval '2 days'
   where id = v_id;
end $$;

-- T6: estorno pelo resolver que ja existe fecha a desistencia e o pedido.
do $$
declare v_id uuid; v_res text; p public.pedidos%rowtype;
begin
  select id into v_id from public.pedido_reclamacoes where pedido_id = 'e6000000-0000-4000-8000-000000000002';
  v_res := public.pedido_reclamacao_resolver(v_id, 'resolvida', 'estorno_total', 23960, 're_teste_arrep', 'automatico', null);
  assert v_res = 'resolvida', format('FALHOU T6a: %s', v_res);
  select * into p from public.pedidos where id = 'e6000000-0000-4000-8000-000000000002';
  assert p.status = 'reembolsado' and not p.reclamacao_aberta and p.valor_reembolsado_cents = 23960,
    format('FALHOU T6b: %s %s %s', p.status, p.reclamacao_aberta, p.valor_reembolsado_cents);
end $$;

-- T7: expirar sem postagem (improcedente, sem dinheiro) solta a trava e nao reembolsa.
do $$
declare v_id uuid; p public.pedidos%rowtype;
begin
  v_id := public.pedido_arrependimento_abrir('e6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002',
    'Desistencia da compra (teste).', now() + interval '7 days');
  perform public.pedido_reclamacao_resolver(v_id, 'improcedente', 'improcedente', 0, null, 'automatico', 'Prazo de postagem expirou.');
  select * into p from public.pedidos where id = 'e6000000-0000-4000-8000-000000000001';
  assert p.status = 'enviado' and not p.reclamacao_aberta and p.valor_reembolsado_cents = 0,
    format('FALHOU T7: %s %s %s', p.status, p.reclamacao_aberta, p.valor_reembolsado_cents);
end $$;

-- T8: trigger de entrega grava 7 dias.
do $$
declare p public.pedidos%rowtype;
begin
  update public.pedidos set status = 'entregue', entregue_em = now() where id = 'e6000000-0000-4000-8000-000000000005';
  select * into p from public.pedidos where id = 'e6000000-0000-4000-8000-000000000005';
  assert p.prazo_reclamacao_ate = p.entregue_em + interval '7 days', format('FALHOU T8: %s', p.prazo_reclamacao_ate);
end $$;

-- T9: teto de foto de envio, e so de pedido pago.
do $$
begin
  assert public.pedido_envio_reservar_upload('e6000000-0000-4000-8000-000000000004', 2), 'FALHOU T9a';
  assert public.pedido_envio_reservar_upload('e6000000-0000-4000-8000-000000000004', 2), 'FALHOU T9b';
  assert not public.pedido_envio_reservar_upload('e6000000-0000-4000-8000-000000000004', 2), 'FALHOU T9c: passou do teto';
  assert not public.pedido_envio_reservar_upload('e6000000-0000-4000-8000-000000000006', 10), 'FALHOU T9d: pedido enviado reservou';
end $$;

do $$ begin raise exception 'LEILAO_ARREPENDIMENTO_TODOS_OK'; end $$;
