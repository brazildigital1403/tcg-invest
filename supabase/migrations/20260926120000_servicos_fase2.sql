-- ============================================================================
-- Fase 2 do servico de bancada: objetivo do colecionador, ficha de entrada,
-- protocolo fotografico e proposta de tratamento (autorizacao por procedimento).
--
-- Aprovada pelo Du e aplicada em producao em 26/09/2026.
--
-- Origem: estudo de conservacao profissional (condition report + treatment
-- proposal antes de qualquer intervencao) adaptado a carta TCG, aprovado pelo
-- Du em 26/09/2026 nos itens 5, 6, 7 e 8.
--
-- O QUE MUDA
--   servico_solicitacoes
--     + objetivo / objetivo_outro      por que a pessoa quer o servico (item 5)
--     + graduadora_alvo                se o objetivo e graduar, para onde vai
--     + proposta_enviada_em            quando a proposta de tratamento saiu
--     + proposta_aceita_em / _termo    aceite do termo especifico da proposta
--     status ganha 'proposta'          entre 'recebida' e 'em_bancada' (item 8)
--   servico_itens
--     + ficha_entrada / ficha_saida    ficha de condicao estruturada (item 6):
--                                      identificacao + frente/verso nos 4
--                                      pilares, escala Excelente..Ruim. Jsonb
--                                      porque o checklist vai evoluir; quem
--                                      valida o formato e o servidor.
--     + ficha_entrada_em / _saida_em   quando cada ficha foi fechada
--   servico_midias
--     + posicao                        frente | verso | canto/borda especifico
--     tipo ganha: entrada_canto, entrada_borda, entrada_angulo, entrada_dano,
--                 saida_canto, saida_borda, processo, video_devolucao (item 7)
--   servico_procedimentos (NOVA)       proposta de tratamento por carta:
--                                      problema, procedimento, objetivo,
--                                      resultado esperado, risco, alternativa,
--                                      decisao do cliente (item 8)
--
-- ★ MESMA POSTURA DA F7: tabela nova nasce fechada (RLS + revoke antes do
--   grant). O dono so LE a propria proposta; aprovar/recusar passa pela rota
--   do servidor, que confere dono e status.
--
-- ★ CUSTO DE IO: zero. 4 tabelas com 2 pedidos de teste; nada toca a
--   pokemon_cards_all. Trocar CHECK em tabela de 2 linhas e instantaneo.
--
-- ROLLBACK (na ordem):
--   drop table public.servico_procedimentos;
--   alter table public.servico_midias drop column posicao;
--   alter table public.servico_itens drop column ficha_entrada, drop column ficha_saida,
--     drop column ficha_entrada_em, drop column ficha_saida_em;
--   alter table public.servico_solicitacoes drop column objetivo, drop column objetivo_outro,
--     drop column graduadora_alvo, drop column proposta_enviada_em,
--     drop column proposta_aceita_em, drop column proposta_termo_versao;
--   (e recriar os dois CHECK com a lista antiga, que esta no cabecalho da F7)
-- ============================================================================

-- ── Solicitacao: objetivo, graduadora e proposta ────────────────────────────

alter table public.servico_solicitacoes
  add column if not exists objetivo text,
  add column if not exists objetivo_outro text,
  add column if not exists graduadora_alvo text,
  add column if not exists proposta_enviada_em timestamptz,
  add column if not exists proposta_aceita_em timestamptz,
  add column if not exists proposta_termo_versao text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servico_solicitacoes_objetivo_check') then
    alter table public.servico_solicitacoes add constraint servico_solicitacoes_objetivo_check
      check (objetivo is null or objetivo in (
        'colecionar', 'apresentacao', 'preservacao', 'venda', 'avaliacao', 'graduacao', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'servico_solicitacoes_graduadora_alvo_check') then
    alter table public.servico_solicitacoes add constraint servico_solicitacoes_graduadora_alvo_check
      check (graduadora_alvo is null or graduadora_alvo in ('PSA', 'CGC', 'BGS', 'TAG', 'GBA', 'outra', 'indefinida'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'servico_solicitacoes_objetivo_outro_check') then
    alter table public.servico_solicitacoes add constraint servico_solicitacoes_objetivo_outro_check
      check (objetivo_outro is null or length(objetivo_outro) <= 200);
  end if;
end $$;

-- Status 'proposta': a carta chegou, a ficha foi feita e a proposta de
-- tratamento espera a decisao do cliente. So depois vai para a bancada.
alter table public.servico_solicitacoes drop constraint if exists servico_solicitacoes_status_check;
alter table public.servico_solicitacoes add constraint servico_solicitacoes_status_check
  check (status in (
    'aguardando_orcamento', 'orcado', 'aceito', 'recusado_cliente', 'recusado_bynx',
    'recebida', 'proposta', 'em_bancada', 'descansando', 'pronta', 'enviada', 'entregue',
    'devolvida_sem_servico', 'cancelado'));

comment on column public.servico_solicitacoes.objetivo is
  'Por que o colecionador quer o servico. graduacao exige graduadora_alvo e muda o alerta do termo.';

-- ── Itens: ficha de entrada e de saida ──────────────────────────────────────

alter table public.servico_itens
  add column if not exists ficha_entrada jsonb,
  add column if not exists ficha_entrada_em timestamptz,
  add column if not exists ficha_saida jsonb,
  add column if not exists ficha_saida_em timestamptz;

comment on column public.servico_itens.ficha_entrada is
  'Ficha de condicao na chegada: identificacao (colecao, numero, variante, idioma, serie) e frente/verso em centralizacao, cantos, bordas, superficie + danos marcados. Escala: excelente|muito_bom|bom|regular|ruim. Formato validado no servidor (src/lib/servicos.ts).';

-- ── Midias: posicao + tipos do protocolo fotografico ────────────────────────

alter table public.servico_midias add column if not exists posicao text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servico_midias_posicao_check') then
    alter table public.servico_midias add constraint servico_midias_posicao_check
      check (posicao is null or posicao ~ '^[a-z_]{1,40}$');
  end if;
end $$;

alter table public.servico_midias drop constraint if exists servico_midias_tipo_check;
alter table public.servico_midias add constraint servico_midias_tipo_check
  check (tipo in (
    'cliente_frente', 'cliente_verso', 'cliente_extra',
    'entrada_difusa', 'entrada_rasante', 'entrada_canto', 'entrada_borda', 'entrada_angulo', 'entrada_dano',
    'saida_difusa', 'saida_rasante', 'saida_canto', 'saida_borda',
    'processo', 'video_abertura', 'video_devolucao', 'embalagem', 'laudo'));

-- ── Proposta de tratamento (nova) ───────────────────────────────────────────

create table if not exists public.servico_procedimentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.servico_solicitacoes(id) on delete cascade,
  item_id uuid not null references public.servico_itens(id) on delete cascade,
  ordem smallint not null default 1,
  problema text not null check (length(problema) between 1 and 500),
  procedimento text not null check (length(procedimento) between 1 and 500),
  objetivo text check (objetivo is null or length(objetivo) <= 500),
  resultado_esperado text check (resultado_esperado is null or length(resultado_esperado) <= 500),
  risco text not null check (risco in ('baixo', 'medio', 'alto')),
  risco_descricao text check (risco_descricao is null or length(risco_descricao) <= 500),
  alternativa text not null default 'Não realizar a intervenção' check (length(alternativa) <= 500),
  decisao text not null default 'pendente' check (decisao in ('pendente', 'aprovado', 'recusado')),
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_servico_proc_solic on public.servico_procedimentos (solicitacao_id, item_id, ordem);

comment on table public.servico_procedimentos is
  'Proposta de tratamento por carta, feita depois da ficha de entrada. O cliente aprova ou recusa cada procedimento; so o aprovado vai para a bancada.';

alter table public.servico_procedimentos enable row level security;
revoke all on table public.servico_procedimentos from anon, authenticated;
grant select on table public.servico_procedimentos to authenticated;
grant all on table public.servico_procedimentos to service_role;

drop policy if exists "servico_proc_select_dono" on public.servico_procedimentos;
create policy "servico_proc_select_dono" on public.servico_procedimentos
  for select to authenticated using (exists (
    select 1 from public.servico_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));
