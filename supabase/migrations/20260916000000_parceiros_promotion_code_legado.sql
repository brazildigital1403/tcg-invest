-- Cupom legado por parceiro: na troca de percentual (15% -> 20%) os codes
-- antigos podem continuar ativos na Stripe; venda que entrar pelo code antigo
-- comissiona o MESMO parceiro (justica na transicao). Coluna fora do grant
-- por coluna de proposito: a Central nao exibe ids Stripe e o select do /me
-- nao a pede, entao nao ha risco de 42501.
-- Aplicada via MCP em 16/09/2026 — este arquivo e o espelho.
alter table public.parceiros add column stripe_promotion_code_id_legado text unique;
