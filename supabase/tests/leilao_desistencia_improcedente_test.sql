-- Teste do #501 (20260928180000_leilao_desistencia_improcedente).
-- Roda como bloco unico terminando em raise proposital = rollback garantido.
-- Precisa de uma desistencia e de uma reclamacao comum ja existentes (ids da prova).
-- Esperado: ERROR P0001 DESISTENCIA_IMPROCEDENTE_OK 5 de 5
do $$
declare rid uuid := 'e00cf9d8-d502-4e62-86a8-48c5a3d6a37d'; ok int := 0;
begin
  -- T1 troca exige video
  begin update pedido_reclamacoes set contestacao_tipo='troca', contestacao_video_url=null where id=rid; raise exception 'T1 passou sem video';
  exception when check_violation then ok := ok+1; end;
  -- T2 tipo fora da lista
  begin update pedido_reclamacoes set contestacao_tipo='outro' where id=rid; raise exception 'T2 aceitou tipo invalido';
  exception when check_violation then ok := ok+1; end;
  -- T3 desistencia improcedente sem destino
  begin update pedido_reclamacoes set status='improcedente', decisao='improcedente', destino_carta=null where id=rid; raise exception 'T3 improcedente sem destino';
  exception when check_violation then ok := ok+1; end;
  -- T4 caminho feliz: troca com video, destino gravado
  update pedido_reclamacoes set contestacao_tipo='troca', contestacao_video_url='https://x.com/v', destino_carta='retida_prova', status='improcedente', decisao='improcedente' where id=rid;
  ok := ok+1;
  -- T5 reclamacao comum improcedente segue sem destino
  update pedido_reclamacoes set contestacao_tipo='dano' where id='367a2eb5-b865-4e8b-a1e4-50cf75152a39';
  ok := ok+1;
  raise exception 'DESISTENCIA_IMPROCEDENTE_OK % de 5', ok;
end $$;
