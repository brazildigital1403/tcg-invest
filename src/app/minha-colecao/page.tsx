'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'

const fmt = (v: number | null | undefined) => {
  if (!v) return 'R$ -'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// Retorna os preços da variante selecionada pelo usuário
function getVariantePrices(price: any, variante: string) {
  if (!price) return { min: null, medio: null, max: null }
  switch (variante) {
    case 'foil':
      return { min: price.preco_foil_min, medio: price.preco_foil_medio, max: price.preco_foil_max }
    case 'promo':
      return { min: price.preco_promo_min, medio: price.preco_promo_medio, max: price.preco_promo_max }
    case 'reverse':
      return { min: price.preco_reverse_min, medio: price.preco_reverse_medio, max: price.preco_reverse_max }
    case 'pokeball':
      return { min: price.preco_pokeball_min, medio: price.preco_pokeball_medio, max: price.preco_pokeball_max }
    default:
      return { min: price.preco_min, medio: price.preco_medio, max: price.preco_max }
  }
}

// Variantes disponíveis para uma carta com base nos preços que existem
function getVariantesDisponiveis(price: any) {
  if (!price) return [{ key: 'normal', label: 'Normal' }]
  const opts = [{ key: 'normal', label: 'Normal' }]
  if (price.preco_foil_medio) opts.push({ key: 'foil', label: 'Foil' })
  if (price.preco_promo_medio) opts.push({ key: 'promo', label: 'Promo' })
  if (price.preco_reverse_medio) opts.push({ key: 'reverse', label: 'Reverse Foil' })
  if (price.preco_pokeball_medio) opts.push({ key: 'pokeball', label: 'Pokeball Foil' })
  return opts
}

export default function MinhaColecao() {
  const { showAlert, showPrompt, showConfirm } = useAppModal()
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadCards() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { window.location.href = '/login'; return }

    const { data } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })

    const cardsData = data || []
    const names = cardsData.map((c) => c.card_name?.trim())
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

    const merged = cardsData.map((c) => ({
      ...c,
      price: priceMap[c.card_name?.trim()] || null,
    }))

    setCards(merged)
    setLoading(false)
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

  async function handleAddByLink() {
    const url = await showPrompt({ message: 'Cole o link da carta na LigaPokemon:', placeholder: 'https://www.ligapokemon.com.br/?view=cards/card&card=...' })
    if (!url) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { showAlert('Você precisa estar logado', 'error'); return }

    try {
      const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!data?.card_name) {
        showAlert('Não foi possível identificar a carta. Verifique o link e tente novamente.', 'error')
        return
      }

      let existing = null
      if (data.card_number) {
        const { data: list } = await supabase.from('user_cards').select('*')
          .eq('user_id', userData.user.id).eq('card_id', data.card_number)
        existing = list && list.length > 0 ? list[0] : null
      } else {
        const { data: list } = await supabase.from('user_cards').select('*')
          .eq('user_id', userData.user.id).ilike('card_name', data.card_name)
        existing = list && list.length > 0 ? list[0] : null
      }

      let insertError = null
      if (existing) {
        const { error } = await supabase.from('user_cards')
          .update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id)
        insertError = error
      } else {
        const { error } = await supabase.from('user_cards').insert({
          user_id: userData.user.id,
          card_name: data.card_name,
          card_id: data.card_number,
          card_image: data.card_image,
          card_link: data.link,
          rarity: data.rarity || null,
          quantity: 1,
          variante: 'normal',
        })
        insertError = error
      }

      if (insertError) { showAlert('Erro ao salvar a carta. Tente novamente.', 'error'); return }

      await supabase.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: data.preco_min || 0,
        preco_medio: data.preco_medio || 0,
        preco_max: data.preco_max || 0,
        preco_normal: data.preco_normal || 0,
        preco_foil: data.preco_foil || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })

      await supabase.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: data.preco_min || null,
        preco_medio: data.preco_medio || null,
        preco_max: data.preco_max || null,
        recorded_at: new Date().toISOString(),
      })

      showAlert('Carta adicionada com sucesso!', 'success')
      window.location.reload()
    } catch (err) {
      showAlert('Erro ao importar a carta. Verifique o link.', 'error')
    }
  }

  async function handleAddPrice(card: any) {
    const url = await showPrompt({
      message: `Cole o link da LigaPokemon para "${card.card_name}":`,
      placeholder: 'https://www.ligapokemon.com.br/?view=cards/card&card=...',
      icon: '🔗',
    })
    if (!url) return

    try {
      const { authFetch } = await import('@/lib/authFetch')
      const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!data?.card_name) {
        showAlert('Não foi possível importar o preço. Verifique o link.', 'error')
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
      loadCards()
    } catch {
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
      await handleRemove(card.id)
    } else {
      await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
    }
    showAlert('Venda realizada com sucesso!', 'success')
  }

  async function handleUpdateQuantity(card: any, delta: number) {
    const newQty = (card.quantity || 1) + delta
    if (newQty <= 0) { await handleRemove(card.id); return }
    const { error } = await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
    if (error) { showAlert('Erro ao atualizar quantidade.', 'error'); return }
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
  }

  async function handleRemove(id: string) {
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
    const fn = () => loadCards()
    window.addEventListener('focus', fn)
    return () => window.removeEventListener('focus', fn)
  }, [])

  if (loading) {
    return <AppLayout><div className="p-6">Carregando coleção...</div></AppLayout>
  }

  // ✅ Totais da carteira baseados na VARIANTE selecionada de cada carta
  const totais = cards.reduce((acc, c) => {
    const variante = c.variante || 'normal'
    const p = getVariantePrices(c.price, variante)
    const qty = c.quantity || 1
    return {
      min: acc.min + (p.min || 0) * qty,
      medio: acc.medio + (p.medio || 0) * qty,
      max: acc.max + (p.max || 0) * qty,
    }
  }, { min: 0, medio: 0, max: 0 })

  return (
    <AppLayout>
      <div className="p-6">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Minha Coleção</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{cards.length} carta{cards.length !== 1 ? 's' : ''} na coleção</p>
          </div>
          <button
            onClick={handleAddByLink}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}
          >
            + Importar por link
          </button>
        </div>

        {/* Resumo financeiro — scroll horizontal com snap no mobile */}
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

        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🃏</p>
            <p style={{ fontSize: 16 }}>Você ainda não adicionou cartas.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Clique em "+ Importar por link" para começar</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {cards.map((c) => {
            const variante = c.variante || 'normal'
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
                        onClick={() => handleAddPrice(c)}
                        style={{
                          width: '100%', marginTop: 4,
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px dashed rgba(245,158,11,0.4)',
                          color: '#f59e0b', padding: '9px 12px',
                          borderRadius: 10, fontSize: 12,
                          cursor: 'pointer', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        🔗 Vincular preço da LigaPokemon
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(c.id)}
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
    </AppLayout>
  )
}