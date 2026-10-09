-- signup_cta -- instrumentacao do cadastro (Fase 3 do epico #490, 09/10/2026).
--
-- A Bynx sabe de que pagina a pessoa veio (signup_landing_page) mas nao QUAL
-- BOTAO abriu o cadastro: "Adicionar a colecao", "Avisar quando anunciarem",
-- o convite da pagina da carta, o header... Sem isso a Fase 1 e a 2b da pagina
-- da carta nao tem como ser medidas botao a botao.
--
-- Mesmo caminho dos signup_utm_*: o cliente poe o rotulo no options.data do
-- signUp (raw_user_meta_data) e o gatilho handle_new_user grava na linha.
-- Formato do rotulo: "pagina:botao" (carta:adicionar, carta:convite,
-- header:entrar) ou "pag:/rota" quando o botao nao foi rotulado.
-- Rollback: alter table public.users drop column signup_cta (e recriar a
-- funcao sem a coluna).

alter table public.users add column if not exists signup_cta text;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.users (
    id, email, name, cpf, city, whatsapp, instagram, tiktok,
    data_nascimento, marketing_aceito, trial_expires_at, termos_aceitos_em,
    cep, logradouro, numero, complemento, bairro, uf,
    signup_utm_source, signup_utm_medium, signup_utm_campaign,
    signup_utm_content, signup_utm_term, signup_referrer,
    signup_landing_page, signup_first_seen_at,
    signup_last_utm_source, signup_last_utm_medium, signup_last_utm_campaign,
    signup_cta
  ) values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'cpf', ''),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'whatsapp', ''),
    nullif(new.raw_user_meta_data->>'instagram', ''),
    nullif(new.raw_user_meta_data->>'tiktok', ''),
    case when new.raw_user_meta_data->>'data_nascimento' ~ '^\d{4}-\d{2}-\d{2}$'
         then (new.raw_user_meta_data->>'data_nascimento')::date else null end,
    coalesce((new.raw_user_meta_data->>'marketing_aceito')::boolean, false),
    now() + interval '7 days',
    now(),
    nullif(new.raw_user_meta_data->>'cep', ''),
    nullif(new.raw_user_meta_data->>'logradouro', ''),
    nullif(new.raw_user_meta_data->>'numero', ''),
    nullif(new.raw_user_meta_data->>'complemento', ''),
    nullif(new.raw_user_meta_data->>'bairro', ''),
    nullif(new.raw_user_meta_data->>'uf', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_source', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_medium', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_campaign', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_content', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_term', ''),
    nullif(new.raw_user_meta_data->>'signup_referrer', ''),
    nullif(new.raw_user_meta_data->>'signup_landing_page', ''),
    -- Vem como ISO do cliente. Timestamp torto nao pode derrubar o cadastro.
    case when new.raw_user_meta_data->>'signup_first_seen_at' ~ '^\d{4}-\d{2}-\d{2}T'
         then (new.raw_user_meta_data->>'signup_first_seen_at')::timestamptz else null end,
    nullif(new.raw_user_meta_data->>'signup_last_utm_source', ''),
    nullif(new.raw_user_meta_data->>'signup_last_utm_medium', ''),
    nullif(new.raw_user_meta_data->>'signup_last_utm_campaign', ''),
    -- Rotulo curto; o cliente ja limita a 60 chars, o left() e o cinto.
    nullif(left(new.raw_user_meta_data->>'signup_cta', 60), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
