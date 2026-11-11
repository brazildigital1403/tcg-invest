-- 11/11/2026: a fonte do preco internacional passa a ser o TCGdex (a API do pokemontcg.io foi
-- reprovada pela Servidor: HTTP 500/502, preco congelado em 15/10 e set novo sem preco; em
-- aposentadoria, sem cadastro novo, chaves ate 01/03/2027).
--
-- Os ids do TCGdex NAO batem com os nossos (sv8 -> sv08, sv8pt5 -> sv08.5, me2pt5 -> me02.5; o
-- padding do numero varia por set). O de-para e por SET (nome + total) e, dentro do set, por numero
-- normalizado, e fica gravado aqui para nao recalcular a cada rodada.
--
-- Mudancas, todas na tabela nova (vazia e com RLS fechada):
--  - tcgdex_id / tcgdex_set_id: o de-para.
--  - fonte: de onde veio o preco (hoje 'tcgdex').
--  - coletado_em passa a aceitar NULL e perde o default: linha que so tem o de-para ainda nao tem
--    preco coletado e nao pode parecer "atualizada agora".

alter table public.card_preco_internacional
  add column if not exists tcgdex_id     text,
  add column if not exists tcgdex_set_id text,
  add column if not exists fonte         text not null default 'tcgdex';

alter table public.card_preco_internacional alter column coletado_em drop not null;
alter table public.card_preco_internacional alter column coletado_em drop default;

create index if not exists idx_card_preco_internacional_tcgdex_set
  on public.card_preco_internacional (tcgdex_set_id);

comment on column public.card_preco_internacional.coletado_em is
  'Quando o preco foi lido na fonte. NULL = so tem o de-para, preco ainda nao coletado.';
