-- Amigo Secreto: CPF de quem recebe (pedido do Du em 11/11/2026). Os Correios pedem
-- o CPF do destinatario para gerar a etiqueta, e quem tirou a pessoa ficava travado.
-- Regras: so quem tirou le o CPF inteiro, dentro do bloco do endereco; o dono ve so os
-- 5 ultimos digitos; a limpeza de dados apaga o CPF junto; nenhum outro caminho le.
-- Trocas exatas nas funcoes: falha se o trecho nao existir, em vez de passar calada.
alter table public.amigo_secreto_participantes add column if not exists cpf text;
alter table public.amigo_secreto_participantes drop constraint if exists amigo_secreto_participantes_cpf_formato;
alter table public.amigo_secreto_participantes add constraint amigo_secreto_participantes_cpf_formato
  check (cpf is null or cpf ~ '^[0-9]{11}$');

-- Digito verificador do CPF (modulo 11), sem aceitar sequencias repetidas.
create or replace function public.amigo_secreto_cpf_valido(p text)
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  s integer; i integer; r integer;
begin
  if d !~ '^[0-9]{11}$' or d ~ '^(.)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::integer * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::integer then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::integer * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::integer;
end
$function$;

-- Salva o CPF de quem esta logado. Vale antes e depois do sorteio; nao mexe na pista.
create or replace function public.amigo_secreto_salvar_cpf(p_slug text, p_cpf text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_d   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_n   integer;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_e.estado = 'encerrado' or v_e.dados_apagados_em is not null then raise exception 'edicao_encerrada'; end if;
  if not public.amigo_secreto_cpf_valido(v_d) then raise exception 'cpf_invalido'; end if;
  update public.amigo_secreto_participantes set cpf = v_d
   where edicao_id = v_e.id and user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'nao_participante'; end if;
  return public.amigo_secreto_meu(p_slug);
end
$function$;

revoke all on function public.amigo_secreto_cpf_valido(text) from public;
revoke all on function public.amigo_secreto_cpf_valido(text) from anon;
grant execute on function public.amigo_secreto_cpf_valido(text) to authenticated;
revoke all on function public.amigo_secreto_salvar_cpf(text, text) from public;
revoke all on function public.amigo_secreto_salvar_cpf(text, text) from anon;
grant execute on function public.amigo_secreto_salvar_cpf(text, text) to authenticated;

do $do$
declare d text; n text;
begin
  -- meu(): CPF inteiro so no endereco de quem tirou; so o final para o dono; perfil exige CPF antes do sorteio.
  select pg_get_functiondef('public.amigo_secreto_meu(text)'::regprocedure) into d;
  n := replace(d,
$a$'cidade', v_t.cidade, 'uf', v_t.uf) else null end,$a$,
$b$'cidade', v_t.cidade, 'uf', v_t.uf, 'cpf', v_t.cpf) else null end,$b$);
  if n = d then raise exception 'meu: trecho do endereco nao encontrado'; end if;
  d := n;
  n := replace(d,
$a$'pista_atualizada_em', v_me.pista_atualizada_em,$a$,
$b$'pista_atualizada_em', v_me.pista_atualizada_em,
      'tem_cpf', v_me.cpf is not null, 'cpf_final', right(v_me.cpf, 5),$b$);
  if n = d then raise exception 'meu: trecho do eu nao encontrado'; end if;
  d := n;
  n := replace(d,
$a$coalesce(v_me.desejo, '') <> ''))$a$,
$b$coalesce(v_me.desejo, '') <> '')
                          and (v_e.estado <> 'inscricoes' or v_me.cpf is not null))$b$);
  if n = d then raise exception 'meu: trecho do perfil_completo nao encontrado'; end if;
  execute n;

  -- limpeza: o CPF some junto com o endereco.
  select pg_get_functiondef('public.amigo_secreto_limpar()'::regprocedure) into d;
  n := replace(d, $a$desejo = null, sugestoes$a$, $b$desejo = null, cpf = null, sugestoes$b$);
  if n = d then raise exception 'limpar: trecho nao encontrado'; end if;
  execute n;
end
$do$;
