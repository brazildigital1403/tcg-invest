-- Set da colecao no produto de loja (28/11/2026, Fase 2b do Marketplace no Club, decisao do Du).
-- So para produto SELADO e opcional: a propria loja informa no cadastro (dado do produto, nunca casado por
-- nome). Com o set, o selado entra sozinho nos blocos do Club que mostram o set (Torneio e evento da Agenda).
-- Coluna nula; nada muda no que ja existe. A gravacao passa pela rota /api/lojas/[id]/produtos, que valida o
-- set contra o catalogo.
--
-- ROLLBACK:
--   alter table public.loja_produtos drop column set_id;

alter table public.loja_produtos
  add column set_id text references public.pokemon_sets(id) on delete set null;
