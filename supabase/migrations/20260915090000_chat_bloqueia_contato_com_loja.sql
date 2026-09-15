-- Chat do marketplace: contato externo bloqueado em conversa com loja que
-- recebe pela Bynx (15/09/2026, decisao do Du).
--
-- POR QUE: a venda que sai da plataforma nao gera comissao, rastreio nem
-- prova. Mas o bloqueio vale SO onde existe checkout: com vendedor sem
-- recebimentos a unica forma de pagar e combinar entre as partes, e a chave
-- Pix costuma ser justamente telefone, e-mail ou CPF. Medido na data: 11
-- conversas, 4 com loja que recebe e 7 com vendedor sem checkout.
--
-- A tabela marketplace_mensagens nao tem policy de INSERT: toda mensagem passa
-- por enviar_mensagem, entao o filtro aqui vale tambem para a REST direta.

-- ── O que conta como contato ───────────────────────────────────────────────
-- Telefone so com o formato de celular/fixo brasileiro (DDD + 8 ou 9 digitos,
-- +55 opcional) depois de tirar separadores: preco ("R$ 1.249,00"), numero de
-- carta ("025/165") e data nao casam. E-mail e links de fora.
create or replace function public.mensagem_tem_contato(p_body text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $f$
declare
  v_trecho text[];
  v_digitos text;
begin
  if p_body is null then return false; end if;
  if p_body ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}' then return true; end if;
  if p_body ~* '(https?://|www\.|wa\.me/|t\.me/|instagram\.com|chat\.whatsapp)' then return true; end if;
  for v_trecho in select regexp_matches(p_body, '\+?\(?\d[\d\s().-]{7,}\d', 'g') loop
    v_digitos := regexp_replace(v_trecho[1], '\D', '', 'g');
    if v_digitos ~ '^(55)?[1-9][0-9]9?[2-9][0-9]{7}$' then return true; end if;
  end loop;
  return false;
end
$f$;

-- ── Quem recebe pela Bynx ─────────────────────────────────────────────────
-- Mesma regra do botao Comprar: loja ativa com recebimentos ligados.
create or replace function public.anuncio_vendedor_recebe_pela_bynx(p_anuncio_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $f$
  select exists (
    select 1
    from marketplace m
    join lojas l on l.owner_user_id = m.user_id
    where m.id = p_anuncio_id
      and l.status = 'ativa'
      and l.connect_charges_enabled is true
  )
$f$;

-- ── enviar_mensagem com o filtro ──────────────────────────────────────────
-- Igual a versao anterior, mais o bloco CONTATO_BLOQUEADO depois do controle
-- de acesso. O texto depois do codigo e mostrado pela tela como veio.
create or replace function public.enviar_mensagem(p_anuncio_id uuid, p_body text)
returns marketplace_mensagens
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_seller uuid; v_buyer uuid; v_card text; v_status text;
  v_recipient uuid; v_msg public.marketplace_mensagens;
begin
  if v_uid is null then raise exception 'nao autenticado'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'mensagem vazia'; end if;
  if length(p_body) > 2000 then raise exception 'mensagem muito longa'; end if;

  select user_id, buyer_id, card_name, status
    into v_seller, v_buyer, v_card, v_status
  from marketplace where id = p_anuncio_id;

  if v_seller is null then raise exception 'anuncio inexistente'; end if;
  if v_uid <> v_seller and (v_buyer is null or v_uid <> v_buyer) then
    raise exception 'sem acesso a esta negociacao';
  end if;

  if public.mensagem_tem_contato(p_body) and public.anuncio_vendedor_recebe_pela_bynx(p_anuncio_id) then
    if v_uid = v_seller then
      raise exception 'CONTATO_BLOQUEADO: Por segurança, contato e pagamento ficam dentro da Bynx. Peça ao comprador para usar o botão Comprar do anúncio.';
    else
      raise exception 'CONTATO_BLOQUEADO: Por segurança, contato e pagamento ficam dentro da Bynx. Use o botão Comprar: o pagamento é processado com segurança e você acompanha o pedido até a entrega.';
    end if;
  end if;

  insert into marketplace_mensagens (anuncio_id, sender_id, body)
  values (p_anuncio_id, v_uid, btrim(p_body))
  returning * into v_msg;

  if v_status = 'reservado' then
    update marketplace set status = 'em_negociacao' where id = p_anuncio_id;
  end if;

  v_recipient := case when v_uid = v_seller then v_buyer else v_seller end;
  if v_recipient is not null then
    insert into notifications (user_id, type, title, message, read, data)
    values (
      v_recipient, 'mensagem', 'Nova mensagem',
      'Voce tem uma nova mensagem sobre "' || coalesce(v_card, 'uma carta') || '".',
      false,
      jsonb_build_object('link', '/marketplace?conversa=' || p_anuncio_id::text,
                         'anuncio_id', p_anuncio_id)
    );
  end if;

  return v_msg;
end;
$function$;

-- Default privileges do Supabase expoem funcao nova a todo mundo.
revoke execute on function public.mensagem_tem_contato(text) from public, anon, authenticated;
revoke execute on function public.anuncio_vendedor_recebe_pela_bynx(uuid) from public, anon;
-- A tela pergunta para escolher entre o aviso e o bloqueio. Devolve so um
-- booleano que o botao Comprar ja torna publico.
grant execute on function public.anuncio_vendedor_recebe_pela_bynx(uuid) to authenticated;
