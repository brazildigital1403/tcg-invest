# BYNX — Master Context (Sessão 19 — 27/04/2026)

**Stack:** Next.js 16.2.2, Supabase hvkcwfcvizrvhkerupfc, Vercel prj_X1CUMTLMwTL77trWqZdDdmBI9PRC / team_FK9fHseL9hy5mbNR6c0Q8JuK
**Repo:** brazildigital1403/tcg-invest (main) | **Domínio:** bynx.gg

---

## Estado Atual (fim da sessão 19)

### Banco de Dados
```
pokemon_cards:   22.861+ cartas
  com preço BRL: crescendo (scans em andamento)
  com imagem:    2.624 Liga-only no Supabase Storage (100% completo!)
  liga-only:     2.624 cartas

pokemon_species: 1.025 espécies (PokeAPI)
  - Farfetch'd (83), Sirfetch'd (865) adicionados manualmente
  - Todos Gen IX DLC #1001-#1025 presentes

pokemon_cards.base_pokemon_names text[]:
  - Populada via SQL + fix-base-names.ts
  - Farfetch'd, Flabébé, Type: Null corrigidos manualmente
  - Buried Fossil → NULL (não é Pokémon)
  - Prefixos: Alolan, Hisuian, Shining, Light, Dark, Mega etc. → nome base
  - TAG TEAM "Garchomp & Giratina-GX" → ["Garchomp","Giratina"] ✅
  - "Ash-Greninja" → ["Greninja"] ✅

user_cards: constraint UNIQUE (user_id, pokemon_api_id)

Bucket Supabase Storage: card-images (público)
  URL: https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/
  Status: 2.624/2.624 imagens Liga salvas (100% completo)
```

### ZenRows Status
```
Plano: Startup
Usado: $208.01 de $227.63 (91%)
Renova: 26/05/2026
Restante: ~$19

scan-images: ✅ COMPLETO — todas as 2.624 cartas Liga têm imagem
scan-sets:   ⚠️ Parou por limite — 151 (sv3pt5) e Journey Together (sv9) ainda abaixo de 50%
```

---

## O Que Foi Feito Nessa Sessão

### 1. scan-images v4 — Supabase Storage ✅ COMPLETO
- Bucket `card-images` criado no Supabase Storage (público)
- Script modificado: Liga → ZenRows → download → upload → URL permanente
- Fix TypeScript: `Buffer` → `ArrayBuffer` para compatibilidade com `fetch(body)`
- **2.624 imagens salvas permanentemente** — nunca mais dependemos da Liga para imagens

### 2. scan-sets — Foco nos sets abaixo de 50%
- TARGET_SETS atualizado para apenas os 9 sets abaixo de 50%
- Depois restringido para apenas `sv3pt5` (151) e `sv9` (Journey Together)
- Parou por limite ZenRows antes de completar — retomará quando possível

### 3. AppLayout — Patrimônio no Header ✅
- Migrado de `card_prices` (obsoleto) para `pokemon_cards`
- Usa `pokemon_api_id` → lookup direto
- Fallback `card_link` → `liga_link`
- BRL → USD×câmbio → EUR×câmbio

### 4. Dashboard Financeiro ✅
- Reescrito para usar `pokemon_api_id` + `card_link` + fallback por nome
- Câmbio via `/api/exchange-rate` (AwesomeAPI)
- `getBestVal()`: BRL > USD×câmbio > EUR×câmbio
- Ranking corretamente ordenado por valor

### 5. Minha Coleção — Box Azul com Estimativa USD ✅
- Calcula `usdEstimado` para cartas sem preço BRL
- Mostra no box azul (Valor Médio): `+ R$ XXX estimado`
- Boxes verde e amarelo centralizados verticalmente com `justifyContent: center`

### 6. Pokédex — Redesign Completo ✅

**Arquitetura:**
- `/api/pokedex/route.ts` → `get_unique_base_pokemon()` SQL → cache 1h + `?refresh=1`
- `/api/pokedex/species/route.ts` → `pokemon_species` em 2 lotes (fix limite 1000 PostgREST) → cache 24h + `?refresh=1`
- `src/app/pokedex/page.tsx` → grid de Pokémon + vista de cartas
- `src/app/pokedex/CardDetailModal.tsx` → componente separado (fix Turbopack IIFE bug)

**Funcionalidades:**
- Vista 1: Grid de Pokémon (~8 por linha desktop), ordenado pela Pokédex nacional
- Sprites: pokemondb.net (Gen I-VIII) + PokeAPI official-artwork (Gen IX DLC #1001+)
- `referrerPolicy="no-referrer"` no `<img>` para bypassa hotlink do pokemondb
- Fallback: oficial-artwork → básico → esconde
- Filtros: busca por nome, geração (I-IX), tipo
- Badge dourado nos Pokémon que o usuário já tem na coleção
- Gen IX DLC: sprites via PokeAPI (pokemondb não tem ainda)

**Vista 2 — Cartas do Pokémon:**
- Busca por `base_pokemon_names @> [pokemon.name]` (array contains)
- Botões Anterior/Próximo Pokémon no header
- Click na carta → abre CardDetailModal (NÃO adiciona direto)

**CardDetailModal:**
- Nav entre cartas (← →) + contador "X de N"
- Teclado: ← → navega entre cartas, Esc fecha
- Layout: imagem + set info (esquerda) | detalhes (direita)
- Mobile responsivo via `isMobile` state (JS, sem CSS media query)
- Labels: Coleção, Número, Lançamento, Artista
- Ataques com ícones de energia (🔥💧🌿⚡🔮👊🌑⚙️🐉⭕🌸)
- Fraquezas, resistências, custo de recuo
- Flavor text em itálico com borda laranja
- Preços BR (mín/méd/máx por variante) + Preços USD/EUR
- Legalidades (Standard/Expanded/Unlimited)
- Link "Ver na Liga Pokémon"
- Seletor de variante com preço antes de adicionar (Normal, Foil, Reverse, Promo, Pokéball)
- Botões: Fechar | + Adicionar à Coleção

**SELECT query inclui:**
`artist, flavor_text, attacks, weaknesses, resistances, retreat_cost, legalities, subtypes, set_logo, set_symbol, set_series`

**SQL Functions:**
- `get_unique_base_pokemon()` → JSON com name + card_count (retorna sem tipos para evitar timeout)
- `get_unique_pokemon()` → DISTINCT ON(name) (função anterior, mantida)
- `rebuild_base_pokemon_names()` → UPDATE via regex (timeout em produção, usar script JS)
- `extract_base_pokemon_names()` → função auxiliar

**Scripts no Mac:**
- `populate-species.ts` → populou 1025 espécies (já rodado)
- `fix-base-names.ts` → word-boundary matching JS para todos os cards (já rodado)

### 7. Sprites Gen IX DLC — Resolvido ✅
- Problema: `/api/pokedex/species` retornava só 1000 espécies (limite PostgREST)
- Fix: busca em 2 lotes paralelos `.range(0,999)` + `.range(1000,1999)`
- Agora retorna todos 1025 → dex_id corretos → sprites aparecem

---

## Arquivos Modificados Nessa Sessão

```
src/app/pokedex/page.tsx                          ← redesign completo, exporta TYPE_COLOR
src/app/pokedex/CardDetailModal.tsx               ← NOVO componente (fix Turbopack IIFE bug)
src/app/api/pokedex/route.ts                      ← cache 1h, ?refresh=1, types separado
src/app/api/pokedex/species/route.ts              ← NOVO — 2 lotes, cache 24h, ?refresh=1
src/app/minha-colecao/page.tsx                    ← usdEstimado no box azul, flex center
src/app/dashboard-financeiro/page.tsx             ← pokemon_api_id + câmbio
src/components/ui/AppLayout.tsx                   ← patrimônio usa pokemon_cards + câmbio

Scripts no Mac (/Users/eduardowillian/bynx-scan/):
  scan-images.ts  ← v4: Liga → ZenRows → download → Supabase Storage (COMPLETO)
  scan-sets.ts    ← foco em sv3pt5 + sv9 (parou por limite ZenRows)
  populate-species.ts  ← populou pokemon_species (já rodado)
  fix-base-names.ts    ← corrigiu base_pokemon_names (já rodado)
```

---

## Bugs Corrigidos

| Bug | Causa | Fix |
|-----|-------|-----|
| Patrimônio R$0,00 no header | Usava `card_prices` obsoleto | Migrou para `pokemon_cards` |
| scan-images TypeScript error | `Buffer` não aceito como `body` no fetch | Mudou para `ArrayBuffer` |
| Pokédex mostrava 122 Pokémon | Limite 1000 rows Supabase | API Route com `get_unique_base_pokemon()` SQL |
| Gen IX DLC sem sprite | `/api/pokedex/species` cortava em 1000 | 2 lotes paralelos `.range()` |
| Turbopack IIFE bug | Modal em IIFE causava "Unterminated regexp" | Extraído para `CardDetailModal.tsx` |
| Artista não aparecia | Faltava `artist` no `.select()` query | Adicionados todos os campos |
| Pokémon regionais separados | Alolan/Hisuian/Mega não mapeados | SQL UPDATE + fix-base-names.ts |
| PostgREST 1000 rows limit | `.limit(2000)` não funciona | Usar `.range()` em lotes |

---

## Pendências

### ⚠️ scan-sets — Retomar quando tiver crédito
ZenRows renova em 26/05/2026. Rodar:
```bash
cd /Users/eduardowillian/bynx-scan
while true; do ZENROWS_API_KEY=adad1cb8c25df1ad2b116d98428bc0914be37bea npx ts-node scan-sets.ts; echo "Reiniciando em 10s..."; sleep 10; done
```
TARGET_SETS atual: `['sv3pt5', 'sv9']` (151 e Journey Together)

### Cache Pokédex — Após mudanças no banco
```
https://www.bynx.gg/api/pokedex?refresh=1
https://www.bynx.gg/api/pokedex/species?refresh=1
```

### A partir de 01/05/2026 — Sistema de Preços
- Migrar de `card_prices` → `pokemon_cards` na busca
- Autocomplete por nome na Minha Coleção
- Pokédex lendo preços direto do Supabase

---

## Regras BYNX (Memória)

1. **BYNX_MASTER_CONTEXT.md** ao final do dia — commit + push
2. **Código 100% completo** sempre — nunca diffs ou snippets
3. **Git em bloco único** com `&&` — Du cola uma vez só
4. **CardItem é o componente padrão** — `src/components/ui/CardItem.tsx`
5. **A partir de 01/05/2026** → melhorias sistema de preços
6. **Turbopack não aceita IIFE complexos** → extrair para componente separado
7. **PostgREST limita 1000 rows** → usar `.range()` em lotes para dados grandes

---

## Key Learnings Dessa Sessão

- **PostgREST hardcap de 1000 rows:** `.limit(2000)` é ignorado — usar `.range(0,999)` + `.range(1000,1999)` em paralelo
- **Turbopack IIFE bug:** `{selectedCard && (() => { ... })()}` com JSX complexo causa "Unterminated regexp literal" — sempre extrair para componente separado
- **pokemondb.net hotlink:** bloqueado por `Referer` header — `referrerPolicy="no-referrer"` bypassa
- **ArrayBuffer vs Buffer:** TypeScript strict mode não aceita `Buffer` como `body` no fetch — usar `ArrayBuffer` retornado direto de `res.arrayBuffer()`
- **Supabase Storage:** bucket `card-images` público — URL permanente, CDN global, sem dependência da Liga

