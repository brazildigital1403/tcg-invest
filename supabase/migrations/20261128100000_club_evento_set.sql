-- Agenda do Club: o set do evento (28/11/2026, Fase 2 do Marketplace no Club, decisao do Du).
-- Evento de lancamento, abertura ou torneio ganha o set da colecao (dado do evento, preenchido por quem
-- organiza a Agenda; nunca escolha de produto). A pagina do evento usa o set para mostrar, de forma
-- automatica, as cartas desse set a venda no Marketplace.
--
-- Objetos novos e uma coluna nula: nada muda no que ja existe. club_evento_json so ganha duas chaves.
-- A gravacao do set e uma funcao propria (club_agenda_definir_set), sem mexer na club_agenda_salvar_interno.
--
-- ROLLBACK:
--   drop function public.club_agenda_definir_set(uuid, text);
--   reaplicar club_evento_json de 20261108100000_club_agenda.sql (sem 'set_id' e 'set_nome');
--   alter table public.club_eventos drop column set_id;

alter table public.club_eventos
  add column set_id text references public.pokemon_sets(id) on delete set null;

create or replace function public.club_evento_json(e club_eventos)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'tipo', e.tipo, 'titulo', e.titulo, 'descricao', e.descricao,
    'formato', e.formato, 'local_nome', e.local_nome, 'cidade', e.cidade, 'uf', e.uf,
    'link_url', e.link_url, 'participantes', to_jsonb(e.participantes), 'imagem_path', e.imagem_path,
    'inicio_data', e.inicio_data, 'fim_data', e.fim_data,
    'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI'),
    'status', e.status, 'nota_status', e.nota_status, 'remarcado_em', e.remarcado_em,
    'set_id', e.set_id,
    'set_nome', (select coalesce(s.name_pt, s.name) from public.pokemon_sets s where s.id = e.set_id)
  )
$$;

-- Define (ou limpa, com nulo) o set de um evento. So quem tem o papel 'agenda'. Evento cancelado nao muda.
create or replace function public.club_agenda_definir_set(p_id uuid, p_set text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_e   public.club_eventos;
  v_set text := nullif(trim(coalesce(p_set, '')), '');
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('agenda') then raise exception 'sem_papel'; end if;
  select * into v_e from public.club_eventos e where e.id = p_id for update;
  if not found then raise exception 'evento_nao_encontrado'; end if;
  if v_e.status = 'cancelado' then raise exception 'evento_cancelado'; end if;
  if v_set is not null and not exists (select 1 from public.pokemon_sets s where s.id = v_set) then raise exception 'set_invalido'; end if;

  update public.club_eventos e set set_id = v_set, editado_por = auth.uid(), updated_at = now()
   where e.id = p_id
   returning * into v_e;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (auth.uid(), 'agenda', 'definir_set', v_e.slug, jsonb_build_object('set_id', v_set));

  return public.club_evento_json(v_e);
end;
$$;
revoke all on function public.club_agenda_definir_set(uuid, text) from public, anon, authenticated;
grant execute on function public.club_agenda_definir_set(uuid, text) to authenticated;
