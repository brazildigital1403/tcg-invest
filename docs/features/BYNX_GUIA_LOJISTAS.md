# Bynx — Guia de Lojistas

> Doc master da feature. Tudo aqui é referência oficial: pricing, mecânica de destaque, limites por plano, arquitetura, roadmap e decisões técnicas.
>
> Última atualização: 23/abr/2026 (v2 — arquitetura user↔lojista + landing B2B)

---

## 1. Visão geral

O **Guia de Lojistas** é um diretório pago de lojas de TCG do Brasil, integrado ao Bynx. Alvo: lojistas de Pokémon, Magic, Yu-Gi-Oh, Lorcana, Digimon e outros card games. Objetivo:

- Para o lojista: ser encontrado por milhares de colecionadores brasileiros que já usam o Bynx
- Para o usuário final: descobrir lojas confiáveis na sua região ou online
- Para o Bynx: construir MRR recorrente em uma audiência já qualificada, com 100% de margem (entrega digital)

**Posicionamento:** "O Google Meu Negócio dos lojistas de TCG brasileiros."

---

## 2. Arquitetura user ↔ lojista

### 2.1 Modelo escolhido: **menu adaptativo com user único**

Um user = um registro na `public.users`. Não existem "tipos de conta" separados. O mesmo user pode:
- Ser apenas colecionador (tem cartas, não tem loja)
- Ser apenas lojista (tem loja, não tem cartas)
- Ser os dois (tem cartas E tem loja) — comum no TCG brasileiro

### 2.2 Detecção automática do perfil no AppLayout

No mount do `AppLayout`, faz 2 queries rápidas:

```sql
-- É colecionador?
SELECT COUNT(*) FROM user_cards WHERE user_id = ?

-- Tem loja?
SELECT id, slug, nome, status FROM lojas WHERE owner_user_id = ? LIMIT 1
```

Com esses 2 booleans (`temCartas`, `temLoja`), o AppLayout decide o menu:

| temCartas | temLoja | Modo | Menu |
|---|---|---|---|
| ✅ | ❌ | **Colecionador puro** | Menu atual completo (Dashboard, Coleção, Pokédex, Marketplace, Separadores, Conta, Suporte) + Guia de Lojas |
| ✅ | ✅ | **Híbrido** | Menu completo + "Minha Loja" + Guia de Lojas |
| ❌ | ✅ | **Lojista puro** | Menu enxuto: Minha Loja, Guia de Lojas, Minha Conta, Suporte. Botão "✨ Explorar como colecionador" pra expandir |
| ❌ | ❌ | **Novo usuário** | Menu completo padrão (default) + Guia de Lojas |

### 2.3 "Explorar como colecionador" (modo lojista)

Quando lojista puro está no menu enxuto, um botão pill na sidebar oferece:

```
✨ Explorar como colecionador
```

Ao clicar, uma flag no localStorage (`bynx_explore_mode = true`) faz o AppLayout ignorar o filtro `temCartas` e mostrar o menu completo. Fica visível um banner pequeno no topo: "Modo colecionador — [Voltar pro modo lojista]".

Isso cobre o caso do lojista que quer começar a montar sua própria coleção ou entender o produto do ponto de vista do cliente — sem precisar criar conta nova.

### 2.4 Guia de Lojas é sempre visível

O item **"Guia de Lojas"** aparece no menu de **qualquer usuário logado**, porque descobrir lojas é útil pra todo colecionador. O item **"Minha Loja"** é o condicional.

---

## 3. Como usuário vira lojista

### 3.1 Funil

```
[Colecionador no Bynx]
      ↓
[Vê "Guia de Lojas" no menu OU recebe email "Quer sua loja aqui?"]
      ↓
[Clica em /lojas → vê CTA "Tem uma loja? Cadastre aqui"]
      ↓
[Vai pra /para-lojistas (landing B2B dedicada)]
      ↓
[Lê benefícios, vê planos, vê prova social]
      ↓
[Clica em "Cadastrar minha loja grátis"]
      ↓
[Se logado: vai pra /minha-loja form]
[Se não logado: abre modal signup com ?next=/minha-loja]
      ↓
[Preenche form → status='pendente' + trial Pro 14 dias ativado]
      ↓
[Admin aprova em /admin/lojas em até 48h]
      ↓
[Loja aparece no /lojas guia público]
```

### 3.2 Pontos de entrada da landing `/para-lojistas`

- Item no header da landing principal (`bynx.gg`) — "Para lojistas"
- CTA no fim da `/lojas` — "Tem uma loja? Cadastre aqui"
- Item no footer do app — "Seja um lojista parceiro"
- Email marketing pra usuários que buscaram muito no guia (fase 2)
- Anúncios Google/Meta apontando pra essa URL (fase 2)

### 3.3 Conteúdo da landing `/para-lojistas`

1. **Hero** — "Sua loja no guia mais completo de TCG do Brasil" + CTA + preview visual de um card premium
2. **Prova social** — carrossel de logos das lojas já cadastradas (fase 2; hoje vazio)
3. **Métricas reais** — colecionadores no Bynx, buscas no guia, cliques em WhatsApp (fase 2 via analytics)
4. **Como funciona** — 3 passos (cadastra → aprovado em 48h → visibilidade)
5. **Comparativo de planos** — tabela visual Básico × Pro × Premium com preview do card de cada tier
6. **Benefícios visuais** — screenshots mostrando como a loja aparece no guia e na página individual
7. **FAQ do lojista** — CNPJ, tempo de aprovação, cancelamento, múltiplas lojas, fotos
8. **CTA final** — "Cadastre sua loja grátis — 14 dias de Pro no trial"
9. **Footer** público do Bynx

---

## 4. Planos e pricing

### 4.1 Tabela de planos

| Feature | **Básico** | **Pro** | **Premium** |
|---|---|---|---|
| **Preço mensal** | Grátis | R$ 39/mês | R$ 89/mês |
| **Preço anual** | — | R$ 390/ano (2 meses grátis) | R$ 890/ano (2 meses grátis) |
| **Renovação anual após 12m** | — | R$ 312/ano (20% off) | R$ 712/ano (20% off) |
| Listagem no guia | ✅ | ✅ | ✅ |
| WhatsApp + link direto | ✅ | ✅ | ✅ |
| Especialidades (jogos) | 1 | Ilimitado | Ilimitado |
| Redes sociais (IG/FB/Website) | ❌ | ✅ | ✅ |
| Endereço + link Google Maps | ✅ | ✅ | ✅ |
| Descrição longa | 160 caracteres | Ilimitado | Ilimitado |
| Fotos da loja | ❌ | 5 | 10 |
| Badge "Pro" no card | ❌ | ✅ (cinza âmbar) | ❌ |
| Badge "Premium" no card | ❌ | ❌ | ✅ (gradient âmbar→vermelho) |
| Borda âmbar destacada | ❌ | ❌ | ✅ |
| Card 1.5x maior na listagem | ❌ | ❌ | ✅ |
| Preview de fotos no card | ❌ | 1 thumb | 3 thumbs |
| Preview "próximo evento" no card | ❌ | ❌ | ✅ |
| Eventos e torneios na página | ❌ | ❌ | ✅ Ilimitado |
| Badge verificado (selo Bynx) | manual | manual | manual |
| SEO customizado | Auto | Auto | **Editável** |
| Analytics (views, cliques WhatsApp) | ❌ | ❌ | ✅ |
| Posição na busca | Final | Meio | **Topo (rotativo)** |
| Trial de 14 dias | — | ✅ | ✅ |

### 4.2 Trial de Pro (14 dias)

Todo novo cadastro de loja ganha **14 dias de Pro grátis**, sem cartão de crédito. Ao final:

- Se o lojista assinar Pro ou Premium → cobrança normal
- Se não assinar → rebaixado automaticamente para Básico (features Pro desativadas)

### 4.3 Ofertas avulsas

| Oferta | Preço | Duração | Observação |
|---|---|---|---|
| Destaque de evento na home do guia | R$ 29 | 7 dias | Evento aparece numa seção "Eventos desta semana" na `/lojas` |
| Boost de 72h no topo da cidade | R$ 19 | 72 horas | Fura a rotação Premium e fixa a loja no topo da UF |
| Foto extra acima do limite | R$ 9 | Permanente | Pro: 5→6 fotos; Premium: 10→11; etc. |

### 4.4 Racional dos preços

**Pro R$ 39:** Preço psicologicamente abaixo de R$ 50. Um único cliente novo do Bynx (gastando em média R$ 150-300) paga o plano por 4-8 meses.

**Premium R$ 89:** Dobra a percepção de valor com preço abaixo da barreira psicológica de R$ 100. Comparação vendedora: "1 semana de campanha no Meta Ads custa R$ 70-100."

**Anual 2 meses grátis (~16%):** Sweet spot entre desconto que chama atenção e previsibilidade de receita.

**20% off na renovação após 12m:** Fideliza lojistas que já validaram ROI.

### 4.5 Projeção de receita

**12 meses, 50 lojistas (70/25/5):** ~R$ 795/mês MRR
**24 meses, 200 lojistas:** ~R$ 3.500-4.000/mês
**36 meses, 500 lojistas:** ~R$ 8.500-10.000/mês

---

## 5. Mecânica de destaque Premium

### 5.1 Abordagem escolhida: **diferenciação visual + rotação**

Premium **não** ganha "topo absoluto". Ganha **presença visual diferenciada + rotação justa dentro do tier**.

**Ordem de renderização na `/lojas`:**
```
1. Todos os Premium (ordenados por rotação round-robin + verificadas primeiro)
2. Todos os Pro (ordenados por completude do perfil)
3. Todos os Básico (ordenados por recência de cadastro)
```

**Diferenciação visual do Premium:**
- Card 1.5x maior que os outros
- Borda âmbar com shadow âmbar sutil
- Badge "Premium" com gradient âmbar→vermelho
- Preview de 3 thumbs de fotos dentro do card
- Texto "Próximo evento: DD/MM — Nome" quando aplicável
- Animação hover com glow âmbar

**Rotação round-robin:** dentro do bloco Premium, a ordem muda. Quem apareceu menos nas últimas horas sobe.

### 5.2 Implementação técnica

```sql
ALTER TABLE public.lojas ADD COLUMN ultima_aparicao_topo timestamp;
CREATE INDEX idx_lojas_aparicao_topo
  ON public.lojas(ultima_aparicao_topo) WHERE plano = 'premium';
```

**Query ordenada:**
```sql
SELECT * FROM lojas
WHERE status = 'ativa' AND plano = 'premium'
ORDER BY
  verificada DESC,
  ultima_aparicao_topo ASC NULLS FIRST,
  created_at DESC;
```

### 5.3 Boost de 72h (oferta avulsa)

Lojistas que querem "pagar mais pra aparecer mais" usam a oferta avulsa (R$ 19 por 72h no topo da cidade) — fura a rotação. Monetização sem criar tier Premium+.

---

## 6. Regras de negócio

### 6.1 Estados da loja

| Status | Aparece no guia? | Lojista edita? | Observação |
|---|---|---|---|
| `pendente` | ❌ | ✅ | Aguardando moderação admin |
| `ativa` | ✅ | ✅ | Estado normal |
| `suspensa` | ❌ | ❌ | Infração. `motivo_suspensao` preenchido |
| `inativa` | ❌ | ✅ | Lojista desativou voluntariamente |

### 6.2 Verificação

Selo âmbar **manual**, só admin concede. Critérios: CNPJ válido, operação real, 3+ meses no Bynx.

### 6.3 Cancelamento

Cancelamento não é imediato — vigência continua até fim do período pago. Depois cai pra Básico (não pra suspensa/inativa). Fotos acima do limite do Básico ficam ocultas mas **não deletadas**.

### 6.4 Exclusão definitiva

Solicitação em `/minha-loja` → Configurações → typing "EXCLUIR" → soft-delete 90 dias → deleção via cron.

---

## 7. Arquitetura técnica

### 7.1 Tabelas Supabase

**`public.lojas`** (já criada)
- ~30 colunas, RLS configurado, 8 índices

**Colunas a adicionar:**
- `ultima_aparicao_topo TIMESTAMP` — rotação Premium
- `trial_inicia_em TIMESTAMP` / `trial_termina_em TIMESTAMP`
- `visualizacoes INT DEFAULT 0` / `cliques_whatsapp INT DEFAULT 0`
- `boost_ativo_ate TIMESTAMP`

### 7.2 Rotas

| Rota | Tipo | Descrição | Status |
|---|---|---|---|
| `/lojas` | Público | Listagem com filtros | ✅ Passo 2 |
| `/lojas/[slug]` | Público | Página individual com lightbox | ✅ Passo 3+3.5 |
| `/minha-loja` | Autenticado | Painel do lojista | ✅ Passo 4 |
| **`/para-lojistas`** | **Público** | **Landing B2B** | ⏳ **Passo 5** |
| AppLayout adaptativo | — | Menu condicional | ⏳ **Passo 6** |
| `/minha-loja/plano` | Autenticado | Upgrade + Stripe | ⏳ Passo 8 |
| `/api/lojas/*` | API | CRUD + analytics | ⏳ Passo 7 |
| `/admin/lojas` | Admin | Moderação | ⏳ Passo 9 |

### 7.3 Padrões do código

- Server Components para páginas públicas com SEO
- Client Components para interações
- Inline styles com objetos TypeScript
- SVG inline nos ícones (evita quirk Turbopack)
- Null checks defensivos
- `useAppModal` (em `@/components/ui/useAppModal`) em vez de `alert`/`confirm`
- Código entregue **100% completo**, não diffs

---

## 8. Roadmap da feature

### ✅ Concluído

- **Passo 1** — Tabela `lojas` no Supabase
- **Passo 2** — `/lojas` listagem pública
- **Passo 3** — `/lojas/[slug]` página individual
- **Passo 3.5** — Lightbox na galeria
- **Passo 4** — `/minha-loja` painel do lojista

### ⏳ Próximos (ordem revisada)

- **Passo 5** — `/para-lojistas` (landing B2B) — **PRÓXIMO**
- **Passo 6** — AppLayout adaptativo (detecta perfil + adiciona Minha Loja / Guia de Lojas)
- **Passo 7** — APIs `/api/lojas/*` (centraliza CRUD + track)
- **Passo 8** — Integração Stripe (Pro/Premium + avulsas)
- **Passo 9** — `/admin/lojas` (moderação)
- **Passo 10** — Upload de fotos (Supabase Storage)
- **Passo 11** — Analytics + ofertas avulsas

### 🚀 Fase 2 (pós-lançamento)

- Avaliações e reviews
- Cupons exclusivos Bynx
- Integração com coleção do user ("essa loja tem X cartas da sua wishlist")
- Categorias especiais (Liga Pokémon oficial, importadora)

---

## 9. Estratégia de lançamento

### Beta fechado (primeiros 30 lojistas)

- **Pro grátis por 6 meses**
- Contrapartida: feedback + depoimento + aparecer nos cases da landing
- Cria urgência ("restam 23 vagas")

### Early adopters (30–100)

- Preço cheio
- Descontos por indicação: indica outra loja Pro/Premium → 1 mês grátis

### Crescimento sustentado (100+)

- Co-marketing com Premium
- Anúncios geográficos (Google/Meta por cidade)
- Programa de afiliados para influencers

---

## 10. Copy / posicionamento

**Landing principal (`/`):**
> "Colecionadores brasileiros já usam o Bynx. Agora eles encontram sua loja aqui." (link pra `/para-lojistas`)

**Landing B2B (`/para-lojistas`) — hero:**
> "Sua loja no guia mais completo de TCG do Brasil."
> "Milhares de colecionadores usam o Bynx todos os meses. Seja encontrado por quem realmente compra."

**Landing B2B — CTA principal:**
> "Cadastrar minha loja grátis — 14 dias de Pro no trial"

**Guia (`/lojas`) — tagline:**
> "Encontre lojas de TCG do Brasil. Físicas e online, com especialidade em Pokémon, Magic, Yu-Gi-Oh e mais."

**Pitch pro Premium (em `/para-lojistas`):**
> "Premium é pra quem quer ser visto. Sua loja entre as primeiras, com fotos, eventos do mês e analytics de quem te encontrou. R$ 89/mês — menos que 1 cliente novo por mês."

---

## 11. Decisões travadas

| Decisão | Valor | Data |
|---|---|---|
| Básico grátis | Sim | 23/abr/2026 |
| Preço Pro | R$ 39/mês · R$ 390/ano | 23/abr/2026 |
| Preço Premium | R$ 89/mês · R$ 890/ano | 23/abr/2026 |
| Desconto anual | 2 meses grátis (~16%) | 23/abr/2026 |
| Renovação anual 12m+ | 20% off | 23/abr/2026 |
| Trial Pro | 14 dias | 23/abr/2026 |
| Destaque Premium | Diferenciação visual + rotação round-robin | 23/abr/2026 |
| Ofertas avulsas | Destaque evento R$29 / Boost 72h R$19 / Foto extra R$9 | 23/abr/2026 |
| Fotos Pro/Premium | 5 / 10 | 23/abr/2026 |
| Eventos | Exclusivo Premium | 23/abr/2026 |
| Verificação | Manual | 23/abr/2026 |
| Beta fechado | 30 lojistas, Pro grátis 6m | 23/abr/2026 |
| **Arquitetura user↔lojista** | **User único + menu adaptativo** | **23/abr/2026** |
| **Landing B2B dedicada** | **`/para-lojistas`** | **23/abr/2026** |
| **Ordem de entrega** | **Landing primeiro → depois AppLayout adaptativo** | **23/abr/2026** |

---

**Fim do doc master.**
