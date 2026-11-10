-- Amigo Secreto: registra a primeira vez que a pessoa abre o envelope "Quem eu
-- tirei" (pedido do Du em 10/11/2026: saber quem ja viu o par). So a primeira
-- abertura; nao mexe em updated_at para nao misturar com edicao de perfil.
alter table public.amigo_secreto_participantes add column if not exists envelope_aberto_em timestamptz;

create or replace function public.amigo_secreto_abri_envelope(p_slug text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  update public.amigo_secreto_participantes p
     set envelope_aberto_em = now()
    from public.amigo_secreto_edicoes e
   where e.slug = p_slug
     and p.edicao_id = e.id
     and p.user_id = v_uid
     and p.tirou_id is not null
     and p.envelope_aberto_em is null;
end
$function$;

revoke all on function public.amigo_secreto_abri_envelope(text) from public;
revoke all on function public.amigo_secreto_abri_envelope(text) from anon;
grant execute on function public.amigo_secreto_abri_envelope(text) to authenticated;
