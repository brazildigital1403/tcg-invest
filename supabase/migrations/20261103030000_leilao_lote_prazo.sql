-- Leilao com prazo (decisao do Du em 03/11/2026): a loja publica uma carta e
-- escolhe 1, 3, 5 ou 7 dias. Lote sem rodada, que o motor ja aceitava: abre na
-- hora, soft close de 2 minutos, e leilao_tick fecha no prazo. Provado na prova.
-- A loja so cancela lote sem lance: lance recebido e compromisso das duas partes.
--
-- Rollback: drop function public.leilao_criar_lote_prazo(uuid, jsonb, integer);
--           drop function public.leilao_cancelar_lote_prazo(uuid, uuid);

create or replace function public.leilao_criar_lote_prazo(p_loja uuid, p_lote jsonb, p_dias integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dono uuid;
  v_status text;
  v_codigo text;
  v_slug_base text;
  v_id uuid;
  v_constraint text;
begin
  if p_dias not in (1, 3, 5, 7) then
    raise exception 'dias_invalido';
  end if;
  if p_lote is null or jsonb_typeof(p_lote) <> 'object'
     or jsonb_typeof(p_lote->'fotos') is distinct from 'array'
     or btrim(coalesce(p_lote->>'card_name', '')) = '' then
    raise exception 'lote_invalido';
  end if;
  select owner_user_id, status into v_dono, v_status from public.lojas where id = p_loja;
  if not found or v_dono is null then
    raise exception 'rodada_nao_encontrada';
  end if;
  v_slug_base := coalesce(nullif(btrim(p_lote->>'slug_base'), ''), 'carta');
  for i in 1..5 loop
    v_codigo := public.leilao_novo_codigo();
    begin
      insert into public.leiloes (
        codigo, slug, vendedor_user_id, loja_id,
        card_id, card_slug, card_name, card_numero, set_nome, card_image,
        fotos, condicao, idioma, graduadora, nota, descricao,
        lance_inicial_cents, duracao_seg, soft_close_seg, status, inicia_em, termina_em
      ) values (
        v_codigo, v_slug_base || '-' || v_codigo, v_dono, p_loja,
        p_lote->>'card_id', p_lote->>'card_slug', btrim(p_lote->>'card_name'), p_lote->>'card_numero',
        p_lote->>'set_nome', p_lote->>'card_image',
        p_lote->'fotos', p_lote->>'condicao', p_lote->>'idioma', p_lote->>'graduadora',
        p_lote->>'nota', p_lote->>'descricao',
        (p_lote->>'lance_inicial_cents')::integer, p_dias * 86400, 120, 'ativo',
        now(), now() + make_interval(days => p_dias)
      )
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'leiloes_codigo_key' then
        raise;
      end if;
    end;
  end loop;
  raise exception 'lote_invalido';
end;
$$;
revoke all on function public.leilao_criar_lote_prazo(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.leilao_criar_lote_prazo(uuid, jsonb, integer) to service_role;

create or replace function public.leilao_cancelar_lote_prazo(p_lote uuid, p_loja uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_n integer; v_status text; v_rodada uuid;
begin
  select n_lances, status, rodada_id into v_n, v_status, v_rodada
    from public.leiloes where id = p_lote and loja_id = p_loja for update;
  if not found or v_rodada is not null then return 'nao_encontrado'; end if;
  if v_status <> 'ativo' then return 'fechado'; end if;
  if v_n > 0 then return 'tem_lance'; end if;
  update public.leiloes set status = 'cancelado', cancelado_motivo = 'cancelado_pela_loja', versao = versao + 1 where id = p_lote;
  return 'ok';
end;
$$;
revoke all on function public.leilao_cancelar_lote_prazo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leilao_cancelar_lote_prazo(uuid, uuid) to service_role;
