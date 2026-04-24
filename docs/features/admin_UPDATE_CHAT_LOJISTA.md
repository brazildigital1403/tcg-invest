# Passo 9 — Moderação de Lojas no Admin [CONCLUÍDO E EM PRODUÇÃO]

Este documento resume o que foi construído no Passo 9 (painel de moderação de
lojas dentro do admin). Foi feito no chat dedicado ao admin e já está rodando
em `https://bynx.gg/admin/lojas`, validado end-to-end.

---

## O que foi entregue

### Página `/admin/lojas`

- Listagem com **4 contadores visuais** (Pendentes / Ativas / Suspensas / Inativas)
- Filtros em pílulas por status
- Busca por nome, slug ou cidade
- Banner âmbar de alerta quando há lojas pendentes
- Cards por loja com logo, nome, badges (status/verificada/plano), slug,
  cidade/UF, tipo, owner, data de cadastro
- Destaque visual âmbar pra lojas pendentes
- Ações contextuais por status:
  - **Pendente:** Aprovar / Suspender / Detalhes
  - **Ativa:** Suspender / Verificar (toggle) / Detalhes
  - **Suspensa:** Reativar / Detalhes
  - **Inativa:** Detalhes
- Modal de suspensão com textarea de motivo (mín. 10 chars, máx. 500) + contador
- Modal de detalhes com todos os campos + link pra página pública e perfil do owner
- Paginação
- Item "Lojas" no menu admin (entre Tickets e Usuários)

### APIs criadas

| Método | Rota | Função |
|---|---|---|
| GET  | `/api/admin/lojas` | Lista com filtros + counters |
| POST | `/api/admin/lojas/[id]/approve` | Aprova (pendente/suspensa → ativa) |
| POST | `/api/admin/lojas/[id]/suspend` | Suspende (exige `motivo` mín 10 chars) |
| POST | `/api/admin/lojas/[id]/toggle-verified` | Alterna badge verificada |

Todas protegidas pelo middleware admin (cookie HMAC `bynx_admin`).

**Query string aceita em `GET /api/admin/lojas`:**

```
?status=pendente|ativa|suspensa|inativa
&q=<busca em nome/slug/cidade>
&plano=basico|pro|premium
&verificada=true|false
&page=1
&perPage=50
```

### Emails (adicionados em `src/lib/email.ts`)

- `sendEmailLojaAprovada({ to, nomeUser, nomeLoja, slug })` — disparado
  **apenas na primeira aprovação** (quando `aprovada_data` é nula). Não spamma
  em reativações de lojas que já foram aprovadas antes.
- `sendEmailLojaSuspensa({ to, nomeUser, nomeLoja, motivo })` — disparado
  toda vez que uma loja é suspensa, com o motivo em destaque.

Ambos seguem o mesmo padrão visual dos outros emails do Bynx (`baseLayout`,
`btn`, `h1`, `p`, `divider`, `badge`, `escapeHtml`).

---

## Schema — migration já rodada

```sql
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS suspensao_motivo TEXT,
  ADD COLUMN IF NOT EXISTS suspensao_data   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspenso_por     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovada_data    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprovada_por     UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lojas_status_idx ON public.lojas(status);
CREATE INDEX IF NOT EXISTS lojas_suspensao_data_idx
  ON public.lojas(suspensao_data) WHERE suspensao_data IS NOT NULL;
```

---

## Observações importantes de schema real

Durante a implementação, consultei as colunas reais da tabela `lojas` e
encontrei 2 divergências em relação ao que estava documentado no briefing
que você me passou:

### 1. Nome da coluna de expiração do plano

O briefing mencionava **`trial_expires_at`** — essa coluna **não existe** na
tabela `lojas`. O nome real é **`plano_expira_em`** (TIMESTAMPTZ).

**Sugestão:** atualizar qualquer doc/código futuro que for referenciar esse
campo pra usar `plano_expira_em`.

### 2. Coluna legado `motivo_suspensao`

Existe uma coluna legado chamada **`motivo_suspensao`** (sem underscore no meio
da palavra "suspensão") que está vazia. A migration do Passo 9 criou a
coluna correta **`suspensao_motivo`** (com underscore do jeito certo).

Ambas existem no banco agora. Usei só `suspensao_motivo`. Se em algum momento
for apropriado, dá pra fazer um DROP COLUMN na legado — mas não é bloqueante.

---

## Colunas completas da tabela `lojas` hoje

Caso precise referenciar em Passos futuros:

```
id, slug, nome, descricao, whatsapp, email, website, instagram, facebook,
cidade, estado, endereco, tipo, especialidades, plano, plano_expira_em,
stripe_subscription_id, stripe_customer_id, status, verificada,
motivo_suspensao (LEGADO), logo_url, fotos, meta_title, meta_description,
eventos, visualizacoes, cliques_whatsapp, owner_user_id, created_at, updated_at,
suspensao_motivo, suspensao_data, suspenso_por, aprovada_data, aprovada_por
```

---

## Fluxos validados em produção

As 3 ações críticas foram testadas end-to-end pelo Du:

1. ✅ **Toggle verificada** — botão "Verificar" / "Remover ✓" alterna badge
2. ✅ **Suspender** — modal com motivo, email sai pro owner, loja some do guia
3. ✅ **Reativar** (via Aprovar na tab Suspensas) — loja volta ao guia

---

## O que o Passo 9 NÃO fez (propositalmente)

- **Não mexi em `POST /api/lojas/[id]/track-click`** — isso é responsabilidade
  sua nos passos do Lojista
- **Não criei upload de fotos** — continua sendo Passo 10
- **Não mudei `FormLoja.tsx`** nem `/lojas/[slug]/page.tsx`
- **Não alterei RLS policies da tabela `lojas`** — as APIs admin usam service role,
  não precisam de RLS

---

## Próximo passo sugerido pra você

**Passo 10 — Upload de fotos via Supabase Storage.** Já tem tudo da moderação
pronto, então dá pra começar o upload com tranquilidade sabendo que o admin
consegue aprovar/suspender lojas conforme o conteúdo que os owners subirem.
