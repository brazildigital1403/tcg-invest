-- ============================================================================
-- Roteiro de prova da fatia 3 (20260928110000_leilao_avisos.sql).
--
-- ★ TEM DE RODAR COMO TRANSACAO UNICA: `psql -1 -v ON_ERROR_STOP=1 -f` ou o
--   arquivo inteiro num unico execute_sql (um texto so). Rodado comando a
--   comando (autocommit), as fixtures FICAM no banco e o raise do fim nao
--   desfaz nada.
-- SEM begin/rollback de proposito: o ultimo comando e
-- `raise exception 'LEILAO_AVISOS_TODOS_OK'` -- a excecao desfaz tudo e nao
-- deixa rastro. Chegar nela = tudo passou. Qualquer outra excecao
-- ("FALHOU Tn: ...") para antes e aponta o bloco.
--
-- Rodar SO na branch de prova, como `postgres`, com o motor (20260928090000),
-- o pedido (20260928100000) e esta migration ja aplicados NA BRANCH.
--
-- ★ now() e fixo dentro da transacao: "reserva vencida" e simulada movendo
--   reservado_ate para o passado.
-- ★ notifications.user_id tem FK para auth.users: as fixtures criam os
--   usuarios em auth.users antes de public.users (a 03 fica SO em public.users
--   de proposito, para provar que sino de usuario sem auth nao trava a fila).
--
-- Usuarios: a300...01 vendedor | a300...02 ana | a300...03 sem auth.users
-- Loja:     f300...01
-- Lote:     b300...01 ativo
-- Eventos:  marcados por payload->>'t' (e1..e9)
-- ============================================================================

-- ─── Fila limpa: pendentes de outras provas nao entram nesta (desfeito no fim)
update public.leilao_eventos set processado_em = now() where processado_em is null;

-- ─── Fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('a3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'leilao-a01@teste.invalid', now(), now()),
  ('a3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'leilao-a02@teste.invalid', now(), now())
on conflict (id) do nothing;

insert into public.users (id, name, email, username, cpf, cep) values
  ('a3000000-0000-4000-8000-000000000001', 'Vendedor Avisos', 'leilao-a01@teste.invalid', 'vendedoravisos', '99999999931', '01001000'),
  ('a3000000-0000-4000-8000-000000000002', 'Ana Avisos',      'leilao-a02@teste.invalid', 'anaavisos',      '99999999932', '01001000'),
  ('a3000000-0000-4000-8000-000000000003', 'Sem Auth',        'leilao-a03@teste.invalid', 'semauthavisos',  '99999999933', '01001000')
on conflict (id) do update set cpf = excluded.cpf, cep = excluded.cep, username = excluded.username;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado)
values ('f3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
        'leilao-avisos-loja', 'Loja Teste Avisos', 'Sao Paulo', 'SP')
on conflict (id) do nothing;

insert into public.leiloes (id, vendedor_user_id, loja_id, card_name, slug, lance_inicial_cents,
                            duracao_seg, status, inicia_em, termina_em)
values ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
        'f3000000-0000-4000-8000-000000000001', 'Pikachu', 'pikachu-avisos-1', 1000,
        3600, 'ativo', now() - interval '1 minute', now() + interval '1 hour');

-- e0: superado antigo, ja processado e com e-mail enviado ha 5 min (debounce).
insert into public.leilao_eventos (leilao_id, tipo, user_id, payload, processado_em, email_em)
values ('b3000000-0000-4000-8000-000000000001', 'superado', 'a3000000-0000-4000-8000-000000000002',
        '{"t":"e0"}', now() - interval '5 minutes', now() - interval '5 minutes');
-- e1..e4 pendentes; e5 ja nasce processado (teto_ajustado).
insert into public.leilao_eventos (leilao_id, tipo, user_id, payload) values
  ('b3000000-0000-4000-8000-000000000001', 'superado', 'a3000000-0000-4000-8000-000000000002', '{"t":"e1"}'),
  ('b3000000-0000-4000-8000-000000000001', 'venceu',   'a3000000-0000-4000-8000-000000000002', '{"t":"e2"}'),
  ('b3000000-0000-4000-8000-000000000001', 'calote',   'a3000000-0000-4000-8000-000000000003', '{"t":"e3"}'),
  ('b3000000-0000-4000-8000-000000000001', 'superado', 'a3000000-0000-4000-8000-000000000001', '{"t":"e4"}');
insert into public.leilao_eventos (leilao_id, tipo, user_id, payload, processado_em)
values ('b3000000-0000-4000-8000-000000000001', 'teto_ajustado', 'a3000000-0000-4000-8000-000000000002',
        '{"t":"e5","idem":"avisos-e5"}', now());

create temp table _r on commit drop as
select 1 as rodada, * from public.leilao_eventos_reservar(100, 120);

-- ─── T1: reserva devolve so os pendentes, em ordem, com um token ────────────
do $$
declare n int; tags text; toks int; tent int; e record;
begin
  select count(*), string_agg(r.payload->>'t', ',' order by r.id), count(distinct r.reserva), max(r.tentativas)
    into n, tags, toks, tent from _r r;
  assert n = 4, format('FALHOU T1: %s reservados', n);
  assert tags = 'e1,e2,e3,e4', format('FALHOU T1b: ordem %s', tags);
  assert toks = 1, format('FALHOU T1c: %s tokens', toks);
  assert tent = 1, format('FALHOU T1d: tentativas %s', tent);
  select * into e from public.leilao_eventos where payload->>'t' = 'e1';
  assert e.reserva is not null and e.reservado_ate > now() and e.processado_em is null,
    'FALHOU T1e: reserva nao gravada na linha';
end $$;

-- ─── T2: debounce -- ultimo e-mail de superado do mesmo usuario + lote ──────
do $$
declare v timestamptz; w timestamptz;
begin
  select ultimo_email_superado_em into v from _r where payload->>'t' = 'e1';
  assert v = now() - interval '5 minutes', format('FALHOU T2: %s', v);
  select ultimo_email_superado_em into w from _r where payload->>'t' = 'e4';
  assert w is null, format('FALHOU T2b: outro usuario herdou o debounce (%s)', w);
  select ultimo_email_superado_em into w from _r where payload->>'t' = 'e2';
  assert w is null, 'FALHOU T2c: venceu nao tem debounce';
end $$;

-- ─── T3: reserva viva nao e pega de novo ────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.leilao_eventos_reservar(100, 120);
  assert n = 0, format('FALHOU T3: %s eventos reservados duas vezes', n);
end $$;

-- ─── T4: token errado nao conclui nada ──────────────────────────────────────
do $$
declare r jsonb; v_id bigint;
begin
  select id into v_id from _r where payload->>'t' = 'e1';
  r := public.leilao_eventos_concluir(gen_random_uuid(),
         jsonb_build_array(jsonb_build_object('id', v_id, 'finalizar', true)));
  assert (r->>'perdidos')::int = 1 and (r->>'finalizados')::int = 0, format('FALHOU T4: %s', r);
  assert (select processado_em from public.leilao_eventos where id = v_id) is null, 'FALHOU T4b: finalizou com token errado';
end $$;

-- ─── T5: sucesso -- sino + e-mail + fim, na mesma chamada ───────────────────
do $$
declare r jsonb; v_id bigint; v_tok uuid; e record; n int;
begin
  select id, reserva into v_id, v_tok from _r where payload->>'t' = 'e2';
  r := public.leilao_eventos_concluir(v_tok, jsonb_build_array(jsonb_build_object(
         'id', v_id, 'email_ok', true, 'finalizar', true,
         'sinos', jsonb_build_array(jsonb_build_object(
           'user_id', 'a3000000-0000-4000-8000-000000000002',
           'title', 'Você venceu: Pikachu', 'message', 'Pague até 29/09 21:30 (Brasília).',
           'data', jsonb_build_object('link', '/leiloes/pikachu-avisos-1', 'evento_id', v_id))))));
  assert (r->>'finalizados')::int = 1 and (r->>'sinos')::int = 1, format('FALHOU T5: %s', r);
  select * into e from public.leilao_eventos where id = v_id;
  assert e.processado_em is not null and e.sino_em is not null and e.email_em is not null
     and e.reserva is null, 'FALHOU T5b: marcas do evento';
  select count(*) into n from public.notifications
   where user_id = 'a3000000-0000-4000-8000-000000000002' and type = 'leilao'
     and data->>'evento_id' = v_id::text and data->>'link' = '/leiloes/pikachu-avisos-1';
  assert n = 1, format('FALHOU T5c: %s sinos', n);

  -- Replay da mesma conclusao: evento ja processado, nada muda, sino nao duplica.
  r := public.leilao_eventos_concluir(v_tok, jsonb_build_array(jsonb_build_object(
         'id', v_id, 'finalizar', true,
         'sinos', jsonb_build_array(jsonb_build_object(
           'user_id', 'a3000000-0000-4000-8000-000000000002', 'title', 'x', 'message', 'x')))));
  assert (r->>'perdidos')::int = 1, format('FALHOU T5d: %s', r);
  select count(*) into n from public.notifications
   where user_id = 'a3000000-0000-4000-8000-000000000002' and type = 'leilao';
  assert n = 1, format('FALHOU T5e: %s sinos apos replay', n);
end $$;

-- ─── T6: falha -- sino fica, e-mail volta para a fila com espera ────────────
do $$
declare r jsonb; v_id bigint; v_tok uuid; e record; n int;
begin
  select id, reserva into v_id, v_tok from _r where payload->>'t' = 'e1';
  r := public.leilao_eventos_concluir(v_tok, jsonb_build_array(jsonb_build_object(
         'id', v_id, 'erro', 'validation_error: teste',
         'sinos', jsonb_build_array(jsonb_build_object(
           'user_id', 'a3000000-0000-4000-8000-000000000002',
           'title', 'Seu lance foi superado', 'message', 'Pikachu: lance atual R$ 20,00.',
           'data', jsonb_build_object('evento_id', v_id))))));
  assert (r->>'falhas')::int = 1, format('FALHOU T6: %s', r);
  select * into e from public.leilao_eventos where id = v_id;
  assert e.processado_em is null and e.reserva is null and e.sino_em is not null and e.email_em is null,
    'FALHOU T6b: estado apos falha';
  assert e.reservado_ate = now() + interval '1 minute', format('FALHOU T6c: espera %s', e.reservado_ate - now());
  assert e.ultimo_erro = 'validation_error: teste', format('FALHOU T6d: %s', e.ultimo_erro);

  -- Espera ainda correndo: nao volta.
  select count(*) into n from public.leilao_eventos_reservar(100, 120) x where x.id = v_id;
  assert n = 0, 'FALHOU T6e: voltou antes da espera';
end $$;

-- T6f: espera vencida -> nova reserva (tentativa 2); concluir de novo nao duplica o sino.
update public.leilao_eventos set reservado_ate = now() - interval '1 second' where payload->>'t' = 'e1';
insert into _r select 2, * from public.leilao_eventos_reservar(100, 120);
do $$
declare r jsonb; x record; n int;
begin
  select * into x from _r where rodada = 2 and payload->>'t' = 'e1';
  assert x.id is not null and x.tentativas = 2, format('FALHOU T6f: %s', x);
  assert x.sino_em is not null, 'FALHOU T6g: sino_em nao veio na reserva';
  assert (select count(*) from _r where rodada = 2) = 1, 'FALHOU T6h: reservou mais que o vencido';
  r := public.leilao_eventos_concluir(x.reserva, jsonb_build_array(jsonb_build_object(
         'id', x.id, 'email_ok', true, 'finalizar', true,
         'sinos', jsonb_build_array(jsonb_build_object(
           'user_id', 'a3000000-0000-4000-8000-000000000002', 'title', 'Seu lance foi superado', 'message', 'x')))));
  assert (r->>'finalizados')::int = 1 and (r->>'sinos')::int = 0, format('FALHOU T6i: %s', r);
  select count(*) into n from public.notifications
   where user_id = 'a3000000-0000-4000-8000-000000000002' and type = 'leilao'
     and title = 'Seu lance foi superado';
  assert n = 1, format('FALHOU T6j: %s sinos de superado', n);
end $$;

-- ─── T7: sino de usuario sem auth.users nao trava; desistencia na 5a ────────
do $$
declare r jsonb; v_id bigint; v_tok uuid; e record;
begin
  select id, reserva into v_id, v_tok from _r where rodada = 1 and payload->>'t' = 'e3';
  update public.leilao_eventos set tentativas = 5 where id = v_id;
  r := public.leilao_eventos_concluir(v_tok, jsonb_build_array(jsonb_build_object(
         'id', v_id, 'erro', 'rate_limit',
         'sinos', jsonb_build_array(
           jsonb_build_object('user_id', 'a3000000-0000-4000-8000-000000000003', 'title', 'Prazo encerrado', 'message', 'x'),
           jsonb_build_object('user_id', 'a3000000-0000-4000-8000-000000000001', 'title', 'Arremate não pago', 'message', 'x')))));
  assert (r->>'desistidos')::int = 1 and (r->>'sinos')::int = 1, format('FALHOU T7: %s', r);
  select * into e from public.leilao_eventos where id = v_id;
  assert e.processado_em is not null and e.ultimo_erro = 'desistiu: rate_limit',
    format('FALHOU T7b: %s / %s', e.processado_em, e.ultimo_erro);
end $$;

-- ─── T8: liberar (rota sem tempo) devolve sem gastar tentativa ──────────────
do $$
declare r jsonb; v_id bigint; v_tok uuid; e record; n int;
begin
  select id, reserva into v_id, v_tok from _r where rodada = 1 and payload->>'t' = 'e4';
  r := public.leilao_eventos_concluir(v_tok, jsonb_build_array(jsonb_build_object('id', v_id, 'liberar', true)));
  assert (r->>'liberados')::int = 1, format('FALHOU T8: %s', r);
  select * into e from public.leilao_eventos where id = v_id;
  assert e.tentativas = 0 and e.reserva is null and e.reservado_ate is null and e.processado_em is null,
    format('FALHOU T8b: tentativas %s', e.tentativas);
  select count(*) into n from public.leilao_eventos_reservar(100, 120) x where x.id = v_id;
  assert n = 1, 'FALHOU T8c: liberado nao voltou para a fila';
end $$;

-- ─── T9: parametros e limites ───────────────────────────────────────────────
do $$
begin
  begin
    perform public.leilao_eventos_concluir(null, '[]'::jsonb);
    raise exception 'FALHOU T9: aceitou reserva nula';
  exception when raise_exception then
    if sqlerrm <> 'parametro_invalido' then raise; end if;
  end;
  begin
    perform public.leilao_eventos_concluir(gen_random_uuid(), '{}'::jsonb);
    raise exception 'FALHOU T9b: aceitou itens fora de array';
  exception when raise_exception then
    if sqlerrm <> 'parametro_invalido' then raise; end if;
  end;
end $$;

-- ─── T10: grants -- so service_role executa ─────────────────────────────────
do $$
begin
  assert not has_function_privilege('anon', 'public.leilao_eventos_reservar(integer, integer)', 'execute'), 'FALHOU T10: anon reserva';
  assert not has_function_privilege('authenticated', 'public.leilao_eventos_reservar(integer, integer)', 'execute'), 'FALHOU T10b: authenticated reserva';
  assert not has_function_privilege('anon', 'public.leilao_eventos_concluir(uuid, jsonb)', 'execute'), 'FALHOU T10c: anon conclui';
  assert not has_function_privilege('authenticated', 'public.leilao_eventos_concluir(uuid, jsonb)', 'execute'), 'FALHOU T10d: authenticated conclui';
  assert has_function_privilege('service_role', 'public.leilao_eventos_reservar(integer, integer)', 'execute'), 'FALHOU T10e: service_role sem reserva';
  assert has_function_privilege('service_role', 'public.leilao_eventos_concluir(uuid, jsonb)', 'execute'), 'FALHOU T10f: service_role sem conclui';
  assert not has_table_privilege('authenticated', 'public.leilao_eventos', 'select'), 'FALHOU T10g: fila legivel por authenticated';
end $$;

-- ─── Fim: desfaz tudo ───────────────────────────────────────────────────────
do $$ begin raise exception 'LEILAO_AVISOS_TODOS_OK'; end $$;
