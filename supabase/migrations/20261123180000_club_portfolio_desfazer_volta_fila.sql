-- Album do Club, Fase 2, Fatia 2b (ajuste de 23/11/2026, pedido do Du): desfazer uma reprovacao
-- agora devolve o conteudo a FILA de conferencia. Antes ele voltava a valer mas ficava marcado
-- como conferido (amostrado_em = now()) e com a nota antiga, e nunca mais era sorteado.
-- As cartas tiradas pela amostra continuam voltando na hora, se a missao se cumpre de novo.
-- Mesma assinatura e mesmas permissoes: so o corpo da funcao muda.
--
-- ROLLBACK: recriar a funcao com a linha do update trocada por
--   update public.club_conteudos c set status = 'ativo', amostrado_em = now(), amostrado_por = p_autor where c.id = v_c.id;

create or replace function public.club_conteudo_desfazer_amostra_interno(p_id uuid, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c       public.club_conteudos;
  v_cartas  jsonb;
begin
  select * into v_c from public.club_conteudos c where c.id = p_id for update;
  if not found then raise exception 'conteudo_nao_encontrado'; end if;
  if v_c.status <> 'reprovado' then raise exception 'conteudo_nao_reprovado'; end if;

  update public.club_conteudos c
  set status = 'ativo', amostrado_em = null, amostrado_por = null, amostra_nota = null
  where c.id = v_c.id;
  v_cartas := public.club_album_conferir_abertas_interno(v_c.user_id);

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'conteudo_desfazer', v_c.id::text,
          jsonb_build_object('chave', v_c.chave, 'cartas_devolvidas', jsonb_array_length(v_cartas)));

  return jsonb_build_object('id', v_c.id, 'status', 'ativo', 'cartas_devolvidas', jsonb_array_length(v_cartas));
end;
$$;
revoke all on function public.club_conteudo_desfazer_amostra_interno(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_conteudo_desfazer_amostra_interno(uuid, uuid) to service_role;
