-- Convite de grupo: um link so para um grupo (ex.: criadores de conteudo) que
-- da N dias de Pro a quem se cadastrar ou entrar por ele (23/10/2026).
--
-- Diferente de campanha_convites (token pessoal por e-mail): aqui o link e
-- compartilhado, entao a defesa contra vazamento e teto de usos, prazo e a
-- chave `ativo` -- os tres checados DENTRO da funcao, com a linha travada.
--
-- Nada e gravado pelo cliente: as tabelas nascem com RLS e sem grant para
-- anon/authenticated, e a funcao so executa com a service role (rota do
-- servidor). Ver memoria "tabela nova nasce exposta no Supabase".

create table if not exists public.convites_grupo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z0-9-]{4,40}$'),
  nome text not null,
  campanha text not null,                  -- vira signup_utm_campaign
  dias_pro integer not null default 365 check (dias_pro between 1 and 730),
  max_usos integer not null check (max_usos > 0),
  usos integer not null default 0 check (usos >= 0),
  expira_em timestamptz not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.convite_grupo_resgates (
  id uuid primary key default gen_random_uuid(),
  convite_id uuid not null references public.convites_grupo(id) on delete restrict,
  user_id uuid not null unique references public.users(id) on delete cascade,  -- 1 resgate por conta, em qualquer convite
  conta_nova boolean not null,
  pro_ate timestamptz not null,
  instagram text,
  quer_parceria boolean not null default false,
  parceria_pedida_em timestamptz,
  resgatado_em timestamptz not null default now()
);
create index if not exists convite_grupo_resgates_convite_idx on public.convite_grupo_resgates(convite_id);

-- Funil por etapa (visita, cta, envio). A conta criada e o resgate saem da
-- tabela de resgates. Sem dado pessoal: so a etapa e a hora.
create table if not exists public.convite_grupo_eventos (
  id bigint generated always as identity primary key,
  convite_id uuid not null references public.convites_grupo(id) on delete cascade,
  etapa text not null check (etapa in ('visita', 'cta', 'envio', 'erro')),
  criado_em timestamptz not null default now()
);
create index if not exists convite_grupo_eventos_convite_idx on public.convite_grupo_eventos(convite_id, etapa);

alter table public.convites_grupo enable row level security;
alter table public.convite_grupo_resgates enable row level security;
alter table public.convite_grupo_eventos enable row level security;
revoke all on public.convites_grupo from anon, authenticated;
revoke all on public.convite_grupo_resgates from anon, authenticated;
revoke all on public.convite_grupo_eventos from anon, authenticated;

-- Origem da conta. Nullable e sem default: nao reescreve a tabela.
alter table public.users
  add column if not exists convite_grupo_id uuid references public.convites_grupo(id) on delete set null;

-- Resgate atomico. Trava a linha do convite, confere ativo/prazo/teto, recusa
-- quem ja resgatou e quem tem assinatura paga na Stripe (o webhook de
-- cancelamento zeraria o pro_expira_em dado aqui), e so entao libera o Pro.
-- trial_expires_at = null tira a conta do cron do trial e da regua.
create or replace function public.resgatar_convite_grupo(p_codigo text, p_user uuid, p_conta_nova boolean)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.convites_grupo%rowtype;
  u record;
  v_ate timestamptz;
begin
  select * into c from public.convites_grupo where codigo = lower(trim(p_codigo)) for update;
  if not found then return json_build_object('ok', false, 'code', 'CONVITE_INVALIDO'); end if;
  if not c.ativo or c.expira_em <= now() or c.usos >= c.max_usos then
    return json_build_object('ok', false, 'code', 'CONVITE_ENCERRADO');
  end if;

  select id, is_pro, plano, pro_expira_em, stripe_subscription_id into u
    from public.users where id = p_user for update;
  if not found then return json_build_object('ok', false, 'code', 'SEM_USUARIO'); end if;

  if exists (select 1 from public.convite_grupo_resgates where user_id = p_user) then
    return json_build_object('ok', false, 'code', 'JA_RESGATOU');
  end if;
  if u.stripe_subscription_id is not null and coalesce(u.is_pro, false)
     and (u.pro_expira_em is null or u.pro_expira_em > now()) then
    return json_build_object('ok', false, 'code', 'ASSINANTE');
  end if;

  -- Pro manual antigo com prazo maior nao encolhe.
  v_ate := greatest(now() + make_interval(days => c.dias_pro), coalesce(u.pro_expira_em, now()));

  update public.convites_grupo set usos = usos + 1 where id = c.id;
  insert into public.convite_grupo_resgates (convite_id, user_id, conta_nova, pro_ate)
    values (c.id, p_user, coalesce(p_conta_nova, false), v_ate);
  update public.users
     set plano = 'anual', is_pro = true, pro_expira_em = v_ate,
         trial_expires_at = null, convite_grupo_id = c.id
   where id = p_user;

  return json_build_object('ok', true, 'pro_ate', v_ate);
end
$function$;

revoke all on function public.resgatar_convite_grupo(text, uuid, boolean) from public, anon, authenticated;
