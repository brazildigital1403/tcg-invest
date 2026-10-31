-- ============================================================================
-- Roteiro de teste de 20260928160000_leilao_menor_de_idade.sql.
--
-- Rodar como UMA transacao. O ultimo bloco levanta LEILAO_MENOR_TODOS_OK de
-- proposito: tudo volta e o banco fica como estava. Outra mensagem = falha.
-- ============================================================================

begin;

-- c1 vendedor; c2 menor (17 anos); c3 faz 18 hoje; c4 adulto; c5 sem data.
insert into public.users (id, name, email, username, cpf, cep, data_nascimento) values
  ('c9000000-0000-4000-8000-000000000001', 'Vendedor Idade', 'id-01@teste.invalid', 'idvendedor', '99999999991', '01001000', '1990-01-01'),
  ('c9000000-0000-4000-8000-000000000002', 'Menor Idade', 'id-02@teste.invalid', 'idmenor', '99999999992', '01001000', (current_date - interval '17 years')::date),
  ('c9000000-0000-4000-8000-000000000003', 'Faz 18 Hoje', 'id-03@teste.invalid', 'idfaz18', '99999999993', '01001000', (current_date - interval '18 years')::date),
  ('c9000000-0000-4000-8000-000000000004', 'Adulto Idade', 'id-04@teste.invalid', 'idadulto', '99999999994', '01001000', '1985-06-15'),
  ('c9000000-0000-4000-8000-000000000005', 'Sem Data', 'id-05@teste.invalid', 'idsemdata', '99999999995', '01001000', null)
on conflict (id) do nothing;

insert into public.leiloes (id, vendedor_user_id, card_name, slug, lance_inicial_cents, duracao_seg,
                            status, inicia_em, termina_em)
values ('d9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000001', 'Carta Idade',
        'carta-idade-01', 1000, 600, 'ativo', now() - interval '1 minute', now() + interval '1 hour');

do $$
begin
  assert has_function_privilege('authenticated', 'public.dar_lance(uuid, integer, uuid)', 'execute'),
    'FALHOU T0a: authenticated perdeu o dar_lance';
  assert not has_function_privilege('anon', 'public.dar_lance(uuid, integer, uuid)', 'execute'),
    'FALHOU T0b: anon executa dar_lance';
end $$;

-- T1: menor de 18 e recusado, e nada e gravado.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  begin
    perform public.dar_lance('d9000000-0000-4000-8000-000000000001', 5000, gen_random_uuid());
    raise exception 'FALHOU T1a: menor deu lance';
  exception when raise_exception then
    if sqlerrm <> 'menor_de_idade' then raise exception 'FALHOU T1b: erro %', sqlerrm; end if;
  end;
  assert not exists (select 1 from public.leilao_proxy where leilao_id = 'd9000000-0000-4000-8000-000000000001'),
    'FALHOU T1c: menor ficou com teto gravado';
  assert (select n_lances from public.leiloes where id = 'd9000000-0000-4000-8000-000000000001') = 0,
    'FALHOU T1d: lote contou lance do menor';
end $$;

-- T2: quem faz 18 hoje ja pode; T3 adulto; T4 data nula segue a regra da casa (adulto).
do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  v := public.dar_lance('d9000000-0000-4000-8000-000000000001', 2000, gen_random_uuid());
  assert (v->>'ok')::boolean, format('FALHOU T2: quem faz 18 hoje nao deu lance: %s', v);

  perform set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
  v := public.dar_lance('d9000000-0000-4000-8000-000000000001', 5000, gen_random_uuid());
  assert (v->>'lider')::boolean, format('FALHOU T3: adulto nao liderou: %s', v);

  perform set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
  v := public.dar_lance('d9000000-0000-4000-8000-000000000001', 9000, gen_random_uuid());
  assert (v->>'ok')::boolean, format('FALHOU T4: sem data nao deu lance: %s', v);
end $$;

-- T5: o menor continua barrado depois que o lote tem lances (nao e so o primeiro).
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"c9000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  begin
    perform public.dar_lance('d9000000-0000-4000-8000-000000000001', 50000, gen_random_uuid());
    raise exception 'FALHOU T5a: menor deu lance com o lote em disputa';
  exception when raise_exception then
    if sqlerrm <> 'menor_de_idade' then raise exception 'FALHOU T5b: erro %', sqlerrm; end if;
  end;
  assert (select lider_user_id from public.leiloes where id = 'd9000000-0000-4000-8000-000000000001')
         = 'c9000000-0000-4000-8000-000000000005', 'FALHOU T5c: lideranca mudou com o lance recusado';
end $$;

do $$ begin raise exception 'LEILAO_MENOR_TODOS_OK'; end $$;

rollback;
