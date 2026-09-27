-- ============================================================================
-- Roteiro de prova da fatia 5 (20260928120000_leilao_painel.sql).
--
-- ★ TEM DE RODAR COMO TRANSACAO UNICA: `psql -1 -v ON_ERROR_STOP=1 -f` ou o
--   arquivo inteiro num unico execute_sql (um texto so). Rodado comando a
--   comando (autocommit), as fixtures FICAM no banco e o raise do fim nao
--   desfaz nada.
-- SEM begin/rollback de proposito: o ultimo comando e
-- `raise exception 'LEILAO_PAINEL_TODOS_OK'` -- a excecao desfaz tudo e nao
-- deixa rastro. Chegar nela = tudo passou. Qualquer outra excecao
-- ("FALHOU Tn: ...") para antes e aponta o bloco.
--
-- Rodar SO na branch de prova, como `postgres`, com o motor
-- (20260928090000) e esta migration ja aplicados NA BRANCH. Nunca em producao.
--
-- Usuarios: a500...01 dono da loja 1 | a500...02 dono da loja 2
-- Lojas:    f500...01 (loja 1) | f500...02 (loja 2)  -- pedidos.loja_id e
--           NOT NULL na branch; nenhum pedido e criado aqui, mas a loja existe
--           para as FKs de rodada e lote.
-- Rodadas:  c500...01 agenda | c500...02 sem lote | c500...03 foto faltando
--           c500...04 lote ja abriu (cancelar recusa) | c500...05 de outra loja
-- Lotes:    b500...01..03 (rodada 01) | b500...04 (rodada 03, 1 foto)
--           b500...05 (rodada 04, sem_lances) | b500...06 (rodada 05)
-- ============================================================================

-- ─── Fixtures ───────────────────────────────────────────────────────────────

insert into public.users (id, name, email, username, cpf, cep) values
  ('a5000000-0000-4000-8000-000000000001', 'Loja Painel Um', 'leilao-pn01@teste.invalid', 'lojapainelum', '99999999951', '01001000'),
  ('a5000000-0000-4000-8000-000000000002', 'Loja Painel Dois', 'leilao-pn02@teste.invalid', 'lojapaineldois', '99999999952', '01001000')
on conflict (id) do update set cpf = excluded.cpf, cep = excluded.cep, username = excluded.username;

insert into public.lojas (id, owner_user_id, slug, nome, cidade, estado) values
  ('f5000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001',
   'leilao-painel-loja-1', 'Loja Painel Um', 'Sao Paulo', 'SP'),
  ('f5000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000002',
   'leilao-painel-loja-2', 'Loja Painel Dois', 'Sao Paulo', 'SP')
on conflict (id) do nothing;

insert into public.leilao_rodadas (id, loja_id, vendedor_user_id, titulo, status, inicia_em) values
  ('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001', 'Rodada boa', 'rascunho', now() + interval '5 minutes'),
  ('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001', 'Rodada vazia', 'rascunho', now() + interval '1 hour'),
  ('c5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001', 'Rodada com foto faltando', 'rascunho', now() + interval '1 hour'),
  ('c5000000-0000-4000-8000-000000000004', 'f5000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001', 'Rodada que ja abriu', 'ao_vivo', now() - interval '10 minutes'),
  ('c5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000002',
   'a5000000-0000-4000-8000-000000000002', 'Rodada da outra loja', 'rascunho', now() + interval '1 hour');

insert into public.leiloes (id, rodada_id, ordem, vendedor_user_id, loja_id, card_name, slug,
                            fotos, lance_inicial_cents, duracao_seg, status, encerrado_em)
values
  ('b5000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 1,
   'a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Pikachu', 'pikachu-painel-1',
   '["https://x.test/f1.webp","https://x.test/v1.webp"]', 1000, 30, 'rascunho', null),
  ('b5000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000001', 2,
   'a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Eevee', 'eevee-painel-2',
   '["https://x.test/f2.webp","https://x.test/v2.webp"]', 1000, 45, 'rascunho', null),
  ('b5000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000001', 3,
   'a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Mew', 'mew-painel-3',
   '["https://x.test/f3.webp","https://x.test/v3.webp"]', 1000, 60, 'rascunho', null),
  ('b5000000-0000-4000-8000-000000000004', 'c5000000-0000-4000-8000-000000000003', 1,
   'a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Ditto', 'ditto-painel-4',
   '["https://x.test/f4.webp",""]', 1000, 30, 'rascunho', null),
  ('b5000000-0000-4000-8000-000000000005', 'c5000000-0000-4000-8000-000000000004', 1,
   'a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Snorlax', 'snorlax-painel-5',
   '["https://x.test/f5.webp","https://x.test/v5.webp"]', 1000, 30, 'sem_lances', now() - interval '5 minutes'),
  ('b5000000-0000-4000-8000-000000000006', 'c5000000-0000-4000-8000-000000000005', 1,
   'a5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', 'Gengar', 'gengar-painel-6',
   '["https://x.test/f6.webp","https://x.test/v6.webp"]', 1000, 30, 'rascunho', null);

-- ─── T1: rodada de OUTRA loja nao e encontrada (agendar, reordenar, cancelar) ─
do $$
begin
  begin
    perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000001', 10);
    raise exception 'FALHOU T1a: agendou rodada de outra loja';
  exception when others then
    if sqlerrm <> 'rodada_nao_encontrada' then raise exception 'FALHOU T1a: %', sqlerrm; end if;
  end;
  begin
    perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000001',
                                          array['b5000000-0000-4000-8000-000000000006']::uuid[]);
    raise exception 'FALHOU T1b: reordenou rodada de outra loja';
  exception when others then
    if sqlerrm <> 'rodada_nao_encontrada' then raise exception 'FALHOU T1b: %', sqlerrm; end if;
  end;
  begin
    perform public.leilao_cancelar_rodada('c5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000001', null);
    raise exception 'FALHOU T1c: cancelou rodada de outra loja';
  exception when others then
    if sqlerrm <> 'rodada_nao_encontrada' then raise exception 'FALHOU T1c: %', sqlerrm; end if;
  end;
  assert (select status from public.leilao_rodadas where id = 'c5000000-0000-4000-8000-000000000005') = 'rascunho',
    'FALHOU T1d: rodada da outra loja mudou';
end $$;

-- ─── T2: inicio com menos de 10 min recusa e NAO muda nada ──────────────────
do $$
begin
  perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 10);
  raise exception 'FALHOU T2: agendou com inicio em 5 min';
exception when others then
  if sqlerrm <> 'inicio_cedo' then raise exception 'FALHOU T2: %', sqlerrm; end if;
end $$;
do $$
begin
  assert (select status from public.leilao_rodadas where id = 'c5000000-0000-4000-8000-000000000001') = 'rascunho',
    'FALHOU T2b: rodada saiu do rascunho';
  assert not exists (select 1 from public.leiloes
                     where rodada_id = 'c5000000-0000-4000-8000-000000000001' and status <> 'rascunho'),
    'FALHOU T2c: lote saiu do rascunho';
end $$;

-- ─── T3: sem inicio recusa ──────────────────────────────────────────────────
update public.leilao_rodadas set inicia_em = null where id = 'c5000000-0000-4000-8000-000000000001';
do $$
begin
  perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 10);
  raise exception 'FALHOU T3: agendou sem inicio';
exception when others then
  if sqlerrm <> 'sem_inicio' then raise exception 'FALHOU T3: %', sqlerrm; end if;
end $$;
update public.leilao_rodadas set inicia_em = now() + interval '30 minutes' where id = 'c5000000-0000-4000-8000-000000000001';

-- ─── T4: rodada sem lote recusa ─────────────────────────────────────────────
do $$
begin
  perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 10);
  raise exception 'FALHOU T4: agendou sem lote';
exception when others then
  if sqlerrm <> 'sem_lotes' then raise exception 'FALHOU T4: %', sqlerrm; end if;
end $$;

-- ─── T5: lote com foto vazia recusa e aponta o lote ─────────────────────────
do $$
begin
  perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001', 10);
  raise exception 'FALHOU T5: agendou lote sem as duas fotos';
exception when others then
  if sqlerrm <> 'lote_sem_fotos:b5000000-0000-4000-8000-000000000004' then raise exception 'FALHOU T5: %', sqlerrm; end if;
end $$;
-- e com UMA foto so (array de 1)
update public.leiloes set fotos = '["https://x.test/f4.webp"]' where id = 'b5000000-0000-4000-8000-000000000004';
do $$
begin
  perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001', 10);
  raise exception 'FALHOU T5b: agendou lote com 1 foto';
exception when others then
  if sqlerrm not like 'lote_sem_fotos:%' then raise exception 'FALHOU T5b: %', sqlerrm; end if;
end $$;

-- ─── T6: reordenar em rascunho (troca 1 e 3, sem bater no indice unico) ─────
do $$
declare v integer;
begin
  v := public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
         array['b5000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000001',
               'b5000000-0000-4000-8000-000000000002']::uuid[]);
  assert v = 3, format('FALHOU T6: devolveu %s', v);
  assert (select ordem from public.leiloes where id = 'b5000000-0000-4000-8000-000000000003') = 1, 'FALHOU T6b: Mew nao e o 1';
  assert (select ordem from public.leiloes where id = 'b5000000-0000-4000-8000-000000000001') = 2, 'FALHOU T6c: Pikachu nao e o 2';
  assert (select ordem from public.leiloes where id = 'b5000000-0000-4000-8000-000000000002') = 3, 'FALHOU T6d: Eevee nao e o 3';
end $$;

-- ─── T7: reordenar com conjunto errado recusa (faltando, repetido, alheio) ──
do $$
begin
  begin
    perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
      array['b5000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000001']::uuid[]);
    raise exception 'FALHOU T7a: aceitou lista faltando lote';
  exception when others then
    if sqlerrm <> 'ordem_invalida' then raise exception 'FALHOU T7a: %', sqlerrm; end if;
  end;
  begin
    perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
      array['b5000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000003',
            'b5000000-0000-4000-8000-000000000001']::uuid[]);
    raise exception 'FALHOU T7b: aceitou lote repetido';
  exception when others then
    if sqlerrm <> 'ordem_invalida' then raise exception 'FALHOU T7b: %', sqlerrm; end if;
  end;
  begin
    perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
      array['b5000000-0000-4000-8000-000000000003', 'b5000000-0000-4000-8000-000000000001',
            'b5000000-0000-4000-8000-000000000006']::uuid[]);
    raise exception 'FALHOU T7c: aceitou lote de outra rodada';
  exception when others then
    if sqlerrm <> 'ordem_invalida' then raise exception 'FALHOU T7c: %', sqlerrm; end if;
  end;
  assert (select ordem from public.leiloes where id = 'b5000000-0000-4000-8000-000000000003') = 1, 'FALHOU T7d: ordem mudou';
end $$;

-- ─── T8: agendar ok -> rodada agendada e TODOS os lotes agendado ────────────
do $$
declare r jsonb;
begin
  r := public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 10);
  assert (r->>'ok')::boolean, 'FALHOU T8: ok';
  assert (r->>'lotes')::int = 3, format('FALHOU T8: lotes %s <> 3', r->>'lotes');
  assert (select status from public.leilao_rodadas where id = 'c5000000-0000-4000-8000-000000000001') = 'agendada',
    'FALHOU T8b: rodada nao agendada';
  assert (select count(*) from public.leiloes
          where rodada_id = 'c5000000-0000-4000-8000-000000000001' and status = 'agendado') = 3,
    'FALHOU T8c: nem todo lote agendado';
  assert not exists (select 1 from public.leiloes
                     where rodada_id = 'c5000000-0000-4000-8000-000000000001' and inicia_em is not null),
    'FALHOU T8d: lote de rodada ao vivo ganhou inicia_em no agendamento';
end $$;

-- ─── T9: agendar de novo recusa ─────────────────────────────────────────────
do $$
begin
  perform public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 10);
  raise exception 'FALHOU T9: agendou duas vezes';
exception when others then
  if sqlerrm <> 'rodada_nao_rascunho' then raise exception 'FALHOU T9: %', sqlerrm; end if;
end $$;

-- ─── T9b: adicionar lote em rodada AGENDADA recusa e nao insere nada ───────
do $$
declare n_antes integer;
begin
  select count(*) into n_antes from public.leiloes where rodada_id = 'c5000000-0000-4000-8000-000000000001';
  begin
    perform public.leilao_adicionar_lote('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
      '{"card_name":"Charmander","slug_base":"charmander","fotos":["https://x.test/f9.webp","https://x.test/v9.webp"],
        "lance_inicial_cents":1000,"duracao_seg":30}'::jsonb);
    raise exception 'FALHOU T9b: adicionou lote em rodada agendada';
  exception when others then
    if sqlerrm <> 'rodada_nao_rascunho' then raise exception 'FALHOU T9b: %', sqlerrm; end if;
  end;
  assert (select count(*) from public.leiloes where rodada_id = 'c5000000-0000-4000-8000-000000000001') = n_antes,
    'FALHOU T9c: lote entrou na rodada agendada';
end $$;

-- ─── T10: reordenar com a rodada agendada ainda vale ────────────────────────
do $$
begin
  perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
    array['b5000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002',
          'b5000000-0000-4000-8000-000000000003']::uuid[]);
  assert (select ordem from public.leiloes where id = 'b5000000-0000-4000-8000-000000000001') = 1, 'FALHOU T10: Pikachu nao voltou a 1';
end $$;

-- ─── T11: o tick abre a rodada agendada e ativa o 1o lote por ordem ─────────
update public.leilao_rodadas set inicia_em = now() - interval '1 second' where id = 'c5000000-0000-4000-8000-000000000001';
select public.leilao_tick();
do $$
begin
  assert (select status from public.leilao_rodadas where id = 'c5000000-0000-4000-8000-000000000001') = 'ao_vivo',
    'FALHOU T11: rodada nao abriu';
  assert (select status from public.leiloes where id = 'b5000000-0000-4000-8000-000000000001') = 'ativo',
    'FALHOU T11b: o lote de ordem 1 nao abriu';
end $$;

-- ─── T12: reordenar e cancelar com lote aberto recusam ──────────────────────
do $$
begin
  begin
    perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001',
      array['b5000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002',
            'b5000000-0000-4000-8000-000000000003']::uuid[]);
    raise exception 'FALHOU T12a: reordenou rodada ao vivo';
  exception when others then
    if sqlerrm <> 'rodada_fechada' then raise exception 'FALHOU T12a: %', sqlerrm; end if;
  end;
  begin
    perform public.leilao_cancelar_rodada('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', null);
    raise exception 'FALHOU T12b: cancelou com lote ativo';
  exception when others then
    if sqlerrm <> 'lote_ja_abriu' then raise exception 'FALHOU T12b: %', sqlerrm; end if;
  end;
  -- rodada 04: lote ja encerrado (sem_lances)
  begin
    perform public.leilao_cancelar_rodada('c5000000-0000-4000-8000-000000000004', 'f5000000-0000-4000-8000-000000000001', null);
    raise exception 'FALHOU T12c: cancelou rodada com lote encerrado';
  exception when others then
    if sqlerrm <> 'lote_ja_abriu' then raise exception 'FALHOU T12c: %', sqlerrm; end if;
  end;
end $$;

-- ─── T13: cancelar rascunho -> rodada cancelada, lotes cancelado ────────────
do $$
declare r jsonb;
begin
  r := public.leilao_cancelar_rodada('c5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001', '  ');
  assert (r->>'lotes_cancelados')::int = 1, format('FALHOU T13: cancelados %s', r->>'lotes_cancelados');
  assert (select status from public.leilao_rodadas where id = 'c5000000-0000-4000-8000-000000000003') = 'cancelada',
    'FALHOU T13b: rodada nao cancelada';
  assert (select status || '|' || cancelado_motivo from public.leiloes where id = 'b5000000-0000-4000-8000-000000000004')
         = 'cancelado|rodada_cancelada_pela_loja', 'FALHOU T13c: lote nao cancelado com motivo padrao';
end $$;

-- ─── T14: cancelar de novo recusa ───────────────────────────────────────────
do $$
begin
  perform public.leilao_cancelar_rodada('c5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001', null);
  raise exception 'FALHOU T14: cancelou duas vezes';
exception when others then
  if sqlerrm <> 'rodada_fechada' then raise exception 'FALHOU T14: %', sqlerrm; end if;
end $$;

-- ─── T15: agendada sem lote aberto cancela (loja desiste antes da hora) ─────
update public.leilao_rodadas set inicia_em = now() + interval '1 hour' where id = 'c5000000-0000-4000-8000-000000000005';
do $$
declare r jsonb;
begin
  r := public.leilao_agendar_rodada('c5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000002', 10);
  r := public.leilao_cancelar_rodada('c5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000002', 'desisti');
  assert (select status || '|' || cancelado_motivo from public.leiloes where id = 'b5000000-0000-4000-8000-000000000006')
         = 'cancelado|desisti', 'FALHOU T15: lote agendado nao cancelou';
end $$;

-- ─── T17: adicionar em rascunho -> ordem sequencial, slug fecha no codigo ──
do $$
declare
  a uuid; b uuid; r record;
  j jsonb := '{"card_id":"sv1-1","card_name":"Bulbasaur","slug_base":"bulbasaur-sv1-1",
               "fotos":["https://x.test/f17.webp","https://x.test/v17.webp"],
               "condicao":"NM","idioma":"pt","lance_inicial_cents":500,"duracao_seg":45}';
begin
  a := public.leilao_adicionar_lote('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', j);
  b := public.leilao_adicionar_lote('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', j);
  assert (select ordem from public.leiloes where id = a) = 1, 'FALHOU T17a: primeiro lote nao e ordem 1';
  assert (select ordem from public.leiloes where id = b) = 2, 'FALHOU T17b: segundo lote nao e ordem 2';
  select * into r from public.leiloes where id = a;
  assert r.status = 'rascunho' and r.loja_id = 'f5000000-0000-4000-8000-000000000001'
         and r.vendedor_user_id = 'a5000000-0000-4000-8000-000000000001', 'FALHOU T17c: dono/status errado';
  assert r.slug = 'bulbasaur-sv1-1-' || r.codigo, format('FALHOU T17d: slug %s', r.slug);
  assert jsonb_array_length(r.fotos) = 2 and r.lance_inicial_cents = 500 and r.duracao_seg = 45,
    'FALHOU T17e: campos do lote';
  -- rodada de outra loja nao e encontrada
  begin
    perform public.leilao_adicionar_lote('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', j);
    raise exception 'FALHOU T17f: adicionou em rodada de outra loja';
  exception when others then
    if sqlerrm <> 'rodada_nao_encontrada' then raise exception 'FALHOU T17f: %', sqlerrm; end if;
  end;
  -- apos reordenar (2,1), o proximo continua no fim
  perform public.leilao_reordenar_lotes('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001',
                                        array[b, a]);
  a := public.leilao_adicionar_lote('c5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', j);
  assert (select ordem from public.leiloes where id = a) = 3, 'FALHOU T17g: terceiro lote nao e ordem 3';
end $$;

-- ─── T16: nenhuma das quatro executa como authenticated/anon ──────────────────
do $$
begin
  assert not has_function_privilege('authenticated', 'public.leilao_agendar_rodada(uuid, uuid, integer)', 'execute'),
    'FALHOU T16a: authenticated executa agendar';
  assert not has_function_privilege('anon', 'public.leilao_reordenar_lotes(uuid, uuid, uuid[])', 'execute'),
    'FALHOU T16b: anon executa reordenar';
  assert not has_function_privilege('authenticated', 'public.leilao_cancelar_rodada(uuid, uuid, text)', 'execute'),
    'FALHOU T16c: authenticated executa cancelar';
  assert not has_function_privilege('authenticated', 'public.leilao_adicionar_lote(uuid, uuid, jsonb)', 'execute'),
    'FALHOU T16e: authenticated executa adicionar';
  assert has_function_privilege('service_role', 'public.leilao_adicionar_lote(uuid, uuid, jsonb)', 'execute'),
    'FALHOU T16f: service_role sem execute em adicionar';
  assert has_function_privilege('service_role', 'public.leilao_agendar_rodada(uuid, uuid, integer)', 'execute'),
    'FALHOU T16d: service_role sem execute';
end $$;

do $$ begin raise exception 'LEILAO_PAINEL_TODOS_OK'; end $$;
