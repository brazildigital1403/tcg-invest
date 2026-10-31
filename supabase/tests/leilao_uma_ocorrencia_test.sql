-- Teste de 20260928190000_leilao_uma_ocorrencia_por_pedido.
-- Bloco unico terminando em raise proposital = rollback garantido.
-- Usa os pedidos de teste #46 (desistencia encerrada com parcial) e #47
-- (desistencia improcedente) da branch de prova.
-- Esperado: ERROR P0001 UMA_OCORRENCIA_OK 4 de 4
do $$
declare p46 uuid; p47 uuid; comp uuid; ok int := 0; novo uuid;
begin
  select id, comprador_user_id into p46, comp from pedidos where numero = 46;
  select id into p47 from pedidos where numero = 47;
  -- T1 desistir de novo depois de um parcial
  begin perform pedido_arrependimento_abrir(p46, comp, 'Desistência da compra (direito de arrependimento, art. 49 do CDC).', now() + interval '7 days');
    raise exception 'T1 abriu a segunda desistencia';
  exception when others then if sqlerrm like '%ja_existe%' then ok := ok + 1; else raise; end if; end;
  -- T2 reclamar depois de uma desistencia improcedente
  begin perform pedido_reclamacao_abrir(p47, comp, 'nao_chegou', 'teste de segunda ocorrencia', '{}', null, now() + interval '2 days', null);
    raise exception 'T2 abriu reclamacao depois da desistencia';
  exception when others then if sqlerrm like '%ja_existe%' then ok := ok + 1; else raise; end if; end;
  -- T3 insert direto tambem barra
  begin insert into pedido_reclamacoes (pedido_id, comprador_user_id, loja_id, vendedor_user_id, motivo, descricao, prazo_loja_ate)
    select id, comprador_user_id, loja_id, vendedor_user_id, 'nao_chegou', 'insert direto de teste', now() from pedidos where id = p47;
    raise exception 'T3 insert direto passou';
  exception when unique_violation then ok := ok + 1; end;
  -- T4 pedido sem ocorrencia continua aceitando a primeira
  select id into novo from pedidos p where p.status in ('enviado', 'entregue')
    and not exists (select 1 from pedido_reclamacoes r where r.pedido_id = p.id) limit 1;
  if novo is null then raise exception 'T4 sem pedido livre na prova'; end if;
  insert into pedido_reclamacoes (pedido_id, comprador_user_id, loja_id, vendedor_user_id, motivo, descricao, prazo_loja_ate)
    select id, comprador_user_id, loja_id, vendedor_user_id, 'nao_chegou', 'primeira ocorrencia de teste', now() from pedidos where id = novo;
  ok := ok + 1;
  raise exception 'UMA_OCORRENCIA_OK % de 4', ok;
end $$;
