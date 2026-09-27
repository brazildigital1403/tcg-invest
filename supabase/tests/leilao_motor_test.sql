-- ============================================================================
-- Roteiro de prova do motor do leilao (20260928090000_leilao_motor.sql).
--
-- SQL puro, tudo dentro de begin ... rollback: nao deixa rastro. Rodar SO na
-- branch de prova, conectado como `postgres`, com a migration do motor ja
-- aplicada NA BRANCH. Nunca em producao.
--
-- Cada bloco que falha para a transacao com "FALHOU Tn: ...". Chegou no fim =
-- tudo passou.
--
-- Como o usuario e simulado: set_config('request.jwt.claims', {"sub": ...})
-- + `set local role authenticated`. `reset role` volta para postgres (para
-- montar dado e conferir o que a RLS esconde).
--
-- ★ now() e FIXO dentro da transacao. Por isso os relogios dos lotes sao
--   montados relativos a now() (corte exato: termina_em = now()). O desempate e
--   o soft close usam clock_timestamp(), que anda.
--
-- ★ NAO cobre concorrencia real (duas sessoes no mesmo lote). Isso so se prova
--   com dois clientes; o desenho e `select ... for update` na linha do lote.
--
-- Usuarios (uuid a000...0N):
--   01 vendedor | 02 ana | 03 bia | 04 caio | 05 dudu (sem CPF) | 06 eva (suspensa)
-- Lotes: b000...01 avulso L1 | b000...02 R1 e b000...03 R2 (rodada c000...01)
--        b000...05 avulso atrasado (T16) | b000...06..09 rodadas de validacao (T17/T18)
-- Pedidos (T15): e000...01 checkout em andamento | e000...02 pago
-- ============================================================================

begin;

-- ─── Fixtures (postgres) ────────────────────────────────────────────────────

insert into public.users (id, name, email, username, cpf, cep, suspended_at) values
  ('a0000000-0000-4000-8000-000000000001', 'Vendedor Teste', 'leilao-t01@teste.invalid', 'vendedorteste', '99999999901', '01001000', null),
  ('a0000000-0000-4000-8000-000000000002', 'Ana Teste',      'leilao-t02@teste.invalid', 'anateste',      '99999999902', '01001000', null),
  ('a0000000-0000-4000-8000-000000000003', 'Bia Teste',      'leilao-t03@teste.invalid', 'biateste',      '99999999903', '01001-000', null),
  ('a0000000-0000-4000-8000-000000000004', 'Caio Teste',     'leilao-t04@teste.invalid', 'caioteste',     '999.999.999-04', '01001000', null),
  ('a0000000-0000-4000-8000-000000000005', 'Dudu Teste',     'leilao-t05@teste.invalid', 'duduteste',     null,          '01001000', null),
  ('a0000000-0000-4000-8000-000000000006', 'Eva Teste',      'leilao-t06@teste.invalid', 'evateste',      '99999999906', '01001000', now())
on conflict (id) do update
  set cpf = excluded.cpf, cep = excluded.cep, suspended_at = excluded.suspended_at,
      username = excluded.username;

-- L1: avulso, ativo, inicial R$ 10,00, soft close 10s, termina em 1h.
insert into public.leiloes (id, vendedor_user_id, card_name, slug, lance_inicial_cents,
                            duracao_seg, soft_close_seg, status, inicia_em, termina_em)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'Charizard ex', 'charizard-ex-teste1', 1000, 3600, 10, 'ativo',
        now() - interval '1 minute', now() + interval '1 hour');


-- ─── T1: primeiro lance paga o INICIAL, nao o teto ──────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 5000, gen_random_uuid());
  assert (r->>'ok')::boolean,                         'FALHOU T1: ok';
  assert (r->>'preco_cents')::int = 1000,             format('FALHOU T1: preco %s <> 1000', r->>'preco_cents');
  assert (r->>'lider')::boolean,                      'FALHOU T1: ana deveria liderar';
  assert (r->>'minimo_proximo_cents')::int = 1100,    format('FALHOU T1: minimo %s <> 1100', r->>'minimo_proximo_cents');
  assert (r->>'n_lances')::int = 1,                   format('FALHOU T1: n_lances %s', r->>'n_lances');
  assert r ? 'server_now' and r ? 'termina_em' and r ? 'versao', 'FALHOU T1: formato do retorno';
end $$;

-- ─── T2: abaixo do minimo devolve o minimo no codigo ────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 1050, gen_random_uuid());
  raise exception 'FALHOU T2: aceitou abaixo do minimo';
exception when others then
  if sqlerrm not like 'abaixo_minimo:1100%' then raise exception 'FALHOU T2: %', sqlerrm; end if;
end $$;

-- ─── T3: lance automatico (proxy) cobre na hora ─────────────────────────────
-- bia 30,00 contra teto 50,00 da ana -> preco = 30,00 + incremento(30,00)=2,00 = 32,00
do $$
declare r jsonb;
begin
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 3000, gen_random_uuid());
  assert not (r->>'lider')::boolean,                  'FALHOU T3: bia nao deveria liderar';
  assert (r->>'preco_cents')::int = 3200,             format('FALHOU T3: preco %s <> 3200', r->>'preco_cents');
  assert (r->>'n_lances')::int = 3,                   format('FALHOU T3: n_lances %s <> 3 (1 + lance da bia + automatico da ana)', r->>'n_lances');
end $$;

-- ─── T4: empate no teto -> vence o MAIS ANTIGO ──────────────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 5000, gen_random_uuid());
  assert not (r->>'lider')::boolean,                  'FALHOU T4: empate deveria ficar com a ana (mais antiga)';
  assert (r->>'preco_cents')::int = 5000,             format('FALHOU T4: preco %s <> 5000', r->>'preco_cents');
  -- caio sobe para 55,00: passa a liderar em min(55,00; 50,00 + 5,00) = 55,00
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 5500, gen_random_uuid());
  assert (r->>'lider')::boolean,                      'FALHOU T4b: caio deveria liderar';
  assert (r->>'preco_cents')::int = 5500,             format('FALHOU T4b: preco %s <> 5500', r->>'preco_cents');
end $$;

reset role;
do $$
declare l record; v_sup int; v_part int;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.lider_user_id = 'a0000000-0000-4000-8000-000000000004', 'FALHOU T4c: lider no banco';
  assert l.lider_maximo_cents = 5500,                 format('FALHOU T4c: teto %s', l.lider_maximo_cents);
  assert l.n_participantes = 3,                       format('FALHOU T4c: participantes %s <> 3', l.n_participantes);
  select count(*) into v_sup from public.leilao_eventos
   where leilao_id = l.id and tipo = 'superado' and user_id = 'a0000000-0000-4000-8000-000000000002';
  assert v_sup = 1,                                   format('FALHOU T4c: evento superado da ana = %s', v_sup);
end $$;

-- ─── T5: proprio leilao / cadastro incompleto / suspenso ────────────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 99900, gen_random_uuid());
  raise exception 'FALHOU T5: vendedor deu lance';
exception when others then
  if sqlerrm <> 'proprio_leilao' then raise exception 'FALHOU T5: %', sqlerrm; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 99900, gen_random_uuid());
  raise exception 'FALHOU T5b: sem CPF deu lance';
exception when others then
  if sqlerrm <> 'cadastro_incompleto' then raise exception 'FALHOU T5b: %', sqlerrm; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 99900, gen_random_uuid());
  raise exception 'FALHOU T5c: suspensa deu lance';
exception when others then
  if sqlerrm <> 'suspenso' then raise exception 'FALHOU T5c: %', sqlerrm; end if;
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 99900, gen_random_uuid());
  raise exception 'FALHOU T5d: sem sub deu lance';
exception when others then
  if sqlerrm <> 'nao_autenticado' then raise exception 'FALHOU T5d: %', sqlerrm; end if;
end $$;

-- T5e: teto acima de R$ 1 milhao -> pedido_invalido (espelho da rota)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 100000001, gen_random_uuid());
  raise exception 'FALHOU T5e: aceitou teto acima de R$ 1 mi';
exception when others then
  if sqlerrm <> 'pedido_invalido' then raise exception 'FALHOU T5e: %', sqlerrm; end if;
end $$;

-- ─── T6: idempotencia ───────────────────────────────────────────────────────
-- bia 70,00 com idem fixo: vence caio (55,00) em min(70,00; 55,00+5,00) = 60,00
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare r1 jsonb; r2 jsonb;
begin
  r1 := public.dar_lance('b0000000-0000-4000-8000-000000000001', 7000, 'd0000000-0000-4000-8000-00000000000a');
  assert (r1->>'lider')::boolean and (r1->>'preco_cents')::int = 6000,
         format('FALHOU T6: primeira %s', r1);
  r2 := public.dar_lance('b0000000-0000-4000-8000-000000000001', 7000, 'd0000000-0000-4000-8000-00000000000a');
  assert (r2->>'repetido')::boolean,                  'FALHOU T6: replay nao marcado';
  assert r2->>'preco_cents' = r1->>'preco_cents'
     and r2->>'n_lances' = r1->>'n_lances'
     and r2->>'versao' = r1->>'versao',               format('FALHOU T6: replay diferente %s x %s', r1, r2);
end $$;

-- mesmo idem com OUTRO usuario nao pode reaproveitar o resultado
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 7000, 'd0000000-0000-4000-8000-00000000000a');
  raise exception 'FALHOU T6b: idem de outro usuario aceito';
exception when others then
  if sqlerrm <> 'idem_invalido' then raise exception 'FALHOU T6b: %', sqlerrm; end if;
end $$;

reset role;
do $$
declare v int; l record;
begin
  select count(*) into v from public.leilao_lances where idem_key = 'd0000000-0000-4000-8000-00000000000a';
  assert v = 1, format('FALHOU T6c: %s linhas com o mesmo idem', v);
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.preco_atual_cents = 6000, format('FALHOU T6c: replay mexeu no preco (%s)', l.preco_atual_cents);
end $$;

-- retrato antes do T7 (o ajuste de teto nao pode mexer em nada publico)
select set_config('leilao_test.n_lances',
         (select n_lances::text from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001'), true),
       set_config('leilao_test.lances',
         (select count(*)::text from public.leilao_lances where leilao_id = 'b0000000-0000-4000-8000-000000000001'), true),
       set_config('leilao_test.versao',
         (select versao::text from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001'), true);

-- ─── T7: lider so sobe o teto -> preco nao muda, nada publico ───────────────
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb; r2 jsonb;
begin
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 8000, 'd0000000-0000-4000-8000-00000000000b');
  assert (r->>'lider')::boolean and (r->>'preco_cents')::int = 6000,
         format('FALHOU T7: %s', r);
  r2 := public.dar_lance('b0000000-0000-4000-8000-000000000001', 8000, 'd0000000-0000-4000-8000-00000000000b');
  assert (r2->>'repetido')::boolean,                  'FALHOU T7: replay do ajuste de teto';
end $$;

-- ─── T7c: lider repetindo o mesmo teto (ou menor) nao grava nada ────────────
do $$
declare r jsonb;
begin
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 8000, gen_random_uuid());
  assert (r->>'ok')::boolean and (r->>'lider')::boolean
     and (r->>'preco_cents')::int = 6000 and (r->>'seu_maximo_cents')::int = 8000,
         format('FALHOU T7c: mesmo teto %s', r);
  assert not (r ? 'repetido'),                        'FALHOU T7c: idem novo marcado como repetido';
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 7000, gen_random_uuid());
  assert (r->>'seu_maximo_cents')::int = 8000,        format('FALHOU T7c: teto menor baixou o teto %s', r);
end $$;

reset role;
do $$
declare l record; v int;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.lider_maximo_cents = 8000 and l.preco_atual_cents = 6000,
         format('FALHOU T7b: teto %s preco %s', l.lider_maximo_cents, l.preco_atual_cents);
  select count(*) into v from public.leilao_eventos
   where tipo = 'teto_ajustado' and payload->>'idem' = 'd0000000-0000-4000-8000-00000000000b';
  assert v = 1, format('FALHOU T7b: %s eventos teto_ajustado', v);
  -- T7 + T7c: um unico teto_ajustado no lote (o que subiu 7000 -> 8000)
  select count(*) into v from public.leilao_eventos
   where tipo = 'teto_ajustado' and leilao_id = l.id;
  assert v = 1, format('FALHOU T7c: %s teto_ajustado no lote (lider repetindo gravou)', v);
  -- nada publico mudou: nem historico, nem contador, nem versao
  select count(*) into v from public.leilao_lances where leilao_id = l.id;
  assert v = current_setting('leilao_test.lances')::int,
         format('FALHOU T7b: leilao_lances %s -> %s', current_setting('leilao_test.lances'), v);
  assert l.n_lances = current_setting('leilao_test.n_lances')::int,
         format('FALHOU T7b: n_lances %s -> %s', current_setting('leilao_test.n_lances'), l.n_lances);
  assert l.versao = current_setting('leilao_test.versao')::int,
         format('FALHOU T7b: versao %s -> %s', current_setting('leilao_test.versao'), l.versao);
end $$;

-- ─── T8: soft close estende ─────────────────────────────────────────────────
update public.leiloes set termina_em = now() + interval '5 seconds'
 where id = 'b0000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  -- ana 90,00 contra bia 80,00: min(90,00; 80,00+5,00) = 85,00
  r := public.dar_lance('b0000000-0000-4000-8000-000000000001', 9000, gen_random_uuid());
  assert (r->>'lider')::boolean and (r->>'preco_cents')::int = 8500, format('FALHOU T8: %s', r);
  assert (r->>'termina_em')::timestamptz >= now() + interval '9 seconds',
         format('FALHOU T8: nao estendeu (%s)', r->>'termina_em');
end $$;

reset role;
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.prorrogacoes = 1, format('FALHOU T8b: prorrogacoes %s', l.prorrogacoes);
end $$;

-- ─── T9: leitura publica NAO vaza o teto ────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare j jsonb;
begin
  select to_jsonb(p) into j from public.leiloes_publico p
   where p.id = 'b0000000-0000-4000-8000-000000000001';
  assert j->>'lider_apelido' = 'a***e',        format('FALHOU T9: apelido %s', j->>'lider_apelido');
  assert (j->>'preco_atual_cents')::int = 8500, 'FALHOU T9: preco na view';
  assert not (j ? 'lider_maximo_cents'),       'FALHOU T9: view expoe o teto';
  assert not (j ? 'lider_user_id'),            'FALHOU T9: view expoe o lider';
  begin
    perform lider_maximo_cents from public.leiloes limit 1;
    raise exception 'FALHOU T9b: anon leu lider_maximo_cents';
  exception when insufficient_privilege then null;
  end;
  begin
    perform user_id from public.leilao_lances limit 1;
    raise exception 'FALHOU T9c: anon leu user_id dos lances';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.leilao_proxy limit 1;
    raise exception 'FALHOU T9d: anon leu leilao_proxy';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.leilao_tick();
    raise exception 'FALHOU T9e: anon rodou o tick';
  exception when insufficient_privilege then null;
  end;
  select to_jsonb(x) into j from public.leilao_lances_publico x
   where x.leilao_id = 'b0000000-0000-4000-8000-000000000001'
   order by x.id desc limit 1;
  assert j is not null,                        'FALHOU T9f: anon nao le o historico publico';
  assert j->>'apelido' ~ '^.\*\*\*.$',          format('FALHOU T9f: apelido sem mascara (%s)', j->>'apelido');
  assert not (j ? 'user_id'),                  'FALHOU T9f: historico expoe user_id';
  assert not (j ? 'idem_key') and not (j ? 'resultado'), 'FALHOU T9f: historico expoe idem/resultado';
end $$;

-- T9g: authenticated le SO o proprio teto em leilao_proxy
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_meu int; v_outros int;
begin
  select count(*) into v_meu from public.leilao_proxy
   where leilao_id = 'b0000000-0000-4000-8000-000000000001'
     and user_id = 'a0000000-0000-4000-8000-000000000004';
  select count(*) into v_outros from public.leilao_proxy
   where leilao_id = 'b0000000-0000-4000-8000-000000000001'
     and user_id <> 'a0000000-0000-4000-8000-000000000004';
  assert v_meu = 1,    format('FALHOU T9g: caio nao le o proprio teto (%s)', v_meu);
  assert v_outros = 0, format('FALHOU T9g: caio le teto de outra pessoa (%s linhas)', v_outros);
end $$;

-- ─── T10: corte exato (now() >= termina_em) ─────────────────────────────────
reset role;
update public.leiloes set termina_em = now() where id = 'b0000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform public.dar_lance('b0000000-0000-4000-8000-000000000001', 50000, gen_random_uuid());
  raise exception 'FALHOU T10: aceitou lance no segundo exato do fim';
exception when others then
  if sqlerrm <> 'leilao_fechado' then raise exception 'FALHOU T10: %', sqlerrm; end if;
end $$;

-- ─── T11: folga de 1s, depois tick fecha o avulso com vencedor e 2o ────────
reset role;
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.status = 'ativo', format('FALHOU T11a: fechou dentro da folga de 1s (%s)', l.status);
end $$;

update public.leiloes set termina_em = now() - interval '1 second'
 where id = 'b0000000-0000-4000-8000-000000000001';
select public.leilao_tick();
do $$
declare l record; v int;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.status = 'aguardando_pagamento', format('FALHOU T11: status %s', l.status);
  assert l.pagar_ate = now() + interval '48 hours', 'FALHOU T11: pagar_ate';
  assert l.segundo_user_id = 'a0000000-0000-4000-8000-000000000003', 'FALHOU T11: segundo deveria ser a bia';
  select count(*) into v from public.leilao_eventos where leilao_id = l.id and tipo in ('encerrado', 'venceu');
  assert v = 2, format('FALHOU T11: eventos encerrado+venceu = %s', v);
end $$;

-- ─── T12: rodada ao vivo -> tick ativa o 1o, fecha e ativa o proximo ────────
insert into public.leilao_rodadas (id, vendedor_user_id, titulo, modo, status, inicia_em)
values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'Rodada teste', 'ao_vivo', 'agendada', now() - interval '1 second');
insert into public.leiloes (id, rodada_id, ordem, vendedor_user_id, card_name, slug,
                            lance_inicial_cents, duracao_seg, soft_close_seg, status)
values
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 1,
   'a0000000-0000-4000-8000-000000000001', 'Pikachu', 'pikachu-teste-r1', 500, 30, 10, 'agendado'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 2,
   'a0000000-0000-4000-8000-000000000001', 'Mew', 'mew-teste-r2', 500, 45, 10, 'agendado');

select public.leilao_tick();
do $$
declare r record; l1 record; l2 record;
begin
  select * into r  from public.leilao_rodadas where id = 'c0000000-0000-4000-8000-000000000001';
  select * into l1 from public.leiloes where id = 'b0000000-0000-4000-8000-000000000002';
  select * into l2 from public.leiloes where id = 'b0000000-0000-4000-8000-000000000003';
  assert r.status = 'ao_vivo',  format('FALHOU T12: rodada %s', r.status);
  assert l1.status = 'ativo' and l1.inicia_em = now() and l1.termina_em = now() + interval '30 seconds',
         format('FALHOU T12: lote 1 %s %s %s', l1.status, l1.inicia_em, l1.termina_em);
  assert l2.status = 'agendado', format('FALHOU T12: lote 2 ativou antes da hora (%s)', l2.status);
end $$;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.dar_lance('b0000000-0000-4000-8000-000000000002', 800, gen_random_uuid());
  assert (r->>'lider')::boolean and (r->>'preco_cents')::int = 500, format('FALHOU T12b: %s', r);
end $$;

reset role;
update public.leiloes set termina_em = now() - interval '1 second'
 where id = 'b0000000-0000-4000-8000-000000000002';
select public.leilao_tick();
do $$
declare l1 record; l2 record;
begin
  select * into l1 from public.leiloes where id = 'b0000000-0000-4000-8000-000000000002';
  select * into l2 from public.leiloes where id = 'b0000000-0000-4000-8000-000000000003';
  assert l1.status = 'aguardando_pagamento', format('FALHOU T12c: lote 1 %s', l1.status);
  assert l2.status = 'ativo' and l2.termina_em = now() + interval '45 seconds',
         format('FALHOU T12c: lote 2 nao ativou (%s %s)', l2.status, l2.termina_em);
end $$;

-- lote 2 vence sem lance -> sem_lances; rodada acaba
update public.leiloes set termina_em = now() - interval '1 second'
 where id = 'b0000000-0000-4000-8000-000000000003';
select public.leilao_tick();
do $$
declare r record; l2 record;
begin
  select * into l2 from public.leiloes where id = 'b0000000-0000-4000-8000-000000000003';
  select * into r  from public.leilao_rodadas where id = 'c0000000-0000-4000-8000-000000000001';
  assert l2.status = 'sem_lances', format('FALHOU T12d: lote 2 %s', l2.status);
  assert r.status = 'encerrada',   format('FALHOU T12d: rodada %s', r.status);
end $$;

-- ─── T13: calote so depois de pagar_ate + 15 min de carencia ───────────────
update public.leiloes set pagar_ate = now() - interval '14 minutes'
 where id = 'b0000000-0000-4000-8000-000000000002';
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000002';
  assert l.status = 'aguardando_pagamento', format('FALHOU T13a: calote dentro da carencia (%s)', l.status);
end $$;

update public.leiloes set pagar_ate = now() - interval '16 minutes'
 where id = 'b0000000-0000-4000-8000-000000000002';
select public.leilao_tick();
do $$
declare l record; v int;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000002';
  assert l.status = 'calote', format('FALHOU T13: %s', l.status);
  select count(*) into v from public.leilao_eventos where leilao_id = l.id and tipo = 'calote';
  assert v = 1, format('FALHOU T13: eventos calote = %s', v);
end $$;

-- ─── T14: incremento bate com o TS ──────────────────────────────────────────
do $$
begin
  assert public.leilao_incremento(0)       = 100
     and public.leilao_incremento(1999)    = 100
     and public.leilao_incremento(2000)    = 200
     and public.leilao_incremento(9999)    = 500
     and public.leilao_incremento(10000)   = 1000
     and public.leilao_incremento(49999)   = 2000
     and public.leilao_incremento(99999)   = 5000
     and public.leilao_incremento(249999)  = 10000
     and public.leilao_incremento(499999)  = 20000
     and public.leilao_incremento(999999)  = 50000
     and public.leilao_incremento(1000000) = 100000, 'FALHOU T14: tabela de incrementos';
  assert public.leilao_mascarar('joana') = 'j***a' and public.leilao_mascarar('J') = '***',
         'FALHOU T14b: mascara';
  -- nome curto: com 2 letras "j***o" entregaria o nome inteiro
  assert public.leilao_mascarar('Jo') = '***' and public.leilao_mascarar(' jo ') = '***'
     and public.leilao_mascarar('') = '***' and public.leilao_mascarar(null) = '***',
         format('FALHOU T14c: nome curto %s', public.leilao_mascarar('Jo'));
  assert public.leilao_mascarar('Ana') = 'a***a', 'FALHOU T14c: 3 letras';
end $$;

-- ─── T15: calote NAO marca lote com checkout em andamento ou pedido pago ────
-- L1 esta aguardando_pagamento desde o T11 (lider: ana).
update public.leiloes set pagar_ate = now() - interval '1 hour'
 where id = 'b0000000-0000-4000-8000-000000000001';
insert into public.pedidos (id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            status, stripe_session_id, leilao_id)
values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'Charizard ex', 8500, 8500, 'pix', 30,
        'aguardando_pagamento', 'cs_test_leilao_t15', 'b0000000-0000-4000-8000-000000000001');
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.status = 'aguardando_pagamento', format('FALHOU T15a: calote com checkout em andamento (%s)', l.status);
end $$;

-- checkout cancelado + pedido PAGO (sem sessao, ligado so por leilao_id)
update public.pedidos set status = 'cancelado', cancelado_em = now()
 where id = 'e0000000-0000-4000-8000-000000000001';
insert into public.pedidos (id, vendedor_user_id, comprador_user_id, item_nome,
                            valor_item_cents, total_comprador_cents, metodo, repasse_prazo,
                            status, pago_em, leilao_id)
values ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002', 'Charizard ex', 8500, 8500, 'pix', 30,
        'pago', now(), 'b0000000-0000-4000-8000-000000000001');
select public.leilao_tick();
do $$
declare l record; v int;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.status = 'aguardando_pagamento', format('FALHOU T15b: calote com pedido pago (%s)', l.status);
  select count(*) into v from public.leilao_eventos where leilao_id = l.id and tipo = 'calote';
  assert v = 0, format('FALHOU T15b: evento calote gravado (%s)', v);
end $$;

-- controle: sem o pedido pago (so o cancelado), ai sim vira calote
delete from public.pedidos where id = 'e0000000-0000-4000-8000-000000000002';
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000001';
  assert l.status = 'calote', format('FALHOU T15c: controle nao virou calote (%s)', l.status);
end $$;

-- ─── T16: tick atrasado nao abre-e-fecha ────────────────────────────────────
-- Agendado para 10 min atras, 30s de duracao: abre com os 30s cheios.
insert into public.leiloes (id, vendedor_user_id, card_name, slug, lance_inicial_cents,
                            duracao_seg, soft_close_seg, status, inicia_em)
values ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
        'Gengar', 'gengar-teste-atrasado', 500, 30, 10, 'agendado',
        now() - interval '10 minutes');
select public.leilao_tick();
do $$
declare l record;
begin
  select * into l from public.leiloes where id = 'b0000000-0000-4000-8000-000000000005';
  assert l.status = 'ativo', format('FALHOU T16: status %s (abriu e fechou no mesmo tick?)', l.status);
  assert l.termina_em = now() + interval '30 seconds',
         format('FALHOU T16: termina_em %s (esperado now()+30s)', l.termina_em);
end $$;

-- ─── T17: lote de rodada 'prazo' exige inicia_em; modo da rodada e fixo ─────
insert into public.leilao_rodadas (id, vendedor_user_id, titulo, modo, status)
values ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
        'Rodada prazo teste', 'prazo', 'rascunho');
do $$
begin
  insert into public.leiloes (id, rodada_id, ordem, vendedor_user_id, card_name, slug,
                              lance_inicial_cents, duracao_seg, status)
  values ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 1,
          'a0000000-0000-4000-8000-000000000001', 'Eevee', 'eevee-teste-prazo', 500, 86400, 'agendado');
  raise exception 'FALHOU T17: lote prazo sem inicia_em aceito';
exception when others then
  if sqlerrm <> 'lote_prazo_sem_inicio' then raise exception 'FALHOU T17: %', sqlerrm; end if;
end $$;

insert into public.leiloes (id, rodada_id, ordem, vendedor_user_id, card_name, slug,
                            lance_inicial_cents, duracao_seg, status)
values ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 1,
        'a0000000-0000-4000-8000-000000000001', 'Eevee', 'eevee-teste-prazo', 500, 86400, 'rascunho');
do $$
begin
  update public.leiloes set status = 'agendado' where id = 'b0000000-0000-4000-8000-000000000006';
  raise exception 'FALHOU T17b: agendou lote prazo sem inicia_em';
exception when others then
  if sqlerrm <> 'lote_prazo_sem_inicio' then raise exception 'FALHOU T17b: %', sqlerrm; end if;
end $$;
do $$
begin
  update public.leilao_rodadas set modo = 'ao_vivo' where id = 'c0000000-0000-4000-8000-000000000002';
  raise exception 'FALHOU T17c: trocou o modo de rodada com lote';
exception when others then
  if sqlerrm <> 'rodada_modo_fixo' then raise exception 'FALHOU T17c: %', sqlerrm; end if;
end $$;

-- ─── T18: rodada ao vivo nao encerra com rascunho nem sem lote aberto ───────
insert into public.leilao_rodadas (id, vendedor_user_id, titulo, modo, status, inicia_em) values
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Rodada com rascunho', 'ao_vivo', 'ao_vivo', now() - interval '1 minute'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Rodada sem lote aberto', 'ao_vivo', 'ao_vivo', now() - interval '1 minute');
insert into public.leiloes (id, rodada_id, ordem, vendedor_user_id, card_name, slug,
                            lance_inicial_cents, duracao_seg, status)
values
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000003', 1,
   'a0000000-0000-4000-8000-000000000001', 'Snorlax', 'snorlax-teste-rascunho', 500, 30, 'rascunho'),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000004', 1,
   'a0000000-0000-4000-8000-000000000001', 'Lapras', 'lapras-teste-cancelado', 500, 30, 'cancelado');
select public.leilao_tick();
do $$
declare r3 record; r4 record;
begin
  select * into r3 from public.leilao_rodadas where id = 'c0000000-0000-4000-8000-000000000003';
  select * into r4 from public.leilao_rodadas where id = 'c0000000-0000-4000-8000-000000000004';
  assert r3.status = 'ao_vivo', format('FALHOU T18: encerrou rodada com lote em rascunho (%s)', r3.status);
  assert r4.status = 'ao_vivo', format('FALHOU T18b: encerrou rodada em que nada abriu (%s)', r4.status);
end $$;

select 'leilao_motor_test: TODOS OK' as resultado;

rollback;
