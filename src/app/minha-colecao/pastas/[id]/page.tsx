'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { setLabel } from '@/lib/setLabel'
import { getUserPlan } from '@/lib/isPro'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconSearch, IconClose } from '@/components/ui/Icons'

const LIMITE_CARTAS_FREE = 100
const PAGE = 9

const fmtBRL = (v: any) => {
  const num = Number(v)
  if (!num || num <= 0) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil',
}

type PastaCard = {
  user_card_id: string
  card_name: string
  card_image: string | null
  set_name: string | null
  set_id: string | null
  rarity: string | null
  variante: string
  quantity: number
  pokemon_api_id: string | null
  unit: number
  posicao: number
  added_at: string
}

type PastaMeta = {
  id: string
  nome: string
  descricao: string | null
  view_mode: string
  locked: boolean
  publico: boolean
}

type InvCard = {
  id: string
  card_name: string
  card_image: string | null
  set_name: string | null
  variante: string
  quantity: number
  rarity: string | null
}

export default function PastaDetalhe() {
  const params = useParams()
  const id = String(params?.id || '')
  const { showAlert, showPrompt, showConfirm } = useAppModal()

  const [meta, setMeta] = useState<PastaMeta | null>(null)
  const [cards, setCards] = useState<PastaCard[]>([])
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'lista' | 'pasta'>('grid')
  const [search, setSearch] = useState('')
  const [openPicker, setOpenPicker] = useState(false)

  async function loadCards() {
    const { data, error } = await supabase.rpc('pasta_detalhe', { p_pasta_id: id })
    if (error) { console.error('[pasta] pasta_detalhe error:', error.message); setCards([]); return }
    setCards((data || []).map((c: any, i: number) => ({
      ...c,
      unit: Number(c.unit) || 0,
      quantity: Number(c.quantity) || 1,
      posicao: c.posicao == null ? i : Number(c.posicao),
    })))
  }

  async function load() {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) { window.location.href = '/login'; return }
      setUserId(userData.user.id)

      const { isPro: pro, isTrial: trial } = await getUserPlan(userData.user.id)
      setIsPro(pro || trial)

      const { data: m, error: me } = await supabase
        .from('pastas')
        .select('id, nome, descricao, view_mode, locked, publico')
        .eq('id', id)
        .single()
      if (me || !m) { showAlert('Pasta não encontrada.', 'error'); window.location.href = '/minha-colecao/pastas'; return }
      setMeta(m as PastaMeta)
      setViewMode(m.view_mode === 'lista' ? 'lista' : m.view_mode === 'pasta' ? 'pasta' : 'grid')

      await loadCards()
    } catch (err: any) {
      console.error('[pasta] load error:', err?.message || err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) load() }, [id])

  // Stats client-side
  const qtd = cards.length
  const patrimonio = cards.reduce((s, c) => s + c.unit * (c.quantity || 1), 0)
  const maisCara = cards.reduce<PastaCard | null>((max, c) => (!max || c.unit > max.unit ? c : max), null)

  const filtered = cards.filter(c => !search || c.card_name?.toLowerCase().includes(search.toLowerCase()))

  async function setView(mode: 'grid' | 'lista' | 'pasta') {
    setViewMode(mode)
    await supabase.from('pastas').update({ view_mode: mode }).eq('id', id)
  }

  async function handleRename() {
    if (!meta) return
    const nome = await showPrompt({ message: 'Renomear Pasta', placeholder: meta.nome })
    if (!nome) return
    const t = nome.trim()
    if (t.length < 1 || t.length > 60) { showAlert('O nome precisa ter entre 1 e 60 caracteres.', 'error'); return }
    const { error } = await supabase.from('pastas').update({ nome: t }).eq('id', id)
    if (error) { showAlert('Erro ao renomear.', 'error'); return }
    setMeta({ ...meta, nome: t })
  }

  async function handleDelete() {
    if (!meta) return
    const ok = await showConfirm({
      message: `Excluir a Pasta "${meta.nome}"? As cartas continuam na sua coleção.`,
      confirmLabel: 'Sim, excluir', cancelLabel: 'Cancelar', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('pastas').delete().eq('id', id)
    if (error) { showAlert('Erro ao excluir.', 'error'); return }
    window.location.href = '/minha-colecao/pastas'
  }

  async function handleRemoveFromPasta(ucId: string) {
    const ok = await showConfirm({
      message: 'Remover esta carta da Pasta? Ela continua na sua coleção.',
      confirmLabel: 'Remover', cancelLabel: 'Cancelar', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('pasta_cards').delete().eq('pasta_id', id).eq('user_card_id', ucId)
    if (error) { showAlert('Erro ao remover.', 'error'); return }
    setCards(prev => prev.filter(c => c.user_card_id !== ucId))
  }

  async function handleAddCards(selectedIds: string[]): Promise<boolean> {
    if (selectedIds.length === 0) return false
    if (!isPro && (cards.length + selectedIds.length) > LIMITE_CARTAS_FREE) {
      showAlert(`No plano Free cada Pasta tem até ${LIMITE_CARTAS_FREE} cartas. Faça upgrade para o Pro e tenha pastas ilimitadas.`, 'warning')
      return false
    }
    const maxPos = cards.reduce((m, c) => Math.max(m, c.posicao ?? -1), -1)
    const rows = selectedIds.map((uc, i) => ({ pasta_id: id, user_card_id: uc, posicao: maxPos + 1 + i }))
    const { error } = await supabase.from('pasta_cards').insert(rows)
    if (error) { showAlert('Erro ao adicionar cartas.', 'error'); return false }
    await loadCards()
    return true
  }

  // Reordenar (fichário): updates = [{id, pos}]
  async function handleMove(updates: { id: string; pos: number }[]) {
    if (updates.length === 0) return
    setCards(prev => prev.map(c => {
      const u = updates.find(x => x.id === c.user_card_id)
      return u ? { ...c, posicao: u.pos } : c
    }))
    const { error } = await supabase.rpc('reordenar_pasta', { p_pasta_id: id, p_itens: updates.map(u => ({ id: u.id, pos: u.pos })) })
    if (error) { showAlert('Erro ao salvar a organização.', 'error'); await loadCards() }
  }

  if (loading) {
    return <AppLayout><div className="p-6">Carregando pasta...</div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="p-6">

        {/* Voltar */}
        <Link href="/minha-colecao/pastas" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 16 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Pastas
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{meta?.nome}</h1>
              {meta?.locked && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>🔒 Travada</span>
              )}
            </div>
            {meta?.descricao && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{meta.descricao}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={handleRename} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Renomear</button>
            <button onClick={handleDelete} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '8px 14px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Excluir</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 18px' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cartas</p>
            <p style={{ fontSize: 20, fontWeight: 800 }}>{qtd}{!isPro && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>/{LIMITE_CARTAS_FREE}</span>}</p>
          </div>
          <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 12, padding: '12px 18px' }}>
            <p style={{ fontSize: 10, color: 'rgba(96,165,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Valor estimado</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{fmtBRL(patrimonio) || 'R$ 0,00'}</p>
          </div>
          {maisCara && maisCara.unit > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 18px', maxWidth: 240 }}>
              <p style={{ fontSize: 10, color: 'rgba(245,158,11,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Carta mais cara</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{maisCara.card_name.replace(/\s*\([^)]*\)/, '')}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmtBRL(maisCara.unit)}</p>
            </div>
          )}
        </div>

        {/* Barra de ações */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={() => setOpenPicker(true)}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Adicionar cartas
          </button>

          {cards.length > 0 && viewMode !== 'pasta' && (
            <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 320 }}>
              <IconSearch size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nesta pasta..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px 8px 32px', color: '#f0f0f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          )}

          {/* Toggle grade / lista / fichário */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3 }}>
            <button onClick={() => setView('grid')} style={{ background: viewMode === 'grid' ? 'rgba(245,158,11,0.15)' : 'transparent', border: 'none', color: viewMode === 'grid' ? '#f59e0b' : 'rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Grade</button>
            <button onClick={() => setView('lista')} style={{ background: viewMode === 'lista' ? 'rgba(245,158,11,0.15)' : 'transparent', border: 'none', color: viewMode === 'lista' ? '#f59e0b' : 'rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Lista</button>
            <button onClick={() => setView('pasta')} style={{ background: viewMode === 'pasta' ? 'rgba(245,158,11,0.15)' : 'transparent', border: 'none', color: viewMode === 'pasta' ? '#f59e0b' : 'rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Fichário</button>
          </div>
        </div>

        {/* Vazio */}
        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '70px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 44, marginBottom: 12 }}>🃏</p>
            <p style={{ fontSize: 15 }}>Nenhuma carta nesta pasta ainda.</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Clique em "Adicionar cartas" para trazer cartas da sua coleção.</p>
          </div>
        )}

        {/* GRID */}
        {viewMode === 'grid' && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
            {filtered.map((c) => (
              <div key={c.user_card_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                <button
                  onClick={() => handleRemoveFromPasta(c.user_card_id)}
                  title="Remover da pasta"
                  style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconClose size={13} />
                </button>
                <div style={{ aspectRatio: '63/88', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.card_image
                    ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 30 }}>🃏</span>}
                </div>
                <div style={{ padding: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.card_name.replace(/\s*\([^)]*\)/, '')}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{setLabel(c.set_name) || '—'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{VARIANTE_LABEL[c.variante] || c.variante}</span>
                    {c.quantity > 1 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>x{c.quantity}</span>}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: c.unit > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)', marginTop: 6 }}>{fmtBRL(c.unit) || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LISTA */}
        {viewMode === 'lista' && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((c) => (
              <div key={c.user_card_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 12px' }}>
                <div style={{ width: 34, height: 47, flexShrink: 0, background: '#0d0f14', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {c.card_image ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span>🃏</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.card_name.replace(/\s*\([^)]*\)/, '')}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{setLabel(c.set_name) || '—'} · {VARIANTE_LABEL[c.variante] || c.variante}{c.quantity > 1 ? ` · x${c.quantity}` : ''}</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: c.unit > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{fmtBRL(c.unit) || '—'}</p>
                <button onClick={() => handleRemoveFromPasta(c.user_card_id)} title="Remover da pasta" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconClose size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* FICHÁRIO (álbum) */}
        {viewMode === 'pasta' && (
          <Binder cards={cards} onMove={handleMove} onRemove={handleRemoveFromPasta} />
        )}

        {filtered.length === 0 && cards.length > 0 && viewMode !== 'pasta' && (
          <div style={{ textAlign: 'center', padding: '50px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Nenhuma carta encontrada nesta pasta.</div>
        )}
      </div>

      {openPicker && userId && (
        <AddCardsModal
          userId={userId}
          isPro={isPro}
          currentCount={cards.length}
          excludeIds={new Set(cards.map(c => c.user_card_id))}
          onClose={() => setOpenPicker(false)}
          onAdd={async (ids) => { const ok = await handleAddCards(ids); if (ok) setOpenPicker(false) }}
        />
      )}
    </AppLayout>
  )
}

/* ───────────────────────── Fichário (álbum físico) ───────────────────────── */
function Binder({
  cards, onMove, onRemove,
}: {
  cards: PastaCard[]
  onMove: (updates: { id: string; pos: number }[]) => void
  onRemove: (ucId: string) => void
}) {
  const [isMobile, setIsMobile] = useState(false)
  const [spread, setSpread] = useState(0)
  const [extraSpreads, setExtraSpreads] = useState(0)
  const [ghost, setGhost] = useState<{ x: number; y: number; card: PastaCard } | null>(null)
  const [overPos, setOverPos] = useState<number | null>(null)
  const dragRef = useRef<{ ucId: string; fromPos: number } | null>(null)
  const byPosRef = useRef<Map<number, PastaCard>>(new Map())
  const flipDirRef = useRef<'next' | 'prev'>('next')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const f = () => setIsMobile(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const pagesPerView = isMobile ? 1 : 2

  // Mapa bolso -> carta
  const byPos = new Map<number, PastaCard>()
  cards.forEach(c => { if (c.posicao != null) byPos.set(c.posicao, c) })
  byPosRef.current = byPos

  const maxPos = cards.reduce((m, c) => Math.max(m, c.posicao ?? -1), -1)
  const lastCardPage = maxPos >= 0 ? Math.floor(maxPos / PAGE) : -1
  const baseSpreads = maxPos >= 0 ? Math.floor(lastCardPage / pagesPerView) + 1 : 1
  const totalSpreads = Math.max(1, baseSpreads + extraSpreads)

  // Clamp do spread atual
  useEffect(() => {
    if (spread > totalSpreads - 1) setSpread(Math.max(0, totalSpreads - 1))
  }, [totalSpreads]) // eslint-disable-line react-hooks/exhaustive-deps

  function go(dir: 1 | -1) {
    setSpread(s => {
      const next = s + dir
      if (next < 0 || next > totalSpreads - 1) return s
      flipDirRef.current = dir === 1 ? 'next' : 'prev'
      return next
    })
  }

  // Teclado ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [totalSpreads]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & drop por pointer (mouse + toque) ──
  function startDrag(e: React.PointerEvent, card: PastaCard) {
    e.preventDefault()
    dragRef.current = { ucId: card.user_card_id, fromPos: card.posicao }
    setGhost({ x: e.clientX, y: e.clientY, card })

    const onPointerMove = (ev: PointerEvent) => {
      setGhost(g => g ? { ...g, x: ev.clientX, y: ev.clientY } : g)
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const pocket = el?.closest('[data-pocket]') as HTMLElement | null
      setOverPos(pocket ? Number(pocket.getAttribute('data-pocket')) : null)
    }
    const onPointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      const drag = dragRef.current
      dragRef.current = null
      setGhost(null)
      setOverPos(null)
      if (!drag) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const pocket = el?.closest('[data-pocket]') as HTMLElement | null
      if (!pocket) return
      const targetPos = Number(pocket.getAttribute('data-pocket'))
      if (Number.isNaN(targetPos) || targetPos === drag.fromPos) return
      const occupant = byPosRef.current.get(targetPos)
      const updates = [{ id: drag.ucId, pos: targetPos }]
      if (occupant && occupant.user_card_id !== drag.ucId) {
        updates.push({ id: occupant.user_card_id, pos: drag.fromPos })
      }
      onMove(updates)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const pagesToShow: number[] = []
  for (let k = 0; k < pagesPerView; k++) pagesToShow.push(spread * pagesPerView + k)

  return (
    <div>
      <style>{`
        @keyframes binderNext { from { opacity: 0.35; transform: translateX(46px) rotateY(-10deg) } to { opacity: 1; transform: none } }
        @keyframes binderPrev { from { opacity: 0.35; transform: translateX(-46px) rotateY(10deg) } to { opacity: 1; transform: none } }
      `}</style>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Arraste as cartas para organizar — solte sobre outra para trocar de lugar.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => go(-1)} disabled={spread <= 0}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: spread <= 0 ? 'rgba(255,255,255,0.2)' : '#f0f0f0', cursor: spread <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', minWidth: 70, textAlign: 'center' }}>Abertura {spread + 1}/{totalSpreads}</span>
          <button onClick={() => go(1)} disabled={spread >= totalSpreads - 1}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: spread >= totalSpreads - 1 ? 'rgba(255,255,255,0.2)' : '#f0f0f0', cursor: spread >= totalSpreads - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => { setExtraSpreads(e => e + 1); setSpread(totalSpreads); }}
            style={{ marginLeft: 4, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Página</button>
        </div>
      </div>

      {/* Álbum aberto */}
      <div style={{ perspective: 1600 }}>
        <div
          key={spread}
          style={{
            display: 'grid',
            gridTemplateColumns: pagesPerView === 2 ? '1fr 1fr' : '1fr',
            gap: pagesPerView === 2 ? 0 : 16,
            maxWidth: pagesPerView === 2 ? 760 : 380,
            margin: '0 auto',
            animation: `${flipDirRef.current === 'prev' ? 'binderPrev' : 'binderNext'} 0.35s ease`,
          }}
        >
          {pagesToShow.map((pg, idx) => (
            <div
              key={pg}
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: pagesPerView === 2 ? (idx === 0 ? '14px 4px 4px 14px' : '4px 14px 14px 4px') : 14,
                padding: 12,
                boxShadow: pagesPerView === 2
                  ? (idx === 0 ? 'inset -10px 0 16px -12px rgba(0,0,0,0.7)' : 'inset 10px 0 16px -12px rgba(0,0,0,0.7)')
                  : 'none',
              }}
            >
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Página {pg + 1}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {Array.from({ length: PAGE }).map((_, slot) => {
                  const globalIndex = pg * PAGE + slot
                  const card = byPos.get(globalIndex)
                  const isOver = overPos === globalIndex
                  const isDragged = dragRef.current?.ucId === card?.user_card_id && !!card
                  return (
                    <div
                      key={globalIndex}
                      data-pocket={globalIndex}
                      style={{
                        position: 'relative',
                        aspectRatio: '63/88',
                        borderRadius: 8,
                        background: card ? '#0d0f14' : 'rgba(255,255,255,0.015)',
                        border: isOver ? '2px solid #f59e0b' : card ? '1px solid rgba(255,255,255,0.1)' : '1.5px dashed rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        opacity: isDragged ? 0.35 : 1,
                        transition: 'border-color 0.1s',
                      }}
                    >
                      {card && (
                        <div
                          onPointerDown={(e) => startDrag(e, card)}
                          title={card.card_name}
                          style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }}
                        >
                          {card.card_image
                            ? <img src={card.card_image} alt={card.card_name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>🃏</div>}
                          {card.quantity > 1 && (
                            <span style={{ position: 'absolute', bottom: 5, left: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'rgba(0,0,0,0.7)', color: '#fff' }}>x{card.quantity}</span>
                          )}
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onRemove(card.user_card_id)}
                            title="Remover da pasta"
                            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <IconClose size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ghost que segue o dedo/mouse */}
      {ghost && (
        <div style={{ position: 'fixed', left: ghost.x, top: ghost.y, transform: 'translate(-50%, -50%) rotate(-4deg)', width: 92, aspectRatio: '63/88', zIndex: 9999, pointerEvents: 'none', borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(245,158,11,0.6)' }}>
          {ghost.card.card_image
            ? <img src={ghost.card.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0d0f14' }} />
            : <div style={{ width: '100%', height: '100%', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🃏</div>}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Modal: escolher cartas do inventário ───────────────────────── */
function AddCardsModal({
  userId, isPro, currentCount, excludeIds, onClose, onAdd,
}: {
  userId: string
  isPro: boolean
  currentCount: number
  excludeIds: Set<string>
  onClose: () => void
  onAdd: (ids: string[]) => void
}) {
  const [inv, setInv] = useState<InvCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const restante = isPro ? Infinity : Math.max(0, LIMITE_CARTAS_FREE - currentCount)

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_cards')
        .select('id, card_name, card_image, set_name, variante, quantity, rarity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setInv((data || []).filter((c: any) => !excludeIds.has(c.id)) as InvCard[])
      setLoading(false)
    })()
  }, [userId])

  const filtered = inv.filter(c => !search || c.card_name?.toLowerCase().includes(search.toLowerCase()))

  function toggle(cid: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(cid)) { next.delete(cid); return next }
      if (!isPro && next.size >= restante) return prev
      next.add(cid)
      return next
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700 }}>Adicionar cartas</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Escolha cartas da sua coleção{!isPro ? ` · restam ${restante} no Free` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, width: 30, height: 30, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose size={14} /></button>
        </div>

        {/* Busca */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
          <IconSearch size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 31, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na coleção..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px 8px 30px', color: '#f0f0f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading && <p style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Carregando coleção...</p>}
          {!loading && inv.length === 0 && <p style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Todas as suas cartas já estão nesta pasta (ou sua coleção está vazia).</p>}
          {!loading && filtered.map((c) => {
            const isSel = selected.has(c.id)
            const blocked = !isSel && !isPro && selected.size >= restante
            return (
              <div key={c.id} onClick={() => toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, cursor: blocked ? 'not-allowed' : 'pointer', background: isSel ? 'rgba(245,158,11,0.1)' : 'transparent', opacity: blocked ? 0.4 : 1, marginBottom: 2 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSel ? '#f59e0b' : 'rgba(255,255,255,0.25)'}`, background: isSel ? '#f59e0b' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSel && <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ width: 28, height: 39, flexShrink: 0, background: '#0d0f14', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {c.card_image ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 14 }}>🃏</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.card_name.replace(/\s*\([^)]*\)/, '')}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{setLabel(c.set_name) || '—'} · {VARIANTE_LABEL[c.variante] || c.variante}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{selected.size} selecionada{selected.size !== 1 ? 's' : ''}</span>
          <button
            disabled={selected.size === 0 || saving}
            onClick={async () => { setSaving(true); await onAdd([...selected]); setSaving(false) }}
            style={{ background: selected.size === 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: selected.size === 0 ? 'rgba(255,255,255,0.3)' : '#000', padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: selected.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}