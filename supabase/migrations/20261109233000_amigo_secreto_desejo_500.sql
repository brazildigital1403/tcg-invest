-- Desejo do Amigo Secreto: limite de 140 para 500 caracteres (pedido do Du, 09/11/2026).
-- Com 140, a caixa parava de aceitar letra e 4 pessoas tiveram o texto cortado.
-- Aplicada em producao como amigo_secreto_desejo_500. A troca na funcao e exata:
-- falha se o trecho nao existir, em vez de passar calada.
alter table public.amigo_secreto_participantes drop constraint amigo_secreto_participantes_desejo_check;
alter table public.amigo_secreto_participantes add constraint amigo_secreto_participantes_desejo_check check (char_length(desejo) <= 500);

do $do$
declare d text; n text;
begin
  select pg_get_functiondef('public.amigo_secreto_salvar_perfil(text, jsonb)'::regprocedure) into d;
  n := replace(d, $x$char_length(coalesce(p->>'desejo', '')) > 140$x$, $x$char_length(coalesce(p->>'desejo', '')) > 500$x$);
  if n = d then raise exception 'trecho do desejo nao encontrado na funcao'; end if;
  execute n;
end
$do$;
