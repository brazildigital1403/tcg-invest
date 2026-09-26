-- ============================================================================
-- F7 do servico de bancada: restauracao e pre-grading (orcamento pelas fotos).
--
-- Aprovada pelo Du e aplicada em producao em 26/09/2026. Exclusao de conta
-- com solicitacao aberta (on delete restrict) e tratada a mao, decisao dele.
--
-- O QUE NASCE (4 tabelas + 1 sequence + 1 bucket):
--   servico_solicitacoes  o pedido de orcamento (1 por envio do formulario)
--   servico_itens         uma linha por carta, com custodia e laudo
--   servico_eventos       a linha do tempo de status (o que a conta mostra)
--   servico_midias        fotos do cliente, fotos de entrada/saida, video de
--                         abertura, embalagem e laudo -- tudo no bucket privado
--   servico_custodia_seq  gera o numero de custodia BX-R-0001 na chegada
--   bucket servico-midias PRIVADO, sem policy de storage
--
-- ★ QUEM ESCREVE E O SERVIDOR. `authenticated` so tem SELECT, e so da propria
--   solicitacao. Criar, aceitar orcamento, informar rastreio e subir foto passam
--   pelas rotas de API com chave de servico, que conferem o dono e se a
--   transicao de status e valida. O admin escreve pelo painel, tambem pelo
--   servidor. Mesmo desenho de `users` (connect) e `ticket_anexos`.
--
-- ★ NASCE FECHADA. Default privilege do Supabase da tudo pro authenticated em
--   tabela nova (ja mordeu uma vez): por isso o `revoke all` antes do grant, e
--   RLS ligada em todas antes de qualquer linha existir.
--
-- ★ FOTO NUNCA TEM URL PUBLICA. Upload do cliente usa createSignedUploadUrl
--   emitida pela rota (o arquivo vai direto pro bucket, sem passar pelo
--   lambda de 4,5 MB); leitura usa signed URL curta. Padrao do ticket-anexos.
--
-- ★ CUSTO DE IO: zero. Tabelas vazias, indices criados em tabela vazia, nada
--   le a pokemon_cards_all. `card_id` e texto solto, sem FK para a view.
--
-- ROLLBACK (uma linha por objeto, na ordem):
--   drop table public.servico_midias, public.servico_eventos,
--              public.servico_itens, public.servico_solicitacoes;
--   drop sequence public.servico_custodia_seq;
--   delete from storage.buckets where id = 'servico-midias';  -- so se vazio
-- ============================================================================

-- ── Solicitacao ─────────────────────────────────────────────────────────────

create table if not exists public.servico_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  -- Numero curto para humanos (#S-0012). Identity nao repete nem com delete.
  numero bigint generated always as identity,
  -- restrict: registro de custodia nao some junto com a conta. Exclusao de
  -- conta (LGPD) com solicitacao aberta precisa ser tratada a mao.
  user_id uuid not null references public.users(id) on delete restrict,
  servico text not null check (servico in ('restauracao', 'pre_grading', 'completo')),
  prazo text not null default 'padrao' check (prazo in ('padrao', 'expresso')),
  status text not null default 'aguardando_orcamento' check (status in (
    'aguardando_orcamento', 'orcado', 'aceito', 'recusado_cliente', 'recusado_bynx',
    'recebida', 'em_bancada', 'descansando', 'pronta', 'enviada', 'entregue',
    'devolvida_sem_servico', 'cancelado')),
  -- Dinheiro sempre em centavos.
  valor_declarado_cents integer not null check (valor_declarado_cents > 0),
  orcamento_cents integer check (orcamento_cents is null or orcamento_cents >= 0),
  seguro_cents integer check (seguro_cents is null or seguro_cents >= 0),
  frete_volta_cents integer check (frete_volta_cents is null or frete_volta_cents >= 0),
  total_cents integer check (total_cents is null or total_cents >= 0),
  orcamento_obs text,
  orcado_em timestamptz,
  -- Fase 1: 'pix_manual', combinado fora do site e marcado pelo admin.
  pagamento_metodo text check (pagamento_metodo is null or pagamento_metodo in ('pix_manual', 'stripe')),
  pago_em timestamptz,
  -- Termo de ciencia de risco, versionado: aceito junto com o orcamento.
  termo_versao text,
  termo_aceito_em timestamptz,
  -- So digitos (11 = DDD + 9). O consentimento e separado do numero.
  whatsapp text check (whatsapp is null or whatsapp ~ '^[1-9][1-9]9[0-9]{8}$'),
  whatsapp_consentido boolean not null default false,
  rastreio_ida text,
  rastreio_volta text,
  lacre_volta text,
  endereco_volta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.servico_solicitacoes is
  'Orcamento de restauracao/pre-grading. Escrita so pelo servidor (API com chave de servico); authenticated le a propria. Ver src/lib/servicos.ts.';

create unique index if not exists servico_solicitacoes_numero_key on public.servico_solicitacoes (numero);
create index if not exists idx_servico_solic_user on public.servico_solicitacoes (user_id, created_at desc);
-- Fila do admin: so o que ainda esta em andamento.
create index if not exists idx_servico_solic_abertas on public.servico_solicitacoes (status, created_at)
  where status not in ('entregue', 'cancelado', 'recusado_cliente', 'recusado_bynx', 'devolvida_sem_servico');

drop trigger if exists servico_solicitacoes_touch on public.servico_solicitacoes;
create trigger servico_solicitacoes_touch before update on public.servico_solicitacoes
  for each row execute function public.touch_updated_at();

-- ── Itens (uma linha por carta) ─────────────────────────────────────────────

create sequence if not exists public.servico_custodia_seq;

create table if not exists public.servico_itens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.servico_solicitacoes(id) on delete cascade,
  -- BX-R-0001, gravado pelo admin NA CHEGADA (nextval da sequence). Nulo antes.
  custodia text unique,
  game text not null default 'pokemon',
  -- Sem FK: pokemon_cards e view e o catalogo muda. Digitacao livre e valida.
  card_id text,
  user_card_id uuid,
  nome text not null check (length(nome) between 1 and 200),
  queixas text[] not null default '{}',
  obs text check (obs is null or length(obs) <= 500),
  valor_declarado_cents integer not null check (valor_declarado_cents > 0),
  -- Decisao por carta no orcamento: null = ainda nao orcada.
  aceito boolean,
  recusa_motivo text,
  -- centralizacao, cantos, bordas, superficie, faixa_nota, graduadora,
  -- proximo_passo, caderno (resumo da bancada).
  laudo jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_servico_itens_solic on public.servico_itens (solicitacao_id);

-- ── Eventos (linha do tempo) ────────────────────────────────────────────────

create table if not exists public.servico_eventos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.servico_solicitacoes(id) on delete cascade,
  status text not null,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists idx_servico_eventos_solic on public.servico_eventos (solicitacao_id, created_at);

-- ── Midias ──────────────────────────────────────────────────────────────────

create table if not exists public.servico_midias (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.servico_solicitacoes(id) on delete cascade,
  item_id uuid references public.servico_itens(id) on delete cascade,
  evento_id uuid references public.servico_eventos(id) on delete set null,
  tipo text not null check (tipo in (
    'cliente_frente', 'cliente_verso', 'cliente_extra',
    'entrada_difusa', 'entrada_rasante', 'saida_difusa', 'saida_rasante',
    'video_abertura', 'embalagem', 'laudo')),
  -- Caminho no bucket servico-midias. Nunca URL.
  path text not null unique,
  mime text not null,
  tamanho integer not null check (tamanho > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_servico_midias_solic on public.servico_midias (solicitacao_id, created_at);

-- ── RLS e privilegios ───────────────────────────────────────────────────────

alter table public.servico_solicitacoes enable row level security;
alter table public.servico_itens        enable row level security;
alter table public.servico_eventos      enable row level security;
alter table public.servico_midias       enable row level security;

revoke all on table public.servico_solicitacoes from anon, authenticated;
revoke all on table public.servico_itens        from anon, authenticated;
revoke all on table public.servico_eventos      from anon, authenticated;
revoke all on table public.servico_midias       from anon, authenticated;

grant select on table public.servico_solicitacoes to authenticated;
grant select on table public.servico_itens        to authenticated;
grant select on table public.servico_eventos      to authenticated;
grant select on table public.servico_midias       to authenticated;

grant all on table public.servico_solicitacoes to service_role;
grant all on table public.servico_itens        to service_role;
grant all on table public.servico_eventos      to service_role;
grant all on table public.servico_midias       to service_role;

revoke all on sequence public.servico_custodia_seq from anon, authenticated;
grant usage, select on sequence public.servico_custodia_seq to service_role;

drop policy if exists "servico_solic_select_dono" on public.servico_solicitacoes;
create policy "servico_solic_select_dono" on public.servico_solicitacoes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "servico_itens_select_dono" on public.servico_itens;
create policy "servico_itens_select_dono" on public.servico_itens
  for select to authenticated using (exists (
    select 1 from public.servico_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));

drop policy if exists "servico_eventos_select_dono" on public.servico_eventos;
create policy "servico_eventos_select_dono" on public.servico_eventos
  for select to authenticated using (exists (
    select 1 from public.servico_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));

drop policy if exists "servico_midias_select_dono" on public.servico_midias;
create policy "servico_midias_select_dono" on public.servico_midias
  for select to authenticated using (exists (
    select 1 from public.servico_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));

-- ── Bucket privado ──────────────────────────────────────────────────────────
-- Sem policy em storage.objects: nem anon nem authenticated leem ou gravam
-- direto. 50 MB por arquivo por causa do video de abertura; a foto do cliente
-- chega comprimida (webp, 1600px) e a rota limita o tamanho dela a parte.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('servico-midias', 'servico-midias', false, 52428800,
        '{image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf}')
on conflict (id) do nothing;
