-- Previa de centralizacao (usuarios logados): uma linha por medicao, SEM foto.
-- Em troca da medicao gratis, a pessoa identifica a carta (vindo da Colecao a
-- carta ja e conhecida; avulso, digita o numero e escolhe entre os candidatos).
-- Os sinais de dado (numero sem carta, "nenhuma destas", imagem que nao bate)
-- caem na card_requests, com origem 'previa' e o id da medicao.
--
-- ★ Tabela FECHADA: tabela nova no Supabase nasce com default privilege para
--   anon/authenticated. Aqui so o service_role le e escreve: a gravacao passa
--   pela rota /api/centralizacao (que confere o limite diario por plano) e a
--   leitura agregada e do admin. Nenhuma policy para usuario de proposito.

create table if not exists public.centralizacao_previas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- null quando a pessoa disse "nenhuma destas" ou o numero nao tinha carta:
  -- fica guardada para ser religada quando a carta for cadastrada.
  card_id text references public.pokemon_cards_all(id) on delete set null,
  origem text not null check (origem in ('colecao', 'avulso')),
  numero_digitado text check (numero_digitado is null or length(numero_digitado) <= 40),
  candidatos_n int check (candidatos_n is null or candidatos_n between 0 and 500),
  escolha text not null check (escolha in ('carta', 'nenhuma')),
  -- lado maior de cada eixo (56,8 = 56,8/43,2) e o pior dos dois
  lr numeric(4,1) not null check (lr between 50 and 100),
  tb numeric(4,1) not null check (tb between 50 and 100),
  pior numeric(4,1) not null check (pior between 50 and 100),
  faixa text not null check (faixa in ('bem', 'levemente', 'descentralizada')),
  confianca numeric(3,2) check (confianca is null or confianca between 0 and 1),
  ajustou_cantos boolean not null default false,
  -- resposta da pergunta "a imagem do catalogo e a da sua carta?" (null = pulou)
  imagem_ok boolean,
  algoritmo text not null,
  -- admin pode tirar uma medicao lixo da estatistica sem apagar
  oculta boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists centralizacao_previas_user_idx on public.centralizacao_previas (user_id, created_at desc);
create index if not exists centralizacao_previas_card_idx on public.centralizacao_previas (card_id) where card_id is not null;

alter table public.centralizacao_previas enable row level security;
revoke all on public.centralizacao_previas from anon, authenticated;
grant all on public.centralizacao_previas to service_role;

-- Sinais da previa na fila de cartas: origem nova e o vinculo com a medicao.
alter table public.card_requests add column if not exists previa_id uuid
  references public.centralizacao_previas(id) on delete set null;
alter table public.card_requests drop constraint if exists card_requests_origem_check;
alter table public.card_requests add constraint card_requests_origem_check
  check (origem = any (array['form'::text, 'auto'::text, 'previa'::text]));
