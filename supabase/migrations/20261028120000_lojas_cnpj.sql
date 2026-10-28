-- ============================================================================
-- Identificar quem vende (#470, decisao do Du em 28/10/2026).
-- ============================================================================
-- POR QUE: o Decreto 7.962/2013 pede nome e CNPJ ou CPF de quem vende. CNPJ
-- nao existia em coluna nenhuma (ver 20260924100000_lojas_natureza.sql).
--
-- REGRA: loja com `cnpj` aparece como empresa (razao social + CNPJ). Sem
-- `cnpj`, aparece como pessoa fisica: nome e CPF do dono, o CPF mascarado nas
-- telas publicas e inteiro so no pedido de quem comprou. O CPF continua so em
-- `users` -- quem monta isso e src/lib/vendedorIdentificado.ts.
--
-- CNPJ e dado publico da Receita, entao ler junto com o resto da loja
-- (RLS de leitura publica de `lojas`) nao expoe nada novo.
--
-- Tabela de 17 linhas: `add column` sem default nao reescreve nada.
-- Rollback: alter table public.lojas drop column cnpj, drop column razao_social;
-- ============================================================================

alter table public.lojas
  add column if not exists cnpj text,
  add column if not exists razao_social text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_lojas_cnpj') then
    alter table public.lojas add constraint chk_lojas_cnpj
      check (cnpj is null or cnpj ~ '^[0-9]{14}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_lojas_razao_social') then
    alter table public.lojas add constraint chk_lojas_razao_social
      check ((cnpj is null) = (razao_social is null)
             and (razao_social is null or length(btrim(razao_social)) between 2 and 150));
  end if;
end $$;

comment on column public.lojas.cnpj is
  'So digitos (14). Null = vende como pessoa fisica (nome e CPF do dono). Ver src/lib/vendedorIdentificado.ts.';
comment on column public.lojas.razao_social is
  'Nome empresarial do CNPJ. Preenchido junto com cnpj, nunca sozinho.';
