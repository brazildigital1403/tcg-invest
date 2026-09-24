-- ============================================================================
-- Loja x colecionador: quem e quem no Guia de Lojas.
--
-- ★ POR QUE (24/09/2026, decisao do Du a partir do caso Creminin). Ate aqui
--   toda linha de `lojas` era tratada como loja, mas nem toda e: a Creminin
--   escreve na propria descricao que vende cartas da colecao pessoal. Quem
--   procura no Guia nao tinha como saber.
--
-- ★ DUAS COLUNAS, NAO UMA, porque declarar e confirmar sao momentos
--   diferentes. A pessoa declara no cadastro (`natureza_declarada`) e o admin
--   confirma ou corrige na aprovacao (`natureza`, que e a verdade publica).
--   Com uma coluna so, a confirmacao apagaria a declaracao e ninguem saberia
--   que houve correcao -- justamente o caso que interessa vigiar, alguem se
--   declarar loja para escapar da etiqueta.
--
-- ★ NAO DA PRA DERIVAR DO QUE JA EXISTE. `verificada` quer dizer documentacao
--   conferida, nao natureza: das 11 lojas ativas, 5 sao verificadas e 6 nao, e
--   entre essas 6 ha loja de verdade que so nao mandou documento (Acervo Das
--   Cartas, Jota Colecoes, PokeGuga, SC CARTAS TCG, Zentaa). CNPJ nao existe
--   em coluna nenhuma do banco.
--
-- Tabela de 13 linhas: `add column` com default constante nao reescreve nada.
-- ============================================================================

alter table public.lojas
  add column if not exists natureza text not null default 'loja',
  add column if not exists natureza_declarada text;

comment on column public.lojas.natureza is
  'Verdade publica: loja ou colecionador. Confirmada pelo admin na aprovacao -- ver src/lib/naturezaLoja.ts.';
comment on column public.lojas.natureza_declarada is
  'O que a pessoa marcou no cadastro. Null nas lojas anteriores a 24/09/2026, que nunca foram perguntadas.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_lojas_natureza') then
    alter table public.lojas add constraint chk_lojas_natureza
      check (natureza in ('loja', 'colecionador'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_lojas_natureza_declarada') then
    alter table public.lojas add constraint chk_lojas_natureza_declarada
      check (natureza_declarada is null or natureza_declarada in ('loja', 'colecionador'));
  end if;
end $$;

-- Backfill: as 10 ativas se apresentam como loja na propria descricao; a
-- Creminin e a unica que se declara colecionador. `natureza_declarada` fica
-- NULL de proposito -- nenhuma delas respondeu a pergunta, que so nasce agora.
update public.lojas set natureza = 'colecionador' where slug = 'creminin';
