-- ============================================================================
-- Membros do Poke Creators Club: quem e Creator (18/11/2026)
-- ============================================================================
-- POR QUE: ate hoje "estar no Club" era so ter conta logada, e o /admin/users nao
-- sabia dizer quem e Creator. Pedido do Du em 18/11: um modal para completar o
-- cadastro ao entrar no Club e a marca de Creator no Admin (mockup aprovado em
-- 18/11, https://claude.ai/artifact/5oJhtB8412C8NLvvJJReVa).
--
-- club_membros: uma linha por conta que e Creator (conta, como entrou, desde
-- quando). Origem: 'modal' (a pessoa entrou pelo botao), 'amigo_secreto',
-- 'aniversarios' ou 'organizacao' (rastro que ja existia: carga unica abaixo e
-- gatilhos para as proximas entradas) e 'admin' (marcado a mao em /admin/users).
--
-- Um @ por Creator: o modal recusa um @ que ja esta na conta de outro Creator. A
-- unicidade fica na funcao (e nao em indice) porque users.instagram nao e unico
-- hoje e a carga abaixo traz o que ja existia, repetido ou nao.
--
-- O navegador nunca le nem escreve a tabela: RLS ligada sem policy, revoke e duas
-- funcoes security definer (ver o proprio cadastro e entrar). O /admin (cookie de
-- senha, sem auth.uid()) usa as funcoes pela chave de servico; marcar e tirar
-- ficam em club_organizacao_log, com user_id nulo (quem faz e o /admin).
--
-- Os gatilhos de rastro engolem qualquer erro: o Amigo Secreto, os Aniversariantes
-- e a organizacao estao no ar e nao podem falhar por causa do registro de membro.
--
-- ROLLBACK (na ordem):
--   drop trigger club_membro_rastro_organizadores on public.club_organizadores;
--   drop trigger club_membro_rastro_aniversarios on public.club_aniversarios;
--   drop trigger club_membro_rastro_amigo_secreto on public.amigo_secreto_participantes;
--   drop function public.club_membro_rastro();
--   drop function public.club_membro_admin_interno(uuid, text, uuid);
--   drop function public.club_entrar(jsonb);
--   drop function public.club_meu_cadastro();
--   drop function public.club_membro_json(uuid);
--   drop function public.club_instagram_limpo(text);
--   drop table public.club_membros;
--   delete from public.club_organizacao_log where acao in ('creator_marcar', 'creator_remover');
-- ============================================================================

-- ── Tabela ──────────────────────────────────────────────────────────────────

create table public.club_membros (
  user_id     uuid primary key references public.users(id) on delete cascade,
  origem      text not null check (origem in ('modal', 'amigo_secreto', 'aniversarios', 'organizacao', 'admin')),
  created_at  timestamptz not null default now()
);

-- Tabela nova nasce exposta no Supabase: RLS + revoke na criacao.
alter table public.club_membros enable row level security;
revoke all on public.club_membros from public, anon, authenticated;

-- ── Helpers internos ────────────────────────────────────────────────────────

-- @ do Instagram como o banco compara: minusculo e sem o(s) @ do comeco.
create or replace function public.club_instagram_limpo(t text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(btrim(coalesce(t, '')), '^@+', ''))
$$;
revoke all on function public.club_instagram_limpo(text) from public, anon, authenticated;

-- Estado de uma conta no Club: se e membro, desde quando, como entrou, o @ e o
-- WhatsApp que ja estao no perfil e o que falta. Nao e "stable" de proposito: o
-- club_entrar chama esta funcao depois de gravar e precisa ler o que acabou de gravar.
create or replace function public.club_membro_json(p_user uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_m     public.club_membros;
  v_u     record;
  v_ig    text;
  v_w     text;
  v_falta jsonb := '[]'::jsonb;
begin
  select * into v_m from public.club_membros where user_id = p_user;
  select u.instagram, u.whatsapp into v_u from public.users u where u.id = p_user;
  v_ig := nullif(public.club_instagram_limpo(v_u.instagram), '');
  v_w  := nullif(btrim(coalesce(v_u.whatsapp, '')), '');
  if v_ig is null or v_ig !~ '^[a-z0-9._]{1,30}$' then v_falta := v_falta || '"instagram"'::jsonb; end if;
  if v_w is null or regexp_replace(v_w, '\D', '', 'g') !~ '^[0-9]{10,13}$' then v_falta := v_falta || '"whatsapp"'::jsonb; end if;
  return jsonb_build_object(
    'membro',    v_m.user_id is not null,
    'origem',    v_m.origem,
    'desde',     v_m.created_at,
    'instagram', v_ig,
    'whatsapp',  v_w,
    'faltam',    v_falta
  );
end;
$$;
revoke all on function public.club_membro_json(uuid) from public, anon, authenticated;
grant execute on function public.club_membro_json(uuid) to service_role;

-- ── O que a pessoa chama no navegador ───────────────────────────────────────

-- Estado da propria conta (so responde sobre auth.uid()).
create or replace function public.club_meu_cadastro()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  return public.club_membro_json(auth.uid());
end;
$$;
revoke all on function public.club_meu_cadastro() from public, anon, authenticated;
grant execute on function public.club_meu_cadastro() to authenticated;

-- Entrar no Club: confirma o @ (obrigatorio) e o WhatsApp (opcional), grava o
-- membro e espelha os dois no perfil (so o que veio preenchido; nunca apaga o que
-- ja estava la). Quem ja e membro e completa o cadastro passa pelo mesmo caminho,
-- sem trocar a origem.
create or replace function public.club_entrar(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ig  text;
  v_w   text;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'dados_invalidos'; end if;
  if not exists (select 1 from public.users where id = v_uid) then raise exception 'usuario_nao_encontrado'; end if;

  v_ig := public.club_instagram_limpo(p->>'instagram');
  if v_ig !~ '^[a-z0-9._]{1,30}$' then raise exception 'instagram_invalido'; end if;

  v_w := nullif(regexp_replace(coalesce(p->>'whatsapp', ''), '\D', '', 'g'), '');
  if v_w is not null and v_w !~ '^[0-9]{10,13}$' then raise exception 'whatsapp_invalido'; end if;

  -- Um @ por Creator. A trava evita duas entradas simultaneas com o mesmo @.
  perform pg_advisory_xact_lock(hashtext('club_membro_ig:' || v_ig));
  if exists (
    select 1
    from public.club_membros m
    join public.users u on u.id = m.user_id
    where m.user_id <> v_uid and public.club_instagram_limpo(u.instagram) = v_ig
  ) then
    raise exception 'instagram_ja_usado';
  end if;

  insert into public.club_membros (user_id, origem) values (v_uid, 'modal')
  on conflict (user_id) do nothing;

  update public.users set
    instagram = case when public.club_instagram_limpo(instagram) = v_ig then instagram else v_ig end,
    whatsapp  = case when v_w is not null and regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') <> v_w then v_w else whatsapp end
  where id = v_uid;

  return public.club_membro_json(v_uid);
end;
$$;
revoke all on function public.club_entrar(jsonb) from public, anon, authenticated;
grant execute on function public.club_entrar(jsonb) to authenticated;

-- ── O que o /admin chama (chave de servico) ─────────────────────────────────

-- Marcar ou tirar um Creator a mao. Cada mudanca fica em club_organizacao_log.
create or replace function public.club_membro_admin_interno(p_user uuid, p_acao text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_origem text;
begin
  if p_acao not in ('marcar', 'remover') then raise exception 'acao_invalida'; end if;
  if not exists (select 1 from public.users where id = p_user) then raise exception 'usuario_nao_encontrado'; end if;

  if p_acao = 'marcar' then
    insert into public.club_membros (user_id, origem) values (p_user, 'admin')
    on conflict (user_id) do nothing;
    if found then
      insert into public.club_organizacao_log (user_id, papel, acao, alvo)
      values (p_autor, 'admin', 'creator_marcar', p_user::text);
    end if;
  else
    delete from public.club_membros where user_id = p_user returning origem into v_origem;
    if v_origem is not null then
      insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
      values (p_autor, 'admin', 'creator_remover', p_user::text, jsonb_build_object('origem', v_origem));
    end if;
  end if;

  return public.club_membro_json(p_user);
end;
$$;
revoke all on function public.club_membro_admin_interno(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.club_membro_admin_interno(uuid, text, uuid) to service_role;

-- ── Rastro: quem ja esta no Club entra como membro, e os novos tambem ───────

-- Carga unica. Mesma conta em mais de uma frente: a origem e a mais especifica
-- (organizacao, depois Amigo Secreto, depois Aniversariantes) e o "desde" e o
-- primeiro rastro.
with rastro as (
  select user_id, 'organizacao'::text  as origem, created_at, 1 as prio from public.club_organizadores
  union all
  select user_id, 'amigo_secreto'::text,           created_at, 2        from public.amigo_secreto_participantes
  union all
  select user_id, 'aniversarios'::text,            created_at, 3        from public.club_aniversarios
), um as (
  select user_id, (array_agg(origem order by prio))[1] as origem, min(created_at) as desde
  from rastro
  group by user_id
)
insert into public.club_membros (user_id, origem, created_at)
select user_id, origem, desde from um
on conflict (user_id) do nothing;

-- Gatilho para as proximas entradas. Engole qualquer erro de proposito (ver o topo).
create or replace function public.club_membro_rastro()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.club_membros (user_id, origem, created_at)
    values (new.user_id, tg_argv[0], coalesce(new.created_at, now()))
    on conflict (user_id) do nothing;
  exception when others then
    null;
  end;
  return new;
end;
$$;
revoke all on function public.club_membro_rastro() from public, anon, authenticated;

create trigger club_membro_rastro_amigo_secreto
  after insert on public.amigo_secreto_participantes
  for each row execute function public.club_membro_rastro('amigo_secreto');

create trigger club_membro_rastro_aniversarios
  after insert on public.club_aniversarios
  for each row execute function public.club_membro_rastro('aniversarios');

create trigger club_membro_rastro_organizadores
  after insert on public.club_organizadores
  for each row execute function public.club_membro_rastro('organizacao');
