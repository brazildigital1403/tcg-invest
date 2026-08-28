-- Teto da comissao de 1a cobranca, por parceiro (null = sem teto).
-- Motivo: no plano ANUAL, "100% da 1a cobranca" repassava a fatura do ano
-- inteiro (R$ 211,65) e deixava a plataforma negativa na venda. Padrao de
-- mercado e 20-40% do ticket anual ou cap fixo. Regra nova: 100% ate R$ 100.
-- Aplicada via MCP em 29/08/2026 — este arquivo e o espelho.
alter table public.parceiros add column comissao_primeira_cap_cents int;

-- O grant de parceiros e POR COLUNA — coluna nova precisa entrar no grant,
-- senao o select da Central do Parceiro quebra com 42501.
grant select (comissao_primeira_cap_cents) on public.parceiros to authenticated;

update public.parceiros set comissao_primeira_cap_cents = 10000 where cupom_code = 'PAULO15';
