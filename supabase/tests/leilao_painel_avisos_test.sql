-- ============================================================================
-- Roteiro de prova da fatia 6 (20260928130000_leilao_painel_avisos.sql).
--
-- ★ TEM DE RODAR COMO TRANSACAO UNICA: `psql -1 -v ON_ERROR_STOP=1 -f` ou o
--   arquivo inteiro num unico execute_sql (um texto so). Rodado comando a
--   comando (autocommit), as fixtures FICAM no banco e o raise do fim nao
--   desfaz nada.
-- SEM begin/rollback de proposito: o ultimo comando e
-- `raise exception 'LEILAO_PAINEL_AVISOS_TODOS_OK'` -- a excecao desfaz tudo e
-- nao deixa rastro. Chegar nela = tudo passou. Qualquer outra excecao
-- ("FALHOU Tn: ...") para antes e aponta o bloco.
--
-- Rodar SO na branch de prova, como `postgres`, com o motor (20260928090000),
-- o pedido (20260928100000), os avisos (20260928110000), o painel
-- (20260928120000) e esta migration ja aplicados NA BRANCH. Nunca em producao.
--
-- ★ notifications.user_id tem FK para auth.users: os seguidores nascem em
--   auth.users antes de public.users (T6 grava o sino pelo consumidor).
--
-- Usuarios: a600...01 dono da loja | a600...02 ana (segue) | a600...03 bia (segue)
-- Loja:     f600...01
-- Rodadas:  c600...01 agendada (cancela) | c600...02 ao vivo com lote encerrado
--           (cancelar recusa) | c600...03 rascunho (outra loja nao acha; depois
--           cancela sem motivo)
-- Lotes:    b600...01 agendado (ana, bia) | b600...02 agendado (ana)
--           b600...03 ja cancelado (bia)  -- todos da c600...01
--           b600...04 sem_lances (ana)    -- c600...02
--           b600...05 rascunho (ana)      -- c600...03
-- ============================================================================

-- ─── Fila limpa: so pendentes dos lotes DESTAS fixtures (sobra de rodada
--     anterior interrompida). Evento de outro leilao nao e tocado; o T6 filtra
--     a reserva pelas rodadas daqui. (Desfeito no fim, de qualquer forma.)
update public.leilao_eventos set processado_em = now()
 where processado_em is null
   and leilao_id in ('b6000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000002',
                     'b6000000-0000-4000-8000-000000000003', 'b6000000-0000-4000-8000-000000000004',
                     'b6000000-0000-4000-8000-000000000005');

-- ─── Fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('a6000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'leilao-pa01@teste.invalid', now(), now()),
  ('a6000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'leilao-pa02@teste.invalid', now(), now()),
  ('a6000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'leilao-pa03@teste.invalid', now(), now())
on conflict (id) do nothing;

insert into public.users (id, name, email, username, cpf, cep) values
  ('a6000000-0000-4000-8000-000000000001', 'Loja Painel Avisos', 'leilao-pa01@teste.invalid', 'lojapainelavisos', '99999999961', '01001000'),
  ('a6000000-0000-4000-8000-000000000002', 'Ana Segue',          'leilao-pa02@teste.invalid', 'anasegue',         '99999999962', '01001000'),
  ('a6000000-0000-4000-8000-000000000003', 'Bia Segue',          'leilao-pa03@teste.invalid', 'biasegue',         '99999999963', '01001000')
on conflict (id) do update set cpf = excluded.cpf, cep = excluded.cep, username = excluded.username;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado)
values ('f6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001',
        'leilao-painel-avisos-loja', 'Loja Painel Avisos', 'Sao Paulo', 'SP')
on conflict (id) do nothing;

insert into public.leilao_rodadas (id, loja_id, vendedor_user_id, titulo, status, inicia_em) values
  ('c6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000001', 'Rodada agendada', 'agendada', now() + interval '1 hour'),
  ('c6000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000001', 'Rodada que ja abriu', 'ao_vivo', now() - interval '10 minutes'),
  ('c6000000-0000-4000-8000-000000000003', 'f6000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000001', 'Rodada em rascunho', 'rascunho', now() + interval '2 hours');

insert into public.leiloes (id, rodada_id, ordem, vendedor_user_id, loja_id, card_name, slug,
                            fotos, lance_inicial_cents, duracao_seg, status, encerrado_em, cancelado_motivo)
values
  ('b6000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 1,
   'a6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'Pikachu', 'pikachu-pa-1',
   '["https://x.test/f1.webp","https://x.test/v1.webp"]', 1000, 30, 'agendado', null, null),
  ('b6000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000001', 2,
   'a6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'Eevee', 'eevee-pa-2',
   '["https://x.test/f2.webp","https://x.test/v2.webp"]', 1000, 30, 'agendado', null, null),
  ('b6000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000001', 3,
   'a6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'Mew', 'mew-pa-3',
   '["https://x.test/f3.webp","https://x.test/v3.webp"]', 1000, 30, 'cancelado', null, 'antes'),
  ('b6000000-0000-4000-8000-000000000004', 'c6000000-0000-4000-8000-000000000002', 1,
   'a6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'Snorlax', 'snorlax-pa-4',
   '["https://x.test/f4.webp","https://x.test/v4.webp"]', 1000, 30, 'sem_lances', now() - interval '5 minutes', null),
  ('b6000000-0000-4000-8000-000000000005', 'c6000000-0000-4000-8000-000000000003', 1,
   'a6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'Gengar', 'gengar-pa-5',
   '["https://x.test/f5.webp","https://x.test/v5.webp"]', 1000, 30, 'rascunho', null, null);

insert into public.leilao_seguidores (leilao_id, user_id) values
  ('b6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002'),
  ('b6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003'),
  ('b6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000002'),
  ('b6000000-0000-4000-8000-000000000003', 'a6000000-0000-4000-8000-000000000003'),
  ('b6000000-0000-4000-8000-000000000004', 'a6000000-0000-4000-8000-000000000002'),
  ('b6000000-0000-4000-8000-000000000005', 'a6000000-0000-4000-8000-000000000002');

-- ─── T1: lote ja abriu -> recusa e NAO grava evento ─────────────────────────
do $$
begin
  begin
    perform public.leilao_cancelar_rodada('c6000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-000000000001', null);
    raise exception 'FALHOU T1a: cancelou rodada com lote encerrado';
  exception when others then
    if sqlerrm <> 'lote_ja_abriu' then raise exception 'FALHOU T1a: %', sqlerrm; end if;
  end;
  assert not exists (select 1 from public.leilao_eventos
                     where tipo = 'cancelado' and rodada_id = 'c6000000-0000-4000-8000-000000000002'),
    'FALHOU T1b: gravou aviso de rodada que nao cancelou';
  assert (select status from public.leilao_rodadas where id = 'c6000000-0000-4000-8000-000000000002') = 'ao_vivo',
    'FALHOU T1c: rodada mudou';
end $$;

-- ─── T2: rodada de outra loja nao e achada e nao gera evento ────────────────
do $$
begin
  begin
    perform public.leilao_cancelar_rodada('c6000000-0000-4000-8000-000000000003', gen_random_uuid(), null);
    raise exception 'FALHOU T2a: cancelou rodada de outra loja';
  exception when others then
    if sqlerrm <> 'rodada_nao_encontrada' then raise exception 'FALHOU T2a: %', sqlerrm; end if;
  end;
  assert not exists (select 1 from public.leilao_eventos
                     where tipo = 'cancelado' and rodada_id = 'c6000000-0000-4000-8000-000000000003'),
    'FALHOU T2b: gravou aviso sem cancelar';
end $$;

-- ─── T3: cancela -> um evento por seguidor de cada lote que ESTA chamada cancelou
do $$
declare
  r jsonb;
begin
  r := public.leilao_cancelar_rodada('c6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'Live adiada');
  assert (r->>'ok')::boolean, 'FALHOU T3a: ok';
  assert (r->>'lotes_cancelados')::int = 2, format('FALHOU T3b: lotes_cancelados = %s', r->>'lotes_cancelados');
  assert (r->>'avisos')::int = 3, format('FALHOU T3c: avisos = %s', r->>'avisos');

  assert (select count(*) from public.leilao_eventos
          where tipo = 'cancelado' and rodada_id = 'c6000000-0000-4000-8000-000000000001') = 3,
    'FALHOU T3d: eventos cancelado <> 3';
  assert (select array_agg(user_id order by user_id) from public.leilao_eventos
          where tipo = 'cancelado' and leilao_id = 'b6000000-0000-4000-8000-000000000001')
         = array['a6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000003']::uuid[],
    'FALHOU T3e: seguidores do lote 1';
  assert (select count(*) from public.leilao_eventos
          where tipo = 'cancelado' and leilao_id = 'b6000000-0000-4000-8000-000000000002'
            and user_id = 'a6000000-0000-4000-8000-000000000002') = 1,
    'FALHOU T3f: seguidor do lote 2';
  -- Lote que ja estava cancelado nao avisa de novo.
  assert not exists (select 1 from public.leilao_eventos
                     where tipo = 'cancelado' and leilao_id = 'b6000000-0000-4000-8000-000000000003'),
    'FALHOU T3g: avisou lote ja cancelado';
  -- Pendentes (o consumidor pega), com o motivo.
  assert not exists (select 1 from public.leilao_eventos
                     where tipo = 'cancelado' and rodada_id = 'c6000000-0000-4000-8000-000000000001'
                       and (processado_em is not null or payload->>'motivo' <> 'Live adiada')),
    'FALHOU T3h: evento processado ou sem motivo';
  -- Comportamento de antes mantido.
  assert (select status from public.leilao_rodadas where id = 'c6000000-0000-4000-8000-000000000001') = 'cancelada',
    'FALHOU T3i: rodada nao cancelou';
  assert (select count(*) from public.leiloes
          where rodada_id = 'c6000000-0000-4000-8000-000000000001' and status = 'cancelado') = 3,
    'FALHOU T3j: lotes nao cancelaram';
  assert (select cancelado_motivo from public.leiloes where id = 'b6000000-0000-4000-8000-000000000001') = 'Live adiada',
    'FALHOU T3k: motivo do lote';
  assert (select cancelado_motivo from public.leiloes where id = 'b6000000-0000-4000-8000-000000000003') = 'antes',
    'FALHOU T3l: mexeu no lote ja cancelado';
end $$;

-- ─── T4: cancelar de novo recusa e nao duplica evento ───────────────────────
do $$
begin
  begin
    perform public.leilao_cancelar_rodada('c6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', null);
    raise exception 'FALHOU T4a: cancelou duas vezes';
  exception when others then
    if sqlerrm <> 'rodada_fechada' then raise exception 'FALHOU T4a: %', sqlerrm; end if;
  end;
  assert (select count(*) from public.leilao_eventos
          where tipo = 'cancelado' and rodada_id = 'c6000000-0000-4000-8000-000000000001') = 3,
    'FALHOU T4b: duplicou aviso';
end $$;

-- ─── T5: rascunho sem motivo -> motivo padrao no evento ─────────────────────
do $$
declare
  r jsonb;
begin
  r := public.leilao_cancelar_rodada('c6000000-0000-4000-8000-000000000003', 'f6000000-0000-4000-8000-000000000001', '   ');
  assert (r->>'lotes_cancelados')::int = 1 and (r->>'avisos')::int = 1, format('FALHOU T5a: %s', r);
  assert (select payload->>'motivo' from public.leilao_eventos
          where tipo = 'cancelado' and leilao_id = 'b6000000-0000-4000-8000-000000000005') = 'rodada_cancelada_pela_loja',
    'FALHOU T5b: motivo padrao';
end $$;

-- ─── T6: o consumidor reserva os 4 e grava o sino ──────────────────────────
-- Reserva o teto (500) e fica so com os eventos das rodadas daqui: pendente de
-- outro leilao pode vir junto e fica reservado ate o raise final desfazer tudo.
create temp table _r on commit drop as
select * from public.leilao_eventos_reservar(500, 120)
 where rodada_id in ('c6000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000002',
                     'c6000000-0000-4000-8000-000000000003');

do $$
declare
  n int;
  res jsonb;
  tok uuid;
begin
  assert (select count(*) from _r) = 4, format('FALHOU T6a: reservou %s', (select count(*) from _r));
  assert not exists (select 1 from _r where tipo <> 'cancelado'), 'FALHOU T6b: reservou outro tipo';
  select reserva into tok from _r limit 1;

  -- Itens em formato equivalente; o plano do consumidor é provado no selftest.
  res := public.leilao_eventos_concluir(tok, (
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'sinos', jsonb_build_array(jsonb_build_object(
        'user_id', user_id, 'title', 'Leilão cancelado',
        'message', 'A loja cancelou o leilão. Ele não vai mais acontecer.',
        'data', jsonb_build_object('leilao_id', leilao_id, 'evento_id', id))),
      'email_ok', false,
      'finalizar', true))
    from _r));
  assert (res->>'finalizados')::int = 4, format('FALHOU T6c: %s', res);
  assert (res->>'sinos')::int = 4, format('FALHOU T6d: %s', res);

  select count(*) into n from public.notifications
   where type = 'leilao' and title = 'Leilão cancelado'
     and user_id in ('a6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000003');
  assert n = 4, format('FALHOU T6e: notificacoes = %s', n);
  assert not exists (select 1 from public.leilao_eventos
                     where tipo = 'cancelado' and processado_em is null
                       and rodada_id in ('c6000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000003')),
    'FALHOU T6f: ficou evento pendente';
  assert not exists (select 1 from public.leilao_eventos
                     where tipo = 'cancelado' and email_em is not null
                       and rodada_id in ('c6000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000003')),
    'FALHOU T6g: marcou e-mail em aviso so de sino';
end $$;

-- ─── T7: continua fechada ───────────────────────────────────────────────────
do $$
begin
  assert not has_function_privilege('authenticated', 'public.leilao_cancelar_rodada(uuid, uuid, text)', 'execute'),
    'FALHOU T7a: authenticated executa cancelar';
  assert not has_function_privilege('anon', 'public.leilao_cancelar_rodada(uuid, uuid, text)', 'execute'),
    'FALHOU T7b: anon executa cancelar';
  assert has_function_privilege('service_role', 'public.leilao_cancelar_rodada(uuid, uuid, text)', 'execute'),
    'FALHOU T7c: service_role sem execute';
end $$;

do $$ begin raise exception 'LEILAO_PAINEL_AVISOS_TODOS_OK'; end $$;
