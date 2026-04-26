# BYNX — Master Context
**Atualizado:** 26/04/2026 — Sessão 17

## Stack & Infra
- Next.js 16.2.2 / Supabase hvkcwfcvizrvhkerupfc / Vercel prj_X1CUMTLMwTL77trWqZdDdmBI9PRC
- Repo: brazildigital1403/tcg-invest (main)
- ZenRows: Startup $129/mês — 40K req protegidas, 50 simultâneas
- Test user: eduardo — 122267ef-5aeb-4fd0-a9c0-616bfca068bd

## Estado do Banco
- pokemon_cards: 21.487 cartas | 1.653 com preço BRL (crescendo — scan rodando)
- user_cards: 45 registros (Eduardo)

## Feito nessa sessão
1. Scan 1 completo (987 preços BRL) → Upgrade Startup → Scan 2 rodando agora (1.653 preços)
2. /api/cards/search, /api/cards/[id], /api/exchange-rate criados
3. AddCardModal reescrito (busca Supabase, sem link Liga)
4. minha-colecao + dashboard migrados de card_prices → pokemon_cards
5. Sistema de preços realtime: BRL real > USD×câmbio > EUR×câmbio
6. RLS fix: policy pública em pokemon_cards (era isso que bloqueava o browser!)
7. Match por liga_link (exato) > nome+número > nome

## Pendências URGENTES
- [ ] Du precisa dar push no último arquivo: `fix: variante persiste, match por liga_link exato, USD por variante`
- [ ] Dashboard-financeiro: mesmos fixes de liga_link + getBestPrice por variante
- [ ] Esperar scan-sets.ts completar
- [ ] OnboardingModal, Pokédex, landing page — textos sem menção à Liga
- [ ] Tabela price_scan_queue + cron job

## Bugs corrigidos
- RLS sem policy em pokemon_cards → policy pública criada
- Match por nome pegava set errado → match por liga_link como prioridade 1
- getVarianteEfetiva sobrescrevia variante salva → removida a lógica de override
- getBestPrice ignorava variante para USD → usa holofoil para foil, reverse para reverse
- Seletor de variante não aparecia → sempre mostra as 5 opções

## Scan-sets.ts
```bash
cd /Users/eduardowillian/bynx-scan && while true; do ZENROWS_API_KEY=adad1cb8c25df1ad2b116d98428bc0914be37bea npx ts-node scan-sets.ts; echo "Reiniciando em 10s..."; sleep 10; done
```
14 sets | ~2.838 cartas | ~$40 | ETA ~2-3h

## Regras BYNX
1. BYNX_MASTER_CONTEXT.md ao final do dia
2. Código 100% completo
3. Git em bloco único com &&
4. A partir de 01/05 — melhorias sistema de preços
