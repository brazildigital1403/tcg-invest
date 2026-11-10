-- Mural do Amigo Secreto abre logo depois do sorteio (pedido do Du, 09/11/2026 21h55),
-- em vez de 60 minutos depois. Mesma assinatura e permissoes da v2
-- (20261104200000_amigo_secreto_v2.sql). Aplicada em producao como
-- amigo_secreto_mural_sem_espera.
create or replace function public.amigo_secreto_mural_abre_em(p_edicao uuid)
returns timestamptz
language sql stable
as $$
  select max(executado_em) from public.amigo_secreto_sorteios where edicao_id = p_edicao;
$$;
revoke all on function public.amigo_secreto_mural_abre_em(uuid) from public, anon, authenticated;
