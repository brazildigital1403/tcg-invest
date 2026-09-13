-- Limite de anuncios de CARTA no banco, com lojista ilimitado.
--
-- ★ POR QUE (13/09/2026, Quadro #291). O limite de 3 anuncios do plano Gratis
-- so existia no navegador: o botao "Anunciar carta" do marketplace checava,
-- mas o "vender" da Minha Colecao gravava N copias sem checar nada, e a regra
-- de acesso de INSERT so conferia o dono. A GhosTCG publicou 15 cartas em 3
-- minutos no plano Gratis por esse caminho (12/09).
--
-- ★ A REGRA (decisao do Du, 13/09, depois de quatro agentes pensadores e
-- advogados do diabo). Carta avulsa e ILIMITADA para:
--   - plano pessoal pago ou em trial (mesma regra de user_pastas_ilimitadas);
--   - dono de loja ATIVA com plano Pro/Premium valido (trial ou pago);
--   - dono de loja ATIVA com recebimentos ativos (Connect) -- a Bynx ganha
--     comissao em cada venda dessas, entao limitar seria cortar a propria receita.
-- Fora disso, 3 anuncios que ocupam vaga (o mesmo STATUS_OCUPAM_VAGA de
-- src/lib/marketplaceStatus.ts, com removido_em nulo). O 3 e o
-- limiteAnuncios do plano free em src/lib/plan.ts.
--
-- ★ ANUNCIO QUE JA ESTA NO AR NUNCA CAI. O gatilho so age em INSERT e em
-- UPDATE que COLOCA um anuncio de volta na vaga (status voltando pra
-- disponivel, ou removido_em sendo limpo). Os 4 usuarios que ja passam de 3
-- continuam com tudo no ar; so nao criam novos enquanto estiverem acima.
--
-- ★ CHAVE DE SERVICO PASSA. Sem claims (conexao direta, migration) ou com
-- role service_role, o gatilho nao se aplica -- manutencao e rotinas do servidor.
--
-- ★ CORRIDA. pg_advisory_xact_lock por usuario: duas gravacoes simultaneas nao
-- passam juntas pelo "tem 2, cabe mais 1".
--
-- ★ ENSAIADO ANTES, em transacao desfeita, com usuarios reais: Gratis sem loja
-- acima do limite barrado; loja Pro no trial passou; loja com Connect passou;
-- loja Basico sem Connect 3 passaram e o 4o barrou; cancelado voltando a
-- disponivel acima do limite barrado; lote de 5 numa instrucao barrado
-- inteiro (0 gravados) e lote de 3 passou; chave de servico passou.
--
-- ★ As funcoes nascem com EXECUTE revogado (default privilege do Supabase
-- libera pra anon/authenticated). O navegador so chama
-- minhas_cartas_ilimitadas(), que responde sobre a PROPRIA conta.

create or replace function public.cartas_ilimitadas(p_uid uuid) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select coalesce(public.user_pastas_ilimitadas(p_uid), false)
      or exists (
        select 1 from lojas l
        where l.owner_user_id = p_uid and l.status = 'ativa'
          and ( l.connect_charges_enabled is true
             or (l.plano in ('pro','premium') and (l.plano_expira_em is null or l.plano_expira_em > now())) )
      )
$f$;

create or replace function public.minhas_cartas_ilimitadas() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.cartas_ilimitadas((select auth.uid()))
$f$;

create or replace function public.enforce_limite_cartas() returns trigger
language plpgsql security definer set search_path to 'public' as $t$
declare v_count int; v_papel text;
begin
  v_papel := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', 'service_role');
  if v_papel = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' then
    if not ((coalesce(new.status,'disponivel') in ('disponivel','reservado','em_negociacao','enviado') and new.removido_em is null)
        and not (coalesce(old.status,'disponivel') in ('disponivel','reservado','em_negociacao','enviado') and old.removido_em is null)) then
      return new;
    end if;
  elsif not (coalesce(new.status,'disponivel') in ('disponivel','reservado','em_negociacao','enviado') and new.removido_em is null) then
    return new;
  end if;
  if public.cartas_ilimitadas(new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('limite_cartas:' || new.user_id::text, 0));
  select count(*) into v_count from marketplace
   where user_id = new.user_id and removido_em is null and id <> new.id
     and coalesce(status,'disponivel') in ('disponivel','reservado','em_negociacao','enviado');
  if v_count >= 3 then
    raise exception 'LIMITE_ANUNCIOS: o plano Grátis permite 3 anúncios ativos. Loja com plano Pro ou com recebimentos ativos anuncia sem limite.' using errcode = 'P0001';
  end if;
  return new;
end $t$;

drop trigger if exists trg_enforce_limite_cartas on public.marketplace;
create trigger trg_enforce_limite_cartas
  before insert or update of status, removido_em on public.marketplace
  for each row execute function public.enforce_limite_cartas();

revoke execute on function public.cartas_ilimitadas(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_limite_cartas() from public, anon, authenticated;
revoke execute on function public.minhas_cartas_ilimitadas() from public, anon;
grant execute on function public.minhas_cartas_ilimitadas() to authenticated;
