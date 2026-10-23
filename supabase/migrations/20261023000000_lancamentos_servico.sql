-- Financeiro passa a contabilizar o servico de bancada (23/10/2026).
-- Nenhum caminho de pagamento de servico (Pix no admin, cartao no webhook,
-- estorno) gravava em `lancamentos`, e a categoria nem era aceita.
--
-- 1) categoria 'servico' liberada.
-- 2) servico_pagamento_id: um lancamento por etapa paga (sinal, servico,
--    integral). O Pix nao tem PaymentIntent para servir de chave unica como o
--    cartao tem; esta coluna e a chave dos dois. UNIQUE simples (nao parcial)
--    para o upsert da REST funcionar com on_conflict.
alter table public.lancamentos drop constraint if exists lancamentos_categoria_check;
alter table public.lancamentos add constraint lancamentos_categoria_check
  check (categoria = any (array['infra','marketing','dominio','pagamentos','impostos','assinatura','comissao','master_set','servico','outros']));

alter table public.lancamentos
  add column if not exists servico_pagamento_id uuid references public.servico_pagamentos(id) on delete set null;
alter table public.lancamentos
  add constraint lancamentos_servico_pagamento_unique unique (servico_pagamento_id);
