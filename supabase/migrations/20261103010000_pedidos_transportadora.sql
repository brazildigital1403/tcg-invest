-- Transportadora do envio no pedido (teste real de 01/11/2026, pedido 12).
--
-- POR QUE: a loja escolhia a transportadora so para validar o formato do
-- rastreio, e a escolha se perdia. O comprador recebia o codigo sem saber onde
-- consultar. Null = pedido enviado antes desta coluna.
--
-- Tabela pequena: add column sem default nao reescreve nada.
-- Rollback: alter table public.pedidos drop column transportadora;
alter table public.pedidos add column if not exists transportadora text;

comment on column public.pedidos.transportadora is
  'Chave de TRANSPORTADORAS em src/lib/rastreio.ts. Null nos pedidos enviados antes de 03/11/2026.';
