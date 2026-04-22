'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { getUserPlan } from '@/lib/isPro'
import UpgradeBanner from '@/components/ui/UpgradeBanner'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'
import AddCardModal from '@/components/dashboard/AddCardModal'
import ScanModal from '@/components/ui/ScanModal'
import { IconScan, IconSearch, IconDownload, IconLink, IconWarning, IconCheck, IconClose } from '@/components/ui/Icons'
import { useAppModal } from '@/components/ui/useAppModal'

const fmt = (v: number | null | undefined) => {
  if (!v) return 'R$ -'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function getVariantePrices(price: any, variante: string) {
  if (!price) return { min: null, medio: null, max: null }
  switch (variante) {
    case 'foil':     return { min: price.preco_foil_min,     medio: price.preco_foil_medio,     max: price.preco_foil_max }
    case 'promo':    return { min: price.preco_promo_min,    medio: price.preco_promo_medio,    max: price.preco_promo_max }
    case 'reverse':  return { min: price.preco_reverse_min,  medio: price.preco_reverse_medio,  max: price.preco_reverse_max }
    case 'pokeball': return { min: price.preco_pokeball_min, medio: price.preco_pokeball_medio, max: price.preco_pokeball_max }
    default:         return { min: price.preco_min,          medio: price.preco_medio,          max: price.preco_max }
  }
}

function getVarianteEfetiva(price: any, varianteSalva: string): string {
  if (!price) return varianteSalva || 'normal'
  const CAMPOS: Record<string, string> = {
    normal: 'preco_medio', foil: 'preco_foil_medio', promo: 'preco_promo_medio',
    reverse: 'preco_reverse_medio', pokeball: 'preco_pokeball_medio',
  }
  if (Number(price[CAMPOS[varianteSalva]] || 0) > 0) return varianteSalva
  for (const [key, campo] of Object.entries(CAMPOS)) {
    if (Number(price[campo] || 0) > 0) return key
  }
  return 'normal'
}

// Variantes disponíveis — só inclui as que têm preço
function getVariantesDisponiveis(price: any) {
  if (!price) return [{ key: 'normal', label: 'Normal' }]
  const opts = []
  if (price.preco_medio)          opts.push({ key: 'normal',   label: 'Normal' })
  if (price.preco_foil_medio)     opts.push({ key: 'foil',     label: 'Foil' })
  if (price.preco_promo_medio)    opts.push({ key: 'promo',    label: 'Promo' })
  if (price.preco_reverse_medio)  opts.push({ key: 'reverse',  label: 'Reverse Foil' })
  if (price.preco_pokeball_medio) opts.push({ key: 'pokeball', label: 'Pokeball Foil' })
  // Garante pelo menos uma opção
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
  const [showImportModal, setShowImportModal] = useState(false)
  const [importLinks, setImportLinks] = useState('')

  const MAX_LINKS = 20
  const SECS_PER_CARD = 6
  const [importingTotal, setImportingTotal] = useState(0)

  function handleExportCSV() {
    if (isPro) {
      const rows = [
        ['Nome', 'Número', 'Variante', 'Raridade', 'Qtd', 'Preço Mín', 'Preço Médio', 'Preço Máx', 'Link'],
        ...cards.map(c => {
          const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
          const p = c.price
          const precos = !p ? { min: '', medio: '', max: '' }
            : variante === 'foil'     ? { min: p.preco_foil_min || '', medio: p.preco_foil_medio || '', max: p.preco_foil_max || '' }
            : variante === 'promo'    ? { min: p.preco_promo_min || '', medio: p.preco_promo_medio || '', max: p.preco_promo_max || '' }
            : variante === 'reverse'  ? { min: p.preco_reverse_min || '', medio: p.preco_reverse_medio || '', max: p.preco_reverse_max || '' }
            : variante === 'pokeball' ? { min: p.preco_pokeball_min || '', medio: p.preco_pokeball_medio || '', max: p.preco_pokeball_max || '' }
            : { min: p.preco_min || '', medio: p.preco_medio || '', max: p.preco_max || '' }
          const numMatch = c.card_name?.match(/\(([^)]+)\)/)
          return [
            c.card_name?.replace(/\s*\([^)]*\)/, '').trim() || '',
            numMatch?.[1] || '',
            variante.charAt(0).toUpperCase() + variante.slice(1),
            c.rarity || '',
            c.quantity || 1,
            precos.min,
            precos.medio,
            precos.max,
            c.card_link || '',
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
      const names = cardsData.map((c: any) => c.card_name?.trim())
      let priceMap: any = {}

      if (names.length > 0) {
        const { data: prices } = await supabase
          .from('card_prices')
          .select('*')
          .in('card_name', names)

        priceMap = (prices || []).reduce((acc: any, p: any) => {
          acc[p.card_name?.trim()] = p
          return acc
        }, {})
      }

      const merged = cardsData.map((c: any) => ({
        ...c,
        price: priceMap[c.card_name?.trim()] || null,
      }))

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

  function handleAddByLink() {
    setImportLinks('')
    setShowImportModal(true)
  }

  async function handleImportSubmit() {
    const links = importLinks.split('\n').map(l => l.trim()).filter(Boolean)
    if (!links.length) return
    if (links.length > MAX_LINKS) {
      showAlert(`Máximo de ${MAX_LINKS} cartas por lote. Você colou ${links.length} links.`, 'warning')
      return
    }

    setShowImportModal(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { showAlert('Você precisa estar logado', 'error'); return }

    setImportingTotal(links.length)
    setImporting(true)
    setImportingMsg(LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)])
    const msgInterval = setInterval(() => {
      setImportingMsg(LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)])
    }, 3000)

    let success = 0, fail = 0

    for (const url of links) {
      try {
        const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
        const data = await res.json()
        if (!data?.card_name) { fail++; continue }

        let existing = null
        if (data.card_number) {
          const { data: list } = await supabase.from('user_cards').select('*')
            .eq('user_id', userData.user.id).eq('card_id', data.card_number).limit(1)
          existing = list?.[0] || null
        }
        if (!existing) {
          const { data: list } = await supabase.from('user_cards').select('*')
            .eq('user_id', userData.user.id).ilike('card_name', data.card_name).limit(1)
          existing = list?.[0] || null
        }

        if (existing) {
          await supabase.from('user_cards')
            .update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id)
          success++
        } else {
          if (!isPro) {
            const { bloqueado } = await checkCardLimit(userData.user.id)
            if (bloqueado) {
              clearInterval(msgInterval)
              setImporting(false)
              showAlert(`Você atingiu o limite de ${LIMITE_FREE} cartas do plano gratuito. Acesse Minha Conta para fazer upgrade.`, 'warning')
              if (success > 0) window.location.reload()
              return
            }
          }
          const { error } = await supabase.from('user_cards').insert({
            user_id: userData.user.id,
            card_name: data.card_name, card_id: data.card_number,
            card_image: data.card_image, card_link: data.link,
            rarity: data.rarity || null, quantity: 1,
            set_name: data.set_name || null,
            variante: data.variantes?.normal ? 'normal'
              : data.variantes?.foil ? 'foil'
              : data.variantes?.promo ? 'promo'
              : data.variantes?.reverse ? 'reverse'
              : data.variantes?.pokeball ? 'pokeball'
              : 'normal',
          })
          if (error) { fail++; continue }
          success++
        }
        await supabase.from('card_prices').upsert({
          card_name: data.card_name,
          preco_min: data.preco_min || 0, preco_medio: data.preco_medio || 0,
          preco_max: data.preco_max || 0, preco_normal: data.preco_normal || 0,
          preco_foil: data.preco_foil || 0, updated_at: new Date().toISOString(),
        }, { onConflict: 'card_name' })
      } catch { fail++ }
    }

    clearInterval(msgInterval)
    setImporting(false)
    const msg = success > 0
      ? `✓ ${success} carta${success > 1 ? 's adicionadas' : ' adicionada'}!${fail > 0 ? ` · ${fail} falha(s)` : ''}`
      : 'Não foi possível importar. Verifique os links.'
    showAlert(msg, success > 0 ? 'success' : 'error')
    if (success > 0) window.location.reload()
  }

  async function handleAddPrice(card: any) {
    const url = await showPrompt({
      message: `Cole o link da LigaPokemon para "${card.card_name}":`,
      placeholder: 'https://www.ligapokemon.com.br/?view=cards/card&card=...',
      icon: undefined,
    })
    if (!url) return

    setLoadingPriceId(card.id)
    try {
      const { authFetch } = await import('@/lib/authFetch')
      const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!data?.card_name) {
        setLoadingPriceId(null)
        showAlert(data?.error || 'Não foi possível importar o preço. Verifique o link.', 'error')
        return
      }

      const variantes = data.variantes || {}
      const n = variantes.normal
      const f = variantes.foil
      const p = variantes.promo
      const r = variantes.reverse

      // Salva com o card_name EXATO do user_cards — garante que o JOIN funcione
      await supabase.from('card_prices').upsert({
        card_name: card.card_name,
        preco_min:    n?.min    || 0,
        preco_medio:  n?.medio  || 0,
        preco_max:    n?.max    || 0,
        preco_normal: n?.medio  || 0,
        preco_foil:   f?.medio  || 0,
        preco_foil_min:    f?.min    || null,
        preco_foil_medio:  f?.medio  || null,
        preco_foil_max:    f?.max    || null,
        preco_promo_min:   p?.min    || null,
        preco_promo_medio: p?.medio  || null,
        preco_promo_max:   p?.max    || null,
        preco_reverse_min:   r?.min   || null,
        preco_reverse_medio: r?.medio || null,
        preco_reverse_max:   r?.max   || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })

      // Atualiza o link da carta
      await supabase.from('user_cards')
        .update({ card_link: data.link || url })
        .eq('id', card.id)

      const nomes = Object.keys(variantes).map(k => k.charAt(0).toUpperCase() + k.slice(1))
      const msg = nomes.length > 0
        ? `Preços importados: ${nomes.join(', ')}`
        : 'Preço importado com sucesso!'

      showAlert(msg, 'success')
      setLoadingPriceId(null)
      loadCards()
    } catch {
      setLoadingPriceId(null)
      showAlert('Erro ao importar preço. Tente novamente.', 'error')
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

      {/* Modal de importação por link */}
      {showImportModal && (() => {
        const lines = importLinks.split('\n').map(l => l.trim()).filter(Boolean)
        const count = lines.length
        const overLimit = count > MAX_LINKS
        const secs = count * SECS_PER_CARD
        const timeStr = secs >= 60
          ? `~${Math.floor(secs / 60)}min${secs % 60 > 0 ? ` ${secs % 60}s` : ''}`
          : `~${secs}s`
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9997,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 460,
              fontFamily: "\'DM Sans\', system-ui, sans-serif", color: '#f0f0f0',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}>
              {/* Título */}
              <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Importar cartas por link
              </p>

              {/* Subtítulo */}
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 20 }}>
                Cole os links da LigaPokemon, um por linha. Aceita links completos ou curtos (lig.ae). Máximo de {MAX_LINKS} cartas por vez.
              </p>

              {/* Textarea */}
              <textarea
                autoFocus
                value={importLinks}
                onChange={e => setImportLinks(e.target.value)}
                rows={6}
                placeholder={"https://www.ligapokemon.com.br/...\nhttps://lig.ae/c2/...\nhttps://lig.ae/c2/..."}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${overLimit ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 10, padding: '12px 14px', color: '#f0f0f0',
                  fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none',
                  fontFamily: 'monospace', boxSizing: 'border-box', marginBottom: 12,
                  transition: 'border-color 0.2s',
                }}
              />

              {/* Contador + estimativa */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: overLimit ? '#ef4444' : count > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                }}>
                  {count === 0 ? 'Nenhum link colado ainda'
                    : overLimit ? `${count}/${MAX_LINKS} — limite excedido!`
                    : `${count} de ${MAX_LINKS} carta${count > 1 ? 's' : ''}`}
                </span>
                {count > 0 && !overLimit && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    ⏱ Estimado: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{timeStr}</strong>
                  </span>
                )}
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowImportModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.6)', padding: '10px 20px', borderRadius: 10,
                    fontSize: 14, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={count === 0 || overLimit}
                  style={{
                    background: count === 0 || overLimit ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    border: 'none', borderRadius: 10, padding: '10px 24px',
                    color: count === 0 || overLimit ? 'rgba(255,255,255,0.3)' : '#000',
                    fontSize: 14, cursor: count === 0 || overLimit ? 'not-allowed' : 'pointer', fontWeight: 700,
                  }}
                >
                  {count > 0 && !overLimit ? `Importar ${count} carta${count > 1 ? 's' : ''} →` : 'Importar →'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      <div className="p-6">

        {/* Onboarding */}

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12, flexDirection: 'column' }} className="md-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
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
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                {filteredCards.length !== cards.length
                  ? `${filteredCards.length} de ${cards.length} carta${cards.length !== 1 ? 's' : ''}`
                  : `${cards.length} carta${cards.length !== 1 ? 's' : ''} na coleção`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
              <button
                onClick={handleAddByLink}
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                + Importar por link
              </button>
              {userId && (
                <button
                  onClick={() => setOpenAddModal(true)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '11px 18px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                >
                  Buscar na API
                </button>
              )}
              {userId && (
                <button
                  onClick={() => setOpenScanModal(true)}
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '11px 18px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
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
                    style={{ background: isPro ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isPro ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`, color: isPro ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', padding: '11px 16px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: isPro ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
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
          <div className="colecao-resumo-card" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p style={{ fontSize: 11, color: 'rgba(34,197,94,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mínimo da Carteira</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', letterSpacing: '-0.02em' }}>{fmt(totais.min)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Pior cenário de venda</p>
          </div>
          <div className="colecao-resumo-card" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <p style={{ fontSize: 11, color: 'rgba(96,165,250,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Valor Médio</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.02em' }}>{fmt(totais.medio)}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Preço médio de mercado</p>
          </div>
          <div className="colecao-resumo-card" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
            <p style={{ fontSize: 13, marginTop: 8 }}>Clique em "+ Importar por link" para começar</p>
          </div>
        )}

        {filteredCards.length === 0 && cards.length > 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <IconSearch size={36} color="rgba(255,255,255,0.15)" style={{marginBottom:12}} />
            <p style={{ fontSize: 15, marginBottom: 6 }}>Nenhuma carta encontrada</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Tente outros filtros ou limpe a busca</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {filteredCards.map((c) => {
            const variante = getVarianteEfetiva(c.price, c.variante || 'normal')
            const variantesDisponiveis = getVariantesDisponiveis(c.price)
            const precos = getVariantePrices(c.price, variante)

            return (
              <div
                key={c.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: (precos.medio || 0) > 100 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  padding: 16,
                  transition: 'border-color 0.2s',
                }}
              >
                <img
                  src={c.card_image || '/placeholder-card.png'}
                  alt={c.card_name}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    if (!e.currentTarget.src.includes('placeholder-card.png'))
                      e.currentTarget.src = '/placeholder-card.png'
                  }}
                  className="w-full h-auto object-cover rounded"
                />

                <div className="mt-3">
                  <a href={c.card_link} target="_blank" className="font-semibold text-sm text-blue-400 hover:underline">
                    {c.card_name}
                  </a>

                  {/* Quantidade */}
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <button onClick={() => handleUpdateQuantity(c, -1)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>-</button>
                    <span>Qtd: {c.quantity || 1}</span>
                    <button onClick={() => handleUpdateQuantity(c, 1)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>+</button>
                  </div>

                  {/* ✅ Seletor de variante */}
                  {variantesDisponiveis.length > 1 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Tipo da carta:</p>
                      <select
                        value={variante}
                        onChange={(e) => handleVarianteChange(c, e.target.value)}
                        style={{ width: "100%", fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 8px", color: "#fff", cursor: "pointer" }}
                      >
                        {variantesDisponiveis.map(v => (
                          <option key={v.key} value={v.key}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Preços da variante selecionada */}
                  <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    <p style={{ marginBottom: 6 }}>Raridade: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{c.rarity || '—'}</span></p>

                    {c.price && (precos.min || precos.medio || precos.max) ? (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Mínimo</span>
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmt(precos.min)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Médio</span>
                          <span style={{ color: '#60a5fa', fontWeight: 700 }}>{fmt(precos.medio)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Máximo</span>
                          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{fmt(precos.max)}</span>
                        </div>
                      </div>
                    ) : (
                      /* Sem preço — botão para adicionar */
                      <button
                        onClick={() => loadingPriceId === c.id ? null : handleAddPrice(c)}
                        disabled={loadingPriceId === c.id}
                        style={{
                          width: '100%', marginTop: 4,
                          background: loadingPriceId === c.id ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
                          border: '1px dashed rgba(245,158,11,0.4)',
                          color: '#f59e0b', padding: '9px 12px',
                          borderRadius: 10, fontSize: 12,
                          cursor: loadingPriceId === c.id ? 'not-allowed' : 'pointer', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {loadingPriceId === c.id ? (
                          <>
                            <div style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}>
                              <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="36" cy="36" r="34" fill="#fff" stroke="#f59e0b" strokeWidth="4"/>
                                <path d="M2 36 Q2 2 36 2 Q70 2 70 36Z" fill="#e53e3e"/>
                                <rect x="2" y="33" width="68" height="6" fill="#333"/>
                                <circle cx="36" cy="36" r="10" fill="#fff" stroke="#333" strokeWidth="3"/>
                              </svg>
                            </div>
                            Buscando preço...
                          </>
                        ) : (
                          <><IconLink size={13} color="currentColor" style={{marginRight:5}} />Vincular preço da LigaPokemon</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(c.id, c.card_name)}
                  style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', width: '100%', padding: '8px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                >
                  Remover
                </button>
                <button
                  onClick={() => handleSell(c)}
                  style={{ marginTop: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', width: '100%', padding: '8px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                >
                  Vender
                </button>
              </div>
            )
          })}
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