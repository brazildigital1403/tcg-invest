'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { getUserPlan } from '@/lib/isPro'
import UpgradeBanner from '@/components/ui/UpgradeBanner'
import AppLayout from '@/components/ui/AppLayout'
import AddCardModal from '@/components/dashboard/AddCardModal'
import ScanModal from '@/components/ui/ScanModal'
import { IconScan, IconSearch, IconDownload, IconLink, IconWarning, IconCheck, IconClose } from '@/components/ui/Icons'
import { useAppModal } from '@/components/ui/useAppModal'
import CardItem from '@/components/ui/CardItem'

const n = (v: any) => { const f = parseFloat(String(v)); return isNaN(f) ? null : f }

const fmt = (v: any) => {
  const num = n(v)
  if (!num || num <= 0) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

function getVariantePrices(price: any, variante: string) {
  if (!price) return { min: null, medio: null, max: null }
  const p = (v: any) => n(v)
  switch (variante) {
    case 'foil':     return { min: p(price.preco_foil_min),     medio: p(price.preco_foil_medio),     max: p(price.preco_foil_max) }
    case 'promo':    return { min: p(price.preco_promo_min),    medio: p(price.preco_promo_medio),    max: p(price.preco_promo_max) }
    case 'reverse':  return { min: p(price.preco_reverse_min),  medio: p(price.preco_reverse_medio),  max: p(price.preco_reverse_max) }
    case 'pokeball': return { min: p(price.preco_pokeball_min), medio: p(price.preco_pokeball_medio), max: p(price.preco_pokeball_max) }
    default:         return { min: p(price.preco_min),          medio: p(price.preco_medio),          max: p(price.preco_max) }
  }
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

export default function MinhaColecao() {
  const { showAlert, showPrompt, showConfirm } = useAppModal()
  const [cards, setCards] = useState<any[]>([])
  const [totalCartas, setTotalCartas] = useState(0)
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [openAddModal, setOpenAddModal] = useState(false)
  const [openScanModal, setOpenScanModal] = useState(false)
  const limiteDisplay = isPro ? '∞' : String(LIMITE_FREE)
  const [search, setSearch] = useState('')
  const [filtroVariante, setFiltroVariante] = useState('')
  const [filtroRaridade, setFiltroRaridade] = useState('')
  const [ordenacao, setOrdenacao] = useState<'az' | 'za' | 'recente' | 'antiga' | 'numero' | 'numero_desc'>('recente')
  const [loading, setLoading] = useState(true)
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<{ usd: number; eur: number }>({ usd: 6.0, eur: 6.5 })

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
          const valorTotal = (precos.medio * qty).toFixed(2).replace('.', ',')
          const numMatch = c.card_name?.match(/\(([^)]+)\)/)
          const addedAt = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : ''
          const fmtPreco = (v: number) => v > 0 ? v.toFixed(2).replace('.', ',') : ''
          return [
            c.card_name?.replace(/\s*\([^)]*\)/, '').trim() || '',
            numMatch?.[1] || '',
            c.set_name || '',
            variante.charAt(0).toUpperCase() + variante.slice(1),
            c.rarity || '',
            qty,
            fmtPreco(precos.min),
            fmtPreco(precos.medio),
            fmtPreco(precos.max),
            valorTotal,
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
    const totalMedio = totais.medio
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const variantLabel: Record<string, string> = { normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil' }

    const rows = cards.map(c => {
      const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
      const p = c.price
      const medio = !p ? 0
        : variante === 'foil'     ? (p.preco_foil_medio || 0)
        : variante === 'promo'    ? (p.preco_promo_medio || 0)
        : variante === 'reverse'  ? (p.preco_reverse_medio || 0)
        : variante === 'pokeball' ? (p.preco_pokeball_medio || 0)
        : (p.preco_medio || 0)
      const total = medio * (c.quantity || 1)
      return { name: c.card_name || '', variante, rarity: c.rarity || '—', qty: c.quantity || 1, medio, total, image: c.card_image }
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
  .title { font-size: 28px; font-weight: 900; color: #111; letter-spacing: -0.03em; }
  .subtitle { font-size: 13px; color: #888; margin-top: 4px; }
  .stats { display: flex; gap: 24px; margin-bottom: 28px; }
  .stat { background: #f9f9f9; border-radius: 10px; padding: 14px 20px; border: 1px solid #eee; }
  .stat-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }
  .stat-value { font-size: 20px; font-weight: 800; color: #f59e0b; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #111; color: #fff; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr:hover td { background: #fafafa; }
  .card-img { width: 28px; height: 39px; object-fit: cover; border-radius: 3px; vertical-align: middle; margin-right: 8px; }
  .badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 10px; background: #f59e0b22; color: #b45309; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #bbb; border-top: 1px solid #eee; padding-top: 16px; }
  .total-row td { font-weight: 800; background: #f9f9f9; border-top: 2px solid #111; }
  @media print { body { padding: 20px; } }
  @media (min-width: 640px) { .md-row { flex-direction: row !important; align-items: flex-start !important; } }
  @media (max-width: 639px) {
    .p-6 { padding: 16px !important; }
    .colecao-titulo { font-size: 22px !important; }
    .colecao-botoes button { font-size: 13px !important; padding: 10px 14px !important; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="title">Bynx</div>
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

<div class="footer">Gerado pelo Bynx · bynx.gg · ${date}</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { showAlert('Permita popups para exportar o PDF.', 'warning'); return }
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  async function loadCards() {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) { window.location.href = '/login'; return }

      setUserId(userData.user.id)
      const { isPro: pro, isTrial: trial } = await getUserPlan(userData.user.id)
      setIsPro(pro || trial)

      const { data } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })

      const cardsData = data || []

      const PRICE_SELECT = 'id, name, number, set_total, liga_link, preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball, preco_min, preco_medio, preco_max, preco_foil_min, preco_foil_medio, preco_foil_max, preco_promo_min, preco_promo_medio, preco_promo_max, preco_reverse_min, preco_reverse_medio, preco_reverse_max, price_usd_normal, price_usd_holofoil, price_usd_reverse, price_eur_normal, price_eur_holofoil'

      const priceById: any   = {}
      const priceByLink: any = {}

      // ── 1. Lookup por pokemon_api_id (novo AddCardModal — mais preciso) ──
      const apiIds = [...new Set(cardsData.map((c: any) => c.pokemon_api_id).filter(Boolean))]
      if (apiIds.length > 0) {
        const { data: byId } = await supabase
          .from('pokemon_cards')
          .select(PRICE_SELECT)
          .in('id', apiIds)
        ;(byId || []).forEach((p: any) => { priceById[p.id] = p })
      }

      // ── 2. Lookup por liga_link (cartas antigas importadas por link) ──
      const allLinks = [...new Set(cardsData.map((c: any) => c.card_link).filter(Boolean))]
      if (allLinks.length > 0) {
        const { data: byLink } = await supabase
          .from('pokemon_cards')
          .select(PRICE_SELECT)
          .in('liga_link', allLinks)
        ;(byLink || []).forEach((p: any) => {
          if (p.liga_link) priceByLink[p.liga_link] = p
        })
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
          const { data: byName } = await supabase
            .from('pokemon_cards').select(PRICE_SELECT).in('name', names).limit(500)
          ;(byName || []).forEach((p: any) => {
            const k = p.name?.trim()
            if (!priceByName[k]) priceByName[k] = p
          })
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
        }
      })

      setCards(merged)
      setTotalCartas(merged.length)
    } catch (err: any) {
      console.error('[minha-colecao] loadCards error:', err?.message || err)
    } finally {
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




  async function handleSell(card: any) {
    const qty = await showPrompt({ message: `Quantas cópias deseja vender?`, placeholder: `1 a ${card.quantity || 1}` })
    if (!qty) return
    const quantityToSell = Number(qty)
    if (quantityToSell <= 0 || quantityToSell > (card.quantity || 1)) { showAlert('Quantidade inválida.', 'error'); return }
    const price = await showPrompt({ message: 'Qual o preço UNITÁRIO da carta? (em R$)', placeholder: 'Ex: 150.00' })
    if (!price) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { showAlert('Você precisa estar logado', 'error'); return }

    const items = Array.from({ length: quantityToSell }).map(() => ({
      user_id: userData.user.id,
      card_id: card.card_id,
      card_name: card.card_name,
      card_image: card.card_image,
      price: Number(price),
    }))

    const { error } = await supabase.from('marketplace').insert(items)
    if (error) { showAlert('Erro ao colocar à venda. Tente novamente.', 'error'); return }

    const newQty = (card.quantity || 1) - quantityToSell
    if (newQty <= 0) {
      await handleRemove(card.id, card.card_name)
    } else {
      await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
    }
    showAlert('Venda realizada com sucesso!', 'success')
  }

  async function handleUpdateQuantity(card: any, delta: number) {
    const newQty = (card.quantity || 1) + delta
    if (newQty <= 0) { await handleRemove(card.id, card.card_name); return }
    const { error } = await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
    if (error) { showAlert('Erro ao atualizar quantidade.', 'error'); return }
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
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
    return <AppLayout><div className="p-6">Carregando coleção...</div></AppLayout>
  }

  // ✅ Totais da carteira baseados na VARIANTE selecionada de cada carta
  const totais = cards.reduce((acc, c) => {
    const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
    const p = getVariantePrices(c.price, variante)
    const qty = c.quantity || 1
    return {
      min: acc.min + (p.min || 0) * qty,
      medio: acc.medio + (p.medio || 0) * qty,
      max: acc.max + (p.max || 0) * qty,
    }
  }, { min: 0, medio: 0, max: 0 })

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
    return matchSearch && matchVariante && matchRaridade
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
      default: return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    }
  })

  // Raridades únicas da coleção
  const raridades = [...new Set(cards.map(c => c.rarity).filter(Boolean))] as string[]

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
              <circle cx="36" cy="36" r="5" fill="#f0f0f0" stroke="#888" strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
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
      <div className="p-6">

        {/* Onboarding */}

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          {/* Linha principal: Título + botão Adicionar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Minha Coleção</h1>
              {!isPro && totalCartas >= LIMITE_FREE ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                  Limite atingido ({totalCartas}/{limiteDisplay})
                </span>
              ) : (
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {totalCartas}/{limiteDisplay} cartas
                </span>
              )}
            </div>
            {/* Botão principal — lado direito do título */}
            {userId && (
              <button
                onClick={() => setOpenAddModal(true)}
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(245,158,11,0.2)', flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                Adicionar carta
              </button>
            )}
          </div>

          {/* Subtítulo + botões secundários */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
              {filteredCards.length !== cards.length
                ? `${filteredCards.length} de ${cards.length} carta${cards.length !== 1 ? 's' : ''}`
                : `${cards.length} carta${cards.length !== 1 ? 's' : ''} na coleção`}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {userId && (
                <button
                  onClick={() => setOpenScanModal(true)}
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
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
                    {isPro ? 'CSV' : 'CSV'}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    title={!isPro ? 'Disponível no plano Pro' : 'Exportar relatório PDF'}
                    style={{ background: isPro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isPro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`, color: isPro ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: isPro ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
                  >
                    {isPro ? 'PDF' : 'PDF'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Resumo financeiro — scroll horizontal */}
        <style>{`
          .colecao-resumo-track {
            display: flex;
            gap: 12px;
            margin-bottom: 28px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 4px;
          }
          .colecao-resumo-track::-webkit-scrollbar { display: none; }
          .colecao-resumo-card {
            flex: 1;
            min-width: 160px;
            scroll-snap-align: start;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
          }
          @media (max-width: 768px) {
            .colecao-resumo-card { min-width: 72vw; }
          }
        `}</style>
        <div className="colecao-resumo-track">
          <div className="colecao-resumo-card" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(34,197,94,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mínimo da Carteira</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', letterSpacing: '-0.02em' }}>{fmt(totais.min)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Pior cenário de venda</p>
          </div>
          <div className="colecao-resumo-card" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <p style={{ fontSize: 11, color: 'rgba(96,165,250,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Valor Médio</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.02em' }}>{fmt(totais.medio)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Preço médio de mercado</p>
            {usdEstimado.valor > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(96,165,250,0.15)' }}>
                <p style={{ fontSize: 11, color: 'rgba(96,165,250,0.5)', marginBottom: 2 }}>
                  + {fmt(usdEstimado.valor)} estimado
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                  {usdEstimado.count} carta{usdEstimado.count !== 1 ? 's' : ''} sem preço BR · USD×câmbio
                </p>
              </div>
            )}
          </div>
          <div className="colecao-resumo-card" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(245,158,11,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Máximo da Carteira</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em' }}>{fmt(totais.max)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Melhor cenário de venda</p>
          </div>
        </div>

        {/* Busca + filtros — 1 linha única, após boxes */}
        {cards.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {/* Busca */}
            <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
              <IconSearch size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar carta..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px 8px 32px', color: '#f0f0f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Raridade */}
            {raridades.length > 0 && (
              <select value={filtroRaridade} onChange={e => setFiltroRaridade(e.target.value)}
                style={{ background: filtroRaridade ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filtroRaridade ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '8px 12px', color: filtroRaridade ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                <option value="" style={{ background: '#0d0f14' }}>Raridade</option>
                {raridades.map(r => <option key={r} value={r} style={{ background: '#0d0f14' }}>{r}</option>)}
              </select>
            )}

            {/* Variante */}
            <select value={filtroVariante} onChange={e => setFiltroVariante(e.target.value)}
              style={{ background: filtroVariante ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filtroVariante ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '8px 12px', color: filtroVariante ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              <option value="" style={{ background: '#0d0f14' }}>Variante</option>
              <option value="normal" style={{ background: '#0d0f14' }}>Normal</option>
              <option value="foil" style={{ background: '#0d0f14' }}>Foil</option>
              <option value="promo" style={{ background: '#0d0f14' }}>Promo</option>
              <option value="reverse" style={{ background: '#0d0f14' }}>Reverse Foil</option>
              <option value="pokeball" style={{ background: '#0d0f14' }}>Pokeball Foil</option>
            </select>

            {/* Ordenação — select único igual à Pokédex */}
            <select value={ordenacao} onChange={e => setOrdenacao(e.target.value as any)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              <option value="numero" style={{ background: '#0d0f14' }}>Nº ↑</option>
              <option value="numero_desc" style={{ background: '#0d0f14' }}>Nº ↓</option>
              <option value="az" style={{ background: '#0d0f14' }}>Nome A→Z</option>
              <option value="za" style={{ background: '#0d0f14' }}>Nome Z→A</option>
              <option value="recente" style={{ background: '#0d0f14' }}>Mais recente</option>
              <option value="antiga" style={{ background: '#0d0f14' }}>Mais antiga</option>
            </select>

            {/* Limpar filtros */}
            {(search || filtroVariante || filtroRaridade) && (
              <button
                onClick={() => { setSearch(''); setFiltroVariante(''); setFiltroRaridade('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🃏</p>
            <p style={{ fontSize: 16 }}>Você ainda não adicionou cartas.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Clique em "+ Buscar carta" para adicionar sua primeira carta</p>
          </div>
        )}

        {filteredCards.length === 0 && cards.length > 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <IconSearch size={36} color="rgba(255,255,255,0.15)" style={{marginBottom:12}} />
            <p style={{ fontSize: 15, marginBottom: 6 }}>Nenhuma carta encontrada</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Tente outros filtros ou limpe a busca</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filteredCards.map((c) => (
            <CardItem
              key={c.id}
              card={c}
              mode="collection"
              variante={c.variante || 'normal'}
              exchangeRate={exchangeRate}
              onVarianteChange={(v) => handleVarianteChange(c, v)}
              onQuantityChange={(delta) => handleUpdateQuantity(c, delta)}
              onRemove={() => handleRemove(c.id, c.card_name)}
            />
          ))}
        </div>
      </div>

      {openAddModal && userId && (
        <AddCardModal
          userId={userId}
          onClose={() => setOpenAddModal(false)}
          onAdded={() => window.location.reload()}
        />
      )}

      {openScanModal && userId && (
        <ScanModal
          userId={userId}
          onClose={() => setOpenScanModal(false)}
          onAdded={() => { setOpenScanModal(false); window.location.reload() }}
        />
      )}
    </AppLayout>
  )
}
