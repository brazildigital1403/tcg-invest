-- Loja oculta tambem some da leitura DIRETA do banco, nao so das telas.
--
-- ★ POR QUE (12/09/2026). A coluna lojas.oculta (20260912180000) foi aplicada
-- so nas consultas do app. As regras de acesso nunca souberam dela:
--   lojas_select_publico          -> status = 'ativa'
--   loja_produtos_select_publico  -> ativo AND estoque > 0, sem olhar a loja
-- Entao qualquer chamada direta a REST com a chave publica listava a Vulcano
-- (loja de teste, oculta) e o produto de teste dela.
--
-- ★ O QUE NAO QUEBRA, E POR QUE. Checkout de carta e de produto, carrinho,
-- frete, pedidos, webhook, crons, rotas de Connect e de produtos da loja leem
-- com CHAVE DE SERVICO, que nao passa por RLS -- conferido arquivo a arquivo.
-- O painel do dono le a propria loja pela lojas_select_owner, que nao muda.
--
-- ★ A REGRA DE DONO EM loja_produtos E NOVA, e e ela que evita a regressao:
-- a tabela so tinha a regra publica, e o aviso de recebimentos do painel
-- (AvisoRecebimentos) conta os produtos do dono por ela. Apertar a publica
-- sem isto zeraria a contagem pra loja oculta.

alter policy "lojas_select_publico" on public.lojas
  using (status = 'ativa' and oculta is not true);

alter policy "loja_produtos_select_publico" on public.loja_produtos
  using (
    ativo = true
    and estoque > 0
    and exists (
      select 1 from public.lojas l
      where l.id = loja_produtos.loja_id
        and l.status = 'ativa'
        and l.oculta is not true
    )
  );

create policy "loja_produtos_select_owner" on public.loja_produtos
  for select to authenticated
  using (
    exists (
      select 1 from public.lojas l
      where l.id = loja_produtos.loja_id
        and l.owner_user_id = (select auth.uid())
    )
  );
