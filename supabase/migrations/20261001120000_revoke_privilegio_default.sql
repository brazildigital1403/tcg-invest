-- ============================================================================
-- Fecha o privilegio que o default do Supabase da de graca, e liga a segunda
-- trava da view `pokemon_cards`.
--
-- ★ NAO HA EXPOSICAO ATIVA HOJE, e isso foi MEDIDO antes de escrever: nenhuma
--   tabela com grant para `anon`/`authenticated` esta sem RLS (so 1 das 89
--   tabelas de `public` tem RLS desligada, e ela nao tem grant nenhum para
--   esses papeis). Esta migration e defesa em profundidade, nao conserto de
--   vazamento -- se fosse vazamento nao estaria num arquivo esperando
--   aprovacao.
--
-- ★ A RAIZ E O DEFAULT PRIVILEGE, nao as tabelas. Medido em 01/10/2026:
--
--     default acl de `postgres`       em public (tabela): authenticated=arwdDxtm
--     default acl de `supabase_admin` em public (tabela): authenticated=arwdDxtm
--                                                        anon=arwdDxtm
--
--   O `D` dessa string e TRUNCATE e o `d` e DELETE. Ou seja: toda tabela nova
--   nasce com os dois, para sempre, sem ninguem pedir. Hoje sao 49 tabelas com
--   TRUNCATE para `authenticated`, entre elas `users`, `lojas`, `marketplace`,
--   `transactions`, `points_ledger` e `tickets`.
--
-- ★ E HA UMA SEGUNDA FONTE, que eu so achei ao conferir a afirmacao do bloco
--   1: o `00000000000000_baseline_schema.sql` tem **51 linhas** da forma
--   `grant insert, select, update, delete, truncate, references, trigger,
--   maintain on table public.X to authenticated` -- uma por tabela, cravadas.
--   Ele e um dump do estado, entao nao e culpado de nada; e a foto do que o
--   default privilege ja havia feito. Mas a consequencia e concreta:
--
--     esta migration corrige a PRODUCAO. Qualquer banco criado do baseline
--     (branch nova de prova, reset) nasce exposto de novo, porque o baseline
--     roda antes dela.
--
--   Nao editei o baseline: e arquivo gerado, e mexer a mao num dump de 7 mil
--   linhas por causa disto trocaria um risco pequeno por um grande. O jeito
--   certo e esta migration rodar na branch tambem, como qualquer outra.
--
-- ★ POR QUE TRUNCATE E PIOR QUE DELETE: **TRUNCATE NAO RESPEITA RLS**. O
--   DELETE sem policy e barrado pela RLS (zero linhas, em silencio), e e por
--   isso que o bloco 2 e cosmetico. O TRUNCATE passaria por cima de qualquer
--   policy -- o que impede hoje e so o fato de o PostgREST nao expor TRUNCATE
--   em lugar nenhum. A protecao e a ausencia de um caminho, nao a ausencia do
--   privilegio: basta uma funcao `security invoker` nova fazer `truncate` para
--   o caminho existir.
--
-- ★ ORDEM DOS BLOCOS: cada um e independente e pode ser cortado sem quebrar os
--   outros. Se for para aplicar so um, aplique o 1 e o 3 -- sao os que mudam
--   algo de verdade.
--
-- ROLLBACK de cada bloco esta no fim do arquivo.
-- ============================================================================


-- ─── BLOCO 1: TRUNCATE sai de todas as tabelas ──────────────────────────────
--
-- Uma linha cobre as 49. Nenhuma rota, RPC, cron ou trigger da Bynx executa
-- TRUNCATE: a varredura do repo devolveu duas ocorrencias, e as duas sao a
-- funcao JS `truncate(texto, max)` que corta a descricao em `CardLoja.tsx`.
-- Custo operacional zero.
--
-- `all tables in schema public` alcanca views e matviews tambem; revogar
-- TRUNCATE delas e inocuo (nao existe truncate de view).

revoke truncate on all tables in schema public from authenticated;
revoke truncate on all tables in schema public from anon;


-- ─── BLOCO 2: DELETE sai so de onde nao ha policy ───────────────────────────
--
-- ★ A LISTA E CALCULADA NA HORA, de proposito. Cravar os 43 nomes que eu medi
--   hoje significaria revogar amanha de uma tabela que ganhou policy no meio
--   do caminho -- e aí a policy nova nao funcionaria, com erro de permissao em
--   vez de comportamento. Em runtime, quem tem policy de DELETE (ou ALL) fica
--   intacto, sempre.
--
-- As 7 que PRECISAM continuar com DELETE (medido): loja_eventos, marketplace,
-- metas_colecao, pasta_cards, pastas, user_cards, watchlist. O bloco nao as
-- toca porque todas tem policy.
--
-- ★ O QUE ESTE BLOCO CUSTA: se um dia alguem criar uma policy de DELETE numa
--   dessas 43 esperando que ela funcione, vai faltar o grant -- e o sintoma
--   sera "permissao negada", nao "zero linhas". E um erro barulhento, que e
--   melhor que o silencioso, mas custa tempo de quem nao souber desta
--   migration. Por isso ele e o bloco mais facil de cortar.

do $$
declare
  t record;
  n int := 0;
begin
  for t in
    select distinct g.table_name
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee in ('anon', 'authenticated')
      and g.privilege_type = 'DELETE'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = g.table_name
          and p.cmd in ('DELETE', 'ALL')
      )
    order by g.table_name
  loop
    execute format('revoke delete on public.%I from anon, authenticated', t.table_name);
    n := n + 1;
  end loop;
  raise notice 'DELETE revogado em % tabela(s) sem policy de DELETE', n;
end $$;


-- ─── BLOCO 3: a cura -- tabela NOVA deixa de nascer assim ───────────────────
--
-- Sem isto, os blocos 1 e 2 sao varrer o chao com a torneira aberta: a
-- proxima migration que criar tabela repoe TRUNCATE e DELETE.
--
-- ★ O SEGUNDO COMANDO PODE FALHAR, e falhar esta tudo bem. Alterar o default
--   de `supabase_admin` exige ser membro dele, e o papel do MCP (`postgres`)
--   pode nao ser. Se falhar, o default de `postgres` -- que e o dono das
--   tabelas que a Bynx cria -- ja esta coberto pelo primeiro, e e o que
--   importa na pratica. Por isso cada um vai no seu proprio bloco, para o erro
--   de um nao abortar o outro.

do $$
begin
  alter default privileges for role postgres in schema public
    revoke truncate on tables from anon, authenticated;
  raise notice 'default privilege de postgres: TRUNCATE removido';
exception when others then
  raise notice 'default privilege de postgres NAO alterado: %', sqlerrm;
end $$;

do $$
begin
  alter default privileges for role supabase_admin in schema public
    revoke truncate on tables from anon, authenticated;
  raise notice 'default privilege de supabase_admin: TRUNCATE removido';
exception when others then
  raise notice 'default privilege de supabase_admin NAO alterado (esperado): %', sqlerrm;
end $$;


-- ─── BLOCO 4: `security_invoker` na view `pokemon_cards` ────────────────────
--
-- ★ O CLAUDE.md AFIRMA QUE ELA TEM ISSO. Nao tem: `reloptions` da view esta
--   NULL, medido em 01/10/2026. Em algum ponto a view foi recriada sem a
--   opcao, e o arquivo de contexto seguiu descrevendo a intencao.
--
-- ★ POR QUE ISSO NAO MUDA NADA HOJE -- e por que vale mesmo assim. Quem le a
--   view, le:
--     mia_readonly   SELECT na view: sim  · na base: sim  -> continua lendo
--     service_role   SELECT na view: sim  · na base: sim  -> continua lendo
--     authenticated  SELECT na view: NAO                  -> segue sem ler
--     anon           SELECT na view: NAO                  -> segue sem ler
--   E a policy da base (`pokemon_cards_public_read`) e `using (true)`, entao a
--   RLS nao barra ninguem que tenha grant. Nada se move.
--
--   O valor e no dia em que alguem rodar `grant select ... to authenticated`
--   na view (ou o default privilege pegar numa recriacao, que e justamente o
--   que o bloco 3 impede). SEM esta opcao, a view serve os dados com os
--   direitos do DONO (postgres) e a RLS da base simplesmente nao se aplica --
--   e a view vira a porta dos fundos de `pokemon_cards_all`. COM ela, a RLS
--   da base continua valendo.
--
-- ★ CUSTO DE IO: ZERO. `alter view ... set` mexe so em catalogo, nao varre a
--   tabela de 187 MB. Invalida plano em cache, e a proxima query recompila.
--   Mesmo assim, aplicar junto de qualquer operacao que leia
--   `pokemon_cards_all` inteira nao vale -- o orcamento de rajada de disco e
--   finito, e `/set` tem 8s no `authenticator`.
--
-- ★ CONFERIR DEPOIS DE APLICAR, nesta ordem: (1) `/set` e a Pokedex abertas
--   pelo caminho do usuario, SEM `?refresh=1`; (2) o refresh das 3 matviews
--   que leem a view (`mv_set_index_stats`, `mv_price_movers`,
--   `mv_base_pokemon_tipos`) -- elas rodam como `postgres`, que tem direito na
--   base, mas e onde um erro apareceria.

alter view public.pokemon_cards set (security_invoker = true);


-- ============================================================================
-- VERIFICACAO (rodar DEPOIS, nao faz parte da migration)
-- ============================================================================
--
-- select json_build_object(
--   'truncate_sobrando', (select count(distinct table_name)
--      from information_schema.role_table_grants
--      where table_schema='public' and grantee in ('anon','authenticated')
--        and privilege_type='TRUNCATE'),
--   'delete_sem_policy_sobrando', (select count(distinct g.table_name)
--      from information_schema.role_table_grants g
--      where g.table_schema='public' and g.grantee in ('anon','authenticated')
--        and g.privilege_type='DELETE'
--        and not exists (select 1 from pg_policies p where p.schemaname='public'
--              and p.tablename=g.table_name and p.cmd in ('DELETE','ALL'))),
--   'delete_preservado', (select json_agg(distinct g.table_name)
--      from information_schema.role_table_grants g
--      where g.table_schema='public' and g.grantee='authenticated'
--        and g.privilege_type='DELETE'),
--   'view_com_invoker', (select reloptions::text from pg_class
--      where oid='public.pokemon_cards'::regclass),
--   'anon_le_a_view', has_table_privilege('anon','public.pokemon_cards','SELECT'),
--   'mia_readonly_le_a_view', has_table_privilege('mia_readonly','public.pokemon_cards','SELECT')
-- );
--
-- Esperado: truncate_sobrando = 0 · delete_sem_policy_sobrando = 0 ·
-- delete_preservado = as 7 com policy · view_com_invoker = {security_invoker=true} ·
-- anon_le_a_view = false · mia_readonly_le_a_view = true
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
--
-- Bloco 1:  grant truncate on all tables in schema public to authenticated;
-- Bloco 2:  grant delete on all tables in schema public to authenticated;
--           (volta MAIS do que foi tirado -- o estado anterior era por tabela.
--            Nao ha problema de seguranca nisso: e o estado de hoje, que a RLS
--            ja barra. Para voltar exato, rodar a lista do bloco 2 antes.)
-- Bloco 3:  alter default privileges for role postgres in schema public
--             grant truncate on tables to anon, authenticated;
-- Bloco 4:  alter view public.pokemon_cards reset (security_invoker);
-- ============================================================================
