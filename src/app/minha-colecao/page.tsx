'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { setLabel } from '@/lib/setLabel'
import { checkCardLimit, LIMITE_FREE, ENFORCEMENT_ATIVO } from '@/lib/checkCardLimit'
import { CAMPO_VALOR } from '@/lib/calcPatrimonio'
import { getUserPlan } from '@/lib/isPro'
import UpgradeBanner from '@/components/ui/UpgradeBanner'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import AtalhoMetas from '@/components/metas/AtalhoMetas'
import AddCardModal from '@/components/dashboard/AddCardModal'
import ScanModal from '@/components/ui/ScanModal'
import { IconKey, IconShield, IconScan, IconSearch, IconDownload, IconLink, IconWarning, IconCheck, IconClose } from '@/components/ui/Icons'
import { useAppModal } from '@/components/ui/useAppModal'
import CardItem, { montarUltimaVenda } from '@/components/ui/CardItem'
import CondicaoEditor from '@/components/dashboard/CondicaoEditor'
import PastaFormModal from '@/components/pastas/PastaFormModal'
import CardDetailModal from '@/components/dashboard/CardDetailModal'
import AnunciarModal from '@/components/marketplace/AnunciarModal'
import CabecalhoSet from '@/components/colecao/CabecalhoSet'
import { familiaDoSet } from '@/lib/setFamilia'
import { getPrecoVariante as faixaVariante } from '@/lib/calcPatrimonio'
import { CONDICAO_KEYS, temCondicao } from '@/lib/condicoes'
import { ehVerificada } from '@/lib/origemCarta'
import { destinoAtual, lerParametro, limparParametros, urlLoginComDestino } from '@/lib/deepLink'

const n = (v: any) => { const f = parseFloat(String(v)); return isNaN(f) ? null : f }

const fmt = (v: any) => {
  const num = n(v)
  if (!num || num <= 0) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

// Faixa da variante, SEM cair pro normal: a Coleção respeita a escolha salva
// pelo usuário e nunca a sobrescreve (ver OpcoesPreco em lib/calcPatrimonio).
// Se ele marcou foil e não há preço foil, mostrar o do normal seria afirmar
// que a foil dele vale o que a comum vale.
function getVariantePrices(price: any, variante: string) {
  if (!price) return { min: null, medio: null, max: null }
  return faixaVariante(price, variante, { fallbackNormal: false })
}

function getVarianteEfetiva(_price: any, varianteSalva: string): string {
  // Sempre respeita a escolha salva pelo usuário — nunca sobrescreve
  return varianteSalva || 'normal'
}

// Variantes disponíveis — só mostra as que têm preço real OU a variante salva
function getVariantesDisponiveis(price: any, varianteSalva?: string) {
  const opts: { key: string; label: string }[] = []

  const hasNormal   = price && (Number(price.preco_normal   || 0) > 0 || Number(price.preco_medio       || 0) > 0)
  const hasFoil     = price && (Number(price.preco_foil     || 0) > 0 || Number(price.preco_foil_medio  || 0) > 0)
  const hasReverse  = price && (Number(price.preco_reverse  || 0) > 0 || Number(price.preco_reverse_medio|| 0) > 0)
  const hasPromo    = price && (Number(price.preco_promo    || 0) > 0 || Number(price.preco_promo_medio  || 0) > 0)
  const hasPokeball = price && (Number(price.preco_pokeball || 0) > 0 || Number(price.preco_pokeball_medio|| 0) > 0)

  // Sempre inclui a variante salva (mesmo sem preço ainda)
  const must = varianteSalva || 'normal'

  if (hasNormal   || must === 'normal')   opts.push({ key: 'normal',   label: 'Normal' })
  if (hasFoil     || must === 'foil')     opts.push({ key: 'foil',     label: 'Foil' })
  if (hasReverse  || must === 'reverse')  opts.push({ key: 'reverse',  label: 'Reverse Foil' })
  if (hasPromo    || must === 'promo')    opts.push({ key: 'promo',    label: 'Promo' })
  if (hasPokeball || must === 'pokeball') opts.push({ key: 'pokeball', label: 'Pokeball Foil' })

  // Garante pelo menos Normal
  if (opts.length === 0) opts.push({ key: 'normal', label: 'Normal' })

  return opts
}

/** Seção da folha de filtros: rótulo pequeno + chips que quebram linha. */
function GrupoFiltro({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--bx-text-3)', margin: '16px 0 9px' }}>{titulo}</p>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

/** Coluna da faixa de filtros do desktop: rótulo + chips que quebram linha. */
function ColunaFiltro({ titulo, rolavel, children }: { titulo: string; rolavel?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--bx-text-3)', margin: '0 0 9px' }}>{titulo}</p>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', ...(rolavel ? { maxHeight: 148, overflowY: 'auto' as const, paddingRight: 4 } : {}) }}>{children}</div>
    </div>
  )
}

/** Chip de opção. Alvo de 38px de altura e 44 de área com o gap da linha. */
function OpcaoFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ minHeight: 38, display: 'inline-flex', alignItems: 'center', padding: '0 13px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background 0.15s ease, border-color 0.15s ease', background: ativo ? 'rgba(245,158,11,0.14)' : 'var(--bx-surface)', border: `1px solid ${ativo ? 'rgba(245,158,11,0.38)' : 'var(--bx-border)'}`, color: ativo ? 'var(--ac-1)' : 'var(--bx-text-2)', fontWeight: ativo ? 700 : 500 }}
    >
      {children}
    </button>
  )
}

export default function MinhaColecao() {
  const { showAlert, showConfirm } = useAppModal()
  const [cards, setCards] = useState<any[]>([])
  const [totalCartas, setTotalCartas] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [limiteCartas, setLimiteCartas] = useState<number>(Infinity)
  const [userId, setUserId] = useState<string | null>(null)
  const [criarPasta, setCriarPasta] = useState(false)
  const router = useRouter()
  const [pastasTopo, setPastasTopo] = useState<any>(null)
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openScanModal, setOpenScanModal] = useState(false)
  const limiteDisplay = (!ENFORCEMENT_ATIVO || limiteCartas === Infinity) ? '∞' : String(limiteCartas)
  const [search, setSearch] = useState('')
  const [filtroVariante, setFiltroVariante] = useState('')
  const [filtroRaridade, setFiltroRaridade] = useState('')
  const [filtroCondicao, setFiltroCondicao] = useState('')
  const [filtroGraduada, setFiltroGraduada] = useState(false)
  const [ordenacao, setOrdenacao] = useState<'az' | 'za' | 'recente' | 'antiga' | 'numero' | 'numero_desc' | 'valor_asc' | 'valor_desc'>('recente')
  const [loading, setLoading] = useState(true)
  // ★ O lookup de preco falhando NAO pode virar colecao sem valor em silencio.
  //   Os 3 fetches terminavam em `.catch(() => [])`: um 429 (o limite e 60/min
  //   por IP, e 10% das cartas da base entram em rajada de 20+ num minuto)
  //   devolvia a colecao inteira com patrimonio R$ 0 e nenhum erro na tela.
  //   Mesma assinatura do incidente da Pokedex: falha virando vazio valido.
  const [precosFalharam, setPrecosFalharam] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  // ★ Item 9. A primeira dor do estudo foi "ficar abrindo aba por aba e nao
  //   ver todas as cartas". O item 6 aliviou abrindo por orcamento, mas quem
  //   tem 86 sets continua precisando tocar em cabecalho. "Tudo" joga fora o
  //   agrupamento e devolve uma grade continua, na ordem que estiver escolhida.
  const [vista, setVista] = useState<'sets' | 'tudo'>('sets')
  // ★ A V1 foi desenhada para 375px e aplicada igual nos dois tamanhos. No
  //   desktop a conta inverte: a linha tem 1.244px e os controles abertos
  //   pedem 867 -- sobram 377. Em vez de folha de rodape (que la ocupava
  //   1512x570, 78% da tela), o botao abre uma faixa no proprio fluxo, em 4
  //   colunas, empurrando a grade. Mesmo padrao de deteccao do AddCardModal.
  const [isMobile, setIsMobile] = useState(false)
  // Houve gravacao no modal? So entao o fechamento reconcilia com o servidor.
  // Ref, nao state: o modal chama onAdded e onClose no mesmo tick.
  const reconciliarRef = useRef(false)
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<{ usd: number; eur: number }>({ usd: 6.0, eur: 6.5 })
  const [detalheCard, setDetalheCard] = useState<any>(null)
  const [anunciarCard, setAnunciarCard] = useState<any>(null)
  // Logo e simbolo por set_id, pro cabecalho de cada grupo (#313).
  const [setsInfo, setSetsInfo] = useState<Record<string, { logo_url: string | null; symbol_url: string | null; total: number | null }>>({})
  // Grupo que a pessoa abriu ou fechou a mao. O que nao esta aqui segue o
  // padrao: primeiro set aberto, ou todos abertos com filtro ativo.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})

  const LOADING_MSGS = [
    'Procurando a carta...',
    'Buscando preços de mercado...',
    'Varrendo o mercado TCG...',
    'Consultando preços das cartas...',
    'Calculando o valor do patrimônio...',
    'Analisando variações de mercado...',
    'Consultando fontes de preços...',
    'Analisando Normal, Foil e Promo...',
  ]
  const [importing, setImporting] = useState(false)
  const [importingMsg, setImportingMsg] = useState('')

  const SECS_PER_CARD = 6

  function handleExportCSV() {
    if (isPro) {
      const rows = [
        ['Nome', 'Número', 'Set', 'Variante', 'Raridade', 'Qtd', 'Preço Mín', 'Preço Médio', 'Preço Máx', 'Valor Total (R$)', 'Link', 'Adicionada em'],
        ...cards.map(c => {
          const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
          const p = c.price
          const precos = !p ? { min: 0, medio: 0, max: 0 }
            : variante === 'foil'     ? { min: p.preco_foil_min || 0, medio: p.preco_foil_medio || 0, max: p.preco_foil_max || 0 }
            : variante === 'promo'    ? { min: p.preco_promo_min || 0, medio: p.preco_promo_medio || 0, max: p.preco_promo_max || 0 }
            : variante === 'reverse'  ? { min: p.preco_reverse_min || 0, medio: p.preco_reverse_medio || 0, max: p.preco_reverse_max || 0 }
            : variante === 'pokeball' ? { min: p.preco_pokeball_min || 0, medio: p.preco_pokeball_medio || 0, max: p.preco_pokeball_max || 0 }
            : { min: p.preco_min || 0, medio: p.preco_medio || 0, max: p.preco_max || 0 }
          const qty = c.quantity || 1
          // Coluna "Valor Total" segue CAMPO_VALOR, igual ao resto da plataforma.
          // Antes usava `medio`: o arquivo que o assinante Pro baixava nao batia
          // com nenhum numero da tela de onde ele saiu.
          const valorTotal = (precos[CAMPO_VALOR] * qty).toFixed(2).replace('.', ',')
          const numMatch = c.card_name?.match(/\(([^)]+)\)/)
          const addedAt = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : ''
          const fmtPreco = (v: number) => v > 0 ? v.toFixed(2).replace('.', ',') : ''
          return [
            c.card_name?.replace(/\s*\([^)]*\)/, '').trim() || '',
            numMatch?.[1] || '',
            setLabel(c.set_name) || '',
            variante.charAt(0).toUpperCase() + variante.slice(1),
            c.rarity || '',
            qty,
            fmtPreco(precos.min),
            fmtPreco(precos.medio),
            fmtPreco(precos.max),
            valorTotal,
            // ★ 12/09: esta coluna FALTAVA. O cabecalho declara 12 colunas com
            // 'Link' na 11a posicao, e o corpo emitia 11 pulando direto pro
            // addedAt -- entao TODO CSV exportado saia com a data embaixo de
            // "Link", e as duas ultimas colunas desalinhadas em relacao ao
            // titulo. Nao era coluna a menos: era dado na coluna errada, num
            // arquivo que so o assinante Pro baixa.
            // O slug ja vinha no payload: CARD_FIELDS do /api/cards/lookup o
            // inclui desde 04/09, com o comentario "sem ele quem consome o
            // lookup nao consegue LINKAR a carta".
            c.price?.slug ? `https://bynx.gg/carta/${c.price.slug}` : '',
            addedAt,
          ]
        })
      ]
      const csv = '\uFEFF' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bynx-colecao-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      showAlert('Exportar CSV é exclusivo do plano Pro. Acesse Minha Conta para fazer upgrade.', 'warning')
    }
  }

  function handleExportPDF() {
    if (!isPro) {
      showAlert('Exportar PDF é exclusivo do plano Pro. Acesse Minha Conta para fazer upgrade.', 'warning')
      return
    }
    const totalMedio = totais.valor
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const variantLabel: Record<string, string> = { normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil' }

    // Usa a mesma resolucao de variante do resto da tela e o campo que
    // CAMPO_VALOR define -- antes montava a cascata na mao sobre `_medio`,
    // e o PDF saia com numero que nao existia em nenhuma outra tela.
    const rows = cards.map(c => {
      const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
      const unit = getVariantePrices(c.price, variante)[CAMPO_VALOR] || 0
      const total = unit * (c.quantity || 1)
      return { name: c.card_name || '', variante, rarity: c.rarity || '—', qty: c.quantity || 1, medio: unit, total, image: c.card_image }
    }).sort((a, b) => b.total - a.total)

    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Bynx — Minha Coleção</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 3px solid #f59e0b; }
  /* Logo com fundo escuro de proposito (#43): o logo_BYNX.png tem o "BYNX"
     branco e sumiria no papel. URL absoluta porque o HTML roda numa janela
     nova (window.open), sem base. print-color-adjust mantem o fundo na impressao. */
  .logo { height: 44px; width: auto; border-radius: 8px; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .subtitle { font-size: 13px; color: #888; margin-top: 4px; }
  .stats { display: flex; gap: 24px; margin-bottom: 28px; }
  .stat { background: #f9f9f9; border-radius: 10px; padding: 14px 20px; border: 1px solid #eee; }
  .stat-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }
  .stat-value { font-size: 20px; font-weight: 800; color: #f59e0b; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #111; color: #fff; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--bx-text); vertical-align: middle; }
  tr:hover td { background: #fafafa; }
  .card-img { width: 28px; height: 39px; object-fit: cover; border-radius: 3px; vertical-align: middle; margin-right: 8px; }
  .badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 10px; background: #f59e0b22; color: #b45309; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #bbb; border-top: 1px solid #eee; padding-top: 16px; }
  .total-row td { font-weight: 800; background: #f9f9f9; border-top: 2px solid #111; }
  @media print { body { padding: 20px; } }
  @media (min-width: 640px) { .md-row { flex-direction: row !important; align-items: flex-start !important; } }
  @media (max-width: 639px) {
    .p-6 { padding: 16px 0 !important; }
    .colecao-titulo { font-size: 22px !important; }
    .colecao-botoes button { font-size: 13px !important; padding: 10px 14px !important; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <img class="logo" src="${window.location.origin}/logo_BYNX_rodape.png" alt="Bynx" />
    <div class="subtitle">Relatório da Coleção Pokémon TCG · ${date}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:22px;font-weight:900;color:#f59e0b">${fmtBRL(totalMedio)}</div>
    <div style="font-size:11px;color:#888">Patrimônio estimado (médio)</div>
  </div>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-label">Total de cartas</div>
    <div class="stat-value">${cards.reduce((a, c) => a + (c.quantity || 1), 0)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Tipos únicos</div>
    <div class="stat-value">${cards.length}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Mais valiosa</div>
    <div class="stat-value" style="font-size:13px">${rows[0]?.name?.replace(/\s*\([^)]*\)/, '') || '—'}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Valor mínimo</div>
    <div class="stat-value">${fmtBRL(totais.min)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Valor máximo</div>
    <div class="stat-value">${fmtBRL(totais.max)}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th colspan="2">Carta</th>
      <th>Variante</th>
      <th>Raridade</th>
      <th>Qtd</th>
      <th>Preço Médio</th>
      <th>Total</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map(r => `
    <tr>
      <td style="width:36px;padding-right:0">
        ${r.image ? `<img src="${r.image}" class="card-img" />` : '<span style="font-size:20px">🃏</span>'}
      </td>
      <td style="font-weight:600">${r.name}</td>
      <td><span class="badge">${variantLabel[r.variante] || r.variante}</span></td>
      <td style="color:#888">${r.rarity}</td>
      <td style="text-align:center">${r.qty}</td>
      <td style="text-align:right">${r.medio > 0 ? fmtBRL(r.medio) : '—'}</td>
      <td style="text-align:right;font-weight:700;color:${r.total > 0 ? '#111' : '#ccc'}">${r.total > 0 ? fmtBRL(r.total) : '—'}</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="5">Total da coleção</td>
      <td></td>
      <td>${fmtBRL(totalMedio)}</td>
    </tr>
  </tbody>
</table>

<div class="footer">Gerado pela Bynx · bynx.gg · ${date}</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { showAlert('Permita popups para exportar o PDF.', 'warning'); return }
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  // ★ Carta adicionada entra na lista ONDE A PESSOA ESTA. Antes, cada carta
  //   gravada disparava window.location.reload(): a colecao sumia atras de
  //   "Carregando colecao...", o scroll ia pro topo, filtro e sets abertos
  //   eram zerados, e o lookup reenviava a colecao inteira de ids (O(n) por
  //   carta). Em sessao de 20 cartas -- 21% dos dias de cadastro -- eram 20
  //   recargas e ate 60 POSTs contra um limite de 60/min.
  //   O refetch acontece UMA vez, no fechamento do modal (`reconciliarRef`),
  //   que e onde o preco definitivo e o "sob revisao" chegam.
  function aplicarNovas(linhas?: any[]) {
    if (!linhas?.length) return
    setCards((prev) => {
      const porId = new Map(prev.map((c: any) => [c.id, c]))
      const novas: any[] = []
      for (const l of linhas) {
        const price = l.__price || porId.get(l.id)?.price || null
        const { __price, ...linha } = l
        const montada = {
          ...(porId.get(l.id) || {}),
          ...linha,
          price,
          number: price?.number || linha.number || porId.get(l.id)?.number || null,
          set_total: price?.set_total || linha.set_total || porId.get(l.id)?.set_total || null,
          ultima_venda: montarUltimaVenda(price || {}),
        }
        if (porId.has(l.id)) porId.set(l.id, montada)
        else novas.push(montada)
      }
      const atualizadas = prev.map((c: any) => porId.get(c.id) || c)
      const proxima = [...novas, ...atualizadas]
      // Fora do updater: ler `cards` desta closure daria o valor velho.
      queueMicrotask(() => setTotalCartas(proxima.length))
      return proxima
    })
  }

  // Uma falha aqui e um fato pro usuario, nao um array vazio: quem chama marca
  // `falhou` e a tela avisa, em vez de exibir a colecao sem preco nenhum.
  async function buscarPrecos(body: Record<string, unknown>): Promise<any[]> {
    const r = await fetch('/api/cards/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`lookup ${r.status}`)
    const d = await r.json()
    return d.cards || []
  }

  async function loadCards() {
    let precoFalhou = false
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) { window.location.href = urlLoginComDestino(destinoAtual()); return }

      setUserId(userData.user.id)
      const { isPro: pro, isTrial: trial, caps } = await getUserPlan(userData.user.id)
      setIsPro(pro || trial)
      setLimiteCartas(caps.limiteCartas)

      // S40: Pastas em destaque no topo da colecao (hero + grade)
      supabase.rpc('pastas_colecao_topo').then(({ data: pt }) => setPastasTopo(pt || null))

      const { data } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })

      const cardsData = data || []



      const priceById: any   = {}
      const priceByLink: any = {}

      // ── 1. Lookup por pokemon_api_id (novo AddCardModal — mais preciso) ──
      const apiIds = [...new Set(cardsData.map((c: any) => c.pokemon_api_id).filter(Boolean))]
      if (apiIds.length > 0) {
        try {
          const byId = await buscarPrecos({ ids: apiIds })
          byId.forEach((p: any) => { priceById[p.id] = p })
        } catch (e: any) {
          precoFalhou = true
          console.error('[minha-colecao] lookup por id falhou:', e?.message || e)
        }
      }

      // ── 2. Lookup por liga_link (cartas antigas importadas por link) ──
      const allLinks = [...new Set(cardsData.map((c: any) => c.card_link).filter(Boolean))]
      if (allLinks.length > 0) {
        try {
          const byLink = await buscarPrecos({ liga_links: allLinks })
          byLink.forEach((p: any) => {
            if (p.liga_link) priceByLink[p.liga_link] = p
          })
        } catch (e: any) {
          precoFalhou = true
          console.error('[minha-colecao] lookup por link falhou:', e?.message || e)
        }
      }

      // ── 3. Fallback por nome (cartas sem api_id nem liga_link) ──
      const legacyCards = cardsData.filter((c: any) => !c.pokemon_api_id && !c.card_link)
      const priceByName: any = {}
      if (legacyCards.length > 0) {
        const cleanEN = (n: string) => {
          const s = (n || '').replace(/\s*\([^)]*\)?\s*$/, '').trim()
          return s.includes(' / ') ? (s.split(' / ').pop()?.trim() || s) : s
        }
        const cleanPT = (n: string) => {
          const s = (n || '').replace(/\s*\([^)]*\)?\s*$/, '').trim()
          return s.includes(' / ') ? (s.split(' / ')[0]?.trim() || s) : s
        }
        // Chunk de 50 nomes para evitar URL longa
        const names = [...new Set(legacyCards.flatMap((c: any) =>
          [cleanEN(c.card_name), cleanPT(c.card_name)].filter(Boolean)
        ))].slice(0, 50)
        if (names.length > 0) {
          try {
            const byName = await buscarPrecos({ names })
            byName.forEach((p: any) => {
              const k = p.name?.trim()
              if (!priceByName[k]) priceByName[k] = p
            })
          } catch (e: any) {
            precoFalhou = true
            console.error('[minha-colecao] lookup por nome falhou:', e?.message || e)
          }
        }
        legacyCards.forEach((c: any) => {
          const en = cleanEN(c.card_name)
          const pt = cleanPT(c.card_name)
          if (!priceByName[en] && !priceByName[pt]) return
          priceByLink[`legacy:${c.id}`] = priceByName[en] || priceByName[pt]
        })
      }

      // ── Resolve preço de cada carta ──
      const getPrice = (c: any) => {
        if (c.pokemon_api_id && priceById[c.pokemon_api_id]) return priceById[c.pokemon_api_id]
        if (c.card_link && priceByLink[c.card_link]) return priceByLink[c.card_link]
        return priceByLink[`legacy:${c.id}`] || null
      }

      const merged = cardsData.map((c: any) => {
        const price = getPrice(c)
        return {
          ...c,
          price,
          number: price?.number || c.number || null,
          set_total: price?.set_total || c.set_total || null,
          ultima_venda: montarUltimaVenda(price || {}),
        }
      })

      setCards(merged)
      setTotalCartas(merged.length)

      // Logos dos sets em uma consulta so. Nao segura a tela: o cabecalho
      // mostra o icone ate chegar, e 30% das cartas nao tem logo cadastrado.
      // Inclui os outros set_ids da familia: quem so tem a carta PT do Chaos
      // Rising tambem ve o logo, que no catalogo esta no set ingles.
      const setIds = [...new Set(merged.flatMap((c: any) => {
        const id = c.price?.set_id
        return id ? (familiaDoSet(id)?.sets || [id]) : []
      }))] as string[]
      if (setIds.length > 0) {
        supabase.from('pokemon_sets').select('id, logo_url, symbol_url, total').in('id', setIds)
          .then(({ data: sd }) => setSetsInfo(Object.fromEntries((sd || []).map((x: any) => [x.id, { logo_url: x.logo_url, symbol_url: x.symbol_url, total: x.total ?? null }]))))
      }
    } catch (err: any) {
      console.error('[minha-colecao] loadCards error:', err?.message || err)
    } finally {
      setPrecosFalharam(precoFalhou)
      setLoading(false)
    }
  }

  async function handleVarianteChange(card: any, novaVariante: string) {
    const { error } = await supabase
      .from('user_cards')
      .update({ variante: novaVariante })
      .eq('id', card.id)

    if (!error) {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, variante: novaVariante } : c))
    }
  }

  async function handleIdiomaChange(card: any, novoIdioma: string) {
    const { error } = await supabase
      .from('user_cards')
      .update({ idioma: novoIdioma })
      .eq('id', card.id)

    if (!error) {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, idioma: novoIdioma } : c))
    }
  }

  async function handleUpdateQuantity(card: any, delta: number) {
    const newQty = (card.quantity || 1) + delta
    if (newQty <= 0) { await handleRemove(card.id, card.card_name); return }
    const { error } = await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
    if (error) { showAlert('Erro ao atualizar quantidade.', 'error'); return }
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
  }

  async function handleSetQuantity(card: any, novaQty: number) {
    if (novaQty < 1) return
    const { error } = await supabase.from('user_cards').update({ quantity: novaQty }).eq('id', card.id)
    if (error) { showAlert('Erro ao atualizar quantidade.', 'error'); return }
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: novaQty } : c))
  }

  async function handleRemove(id: string, cardName?: string) {
    const confirmed = await showConfirm({
      message: `Tem certeza que deseja remover "${cardName || 'esta carta'}" da sua coleção? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Sim, remover',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!confirmed) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data, error } = await supabase.from('user_cards').delete()
      .eq('id', id).eq('user_id', userData.user.id).select()
    if (error) { showAlert('Erro ao remover a carta.', 'error'); return }
    if (!data || data.length === 0) { showAlert('Nada foi deletado. Verifique as políticas RLS no Supabase.', 'warning'); return }
    setCards(prev => prev.filter(c => c.id !== id))
  }

  useEffect(() => { loadCards() }, [])

  // O FAB do chat (ChatDock) mora no mesmo canto: right 16, bottom 84. Ele so
  // aparece aqui quando ha mensagem nao lida, mas quando aparece os dois se
  // cobrem. Esta classe no body desloca o do chat pro lado -- lado a lado
  // somam 124px dos 375 e cabem folgados.
  useEffect(() => {
    document.body.classList.add('bx-fab-add')
    return () => document.body.classList.remove('bx-fab-add')
  }, [])

  // Set que a pessoa abriu ou fechou a mao sobrevive a recarga. Antes nao
  // sobrevivia nem ao proprio app: cada carta adicionada recarregava a pagina
  // e devolvia todos os grupos ao padrao. try/catch porque aba privada pode
  // recusar o storage -- e aqui ficar sem preferencia nao pode quebrar a tela.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('bx-colecao-abertos')
      if (salvo) setAbertos(JSON.parse(salvo))
      const v = localStorage.getItem('bx-colecao-vista')
      if (v === 'tudo' || v === 'sets') setVista(v)
    } catch { /* sem preferencia, segue no padrao */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('bx-colecao-vista', vista) } catch { /* idem */ }
  }, [vista])
  useEffect(() => {
    function medir() { setIsMobile(window.innerWidth <= 768) }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  useEffect(() => {
    try {
      if (Object.keys(abertos).length) localStorage.setItem('bx-colecao-abertos', JSON.stringify(abertos))
    } catch { /* idem */ }
  }, [abertos])

  // Deep link dos e-mails da regua (E02, E05): /minha-colecao?scan=1 abre o
  // Scan IA direto, no mesmo modal do botao "Escanear foto". Espera o userId
  // (o modal precisa dele) e tira o parametro da URL: recarregar nao reabre.
  useEffect(() => {
    if (!userId || lerParametro('scan') !== '1') return
    limparParametros('scan')
    setOpenScanModal(true)
  }, [userId])
  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => setExchangeRate({ usd: d.usd || 6.0, eur: d.eur || 6.5 }))
      .catch(() => {})
  }, [])

  // Melhor preço disponível: BRL real → USD convertido → EUR convertido
  function getBestPrice(card: any): { valor: number; tipo: 'brl' | 'usd' | 'eur' } | null {
    const p = card.price
    const rate = exchangeRate
    const variante = card.variante || 'normal'

    if (!p) return null

    // 1. BRL real da Liga — respeita variante
    const precoBRL = parseFloat(
      (variante === 'foil'      ? (p.preco_foil || p.preco_normal)
      : variante === 'reverse'  ? (p.preco_reverse || p.preco_normal)
      : variante === 'promo'    ? (p.preco_promo || p.preco_normal)
      : variante === 'pokeball' ? (p.preco_pokeball || p.preco_normal)
      : p.preco_normal) || 0
    )
    if (precoBRL > 0) return { valor: precoBRL, tipo: 'brl' }

    // 2. USD convertido — foil usa price_usd_holofoil quando disponível
    const usdFoil   = parseFloat(p.price_usd_holofoil || 0)
    const usdNormal = parseFloat(p.price_usd_normal || 0)
    const usdReverse = parseFloat(p.price_usd_reverse || 0)

    let usdValor = 0
    if (variante === 'foil' && usdFoil > 0)        usdValor = usdFoil
    else if (variante === 'reverse' && usdReverse > 0) usdValor = usdReverse
    else usdValor = Math.max(usdNormal, usdFoil)

    if (usdValor > 0) return { valor: usdValor * rate.usd, tipo: 'usd' }

    // 3. EUR convertido
    const eurValor = Math.max(
      parseFloat(p.price_eur_normal || 0),
      parseFloat(p.price_eur_holofoil || 0)
    )
    if (eurValor > 0) return { valor: eurValor * rate.eur, tipo: 'eur' }

    return null
  }




  if (loading) {
    return <AppLayout><div>Carregando coleção...</div></AppLayout>
  }

  // ✅ Total real de cartas (soma de quantities, não count de tipos)
  const totalQty = cards.reduce((s, c) => s + (c.quantity || 1), 0)

  // Cartas verificadas: as que vieram do Scan ou de compra paga na Bynx.
  // ★ CONTA LINHAS, como o resto deste cabecalho e como o perfil publico --
  // a mesma conta em dois lugares diverge na hora que uma soma `quantity` e
  // a outra nao.
  const verificadas = cards.filter(c => ehVerificada(c.origem)).length

  // ✅ Totais da carteira baseados na VARIANTE selecionada de cada carta.
  //
  // `sobRevisao` acompanha quanto do total vem de carta marcada pelo guard
  // (preco_nao_confiavel, do /api/cards/lookup). A carta CONTINUA somando --
  // decisao do Du -- mas o usuario ve a proporcao, porque ela costuma nao ser
  // pequena: ha quem tenha 4 cartas e uma delas responda por 97% do total.
  // ★ `valor` segue CAMPO_VALOR (a mesma constante que o PATRIMONIO do topo usa
  // via calcPatrimonio). Antes este bloco somava `medio` fixo enquanto o topo
  // somava `min`: a MESMA tela exibia dois patrimonios, e o card inflava 44,8%
  // sobre a base toda. A legenda ja dizia "Menor preco de mercado" -- a copy
  // tinha migrado na virada de 25/08 e a conta nao.
  const totais = cards.reduce((acc, c) => {
    const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
    const p = getVariantePrices(c.price, variante)
    const qty = c.quantity || 1
    const val = (p[CAMPO_VALOR] || 0) * qty
    const suspeita = !!c.price?.preco_nao_confiavel
    return {
      valor: acc.valor + val,
      min: acc.min + (p.min || 0) * qty,
      medio: acc.medio + (p.medio || 0) * qty,
      max: acc.max + (p.max || 0) * qty,
      sobRevisao: acc.sobRevisao + (suspeita ? val : 0),
      qtdSobRevisao: acc.qtdSobRevisao + (suspeita && val > 0 ? 1 : 0),
    }
  }, { valor: 0, min: 0, medio: 0, max: 0, sobRevisao: 0, qtdSobRevisao: 0 })

  const pctSobRevisao = totais.valor > 0 ? (totais.sobRevisao / totais.valor) * 100 : 0

  // Estimativa USD para cartas sem preço BRL
  const usdEstimado = cards.reduce((acc, c) => {
    const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
    const p = getVariantePrices(c.price, variante)
    if ((p.medio || 0) > 0) return acc  // já tem BRL — ignora
    const price = c.price
    if (!price) return acc
    const usd = variante === 'foil'
      ? parseFloat(price.price_usd_holofoil || 0) || parseFloat(price.price_usd_normal || 0)
      : parseFloat(price.price_usd_normal || 0) || parseFloat(price.price_usd_holofoil || 0)
    const qty = c.quantity || 1
    return { valor: acc.valor + usd * exchangeRate.usd * qty, count: acc.count + (usd > 0 ? qty : 0) }
  }, { valor: 0, count: 0 })

  // ── Filtro local ────────────────────────────────────────────────────────────
  const filteredCards = cards.filter(c => {
    const matchSearch = !search || c.card_name?.toLowerCase().includes(search.toLowerCase())
    const matchVariante = !filtroVariante || (c.variante || 'normal') === filtroVariante
    const matchRaridade = !filtroRaridade || c.rarity === filtroRaridade
    const matchCondicao = !filtroCondicao || temCondicao(c.condicoes, filtroCondicao)
    const matchGraduada = !filtroGraduada || !!c.graduada
    return matchSearch && matchVariante && matchRaridade && matchCondicao && matchGraduada
  }).sort((a, b) => {
    switch (ordenacao) {
      case 'az':      return (a.card_name || '').localeCompare(b.card_name || '')
      case 'za':      return (b.card_name || '').localeCompare(a.card_name || '')
      case 'antiga':  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      case 'numero': {
        const getNum = (name: string) => {
          const m = name?.match(/\(([^/)]+)/)
          return m ? parseInt(m[1]) || 0 : 0
        }
        return getNum(a.card_name) - getNum(b.card_name)
      }
      case 'numero_desc': {
        const getNum = (name: string) => {
          const m = name?.match(/\(([^/)]+)/)
          return m ? parseInt(m[1]) || 0 : 0
        }
        return getNum(b.card_name) - getNum(a.card_name)
      }
      case 'valor_desc':
      case 'valor_asc': {
        const valMedio = (c: any) => getVariantePrices(c.price, getVarianteEfetiva(c.price, c.variante || 'normal'))[CAMPO_VALOR] || 0
        return ordenacao === 'valor_asc' ? valMedio(a) - valMedio(b) : valMedio(b) - valMedio(a)
      }
      default: return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    }
  })

  // Raridades únicas da coleção
  const raridades = [...new Set(cards.map(c => c.rarity).filter(Boolean))] as string[]

  // ── Agrupamento por set (#313) ──────────────────────────────────────────────
  // Chave e o set_id do catalogo, nao o nome: 99,6% das cartas tem (medido em
  // 12/09). O 100% da barra e o total COM secretas de pokemon_sets (#505, 12/10);
  // o set_total da carta e o IMPRESSO e so entra como fallback, porque os sets
  // do fornecedor BR (587 em 11/10) nao tem linha em pokemon_sets.
  // As 27 sem set caem num grupo pelo nome gravado na user_card.
  //
  // ★ O PROGRESSO sai da colecao inteira (`cards`); o que o filtro muda e so
  // quais grupos e cartas aparecem. Filtrar por Foil nao pode derrubar a barra.
  //
  // ★ FAMILIA (13/09). O mesmo set pode ter mais de um set_id: PT e EN do
  // Chaos Rising, ou o mesmo set importado duas vezes. Vira UM grupo, com o
  // nome da familia, e a carta conta pelo NUMERO -- a 010 em portugues e a 010
  // em ingles sao a mesma posicao do set, e "001" e "1" tambem.
  const chaveSet = (c: any): string => {
    const id = c.price?.set_id
    if (!id) return `nome:${c.set_name || ''}`
    return familiaDoSet(id)?.chave || id
  }
  const posicao = (c: any): string => {
    const num = String(c.number ?? '').trim().toLowerCase().replace(/^0+(?=\d)/, '')
    return num ? `n:${num}` : `id:${c.pokemon_api_id || c.card_link || c.id}`
  }
  const resumoSets = new Map<string, { setIds: string[]; nome: string; total: number | null; ids: Set<string>; valor: number }>()
  for (const c of cards) {
    const k = chaveSet(c)
    const fam = familiaDoSet(c.price?.set_id)
    let r = resumoSets.get(k)
    if (!r) {
      r = {
        // A chave da familia e o id oficial: vem primeiro na busca do logo.
        setIds: fam ? [fam.chave, ...fam.sets.filter(s => s !== fam.chave)] : (c.price?.set_id ? [c.price.set_id] : []),
        nome: fam?.nome || setLabel(c.price?.set_name || c.set_name) || 'Sem set',
        total: null, ids: new Set(), valor: 0,
      }
      resumoSets.set(k, r)
    }
    // Fallback quando o set nao esta em pokemon_sets: o maior set_total da familia.
    const t = n(c.set_total)
    if (t && (!r.total || t > r.total)) r.total = t
    r.ids.add(posicao(c))
    r.valor += (getVariantePrices(c.price, getVarianteEfetiva(c.price, c.variante || 'normal'))[CAMPO_VALOR] || 0) * (c.quantity || 1)
  }

  // A ordem dos grupos SEGUE a ordenacao escolhida: cada set entra na posicao
  // da sua primeira carta. Em "Mais recente" o topo e o set da ultima carta
  // adicionada; em "Maior valor", o da carta mais cara. Dentro do grupo a
  // ordem e a mesma -- nenhuma ordenacao desfaz o agrupamento.
  const grupos: Array<{ key: string; cards: any[] }> = []
  const posGrupo = new Map<string, number>()
  for (const c of filteredCards) {
    const k = chaveSet(c)
    if (!posGrupo.has(k)) { posGrupo.set(k, grupos.length); grupos.push({ key: k, cards: [] }) }
    grupos[posGrupo.get(k)!].cards.push(c)
  }
  const filtroAtivo = !!(search || filtroVariante || filtroRaridade || filtroCondicao || filtroGraduada)
  // A busca tem campo proprio e nao entra na conta do botao.
  const qtdFiltros = [filtroRaridade, filtroVariante, filtroCondicao, filtroGraduada].filter(Boolean).length
  function limparFiltros() {
    setFiltroRaridade(''); setFiltroVariante(''); setFiltroCondicao(''); setFiltroGraduada(false)
  }

  // ★ Abrir "o primeiro grupo" (i === 0) foi dimensionado contra quem tem 100
  //   sets -- mas 75% dos grupos set x usuario da base tem no maximo 2 cartas,
  //   e a mediana e UMA. O acordeao estava criando aba para esconder 1 carta:
  //   uma colecao de 422 cartas abria com 3 na tela e 82 cabecalhos fechados.
  //   Agora o padrao abre grupos ENQUANTO COUBER no orcamento -- quem tem
  //   pouco por set ve a colecao inteira, e quem tem um set gigante continua
  //   com ele sozinho aberto, que era o que o #313 queria proteger.
  const ORCAMENTO_ABERTURA = 24
  const abertoPadrao: Record<string, boolean> = {}
  {
    let soma = 0
    for (const g of grupos) {
      const cabe = soma < ORCAMENTO_ABERTURA
      abertoPadrao[g.key] = cabe
      if (cabe) soma += g.cards.length
    }
  }
  // ★ Quantas pilhas a MESMA carta tem na colecao. Desde 15/10 foil, reverse e
  //   idiomas diferentes sao linhas proprias: dois cartoes ficam com nome,
  //   numero, arte e selo de idioma iguais, e o unico sinal era o ponto de 7px
  //   na mini-tabela. Quem tem duas ou mais ganha a variante escrita.
  //   Graduada fica de fora da conta: ela ja se distingue pela tarja da
  //   graduadora no topo do cartao.
  const pilhasPorCarta = new Map<string, number>()
  for (const c of cards) {
    if (c.graduada) continue
    const k = c.pokemon_api_id || c.card_id
    if (k) pilhasPorCarta.set(k, (pilhasPorCarta.get(k) || 0) + 1)
  }

  // A quarta fileira do celular (2 colunas) e onde a oferta entra na vista plana.
  const POSICAO_OFERTA = 8
  const renderCarta = (c: (typeof filteredCards)[number]) => (
    <CardItem
      key={c.id}
      card={c}
      mode="collection"
      onSelect={() => setDetalheCard(c)}
      variante={c.variante || 'normal'}
      marcarVariante={!c.graduada && (pilhasPorCarta.get(c.pokemon_api_id || c.card_id) || 0) > 1}
      exchangeRate={exchangeRate}
      onVarianteChange={(v) => handleVarianteChange(c, v)}
      onQuantityChange={(delta) => handleUpdateQuantity(c, delta)}
      footerSlot={<CondicaoEditor userCardId={c.id} quantity={c.quantity || 1} condicoes={c.condicoes || null} isPro={isPro} onSaved={(novas) => setCards(prev => prev.map(x => x.id === c.id ? { ...x, condicoes: novas } : x))} />}
    />
  )

  const todosAbertos = grupos.length > 0 && grupos.every(g => (g.key in abertos ? abertos[g.key] : (filtroAtivo || abertoPadrao[g.key])))
  function alternarTodos(abrir: boolean) {
    setAbertos(Object.fromEntries(grupos.map(g => [g.key, abrir])))
  }

  return (
    <AppLayout>
      {/* Loading overlay para importação */}
      {importing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
        }}>
          {/* Pokébola animada */}
          <div style={{ animation: 'spin 1.2s linear infinite', width: 72, height: 72 }}>
            <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
              <circle cx="36" cy="36" r="34" fill="#fff" stroke="#222" strokeWidth="3"/>
              <path d="M2 36 Q2 2 36 2 Q70 2 70 36Z" fill="#e53e3e"/>
              <rect x="2" y="33" width="68" height="6" fill="#222"/>
              <circle cx="36" cy="36" r="10" fill="#fff" stroke="#222" strokeWidth="3"/>
              <circle cx="36" cy="36" r="5" fill="var(--bx-text)" stroke="#888" strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{
            background: 'var(--bx-surface-2)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 20, padding: '28px 40px', maxWidth: 420, textAlign: 'center',
          }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
              Importando carta...
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, transition: 'all 0.5s' }}>
              {importingMsg}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
              {(() => {
                const secs = importingTotal * SECS_PER_CARD
                const timeStr = secs >= 60
                  ? `~${Math.floor(secs / 60)}min${secs % 60 > 0 ? ` ${secs % 60}s` : ''}`
                  : secs > 0 ? `~${secs}s` : ''
                return `Aguarde${timeStr ? `, estimado ${timeStr}` : ''}`
              })()}
            </p>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      <div>

        {/* Onboarding */}

        {/* Header — padrao do app, ver src/components/ui/PageHeader.tsx */}
        <PageHeader
          trilha={[INICIO, { name: 'Coleção', href: '/minha-colecao' }]}
          titulo="Minha Coleção"
          descricao="Tudo que você tem, com o valor de mercado atualizado."
          selo={
            ENFORCEMENT_ATIVO && cards.length >= limiteCartas ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                Limite atingido ({cards.length}/{limiteDisplay})
              </span>
            ) : (
              <span
                /* ★ Desde 15/10 foil, reverse e idiomas diferentes sao linhas
                   proprias, e o gatilho do banco conta linhas: guardar a foil
                   E a normal da mesma carta gasta duas vagas. Decisao do Du
                   em 15/10 -- a segunda pilha custa vaga mesmo. O texto antigo
                   dizia so "cartas diferentes. Repetidas nao contam", que
                   deixou de explicar a conta que a pessoa ve na tela. */
                title="O limite conta cada carta uma vez por variante e idioma: a foil e a normal da mesma carta ocupam duas vagas. Cópias repetidas da mesma carta não contam."
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, background: 'var(--bx-surface-2)', color: 'rgba(255,255,255,0.35)', border: '1px solid var(--bx-border)', whiteSpace: 'nowrap' }}
              >
                {cards.length}/{limiteDisplay} diferentes
              </span>
            )
          }
          acao={userId && (
            <button
              className="mc-add-topo"
              onClick={() => setOpenAddModal(true)}
              style={{ background: 'var(--bx-brand)', border: 'none', color: '#000', padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', alignItems: 'center', whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(245,158,11,0.2)', flexShrink: 0 }}
            >
              Adicionar carta
            </button>
          )}
          stat={
            /* Dois numeros diferentes conviviam aqui sem rotulo (o selo contava
               cartas distintas, este contava quantidades) e pareciam divergencia. */
            filteredCards.length !== cards.length
              ? `${filteredCards.length} de ${cards.length} diferentes · ${totalQty} no total${verificadas > 0 ? ` · ${verificadas} verificada${verificadas !== 1 ? 's' : ''}` : ''}`
              : `${totalQty} carta${totalQty !== 1 ? 's' : ''} no total · ${cards.length} diferente${cards.length !== 1 ? 's' : ''}${verificadas > 0 ? ` · ${verificadas} verificada${verificadas !== 1 ? 's' : ''}` : ''}`
          }
        >
              {userId && (
                <Link
                  href="/minha-colecao/pastas"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  Pastas
                </Link>
              )}
              {userId && <AtalhoMetas />}
              {userId && (
                <button
                  onClick={() => setOpenScanModal(true)}
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 7V5a1 1 0 011-1h2M16 7V5a1 1 0 00-1-1h-2M4 13v2a1 1 0 001 1h2M16 13v2a1 1 0 01-1 1h-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M3 10h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  Escanear foto
                </button>
              )}
              {cards.length > 0 && (
                <>
                  <button
                    onClick={handleExportCSV}
                    title={!isPro ? 'Disponível no plano Pro' : 'Exportar como planilha'}
                    style={{ background: isPro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isPro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`, color: isPro ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', padding: '11px 16px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: isPro ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M3 8h14M3 13h14M8 3v14" stroke="currentColor" strokeWidth="1.2"/></svg>
                    CSV
                  </button>
                  <button
                    onClick={handleExportPDF}
                    title={!isPro ? 'Disponível no plano Pro' : 'Exportar relatório PDF'}
                    style={{ background: isPro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isPro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`, color: isPro ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: isPro ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 3h6l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 3v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M7 11h6M7 14h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    PDF
                  </button>
                </>
              )}
        </PageHeader>

        {/* ★ O UpgradeBanner estava IMPORTADO aqui e nunca renderizado — a tela
            mais usada do app nao tinha oferta nenhuma. O componente ja se
            auto-protege (nao aparece pra Pro nem pra trial ativo), entao a
            unica condicao que falta e ter comecado a usar: quem esta com a
            colecao vazia nao tem por que ver "desbloqueie o Scan".
            Antes disso, o unico gatilho de upsell do app era o muro pos-trial,
            que exige mais de 100 cartas — 12 pessoas na base inteira. */}
        {/* ★ A oferta fica, mas deixa de ocupar metade da primeira dobra.
            O bloco cheio mede 342px e aparece para 98% da base (289 de 295
            donos de colecao sao free) -- junto com cabecalho, resumo, pastas e
            filtros empurrava a primeira carta para 1.591px, ou seja, NENHUMA
            carta na primeira dobra. Aqui fica a faixa fina (~90px); o bloco
            cheio desceu para depois da primeira fileira de cartas, e quem rola
            a colecao continua esbarrando nele. */}
        {!isPro && cards.length > 0 && (
          <Link
            href="/planos"
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>Scan com IA no plano Pro</p>
              <p style={{ fontSize: 11.5, color: 'var(--bx-text-2)', marginTop: 2 }}>Catalogue pela foto, sem digitar</p>
            </div>
            <span style={{ flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--ac-1)', fontSize: 13, fontWeight: 600 }}>Ver</span>
          </Link>
        )}

        {/* Resumo em duas caixas (#313, 12/09). Eram 3 cartoes de 72vw com
            rolagem lateral: no celular so o primeiro aparecia e ainda empurrava
            a colecao pra baixo. Minimo e maximo viraram a linha de baixo do
            valor; o aviso de preco sob revisao e a estimativa em USD ficam. */}
        {/* ★ Preco que nao veio e um AVISO, nao um zero. Sem isto, um 429 do
            lookup devolvia a colecao inteira valendo R$ 0,00 sem nenhum sinal
            na tela -- a pessoa acha que perdeu o patrimonio, nao que a
            consulta falhou. */}
        {precosFalharam && cards.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: 'var(--bx-red)' }}>
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4.5M10 13.4v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700 }}>Não foi possível carregar os preços</p>
              <p style={{ fontSize: 12, color: 'var(--bx-text-2)', marginTop: 2, lineHeight: 1.4 }}>Sua coleção está aqui. O valor volta ao tentar de novo.</p>
            </div>
            <button
              onClick={() => loadCards()}
              style={{ flexShrink: 0, minHeight: 44, padding: '0 16px', borderRadius: 10, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Tentar
            </button>
          </div>
        )}

        {cards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 24 }}>
            <div style={{ background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 14, padding: '12px 14px', minWidth: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginBottom: 2 }}>Valor de mercado</p>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: precosFalharam && !totais.valor ? 'var(--bx-text-3)' : undefined }}>
                {precosFalharam && !totais.valor ? 'indisponível' : (fmt(totais.valor) || 'R$ 0,00')}
              </p>
              {totais.max > 0 && (
                <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginTop: 2 }}>{fmt(totais.min) || 'R$ 0,00'} a {fmt(totais.max)}</p>
              )}
              {totais.sobRevisao > 0 && (
                <p style={{ fontSize: 11, color: 'var(--bx-amber)', marginTop: 5, lineHeight: 1.4 }}>
                  {fmt(totais.sobRevisao)} em {totais.qtdSobRevisao} carta{totais.qtdSobRevisao !== 1 ? 's' : ''} com preço sob revisão
                </p>
              )}
              {usdEstimado.valor > 0 && (
                <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginTop: 5, lineHeight: 1.4 }}>
                  + {fmt(usdEstimado.valor)} estimado em USD · {usdEstimado.count} carta{usdEstimado.count !== 1 ? 's' : ''} sem preço BR
                </p>
              )}
            </div>
            <div style={{ background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 14, padding: '12px 14px', minWidth: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginBottom: 2 }}>Cartas</p>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{totalQty}</p>
              <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginTop: 2 }}>em {resumoSets.size} {resumoSets.size === 1 ? 'set' : 'sets'}</p>
            </div>
          </div>
        )}

        {/* ── PASTAS EM DESTAQUE (hero + grade) ── */}
        {/* Hero de pasta VAZIA nao ocupa 277px da dobra: medido, 44,9% de quem
            ve este bloco tem a pasta em destaque com zero carta. Sem carta
            dentro, a pasta vira so mais um bloco entre a pessoa e a colecao. */}
        {pastasTopo?.hero && Number(pastasTopo.hero.qtd) > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                Pastas
              </h2>
              <Link href="/minha-colecao/pastas" style={{ fontSize: 13, color: '#f59e0b', textDecoration: 'none' }}>Ver todas →</Link>
            </div>

            {/* ★ D2: carrossel compacto. O hero media 277px e cada pasta
                seguinte 134 -- 439px no total, mais que cabecalho e resumo
                somados, segurando a primeira carta em 1.217px. Aqui a pasta em
                destaque vira o primeiro cartao da mesma trilha: a capa e o
                patrimonio continuam (sao o que identifica a pasta), e o bloco
                inteiro cabe em ~140px. */}
            <style>{`
              .pastas-track { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; }
              .pastas-track::-webkit-scrollbar { display: none; }
              .pasta-cartao { flex: 0 0 auto; width: 208px; height: 112px; scroll-snap-align: start; }
            `}</style>
            <div className="pastas-track">
              {[{ ...pastasTopo.hero, destaque: true }, ...(pastasTopo.outras || []).slice(0, 5)].map((p: any) => (
                <Link
                  key={p.id}
                  className="pasta-cartao"
                  href={p.locked ? '/minha-colecao/pastas' : `/minha-colecao/pastas/${p.id}`}
                  style={{
                    textDecoration: 'none', color: 'inherit', position: 'relative', display: 'flex', flexDirection: 'column',
                    justifyContent: 'flex-end', padding: 12, borderRadius: 14, overflow: 'hidden',
                    border: p.destaque ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--bx-border)',
                    background: p.imagem_url
                      ? `linear-gradient(90deg, rgba(8,10,15,0.94), rgba(8,10,15,0.45)), center/cover no-repeat url(${p.imagem_url})`
                      : 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(239,68,68,0.12))',
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</p>
                  <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginTop: 1 }}>{p.qtd} carta{Number(p.qtd) !== 1 ? 's' : ''}</p>
                  {fmt(p.patrimonio) && <p style={{ fontSize: 12.5, fontWeight: 700, color: '#60a5fa', marginTop: 2 }}>{fmt(p.patrimonio)}</p>}
                  {p.locked && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,15,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ display: 'flex' }}><IconKey size={18} /></span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Desbloquear no Pro</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── PASTAS: vitrine quando o usuario ainda nao tem nenhuma ── */}
        {userId && pastasTopo && pastasTopo.total === 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              Pastas
            </h2>

            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 18, padding: 20, background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(239,68,68,0.06))' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6 }}>Monte seu álbum digital de cartas</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 16 }}>Crie pastas, organize do seu jeito e visualize como um fichário de verdade.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ color: '#f59e0b', flexShrink: 0 }}><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Separe por coleção, tipo ou raridade
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ color: '#60a5fa', flexShrink: 0 }}><path d="M4 4h12v12H4z" stroke="currentColor" strokeWidth="1.5"/><path d="M4 8h12M8 4v12" stroke="currentColor" strokeWidth="1.2"/></svg>
                    Veja o patrimônio de cada pasta
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ color: '#22c55e', flexShrink: 0 }}><circle cx="6" cy="10" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="14" cy="5" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="14" cy="15" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M7.7 9l4.6-2.6M7.7 11l4.6 2.6" stroke="currentColor" strokeWidth="1.3"/></svg>
                    Deixe pública e mostre no seu perfil
                  </div>
                </div>

                <button
                  onClick={() => setCriarPasta(true)}
                  style={{ fontSize: 13, fontWeight: 800, color: '#000', background: 'var(--bx-brand)', border: 'none', padding: '11px 22px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                >
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Criar primeira pasta
                </button>
              </div>

              <div style={{ flex: '0 0 180px', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--bx-border)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'linear-gradient(135deg, rgba(245,158,11,0.4), rgba(239,68,68,0.3))' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'linear-gradient(135deg, rgba(96,165,250,0.4), rgba(168,85,247,0.3))' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'linear-gradient(135deg, rgba(34,197,94,0.4), rgba(245,158,11,0.3))' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(96,165,250,0.3))' }} />
                  <div style={{ aspectRatio: '5/7', borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)' }} />
                </div>
                <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 9 }}>visualização fichário</p>
              </div>
            </div>
          </div>
        )}

        {/* ★ V1: busca + um botao "Filtros" com contador. A barra tinha 138px
            e TRES linhas em 375px -- sete controles somando 867px de largura
            para 343 disponiveis, e os seletores com 36px de altura, abaixo do
            minimo de toque. Cinco deles ficam vazios na maioria das sessoes.
            Agora a barra tem 44px em repouso (92 quando ha chip aplicado), o
            que esta aplicado volta como chip removivel, e o resto mora numa
            folha com a contagem viva no rodape.
            Filtro novo (idioma, por exemplo) entra na folha sem a barra
            crescer de novo. */}
        {cards.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <IconSearch size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar carta..."
                  style={{ width: '100%', minHeight: 44, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '0 12px 0 36px', color: 'var(--bx-text)', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'var(--bx-border)'}
                />
              </div>
              <button
                onClick={() => setFiltrosAbertos(v => !v)}
                style={{ flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: qtdFiltros ? 'rgba(245,158,11,0.1)' : 'var(--bx-surface-2)', border: `1px solid ${qtdFiltros ? 'rgba(245,158,11,0.3)' : 'var(--bx-border)'}`, color: qtdFiltros ? 'var(--ac-1)' : 'var(--bx-text-2)' }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 6h14M6 10h8M9 14h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Filtros
                {qtdFiltros > 0 && (
                  <span style={{ background: 'var(--ac-1)', color: 'var(--bx-brand-ink)', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{qtdFiltros}</span>
                )}
                {/* So no desktop: la a faixa fica aberta enquanto a pessoa
                    filtra, entao o botao precisa dizer em que estado esta. */}
                {!isMobile && (
                  <span style={{ fontSize: 10, opacity: 0.7, transform: filtrosAbertos ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block' }}>&#9662;</span>
                )}
              </button>
            </div>

            {/* O que esta aplicado fica a vista, e sai com um toque. */}
            {qtdFiltros > 0 && (
              <div style={{ display: 'flex', gap: 7, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
                {(([
                  filtroRaridade ? [filtroRaridade, () => setFiltroRaridade('')] : null,
                  filtroVariante ? [filtroVariante.charAt(0).toUpperCase() + filtroVariante.slice(1), () => setFiltroVariante('')] : null,
                  filtroCondicao ? [filtroCondicao, () => setFiltroCondicao('')] : null,
                  filtroGraduada ? ['Graduadas', () => setFiltroGraduada(false)] : null,
                ].filter(Boolean)) as [string, () => void][]).map(([rotulo, limpar]) => (
                  <button key={rotulo} onClick={limpar}
                    style={{ flexShrink: 0, minHeight: 36, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 12px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.32)', color: 'var(--ac-1)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {rotulo} <span style={{ fontSize: 14, lineHeight: 1 }}>&times;</span>
                  </button>
                ))}
                <button onClick={limparFiltros}
                  style={{ flexShrink: 0, minHeight: 36, background: 'none', border: 'none', color: 'var(--bx-text-3)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '0 6px', whiteSpace: 'nowrap' }}>
                  Limpar
                </button>
              </div>
            )}

            {/* ★ D4, so no desktop: a faixa abre DENTRO do fluxo e empurra a
                grade, em vez de cobrir a tela. Nada fica sobreposto, nada
                precisa ser fechado pra voltar a ver as cartas, e a escolha
                pode ficar aberta enquanto a pessoa filtra. No celular segue a
                folha de rodape, que la e o certo. */}
            {filtrosAbertos && !isMobile && (
              <div style={{ marginTop: 12, border: '1px solid var(--bx-border)', borderRadius: 14, padding: 16, background: 'var(--bx-surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                  <ColunaFiltro titulo="ORDENAR POR">
                    {([
                      ['recente', 'Mais recente'], ['antiga', 'Mais antiga'], ['az', 'Nome A→Z'], ['za', 'Nome Z→A'],
                      ['valor_desc', 'Maior valor'], ['valor_asc', 'Menor valor'], ['numero', 'Nº ↑'], ['numero_desc', 'Nº ↓'],
                    ] as const).map(([v, rotulo]) => (
                      <OpcaoFiltro key={v} ativo={ordenacao === v} onClick={() => setOrdenacao(v)}>{rotulo}</OpcaoFiltro>
                    ))}
                  </ColunaFiltro>

                  {raridades.length > 0 && (
                    /* A raridade tem 24 valores na conta do Du: sem teto, ela
                       sozinha faria a faixa passar de 400px de altura. */
                    <ColunaFiltro titulo="RARIDADE" rolavel>
                      <OpcaoFiltro ativo={!filtroRaridade} onClick={() => setFiltroRaridade('')}>Todas</OpcaoFiltro>
                      {raridades.map(r => (
                        <OpcaoFiltro key={r} ativo={filtroRaridade === r} onClick={() => setFiltroRaridade(filtroRaridade === r ? '' : r)}>{r}</OpcaoFiltro>
                      ))}
                    </ColunaFiltro>
                  )}

                  <ColunaFiltro titulo="VARIANTE">
                    <OpcaoFiltro ativo={!filtroVariante} onClick={() => setFiltroVariante('')}>Todas</OpcaoFiltro>
                    {['normal', 'foil', 'reverse', 'promo', 'pokeball'].map(v => (
                      <OpcaoFiltro key={v} ativo={filtroVariante === v} onClick={() => setFiltroVariante(filtroVariante === v ? '' : v)}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </OpcaoFiltro>
                    ))}
                  </ColunaFiltro>

                  <ColunaFiltro titulo="CONDIÇÃO">
                    <OpcaoFiltro ativo={!filtroCondicao} onClick={() => setFiltroCondicao('')}>Todas</OpcaoFiltro>
                    {CONDICAO_KEYS.map(k => (
                      <OpcaoFiltro key={k} ativo={filtroCondicao === k} onClick={() => setFiltroCondicao(filtroCondicao === k ? '' : k)}>{k}</OpcaoFiltro>
                    ))}
                    <div style={{ width: '100%', height: 12 }} />
                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--bx-text-3)', margin: '0 0 9px', width: '100%' }}>GRADUADAS</p>
                    <OpcaoFiltro ativo={filtroGraduada} onClick={() => setFiltroGraduada(v => !v)}>Só graduadas</OpcaoFiltro>
                  </ColunaFiltro>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bx-border)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--bx-text-3)' }}>
                    {filteredCards.length} carta{filteredCards.length !== 1 ? 's' : ''} com esses filtros
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {qtdFiltros > 0 && (
                      <button onClick={limparFiltros} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, background: 'none', border: '1px solid var(--bx-border)', color: 'var(--bx-text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>
                    )}
                    <button onClick={() => setFiltrosAbertos(false)} style={{ minHeight: 40, padding: '0 16px', borderRadius: 10, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar filtros</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fora da barra: nao e filtro, e nao pode disputar largura com ela. */}
        {cards.length > 0 && grupos.length > 1 && !filtroAtivo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)' }}>
              {([['sets', 'Por set'], ['tudo', 'Tudo']] as const).map(([v, rotulo]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  style={{ minHeight: 36, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: vista === v ? 700 : 500, background: vista === v ? 'rgba(245,158,11,0.14)' : 'transparent', color: vista === v ? 'var(--ac-1)' : 'var(--bx-text-3)', transition: 'background 0.15s ease, color 0.15s ease' }}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {vista === 'sets' && (
              <button
                onClick={() => alternarTodos(!todosAbertos)}
                style={{ background: 'none', border: 'none', color: 'var(--ac-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', minHeight: 44, padding: '0 4px' }}
              >
                {todosAbertos ? 'Recolher tudo' : 'Expandir tudo'}
              </button>
            )}
          </div>
        )}

        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <svg width="48" height="48" viewBox="0 0 20 20" fill="none" style={{ display: 'block', margin: '0 auto 16px' }}><rect x="3" y="5" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7 5V4a2 2 0 012-2h6a2 2 0 012 2v9a2 2 0 01-2 2h-1" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            <p style={{ fontSize: 16 }}>Você ainda não adicionou cartas.</p>
            {/* Apontava pra "+ Buscar carta", botao que nao existe mais com
                esse nome. Agora casa com o rotulo real do botao. */}
            <p style={{ fontSize: 13, marginTop: 8 }}>Toque em "Adicionar carta" para começar sua coleção</p>
          </div>
        )}

        {filteredCards.length === 0 && cards.length > 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <IconSearch size={36} color="rgba(255,255,255,0.15)" style={{marginBottom:12}} />
            <p style={{ fontSize: 15, marginBottom: 6 }}>Nenhuma carta encontrada</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Tente outros filtros ou limpe a busca</p>
          </div>
        )}
        <style>{`
          .colecao-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
          @media (max-width: 768px) { .colecao-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
        `}</style>
        {/* Grade agrupada por set (#313): primeiro set aberto ao chegar, os
            outros fechados, pra quem tem 100 sets ver a colecao no primeiro view. */}
        {/* ★ Vista "Tudo": uma grade so, sem cabecalho e sem acordeao. A ordem
            e a mesma da barra de filtros -- o agrupamento sai, a ordenacao
            fica. A oferta entra ocupando a linha inteira depois da quarta
            fileira do celular (8 cartas), pra aparecer no caminho de quem rola
            sem ser a primeira coisa da lista. */}
        {vista === 'tudo' && filteredCards.length > 0 && (
          <>
            <div className="colecao-grid">
              {filteredCards.flatMap((c, i) => (
                i === POSICAO_OFERTA
                  ? [<div key="oferta" style={{ gridColumn: '1 / -1', margin: '6px 0' }}><UpgradeBanner tipo="cartas" quantidade={cards.length} /></div>, renderCarta(c)]
                  : [renderCarta(c)]
              ))}
            </div>
            {filteredCards.length <= POSICAO_OFERTA && (
              <div style={{ marginTop: 16 }}><UpgradeBanner tipo="cartas" quantidade={cards.length} /></div>
            )}
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(vista === 'tudo' ? [] : grupos).map((g, i) => {
            const r = resumoSets.get(g.key)!
            const aberto = g.key in abertos ? abertos[g.key] : (filtroAtivo || abertoPadrao[g.key])
            const comLogo = r.setIds.find(s => setsInfo[s]?.logo_url)
            const comSimbolo = r.setIds.find(s => setsInfo[s]?.symbol_url)
            // Total com secretas do catalogo (chave da familia primeiro); senao o da carta.
            const totalSet = r.setIds.map(s => setsInfo[s]?.total).find((t): t is number => !!t) ?? r.total
            return (
              <section key={g.key}>
                <CabecalhoSet
                  nome={r.nome}
                  logoUrl={comLogo ? setsInfo[comLogo].logo_url : null}
                  symbolUrl={comSimbolo ? setsInfo[comSimbolo].symbol_url : null}
                  coletadas={r.ids.size}
                  total={totalSet}
                  valor={fmt(r.valor)}
                  resultados={filtroAtivo ? g.cards.length : null}
                  aberto={aberto}
                  onToggle={() => setAbertos(prev => ({ ...prev, [g.key]: !aberto }))}
                />
                {aberto && (
                  <div className="colecao-grid" style={{ marginTop: 10, marginBottom: 8 }}>
                    {g.cards.map((c) => renderCarta(c))}
                  </div>
                )}
                {/* O bloco cheio da oferta, agora DEPOIS do primeiro grupo:
                    a pessoa ve carta antes de ver preco de plano, e a oferta
                    continua no caminho de quem rola. */}
                {i === 0 && <div style={{ marginTop: 16 }}><UpgradeBanner tipo="cartas" quantidade={cards.length} /></div>}
              </section>
            )
          })}
        </div>
      </div>

      {/* ★ Adicionar ao alcance do polegar. No celular a unica entrada ficava
          no topo da pagina: depois de rolar a colecao (4.493px medidos numa
          conta de 8 sets, e muito mais numa de 83), cadastrar exigia voltar
          ao topo A CADA carta -- e 46% dos dias de cadastro tem 5 cartas ou
          mais. O botao do PageHeader sai no mobile e volta no desktop, o que
          ainda devolve a linha do titulo (o h1 quebrava em duas linhas com
          61px uteis). Sem menu de opcoes: abre a busca direto, que e por onde
          99,9% das cartas entram -- o scan responde por 0,09%. */}
      {userId && (
        <button
          className="mc-fab-add"
          onClick={() => setOpenAddModal(true)}
          aria-label="Adicionar carta"
          style={{ position: 'fixed', right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', width: 56, height: 56, borderRadius: '50%', background: 'var(--bx-brand)', border: 'none', color: 'var(--bx-brand-ink)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.4)', zIndex: 150, transition: 'transform 0.15s ease' }}
        >
          <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <style>{`
        /* O FAB e a entrada do mobile; no desktop quem manda e o botao do
           cabecalho. Os dois nunca aparecem juntos. */
        .mc-fab-add { display: none; }
        .mc-add-topo { display: flex; }
        @media (max-width: 768px) {
          .mc-fab-add { display: flex; }
          .mc-add-topo { display: none; }
        }
        .mc-fab-add:active { transform: scale(0.94); }
        @media (prefers-reduced-motion: reduce) { .mc-fab-add { transition: none; } }
      `}</style>

      {/* ★ Folha de filtros (V1). Tudo o que saiu da barra mora aqui, e o
          rodape mostra quantas cartas o estado atual devolve ANTES de aplicar
          -- a pessoa nao precisa fechar para descobrir que zerou a lista. */}
      {filtrosAbertos && isMobile && (
        <div
          onClick={() => setFiltrosAbertos(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,6,10,0.7)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxHeight: '86vh', background: 'var(--bx-bg-elev)', borderTop: '1px solid var(--bx-border-2)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)', margin: '10px auto 2px', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 0', flexShrink: 0 }}>
              <strong style={{ fontSize: 17 }}>Filtros</strong>
              {qtdFiltros > 0 && (
                <button onClick={limparFiltros} style={{ background: 'none', border: 'none', color: 'var(--bx-text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, padding: '0 4px' }}>Limpar</button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 8px' }}>
              <GrupoFiltro titulo="ORDENAR POR">
                {([
                  ['recente', 'Mais recente'], ['antiga', 'Mais antiga'], ['az', 'Nome A→Z'], ['za', 'Nome Z→A'],
                  ['valor_desc', 'Maior valor'], ['valor_asc', 'Menor valor'], ['numero', 'Nº ↑'], ['numero_desc', 'Nº ↓'],
                ] as const).map(([v, rotulo]) => (
                  <OpcaoFiltro key={v} ativo={ordenacao === v} onClick={() => setOrdenacao(v)}>{rotulo}</OpcaoFiltro>
                ))}
              </GrupoFiltro>

              {raridades.length > 0 && (
                <GrupoFiltro titulo="RARIDADE">
                  <OpcaoFiltro ativo={!filtroRaridade} onClick={() => setFiltroRaridade('')}>Todas</OpcaoFiltro>
                  {raridades.map(r => (
                    <OpcaoFiltro key={r} ativo={filtroRaridade === r} onClick={() => setFiltroRaridade(filtroRaridade === r ? '' : r)}>{r}</OpcaoFiltro>
                  ))}
                </GrupoFiltro>
              )}

              <GrupoFiltro titulo="VARIANTE">
                <OpcaoFiltro ativo={!filtroVariante} onClick={() => setFiltroVariante('')}>Todas</OpcaoFiltro>
                {['normal', 'foil', 'reverse', 'promo', 'pokeball'].map(v => (
                  <OpcaoFiltro key={v} ativo={filtroVariante === v} onClick={() => setFiltroVariante(filtroVariante === v ? '' : v)}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </OpcaoFiltro>
                ))}
              </GrupoFiltro>

              <GrupoFiltro titulo="CONDIÇÃO">
                <OpcaoFiltro ativo={!filtroCondicao} onClick={() => setFiltroCondicao('')}>Todas</OpcaoFiltro>
                {CONDICAO_KEYS.map(k => (
                  <OpcaoFiltro key={k} ativo={filtroCondicao === k} onClick={() => setFiltroCondicao(filtroCondicao === k ? '' : k)}>{k}</OpcaoFiltro>
                ))}
              </GrupoFiltro>

              <button
                onClick={() => setFiltroGraduada(v => !v)}
                style={{ width: '100%', minHeight: 52, marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', color: 'var(--bx-text)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                <span>Só cartas graduadas</span>
                <span style={{ width: 44, height: 26, borderRadius: 999, background: filtroGraduada ? 'rgba(245,158,11,0.3)' : 'var(--bx-surface-3)', border: `1px solid ${filtroGraduada ? 'rgba(245,158,11,0.5)' : 'var(--bx-border-2)'}`, position: 'relative', transition: 'background 0.15s ease' }}>
                  <span style={{ position: 'absolute', top: 2, left: filtroGraduada ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: filtroGraduada ? 'var(--ac-1)' : 'var(--bx-text-3)', transition: 'left 0.15s ease' }} />
                </span>
              </button>
            </div>

            <div style={{ padding: '14px 18px calc(16px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--bx-border)', flexShrink: 0 }}>
              <button
                onClick={() => setFiltrosAbertos(false)}
                style={{ width: '100%', minHeight: 50, borderRadius: 12, background: 'var(--bx-brand)', color: 'var(--bx-brand-ink)', border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Ver {filteredCards.length} carta{filteredCards.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {openAddModal && userId && (
        <AddCardModal
          userId={userId}
          onClose={() => {
            setOpenAddModal(false)
            if (reconciliarRef.current) { reconciliarRef.current = false; loadCards() }
          }}
          onAdded={(novas) => { reconciliarRef.current = true; aplicarNovas(novas) }}
        />
      )}

      {openScanModal && userId && (
        <ScanModal
          userId={userId}
          onClose={() => setOpenScanModal(false)}
          /* O scan grava por caminho proprio (casa por nome) e nao devolve as
             linhas, entao aqui o refetch e a forma honesta de refletir -- mas
             sem recarregar a pagina: scroll, filtro e sets abertos ficam. */
          onAdded={() => { setOpenScanModal(false); loadCards() }}
        />
      )}

      {criarPasta && userId && (
        <PastaFormModal
          userId={userId}
          mode="create"
          onClose={() => setCriarPasta(false)}
          onSaved={(id) => { setCriarPasta(false); router.push(`/minha-colecao/pastas/${id}`) }}
        />
      )}
      {detalheCard && (
        <CardDetailModal
          key={detalheCard.id}
          card={detalheCard}
          isPro={isPro}
          exchangeRate={exchangeRate}
          onClose={() => setDetalheCard(null)}
          onVarianteChange={(v) => handleVarianteChange(detalheCard, v)}
          onIdiomaChange={(i) => handleIdiomaChange(detalheCard, i)}
          onQuantitySet={(novaQty) => handleSetQuantity(detalheCard, novaQty)}
          onCondicoesSaved={(novas) => setCards(prev => prev.map(x => x.id === detalheCard.id ? { ...x, condicoes: novas } : x))}
          onAnunciar={() => { setAnunciarCard(detalheCard); setDetalheCard(null) }}
          onGradSaved={(campos) => { setCards(prev => prev.map(c => c.id === detalheCard.id ? { ...c, ...campos } : c)); setDetalheCard((prev: any) => prev ? { ...prev, ...campos } : prev) }}
          onRemove={async () => { await handleRemove(detalheCard.id, detalheCard.card_name); setDetalheCard(null) }}
          lista={grupos.flatMap(g => g.cards)}
          onNavegar={(c) => setDetalheCard(c)}
        />
      )}

      {anunciarCard && userId && (
        <AnunciarModal
          userId={userId}
          initialCard={anunciarCard}
          onClose={() => setAnunciarCard(null)}
          onAdded={() => setAnunciarCard(null)}
        />
      )}
    </AppLayout>
  )
}
