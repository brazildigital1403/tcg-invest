-- ============================================================================
-- Leilao da Bynx: MENOR DE 18 NAO DA LANCE.
--
-- ★ NAO APLICADA EM PRODUCAO. Depende de 20260928090000_leilao_motor.sql.
--   Sobe com o Du, junto das outras fatias do leilao.
--
-- Decisao do Du (05/10/2026, #415): menores nao podem dar lance. O dar_lance ja
-- conferia elegibilidade em users (suspenso, CPF, CEP) antes de travar o lote;
-- a data de nascimento entra no mesmo SELECT por PK e levanta 'menor_de_idade'.
-- Data nula = adulto, como o resto do site (S40); em 05/10 os 462 usuarios
-- tinham a data preenchida e 8 eram menores.
--
-- O resto do dar_lance e IDENTICO ao de 20260928090000 (copiado, so o bloco
-- de elegibilidade mudou). Lance automatico de proxy nao passa por aqui: quem
-- ja tinha teto antes desta migration segue no lote ate ele fechar.
--
-- ROLLBACK: reaplicar dar_lance de 20260928090000_leilao_motor.sql.
-- ============================================================================

set local lock_timeout = '3s';

create or replace function public.dar_lance(p_leilao uuid, p_maximo_cents integer, p_idem uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
set statement_timeout = '5s'
as $$
declare
  v_uid          uuid := auth.uid();
  v_agora        timestamptz := now();   -- hora em que o lance chegou (corte exato)
  v_relogio      timestamptz;            -- hora real apos a trava (desempate, soft close)
  v_l            public.leiloes%rowtype;
  v_suspenso     timestamptz;
  v_cpf          text;
  v_cep          text;
  v_nascimento   date;
  v_achou        boolean;
  v_res          jsonb;
  v_idem_user    uuid;
  v_idem_leilao  uuid;
  v_min          integer;
  v_meu_max      integer;
  v_top1_user    uuid;
  v_top1_max     integer;
  v_top2_user    uuid;
  v_top2_max     integer;
  v_preco        integer;
  v_preco_antigo integer;
  v_lider_antigo uuid;
  v_novos        integer := 0;
  v_termina      timestamptz;
  v_prorrogou    boolean := false;
  v_lance_id     bigint;
  v_n_lances     integer;
  v_versao       integer;
  v_n_part       integer;
begin
  if v_uid is null then
    raise exception 'nao_autenticado';
  end if;
  -- Teto de R$ 1 milhao (espelho de MAXIMO_CENTS_TETO na rota). Tambem e o que
  -- mantem teto + incremento longe do limite do integer.
  if p_leilao is null or p_idem is null or p_maximo_cents is null
     or p_maximo_cents < 1 or p_maximo_cents > 100000000 then
    raise exception 'pedido_invalido';
  end if;

  -- Elegibilidade (PK em users), ANTES da trava: nao segura o lote a toa.
  select u.suspended_at, u.cpf, u.cep, u.data_nascimento, true
    into v_suspenso, v_cpf, v_cep, v_nascimento, v_achou
  from public.users u where u.id = v_uid;
  if not coalesce(v_achou, false) then
    raise exception 'cadastro_incompleto';
  end if;
  if v_suspenso is not null then
    raise exception 'suspenso';
  end if;
  -- ★ 20260928160000 (decisao do Du, 05/10): menor de 18 nao da lance. Data
  -- nula segue a regra da casa (S40: desconhecida = adulto); hoje todos os
  -- usuarios tem a data preenchida.
  if v_nascimento is not null and v_nascimento > (current_date - interval '18 years')::date then
    raise exception 'menor_de_idade';
  end if;
  if length(regexp_replace(coalesce(v_cpf, ''), '[^0-9]', '', 'g')) <> 11
     or length(regexp_replace(coalesce(v_cep, ''), '[^0-9]', '', 'g')) <> 8 then
    raise exception 'cadastro_incompleto';
  end if;

  -- ★ A trava. Tudo daqui para baixo e serial por lote.
  select * into v_l from public.leiloes where id = p_leilao for update;
  if not found then
    raise exception 'leilao_fechado';
  end if;
  v_relogio := clock_timestamp();

  -- Idempotencia (depois da trava: replay simultaneo nao passa em dobro).
  select x.resultado, x.user_id, x.leilao_id into v_res, v_idem_user, v_idem_leilao
  from public.leilao_lances x where x.idem_key = p_idem;
  if not found then
    select e.payload->'resultado', e.user_id, e.leilao_id into v_res, v_idem_user, v_idem_leilao
    from public.leilao_eventos e
    where e.tipo = 'teto_ajustado' and (e.payload->>'idem') = p_idem::text;
  end if;
  if v_idem_user is not null then
    if v_idem_user <> v_uid or v_idem_leilao <> p_leilao or v_res is null then
      raise exception 'idem_invalido';
    end if;
    return v_res || jsonb_build_object('server_now', clock_timestamp(), 'repetido', true);
  end if;

  if v_l.vendedor_user_id = v_uid
     or (v_l.loja_id is not null and exists (
           select 1 from public.lojas lj where lj.id = v_l.loja_id and lj.owner_user_id = v_uid)) then
    raise exception 'proprio_leilao';
  end if;

  -- Corte exato.
  if v_l.status <> 'ativo'
     or v_l.termina_em is null
     or v_agora >= v_l.termina_em
     or (v_l.inicia_em is not null and v_agora < v_l.inicia_em) then
    raise exception 'leilao_fechado';
  end if;

  v_preco_antigo := v_l.preco_atual_cents;
  v_lider_antigo := v_l.lider_user_id;
  v_min := case
    when v_l.n_lances = 0 or v_l.preco_atual_cents is null then v_l.lance_inicial_cents
    else v_l.preco_atual_cents + public.leilao_incremento(v_l.preco_atual_cents)
  end;

  -- ── Quem ja lidera: so ajusta o proprio teto. Preco nao muda, nada publico. ──
  if v_lider_antigo = v_uid then
    select p.maximo_cents into v_meu_max
    from public.leilao_proxy p where p.leilao_id = p_leilao and p.user_id = v_uid;

    v_res := jsonb_build_object(
      'ok', true,
      'preco_cents', coalesce(v_l.preco_atual_cents, v_l.lance_inicial_cents),
      'lider', true,
      'termina_em', v_l.termina_em,
      'server_now', clock_timestamp(),
      'minimo_proximo_cents', v_min,
      'n_lances', v_l.n_lances,
      'versao', v_l.versao,
      'seu_maximo_cents', greatest(p_maximo_cents, coalesce(v_meu_max, 0))
    );

    -- Mesmo teto (ou menor): nada muda, nada e gravado. Um replay deste idem
    -- cai aqui de novo e devolve o mesmo retrato.
    if p_maximo_cents <= coalesce(v_meu_max, 0) then
      return v_res;
    end if;

    update public.leilao_proxy
       set maximo_cents = p_maximo_cents, created_at = v_relogio, atualizado_em = v_relogio
     where leilao_id = p_leilao and user_id = v_uid;
    update public.leiloes
       set lider_maximo_cents = p_maximo_cents
     where id = p_leilao;
    insert into public.leilao_eventos (leilao_id, tipo, user_id, payload, processado_em)
    values (p_leilao, 'teto_ajustado', v_uid,
            jsonb_build_object('idem', p_idem::text, 'resultado', v_res,
                               'de_cents', v_meu_max, 'para_cents', p_maximo_cents), now());
    return v_res;
  end if;

  -- ── Lance novo (ou teto maior de quem nao lidera) ──
  if p_maximo_cents < v_min then
    raise exception 'abaixo_minimo:%', v_min;
  end if;

  insert into public.leilao_proxy (leilao_id, user_id, maximo_cents, created_at, atualizado_em)
  values (p_leilao, v_uid, p_maximo_cents, v_relogio, v_relogio)
  on conflict (leilao_id, user_id) do update
    set maximo_cents  = excluded.maximo_cents,
        created_at    = excluded.created_at,     -- teto novo, fila nova no desempate
        atualizado_em = excluded.atualizado_em
    where public.leilao_proxy.maximo_cents < excluded.maximo_cents;

  -- Top 2 (indice idx_leilao_proxy_ranking). Empate: created_at mais antigo.
  select p.user_id, p.maximo_cents into v_top1_user, v_top1_max
  from public.leilao_proxy p
  where p.leilao_id = p_leilao
  order by p.maximo_cents desc, p.created_at asc, p.user_id
  limit 1;

  select p.user_id, p.maximo_cents into v_top2_user, v_top2_max
  from public.leilao_proxy p
  where p.leilao_id = p_leilao and p.user_id <> v_top1_user
  order by p.maximo_cents desc, p.created_at asc, p.user_id
  limit 1;

  if v_top2_user is null then
    v_preco := v_l.lance_inicial_cents;
  else
    v_preco := least(v_top1_max, v_top2_max + public.leilao_incremento(v_top2_max));
  end if;
  v_preco := greatest(v_preco, v_l.lance_inicial_cents, coalesce(v_preco_antigo, 0));

  if v_top1_user = v_uid then
    -- Quem chamou passou a liderar. O antigo lider "subiu ate o teto" antes.
    if v_lider_antigo is not null and v_top2_user is not null
       and v_top2_max > coalesce(v_preco_antigo, 0) then
      insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico)
      values (p_leilao, v_top2_user, v_top2_max, true);
      v_novos := v_novos + 1;
    end if;
    insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico, idem_key)
    values (p_leilao, v_uid, v_preco, false, p_idem)
    returning id into v_lance_id;
    v_novos := v_novos + 1;

    if v_lider_antigo is not null and v_lider_antigo <> v_uid then
      insert into public.leilao_eventos (leilao_id, tipo, user_id, payload)
      values (p_leilao, 'superado', v_lider_antigo,
              jsonb_build_object('preco_cents', v_preco,
                                 'minimo_proximo_cents', v_preco + public.leilao_incremento(v_preco)));
    end if;
  else
    -- Quem chamou foi coberto na hora pelo teto do lider.
    insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico, idem_key)
    values (p_leilao, v_uid, p_maximo_cents, false, p_idem)
    returning id into v_lance_id;
    insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico)
    values (p_leilao, v_top1_user, v_preco, true);
    v_novos := v_novos + 2;
  end if;

  -- Soft close: lance nos ultimos soft_close_seg empurra o fim.
  v_termina := v_l.termina_em;
  if v_l.soft_close_seg > 0
     and v_l.termina_em - v_relogio < make_interval(secs => v_l.soft_close_seg) then
    v_termina := greatest(v_l.termina_em, v_relogio + make_interval(secs => v_l.soft_close_seg));
    v_prorrogou := v_termina > v_l.termina_em;
  end if;

  select count(*)::int into v_n_part from public.leilao_proxy where leilao_id = p_leilao;

  update public.leiloes
     set preco_atual_cents  = v_preco,
         lider_user_id      = v_top1_user,
         lider_maximo_cents = v_top1_max,
         n_lances           = n_lances + v_novos,
         n_participantes    = v_n_part,
         termina_em         = v_termina,
         prorrogacoes       = prorrogacoes + (case when v_prorrogou then 1 else 0 end),
         versao             = versao + 1
   where id = p_leilao
  returning n_lances, versao into v_n_lances, v_versao;

  v_res := jsonb_build_object(
    'ok', true,
    'preco_cents', v_preco,
    'lider', v_top1_user = v_uid,
    'termina_em', v_termina,
    'server_now', clock_timestamp(),
    'minimo_proximo_cents', v_preco + public.leilao_incremento(v_preco),
    'n_lances', v_n_lances,
    'versao', v_versao
  );

  update public.leilao_lances set resultado = v_res where id = v_lance_id;

  return v_res;
end;
$$;

comment on function public.dar_lance(uuid, integer, uuid) is
  'Lance com teto oculto, desempate pelo mais antigo, soft close e idempotencia por p_idem. Erros (raise): nao_autenticado, cadastro_incompleto, suspenso, menor_de_idade (20260928160000), leilao_fechado, proprio_leilao, abaixo_minimo:<cents>, idem_invalido, pedido_invalido.';

revoke all on function public.dar_lance(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.dar_lance(uuid, integer, uuid) to authenticated;
