-- Pista do Amigo Secreto editavel depois do sorteio (direcao "Pista na missao",
-- aprovada pelo Du em 09/11/2026). Guarda quando a pista mudou depois do sorteio,
-- para quem tirou ver o selo "Pista atualizada". Pista fecha no prazo de entrega.
-- Trocas exatas nas funcoes: falha se o trecho nao existir, em vez de passar calada.
alter table public.amigo_secreto_participantes add column if not exists pista_atualizada_em timestamptz;

do $do$
declare d text; n text;
begin
  select pg_get_functiondef('public.amigo_secreto_salvar_perfil(text, jsonb)'::regprocedure) into d;
  n := replace(d,
$a$  if v_me.id is not null and (v_e.estado = 'encerrado' or v_e.dados_apagados_em is not null) then$a$,
$b$  if v_me.id is not null and v_e.estado <> 'inscricoes' and now() > v_e.postar_ate
     and (p ? 'desejo' or p ? 'sugestoes' or p ? 'me_surpreenda') then
    raise exception 'pista_encerrada';
  end if;
  if v_me.id is not null and (v_e.estado = 'encerrado' or v_e.dados_apagados_em is not null) then$b$);
  if n = d then raise exception 'salvar_perfil: trecho do prazo nao encontrado'; end if;
  d := n;
  n := replace(d,
$a$      updated_at    = now()
    where id = v_me.id$a$,
$b$      pista_atualizada_em = case when v_e.estado <> 'inscricoes' and (
          (p ? 'desejo' and nullif(p->>'desejo','') is distinct from desejo)
          or (p ? 'sugestoes' and v_sug is distinct from sugestoes)
          or (p ? 'me_surpreenda' and (p->>'me_surpreenda')::boolean is distinct from me_surpreenda)
        ) then now() else pista_atualizada_em end,
      updated_at    = now()
    where id = v_me.id$b$);
  if n = d then raise exception 'salvar_perfil: trecho do update nao encontrado'; end if;
  execute n;

  select pg_get_functiondef('public.amigo_secreto_meu(text)'::regprocedure) into d;
  n := replace(d,
$a$      'recebido_em', v_t.recebido_em,
      'aceitou', v_t.quer_revelar$a$,
$b$      'recebido_em', v_t.recebido_em,
      'pista_atualizada_em', v_t.pista_atualizada_em,
      'aceitou', v_t.quer_revelar$b$);
  if n = d then raise exception 'meu: trecho do tirou nao encontrado'; end if;
  d := n;
  n := replace(d,
$a$      'quer_revelar', v_me.quer_revelar,$a$,
$b$      'quer_revelar', v_me.quer_revelar,
      'pista_atualizada_em', v_me.pista_atualizada_em,$b$);
  if n = d then raise exception 'meu: trecho do eu nao encontrado'; end if;
  execute n;
end
$do$;
