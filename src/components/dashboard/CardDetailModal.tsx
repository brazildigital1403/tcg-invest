'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import CondicaoEditor from '@/components/dashboard/CondicaoEditor'
import { GRADUADORAS, GRADUADORA_MAP, tierNome, isNotaTop, notaCurta } from '@/lib/graduadoras'
import Link from 'next/link'
import { IconHistory, IconBell, IconCheck } from '@/components/ui/Icons'
import { useAppModal } from '@/components/ui/useAppModal'
import { CAMPO_VALOR } from '@/lib/calcPatrimonio'
import { TYPE_COLOR, raridadePt, subtipoPt, tipoTcgPt } from '@/lib/pokedexTextos'

interface Props {
  card: any
  isPro: boolean
  exchangeRate?: { usd: number; eur: number }
  onClose: () => void
  onVarianteChange: (v: string) => void
  onIdiomaChange: (i: string) => void
  onQuantitySet: (novaQty: number) => void
  onCondicoesSaved: (novas: Record<string, number> | null) => void
  onAnunciar: () => void
  onGradSaved: (campos: any) => void
  onRemove: () => void
  /** Lista que a pessoa esta vendo, para anterior/proxima. Sem ela, a navegacao some. */
  lista?: any[]
  onNavegar?: (card: any) => void
  /** Complemento do contador ("3 de 8 das mais valiosas"). Padrao: na sua colecao. */
  rotuloLista?: string
}

const VAR_LABELS: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse', pokeball: 'Pokéball',
}
const IDIOMAS_LISTA = ['pt', 'en', 'jp', 'es', 'fr', 'de', 'it', 'cn', 'kr'] as const
const IDIOMA_LABELS: Record<string, string> = {
  pt: 'PT', en: 'EN', jp: 'JP', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', cn: 'CN', kr: 'KR',
}
const FILTROS_DIAS = [7, 15, 30, 60] as const

interface HistoricoVenda {
  valor_cents: number
  variante: string | null
  condicao: string | null
  idioma: string | null
  capturado_em: string
  vendido_em?: string | null
  data_venda?: string | null
}

function fmtBRL(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Lista de variantes que a carta possui (preco BRL na coluna, OU em outras_variantes,
// OU a variante atualmente salva). Cada uma com o medio pra ordenar/exibir.
function buildVariantes(price: any, varianteSalva: string) {
  const p = price || {}
  const std = [
    { key: 'normal',   medio: p.preco_medio },
    { key: 'foil',     medio: p.preco_foil_medio },
    { key: 'promo',    medio: p.preco_promo_medio },
    { key: 'reverse',  medio: p.preco_reverse_medio },
    { key: 'pokeball', medio: p.preco_pokeball_medio },
  ].map(v => ({ key: v.key, label: VAR_LABELS[v.key] || cap(v.key), medio: Number(v.medio) || 0 }))

  const ov = (p.outras_variantes && typeof p.outras_variantes === 'object') ? p.outras_variantes : {}
  const extra = Object.entries(ov).map(([k, val]: [string, any]) => ({
    key: k, label: cap(k), medio: Number(val?.medio) || 0,
  }))

  const all = [...std, ...extra]
  // mostra as que tem preco; sempre inclui a variante salva
  let list = all.filter(v => v.medio > 0 || v.key === varianteSalva)
  if (varianteSalva && !list.find(v => v.key === varianteSalva)) {
    list = [{ key: varianteSalva, label: VAR_LABELS[varianteSalva] || cap(varianteSalva), medio: 0 }, ...list]
  }
  // ordem: salva primeiro, depois por preco desc
  list.sort((a, b) => (a.key === varianteSalva ? -1 : b.key === varianteSalva ? 1 : b.medio - a.medio))
  return list
}

// Preco da variante selecionada: BRL (coluna) -> outras_variantes -> USD convertido.
function precoVariante(price: any, v: string, rate?: { usd: number; eur: number }) {
  const p = price || {}
  const brlMap: Record<string, [any, any, any]> = {
    normal:   [p.preco_min, p.preco_medio, p.preco_max],
    foil:     [p.preco_foil_min, p.preco_foil_medio, p.preco_foil_max],
    promo:    [p.preco_promo_min, p.preco_promo_medio, p.preco_promo_max],
    reverse:  [p.preco_reverse_min, p.preco_reverse_medio, p.preco_reverse_max],
    pokeball: [p.preco_pokeball_min, p.preco_pokeball_medio, p.preco_pokeball_max],
  }
  // O gate era o indice [1] cravado -- o MEDIO. Com a regra em CAMPO_VALOR,
  // uma carta que tem minimo mas nao tem medio cairia pro USD sem motivo.
  const IDX = CAMPO_VALOR === 'min' ? 0 : CAMPO_VALOR === 'max' ? 2 : 1
  const brl = brlMap[v]
  if (brl && Number(brl[IDX]) > 0) {
    return { medio: Number(brl[1]), min: Number(brl[0]) || 0, max: Number(brl[2]) || 0, valor: Number(brl[IDX]), fonte: 'BRL', label: 'Mercado Brasileiro' }
  }
  const ov = p.outras_variantes?.[v]
  if (ov && Number(ov[CAMPO_VALOR === 'min' ? 'min' : CAMPO_VALOR === 'max' ? 'max' : 'medio']) > 0) {
    return { medio: Number(ov.medio), min: Number(ov.min) || 0, max: Number(ov.max) || 0, valor: Number(ov[CAMPO_VALOR === 'min' ? 'min' : CAMPO_VALOR === 'max' ? 'max' : 'medio']), fonte: 'BRL', label: 'Mercado Brasileiro' }
  }
  const usdMap: Record<string, any> = { normal: p.price_usd_normal, foil: p.price_usd_holofoil, reverse: p.price_usd_reverse }
  const usd = usdMap[v]
  if (Number(usd) > 0 && rate?.usd) {
    return { medio: Number(usd) * rate.usd, min: 0, max: 0, valor: Number(usd) * rate.usd, fonte: 'USD', label: 'TCG Player · USD convertido' }
  }
  return { medio: 0, min: 0, max: 0, valor: 0, fonte: null as string | null, label: null as string | null }
}

/**
 * Detalhe da carta da Colecao. Redesenhado em 22/09/2026 no molde do modal da
 * Pokedex (mockup "Colecao: modal da carta", aprovado pelo Du). Mesmos dados e
 * as mesmas gravacoes de antes; o que muda e a ordem e o peso:
 *
 *   arte grande (slab quando graduada) -> quem e (nome, PS, raridade em
 *   portugues) -> quanto valem as SUAS copias -> "Na sua colecao" (quantidade,
 *   variante, idioma, condicao) -> Vender + Aviso de preco -> graduacao ->
 *   dados de jogo -> historico -> links.
 *
 * "Salvar alteracoes" saiu do meio do bloco e virou barra no rodape, que so
 * aparece quando algo mudou. "Remover" deixou de ser botao vermelho do lado do
 * Anunciar. Anterior/proxima andam pela lista que a pessoa esta vendo.
 *
 * A ficha de jogo (PS, ataques, fraqueza) nao vem no lookup da colecao, que
 * traz so preco: busca a carta inteira por id ao abrir, uma linha pela chave.
 */
export default function CardDetailModal({
  card, isPro, exchangeRate, onClose,
  onVarianteChange, onIdiomaChange, onQuantitySet, onCondicoesSaved, onAnunciar, onRemove, onGradSaved,
  lista, onNavegar, rotuloLista = 'na sua coleção',
}: Props) {
  const [variante, setVariante] = useState<string>(card.variante || 'normal')
  const [varPreco, setVarPreco] = useState<string>(card.variante || 'normal')
  const [condicoes, setCondicoes] = useState<Record<string, number> | null>(card.condicoes || null)
  const [quantity, setQuantity] = useState<number>(card.quantity || 1)
  const [anunciados, setAnunciados] = useState<number | null>(null)
  const [savedVar, setSavedVar] = useState<string>(card.variante || 'normal')
  const [idioma, setIdioma] = useState<string>((card.idioma || 'pt').toLowerCase())
  const [savedIdioma, setSavedIdioma] = useState<string>((card.idioma || 'pt').toLowerCase())
  const [savedQty, setSavedQty] = useState<number>(card.quantity || 1)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const [graduada, setGraduada] = useState<boolean>(!!card.graduada)
  const [graduadora, setGraduadora] = useState<string>(card.graduadora || 'psa')
  const [nota, setNota] = useState<number | null>(card.nota != null ? Number(card.nota) : 10)
  const [blackLabel, setBlackLabel] = useState<boolean>(!!card.black_label)
  const [subnotas, setSubnotas] = useState<Record<string, string>>(card.subnotas || {})
  const [verSubnotas, setVerSubnotas] = useState<boolean>(!!card.subnotas && Object.values(card.subnotas || {}).some(Boolean))
  const [cert, setCert] = useState<string>(card.cert_graduacao || '')
  const [valorGrad, setValorGrad] = useState<string>(card.valor_graduada != null ? String(card.valor_graduada) : '')
  const [savingGrad, setSavingGrad] = useState(false)
  const [flashGrad, setFlashGrad] = useState(false)
  const [historicoVendas, setHistoricoVendas] = useState<HistoricoVenda[]>([])
  const [diasHistorico, setDiasHistorico] = useState(7)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ficha, setFicha] = useState<any | null>(null)

  const price = card.price || null
  const cartaUrlId: string | null = price?.id || card.pokemon_api_id || null

  // Status no marketplace (copias ativas a venda desta carta)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: u } = await supabase.auth.getUser()
        if (!u?.user || !card.card_id) { if (active) setAnunciados(0); return }
        const { count } = await supabase
          .from('marketplace')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.user.id)
          .eq('card_id', card.card_id)
          .in('status', ['disponivel', 'reservado', 'em_negociacao', 'enviado'])
        if (active) setAnunciados(count || 0)
      } catch {
        if (active) setAnunciados(0)
      }
    })()
    return () => { active = false }
  }, [card.id, card.card_id])

  // Ficha de jogo: a carta inteira, uma linha pela chave primaria.
  useEffect(() => {
    if (!cartaUrlId) { setFicha(null); return }
    let active = true
    fetch('/api/cards/lookup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [cartaUrlId], full: true }),
    })
      .then(r => r.ok ? r.json() : { cards: [] })
      .then(d => { if (active) setFicha((d.cards || [])[0] || null) })
      .catch(() => { if (active) setFicha(null) })
    return () => { active = false }
  }, [cartaUrlId])

  const variantes = buildVariantes(price, savedVar)
  const pv = precoVariante(price, varPreco, exchangeRate)
  // ultima_venda.valor vem em CENTAVOS do banco; fmtBRL espera reais.
  const ultimoVendidoFmt = card.ultima_venda?.valor != null
    ? fmtBRL(Number(card.ultima_venda.valor) / 100)
    : null

  // Aviso de preco (watchlist), mesmo fluxo da Pokedex e das Metas: preco
  // maximo opcional; em branco = avisa de qualquer anuncio. undefined =
  // carregando, null = sem aviso, number|'livre' = ligado. (#49, 21/09/2026)
  const { showPrompt, showAlert } = useAppModal()
  const avisoId: string | null = card.pokemon_api_id || price?.id || null
  const [aviso, setAviso] = useState<number | 'livre' | null | undefined>(undefined)
  const [avisoMsg, setAvisoMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!avisoId) { setAviso(null); return }
    let ativo = true
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) { if (ativo) setAviso(null); return }
      const { data: row } = await supabase.from('watchlist').select('target_price').eq('user_id', uid).eq('card_id', avisoId).maybeSingle()
      if (ativo) setAviso(row ? (row.target_price != null ? Number(row.target_price) : 'livre') : null)
    })
    return () => { ativo = false }
  }, [avisoId])

  const nomeLimpo = card.card_name?.replace(/\s*\([^)]*\)\s*$/, '') || price?.name || 'esta carta'

  async function definirAviso() {
    if (!avisoId) return
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) return
    const v = await showPrompt({
      message: `Até quanto você pagaria por ${nomeLimpo}?`,
      placeholder: 'Ex.: 50',
      defaultValue: typeof aviso === 'number' ? String(aviso).replace('.', ',') : '',
      hint: 'Em reais. Você recebe aviso quando aparecer à venda até esse valor. Deixe em branco para receber de qualquer preço.',
      inputMode: 'decimal',
      permitirVazio: true,
    })
    if (v === null) return
    const limpo = v.trim().replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const teto = limpo ? Number(limpo) : null
    if (teto !== null && (!Number.isFinite(teto) || teto <= 0)) { showAlert('Digite um valor em reais, como 50 ou 49,90.', 'warning'); return }
    const { error } = await supabase.from('watchlist').upsert(
      { user_id: uid, card_id: avisoId, target_price: teto, target_type: teto === null ? null : 'max' },
      { onConflict: 'user_id,card_id' },
    )
    if (error) { showAlert('Não conseguimos salvar o aviso. Tente de novo.', 'error'); return }
    setAviso(teto === null ? 'livre' : teto)
    setAvisoMsg(null)
  }

  async function desligarAviso() {
    if (!avisoId) return
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) return
    const { error } = await supabase.from('watchlist').delete().eq('user_id', uid).eq('card_id', avisoId)
    if (error) { showAlert('Não conseguimos desligar o aviso. Tente de novo.', 'error'); return }
    setAviso(null)
    setAvisoMsg('Aviso desligado.')
  }

  const gradMeta = GRADUADORA_MAP[graduadora] || GRADUADORAS[0]
  const gradTop = isNotaTop(nota, blackLabel)

  // Historico de "ultima venda" -- so busca se a carta tem pelo menos um
  // valor atual (sem isso nao ha o que mostrar) e refaz quando o filtro
  // de periodo muda.
  useEffect(() => {
    if (!cartaUrlId || !ultimoVendidoFmt) { setHistoricoVendas([]); return }
    let active = true
    setCarregandoHistorico(true)
    fetch(`/api/cards/${encodeURIComponent(cartaUrlId)}/historico-vendas?dias=${diasHistorico}`)
      .then(r => r.ok ? r.json() : { historico: [] })
      .then(({ historico }) => { if (active) setHistoricoVendas(historico || []) })
      .catch(() => { if (active) setHistoricoVendas([]) })
      .finally(() => { if (active) setCarregandoHistorico(false) })
    return () => { active = false }
  }, [cartaUrlId, ultimoVendidoFmt, diasHistorico])

  function alterarQuantidade(delta: number) {
    const nova = quantity + delta
    if (nova < 1) return // remocao total fica no Remover da colecao
    setQuantity(nova)
  }

  const dirty = quantity !== savedQty || variante !== savedVar || idioma !== savedIdioma
  const mudancas = [
    quantity !== savedQty ? `a quantidade para ${quantity} ${quantity === 1 ? 'cópia' : 'cópias'}` : null,
    variante !== savedVar ? `a variante para ${VAR_LABELS[variante] || cap(variante)}` : null,
    idioma !== savedIdioma ? `o idioma para ${IDIOMA_LABELS[idioma] || idioma.toUpperCase()}` : null,
  ].filter(Boolean) as string[]

  async function salvar() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      if (quantity !== savedQty) await Promise.resolve(onQuantitySet(quantity))
      if (variante !== savedVar) await Promise.resolve(onVarianteChange(variante))
      if (idioma !== savedIdioma) await Promise.resolve(onIdiomaChange(idioma))
      setSavedQty(quantity)
      setSavedVar(variante)
      setSavedIdioma(idioma)
      setFlash(true)
      window.setTimeout(() => setFlash(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  function descartar() {
    setQuantity(savedQty); setVariante(savedVar); setVarPreco(savedVar); setIdioma(savedIdioma)
  }

  function pickGraduadora(slug: string) {
    setGraduadora(slug)
    if (!GRADUADORA_MAP[slug]?.temBlackLabel) setBlackLabel(false)
  }
  function pickNota(v: string) {
    if (v === 'BL') { setNota(10); setBlackLabel(true) }
    else { setNota(Number(v)); setBlackLabel(false) }
  }
  async function salvarGrad(forcarGraduada?: boolean) {
    if (savingGrad) return
    const ehGraduada = forcarGraduada ?? graduada
    setSavingGrad(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const campos: any = ehGraduada
        ? {
            graduada: true,
            graduadora,
            nota,
            black_label: blackLabel,
            cert_graduacao: cert || null,
            subnotas: gradMeta.temSubnota ? subnotas : null,
            valor_graduada: valorGrad ? Number(String(valorGrad).replace(',', '.')) : null,
          }
        : { graduada: false }
      const { error } = await supabase.from('user_cards').update(campos).eq('id', card.id)
      if (!error) {
        onGradSaved(campos)
        setFlashGrad(true)
        window.setTimeout(() => setFlashGrad(false), 1800)
      } else {
        showAlert('Não conseguimos salvar a graduação. Tente de novo.', 'error')
      }
    } finally {
      setSavingGrad(false)
    }
  }

  // Desligar a graduacao grava na hora (nao ha o que preencher); ligar so abre
  // o formulario -- grava quando a pessoa confirma nota e valor.
  function alternarGraduada() {
    if (graduada) { setGraduada(false); if (card.graduada) salvarGrad(false) }
    else setGraduada(true)
  }

  // Anterior/proxima na lista que a pessoa esta vendo (filtros aplicados).
  const idx = lista ? lista.findIndex(c => c.id === card.id) : -1
  const anterior = lista && idx > 0 ? lista[idx - 1] : null
  const proxima = lista && idx >= 0 && idx < lista.length - 1 ? lista[idx + 1] : null
  const irPara = (c: unknown) => {
    if (!c || !onNavegar) return
    if (dirty && !window.confirm('Você tem alterações não salvas nesta carta. Sair sem salvar?')) return
    onNavegar(c)
  }
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && proxima) irPara(proxima)
      if (e.key === 'ArrowLeft' && anterior) irPara(anterior)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // Suprime o rotulo "Liga BR — XXX" quando o set nao tem nome real de mercado.
  const setNomeRaw = price?.set_name || card.set_name || ''
  const setNome = /^Liga BR\b/i.test(setNomeRaw) ? null : (setNomeRaw || null)
  const numeroRaw = price?.number || card.number
  const total = price?.set_total || card.set_total
  const numero = numeroRaw ? (total ? `${String(numeroRaw).padStart(3, '0')}/${total}` : String(numeroRaw)) : null
  const raridade = raridadePt(price?.rarity || card.rarity)
  const subtipos: string[] = (ficha?.subtypes || []).map(subtipoPt)
  const tipos: string[] = ficha?.types || []
  const hp = ficha?.hp
  const img = price?.image_large || card.card_image || price?.image_small
  const holo = !graduada && varPreco !== 'normal'

  const parse = <T,>(v: unknown, vazio: T): T => { if (v == null) return vazio; if (typeof v !== 'string') return v as T; try { return JSON.parse(v) as T } catch { return vazio } }
  const attacks = parse<{ name: string; cost?: string[]; damage?: string; text?: string }[]>(ficha?.attacks, [])
  const abilities = parse<{ name: string; text?: string }[]>(ficha?.abilities, [])
  const weaknesses = parse<{ type: string; value: string }[]>(ficha?.weaknesses, [])
  const resistances = parse<{ type: string; value: string }[]>(ficha?.resistances, [])
  const recuo: string[] = ficha?.retreat_cost || []

  const valorCopias = graduada ? Number(String(valorGrad || 0).replace(',', '.')) * quantity : pv.valor * quantity
  const slug = ficha?.slug || price?.slug || cartaUrlId
  const brl = (n: number) => fmtBRL(n)

  const chip = (ativo: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: 12.5, fontWeight: 700, minHeight: 36, padding: '0 11px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
    border: `1px solid ${ativo ? 'var(--ac-1)' : 'var(--bx-border-2)'}`, background: ativo ? 'rgba(var(--ac-1-rgb), 0.12)' : 'transparent',
    color: ativo ? 'var(--ac-1)' : 'var(--bx-text-2)', transition: 'background .15s ease, border-color .15s ease, color .15s ease',
  })
  const chipGrad = (ativo: boolean): React.CSSProperties => ({
    ...chip(false), borderRadius: 10,
    ...(ativo ? { background: gradMeta.cor, borderColor: gradMeta.cor, color: '#fff' } : {}),
  })

  return (
    <div className="bx-cmd-fundo" onClick={onClose}>
      <div className="bx-cmd" role="dialog" aria-modal="true" aria-label={nomeLimpo} onClick={e => e.stopPropagation()}>

        {/* Navegacao */}
        <div className="bx-cmd-nav">
          <button type="button" onClick={() => irPara(anterior)} disabled={!anterior} aria-label={anterior ? `Carta anterior: ${anterior.card_name}` : 'Sem carta anterior'} className="bx-cmd-navbtn">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="bx-cmd-navnome">{anterior ? String(anterior.card_name || '').replace(/\s*\([^)]*\)\s*$/, '') : ''}</span>
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bx-text-3)', whiteSpace: 'nowrap' }}>
            {lista && idx >= 0 ? <>{idx + 1} de {lista.length}<span className="bx-cmd-navnome"> {rotuloLista}</span></> : 'Na sua coleção'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <button type="button" onClick={() => irPara(proxima)} disabled={!proxima} aria-label={proxima ? `Próxima carta: ${proxima.card_name}` : 'Sem próxima carta'} className="bx-cmd-navbtn">
              <span className="bx-cmd-navnome">{proxima ? String(proxima.card_name || '').replace(/\s*\([^)]*\)\s*$/, '') : ''}</span>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar" className="bx-cmd-fechar">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        <div className="bx-cmd-corpo">
          {/* Arte / slab */}
          <div className="bx-cmd-arte">
            <div className="bx-cmd-carta" style={graduada ? { background: blackLabel ? '#0a0a0a' : gradMeta.cor, padding: '0 5px 5px', boxShadow: `0 0 0 2px ${gradMeta.cor}${gradTop ? `, 0 0 26px -2px ${gradMeta.cor}` : ''}, 0 30px 60px -20px rgba(0,0,0,.9)` } : undefined}>
              {graduada && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 6px' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: blackLabel ? '#e8c878' : '#fff' }}>{gradMeta.curto}</span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <b style={{ fontSize: 20, fontWeight: 900, color: blackLabel ? '#e8c878' : '#fff', lineHeight: 1 }}>{notaCurta(nota, blackLabel)}</b>
                    <span style={{ fontSize: 9, fontWeight: 800, color: blackLabel ? 'rgba(232,200,120,.9)' : 'rgba(255,255,255,.9)', textTransform: 'uppercase' }}>{tierNome(graduadora, nota, blackLabel)}</span>
                  </span>
                </div>
              )}
              {img ? (
                // Imagem de varios hosts (catalogo e fotos antigas), fora do otimizador de proposito.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img} src={img} alt={`${nomeLimpo}${numero ? ` ${numero}` : ''}`} loading="eager" fetchPriority="high" decoding="async"
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: graduada ? 8 : 12, aspectRatio: '63 / 88', objectFit: 'cover', background: 'var(--bx-surface-2)' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '63 / 88', background: 'var(--bx-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bx-text-3)', fontSize: 12, padding: 18, textAlign: 'center', borderRadius: 12 }}>{nomeLimpo}</div>
              )}
              {holo && <span className="bx-cmd-holo" aria-hidden="true" />}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="bx-cmd-selo" style={{ background: 'rgba(var(--ac-1-rgb), .14)', color: 'var(--ac-1)', borderColor: 'rgba(var(--ac-1-rgb), .3)' }}>{VAR_LABELS[savedVar] || cap(savedVar)}</span>
              <span className="bx-cmd-selo">{IDIOMA_LABELS[savedIdioma] || savedIdioma.toUpperCase()}</span>
              <span className="bx-cmd-selo">{savedQty} {savedQty === 1 ? 'cópia' : 'cópias'}</span>
            </div>
            {ficha?.artist && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bx-text-3)', textAlign: 'center' }}>Ilustração: {ficha.artist}</div>}
          </div>

          <div className="bx-cmd-info">
            {/* Quem e */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 className="bx-cmd-nome">{nomeLimpo}</h2>
                {hp && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--bx-text-3)' }}>PS <span style={{ fontSize: 21, color: 'var(--bx-red)' }}>{hp}</span></span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--bx-text-2)', marginTop: 3 }}>{[setNome, numero, raridade].filter(Boolean).join(' · ')}</div>
              {(raridade || subtipos.length > 0 || tipos.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {raridade && <span className="bx-cmd-selo" style={{ borderColor: 'rgba(var(--ac-1-rgb), .45)', color: 'var(--ac-1)' }}>{raridade}</span>}
                  {subtipos.map(s => <span key={s} className="bx-cmd-selo">{s}</span>)}
                  {tipos.map(t => <span key={t} className="bx-cmd-selo" style={{ background: TYPE_COLOR[t]?.bg, color: TYPE_COLOR[t]?.text, borderColor: 'transparent' }}>{tipoTcgPt(t)}</span>)}
                </div>
              )}
            </div>

            {/* Quanto valem as suas copias */}
            {graduada ? (
              <div className="bx-cmd-preco" style={{ background: hexA(gradMeta.cor, 0.08), borderColor: hexA(gradMeta.cor, 0.3) }}>
                <div className="bx-cmd-k" style={{ color: gradMeta.cor }}>Seu valor · {gradMeta.curto} {notaCurta(nota, blackLabel)} {tierNome(graduadora, nota, blackLabel)}</div>
                {Number(String(valorGrad).replace(',', '.')) > 0 ? (
                  <div className="bx-cmd-grande" style={{ color: gradMeta.cor }}>{brl(valorCopias)}</div>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bx-text-2)', marginTop: 4 }}>Informe o seu valor na graduação, logo abaixo.</div>
                )}
                <div style={{ fontSize: 12.5, color: 'var(--bx-text-2)', marginTop: 4, lineHeight: 1.45 }}>
                  O valor da graduada é o que você informa.{pv.valor > 0 ? ` Como referência, a mesma carta sem graduação sai por ${brl(pv.valor)} no Mercado Brasileiro.` : ''}
                </div>
                {cert && <div style={{ fontSize: 12, color: 'var(--bx-text-3)', marginTop: 8 }}>Certificado {cert}</div>}
              </div>
            ) : (
              <div className="bx-cmd-preco">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="bx-cmd-k">{quantity === 1 ? 'Sua cópia vale' : `Suas ${quantity} cópias valem`}</div>
                    {pv.valor > 0 ? (
                      <>
                        <div className="bx-cmd-grande" style={pv.fonte === 'USD' ? { color: 'var(--bx-blue, #60a5fa)' } : undefined}>{brl(valorCopias)}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--bx-text-2)', marginTop: 2 }}>
                          {quantity > 1 ? `${brl(pv.valor)} cada · ` : ''}{pv.fonte === 'USD' ? 'TCGPlayer, convertido pela cotação do dia' : `Mercado Brasileiro, ${CAMPO_VALOR === 'min' ? 'menor preço' : CAMPO_VALOR === 'max' ? 'maior preço' : 'preço médio'} da ${VAR_LABELS[varPreco] || cap(varPreco)}`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--bx-text-2)', marginTop: 4 }}>Ainda sem preço para esta variante</div>
                        <div style={{ fontSize: 12.5, color: 'var(--bx-text-3)', marginTop: 4, lineHeight: 1.45 }}>Se não aparecer em até 24h, fale com a gente que averiguamos.</div>
                      </>
                    )}
                  </div>
                  {variantes.length > 1 && (
                    <div role="group" aria-label="Ver o preço da variante" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {variantes.map(v => <button key={v.key} type="button" onClick={() => setVarPreco(v.key)} aria-pressed={varPreco === v.key} style={chip(varPreco === v.key)}>{v.label}</button>)}
                    </div>
                  )}
                </div>
                {pv.fonte === 'BRL' && (
                  <div className="bx-cmd-faixa">
                    {([['Médio', pv.medio > 0 ? brl(pv.medio) : null], ['Máximo', pv.max > 0 ? brl(pv.max) : null], ['Última venda', ultimoVendidoFmt]] as [string, string | null][]).map(([r, v], i) => (
                      <div key={r} className="bx-cmd-mini">
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)' }}>{r}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: !v ? 'var(--bx-text-2)' : i === 2 ? 'var(--bx-green)' : 'var(--bx-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v || 'sem dado'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Na sua colecao */}
            <div className="bx-cmd-bloco">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div className="bx-cmd-k">Na sua coleção</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" onClick={() => alterarQuantidade(-1)} disabled={quantity <= 1} aria-label="Tirar uma cópia" className="bx-cmd-step">−</button>
                  <span style={{ minWidth: 30, textAlign: 'center', fontSize: 17, fontWeight: 900 }} aria-live="polite">{quantity}</span>
                  <button type="button" onClick={() => alterarQuantidade(1)} aria-label="Somar uma cópia" className="bx-cmd-step">+</button>
                </div>
              </div>
              <div className="bx-cmd-campos">
                <span className="bx-cmd-rot">Variante</span>
                <div className="bx-cmd-chips">
                  {variantes.map(v => <button key={v.key} type="button" onClick={() => { setVariante(v.key); setVarPreco(v.key) }} aria-pressed={variante === v.key} style={chip(variante === v.key)}>{v.label}</button>)}
                </div>
                <span className="bx-cmd-rot">Idioma</span>
                <div className="bx-cmd-chips bx-cmd-rola">
                  {IDIOMAS_LISTA.map(i => <button key={i} type="button" onClick={() => setIdioma(i)} aria-pressed={idioma === i} style={chip(idioma === i)}>{IDIOMA_LABELS[i]}</button>)}
                </div>
                {!graduada && (
                  <>
                    <span className="bx-cmd-rot">Condição</span>
                    <div>
                      <CondicaoEditor
                        userCardId={card.id}
                        quantity={savedQty}
                        condicoes={condicoes}
                        isPro={isPro}
                        onSaved={(novas: Record<string, number> | null) => { setCondicoes(novas); onCondicoesSaved(novas) }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Vender + Aviso de preco */}
            <div className="bx-cmd-dupla">
              <div className="bx-cmd-bloco" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="bx-cmd-k" style={{ color: 'var(--bx-text-3)' }}>Vender</div>
                <div style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.45, flex: 1 }}>
                  {anunciados === null ? 'Carregando…'
                    : anunciados > 0 ? <><b style={{ color: 'var(--bx-green)' }}>{anunciados} {anunciados === 1 ? 'cópia à venda' : 'cópias à venda'}</b> no Mercado. <a href="/marketplace" style={{ color: 'var(--bx-text-2)' }}>Ver anúncios</a></>
                    : 'Não anunciada no Mercado. O anúncio já abre com esta carta.'}
                </div>
                <button type="button" onClick={onAnunciar} className="bx-cmd-anunciar bx-cmd-anunciar-desk">{anunciados && anunciados > 0 ? 'Anunciar mais uma' : 'Anunciar esta carta'}</button>
              </div>
              {avisoId && (
                <div className="bx-cmd-bloco" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: aviso !== null && aviso !== undefined ? 'rgba(var(--ac-1-rgb), .35)' : undefined }}>
                  <div className="bx-cmd-k" style={{ color: 'var(--bx-text-3)' }}>Aviso de preço</div>
                  <div style={{ fontSize: 13, color: aviso !== null && aviso !== undefined ? 'var(--bx-text)' : 'var(--bx-text-2)', lineHeight: 1.45, flex: 1 }}>
                    {aviso === undefined ? 'Carregando…'
                      : aviso === null ? (avisoMsg || 'Receba um aviso quando esta carta aparecer à venda.')
                      : aviso === 'livre' ? 'Ligado: você é avisado de qualquer anúncio.' : `Ligado: você é avisado de anúncios até ${brl(aviso)}.`}
                  </div>
                  {aviso !== undefined && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={definirAviso} aria-pressed={aviso !== null} className={`bx-cmd-sino${aviso !== null ? ' bx-cmd-sino-on' : ''}`}>
                        <IconBell size={15} color="currentColor" /> {aviso !== null ? 'Mudar aviso' : 'Avisar preço'}
                      </button>
                      {aviso !== null && <button type="button" onClick={desligarAviso} className="bx-cmd-ghost">Desligar</button>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Graduacao */}
            <div className="bx-cmd-bloco">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Carta graduada</div>
                  {!graduada && <div style={{ fontSize: 12.5, color: 'var(--bx-text-3)' }}>PSA, CGC, BGS e outras. Ligue para informar nota, certificado e seu valor.</div>}
                </div>
                <button type="button" role="switch" aria-checked={graduada} aria-label="Esta carta é graduada" onClick={alternarGraduada}
                  className="bx-cmd-switch" style={{ background: graduada ? gradMeta.cor : 'var(--bx-surface-3)' }}>
                  <span style={{ left: graduada ? 23 : 3 }} />
                </button>
              </div>
              {graduada && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                  <div>
                    <div className="bx-cmd-rot" style={{ marginBottom: 6 }}>Graduadora</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {GRADUADORAS.map(g => <button key={g.slug} type="button" onClick={() => pickGraduadora(g.slug)} aria-pressed={graduadora === g.slug} style={{ ...chip(false), borderRadius: 10, ...(graduadora === g.slug ? { background: g.cor, borderColor: g.cor, color: '#fff' } : {}) }}>{g.curto}</button>)}
                    </div>
                  </div>
                  <div>
                    <div className="bx-cmd-rot" style={{ marginBottom: 6 }}>Nota</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {['7', '8', '9', '9.5', '10'].map(v => {
                        const on = !blackLabel && Number(nota) === Number(v)
                        return <button key={v} type="button" onClick={() => pickNota(v)} aria-pressed={on} style={{ ...chipGrad(on), minWidth: 48, minHeight: 40 }}>{v.replace('.', ',')}</button>
                      })}
                      {gradMeta.temBlackLabel && (
                        <button type="button" onClick={() => pickNota('BL')} aria-pressed={blackLabel} style={{ ...chip(false), borderRadius: 10, minHeight: 40, ...(blackLabel ? { background: '#0a0a0a', borderColor: '#c8a04b', color: '#e8c878' } : {}) }}>Black Label</button>
                      )}
                    </div>
                  </div>
                  <div className="bx-cmd-dupla">
                    <label className="bx-cmd-campo">
                      <span className="bx-cmd-rot">Certificado</span>
                      <input value={cert} onChange={e => setCert(e.target.value)} placeholder="Número" />
                    </label>
                    <label className="bx-cmd-campo">
                      <span className="bx-cmd-rot">Seu valor (R$)</span>
                      <input value={valorGrad} onChange={e => setValorGrad(e.target.value)} placeholder="Ex.: 950" inputMode="decimal" />
                    </label>
                  </div>
                  {gradMeta.temSubnota && (verSubnotas ? (
                    <div>
                      <div className="bx-cmd-rot" style={{ marginBottom: 6 }}>Subnotas</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                        {([['centro', 'Centro'], ['cantos', 'Cantos'], ['bordas', 'Bordas'], ['superficie', 'Superfície']] as [string, string][]).map(([k, lbl]) => (
                          <label key={k} className="bx-cmd-campo" style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bx-text-3)' }}>{lbl}</span>
                            <input value={subnotas[k] || ''} onChange={e => setSubnotas(prev => ({ ...prev, [k]: e.target.value }))} placeholder="—" inputMode="decimal" style={{ textAlign: 'center', padding: '0 4px' }} />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setVerSubnotas(true)} className="bx-cmd-ghost" style={{ borderStyle: 'dashed' }}>Adicionar subnotas (centro, cantos, bordas, superfície)</button>
                  ))}
                  <button type="button" onClick={() => salvarGrad(true)} disabled={savingGrad}
                    className="bx-cmd-salvargrad" style={{ borderColor: flashGrad ? 'rgba(34,197,94,.4)' : hexA(gradMeta.cor, 0.45), background: flashGrad ? 'rgba(34,197,94,.14)' : hexA(gradMeta.cor, 0.14), color: flashGrad ? 'var(--bx-green)' : 'var(--bx-text)' }}>
                    {savingGrad ? 'Salvando…' : flashGrad ? <><IconCheck size={14} color="var(--bx-green)" /> Graduação salva</> : 'Salvar graduação'}
                  </button>
                </div>
              )}
            </div>

            {/* Dados de jogo (so nas cartas que tem) */}
            {abilities.map((a, i) => (
              <div key={`h${i}`} className="bx-cmd-linha">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bx-cmd-k">Habilidade</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800 }}>{a.name}</span>
                </div>
                {a.text && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>{a.text}</p>}
              </div>
            ))}
            {attacks.length > 0 && (
              <div className="bx-cmd-linha">
                <div className="bx-cmd-k" style={{ marginBottom: 8 }}>{attacks.length === 1 ? 'Ataque' : 'Ataques'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attacks.map((atk, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', gap: 3 }}>{(atk.cost || []).map((e, j) => <EnergiaDot key={j} tipo={e} />)}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 800, flex: 1 }}>{atk.name}</span>
                        {atk.damage && <span style={{ fontSize: 18, fontWeight: 900 }}>{atk.damage}</span>}
                      </div>
                      {atk.text && <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>{atk.text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(weaknesses.length > 0 || resistances.length > 0 || recuo.length > 0) && (
              <div className="bx-cmd-linha" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                {weaknesses.length > 0 && <div><div className="bx-cmd-rot" style={{ marginBottom: 4 }}>Fraqueza</div>{weaknesses.map((w, i) => <span key={i} style={{ fontWeight: 800, color: 'var(--bx-red)', marginRight: 8 }}>{tipoTcgPt(w.type)} {w.value}</span>)}</div>}
                {resistances.length > 0 && <div><div className="bx-cmd-rot" style={{ marginBottom: 4 }}>Resistência</div>{resistances.map((r, i) => <span key={i} style={{ fontWeight: 800, color: 'var(--bx-green)', marginRight: 8 }}>{tipoTcgPt(r.type)} {r.value}</span>)}</div>}
                {recuo.length > 0 && <div><div className="bx-cmd-rot" style={{ marginBottom: 4 }}>Recuo</div><span style={{ fontWeight: 800 }}>{recuo.length} {recuo.length === 1 ? 'energia' : 'energias'}</span></div>}
              </div>
            )}

            {/* Historico de vendas */}
            {ultimoVendidoFmt && (
              <div className="bx-cmd-linha">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="bx-cmd-k" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconHistory size={13} /> Histórico de vendas</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {FILTROS_DIAS.map(d => <button key={d} type="button" onClick={() => setDiasHistorico(d)} aria-pressed={diasHistorico === d} style={{ ...chip(diasHistorico === d), minHeight: 32, fontSize: 11.5 }}>{d}d</button>)}
                  </div>
                </div>
                {carregandoHistorico ? (
                  <p style={{ fontSize: 12, color: 'var(--bx-text-faint)', margin: 0 }}>Carregando…</p>
                ) : historicoVendas.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {historicoVendas.map((h, i) => {
                      const dataRef = h.data_venda || h.vendido_em || h.capturado_em
                      const dias = Math.floor((new Date().getTime() - new Date(dataRef).getTime()) / 86400000)
                      const quando = dias <= 0 ? 'Hoje' : dias === 1 ? 'Ontem' : `${dias} dias atrás`
                      const meta = [h.variante, h.condicao, h.idioma].filter(Boolean).join(' · ')
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bx-surface-2)', fontSize: 12 }}>
                          <span style={{ color: 'var(--bx-text-2)' }}>{quando}</span>
                          {meta && <span style={{ color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>}
                          <b>{fmtBRL(h.valor_cents / 100)}</b>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--bx-text-faint)', margin: 0 }}>Coletando desde hoje. O histórico completo aparece com o tempo.</p>
                )}
              </div>
            )}

            {/* Links + remover */}
            <div className="bx-cmd-linha bx-cmd-links">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '1 1 auto' }}>
                {slug && <Link href={`/carta/${slug}`} prefetch={false} className="bx-cmd-link">Ver página da carta</Link>}
                {slug && <Link href={`/carta/${slug}#ofertas`} prefetch={false} className="bx-cmd-link bx-ctx-comprador" style={{ color: 'var(--ac-1)' }}>Ver quem vende</Link>}
              </div>
              <button type="button" onClick={onRemove} className="bx-cmd-remover">Remover da coleção</button>
            </div>
          </div>
        </div>

        {/* Rodape: salvar quando mudou; no celular, Anunciar fixo */}
        {dirty ? (
          <div className="bx-cmd-barra" role="status">
            <span style={{ fontSize: 13, color: 'var(--bx-text)', flex: '1 1 180px', lineHeight: 1.4 }}>Você mudou {mudancas.join(', ')}.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={descartar} className="bx-cmd-ghost">Descartar</button>
              <button type="button" onClick={salvar} disabled={saving} className="bx-cmd-salvar">{saving ? 'Salvando…' : 'Salvar alterações'}</button>
            </div>
          </div>
        ) : flash ? (
          <div className="bx-cmd-barra" role="status" style={{ borderTopColor: 'rgba(34,197,94,.35)', background: 'rgba(34,197,94,.08)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--bx-green)' }}><IconCheck size={15} color="var(--bx-green)" /> Alterações salvas</span>
          </div>
        ) : (
          <div className="bx-cmd-rodape-cel">
            <button type="button" onClick={onAnunciar} className="bx-cmd-anunciar">{anunciados && anunciados > 0 ? 'Anunciar mais uma' : 'Anunciar esta carta'}</button>
          </div>
        )}
      </div>

      <style>{`
        .bx-cmd-fundo { position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,.82); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: bxCmdEntra .2s ease both; font-family: 'DM Sans', system-ui, sans-serif; }
        .bx-cmd { width: 100%; max-width: 1000px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-radius: 22px; box-shadow: 0 32px 100px rgba(0,0,0,.7); color: var(--bx-text); }
        .bx-cmd-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; border-bottom: 1px solid var(--bx-border); flex-shrink: 0; }
        .bx-cmd-navbtn { display: flex; align-items: center; gap: 6px; min-height: 44px; min-width: 44px; justify-content: center; padding: 0 10px; background: none; border: none; border-radius: 10px; color: var(--bx-text-2); font: inherit; font-size: 13px; cursor: pointer; max-width: 240px; transition: background .15s ease; }
        .bx-cmd-navbtn:hover:not(:disabled) { background: var(--bx-surface-2); }
        .bx-cmd-navbtn:disabled { color: var(--bx-text-faint); cursor: default; }
        .bx-cmd-navnome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bx-cmd-fechar { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: none; border: none; border-radius: 10px; color: var(--bx-text-2); cursor: pointer; }
        .bx-cmd-corpo { flex: 1; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 16px; }
        @media (min-width: 860px) { .bx-cmd-corpo { grid-template-columns: 300px minmax(0, 1fr); gap: 28px; padding: 22px 26px 26px; } .bx-cmd-arte { position: sticky; top: 0; align-self: start; } }
        .bx-cmd-arte { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .bx-cmd-carta { position: relative; width: 220px; border-radius: 12px; overflow: hidden; box-shadow: 0 30px 60px -20px rgba(0,0,0,.9); }
        @media (min-width: 860px) { .bx-cmd-carta { width: 300px; } }
        .bx-cmd-holo { position: absolute; inset: 0; mix-blend-mode: screen; pointer-events: none; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.28) 45%, rgba(var(--ac-1-rgb), .2) 55%, transparent 70%); background-size: 250% 100%; animation: bxCmdHolo 3s ease-in-out infinite alternate; }
        .bx-cmd-selo { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--bx-border-2); color: var(--bx-text-2); }
        .bx-cmd-info { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .bx-cmd-nome { margin: 0; font-size: clamp(23px, 3vw, 28px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.1; }
        .bx-cmd-k { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ac-1); }
        .bx-cmd-rot { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--bx-text-3); }
        .bx-cmd-preco { padding: 16px; border-radius: 16px; background: var(--bx-hero-wash), var(--bx-surface); border: 1px solid rgba(var(--ac-1-rgb), .28); }
        .bx-cmd-grande { font-size: clamp(30px, 5vw, 38px); font-weight: 900; letter-spacing: -.04em; line-height: 1.1; color: var(--ac-1); }
        .bx-cmd-faixa { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
        .bx-cmd-mini { background: var(--bx-bg); border: 1px solid var(--bx-border); border-radius: 10px; padding: 8px 10px; min-width: 0; }
        .bx-cmd-bloco { padding: 14px; border-radius: 16px; background: var(--bx-surface); border: 1px solid var(--bx-border); min-width: 0; }
        .bx-cmd-step { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2); color: var(--bx-text); font: inherit; font-size: 20px; cursor: pointer; transition: background .15s ease; }
        .bx-cmd-step:disabled { opacity: .4; cursor: default; }
        .bx-cmd-campos { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
        .bx-cmd-campos > .bx-cmd-rot { margin-top: 6px; }
        @media (min-width: 560px) { .bx-cmd-campos { grid-template-columns: 90px minmax(0, 1fr); gap: 10px 12px; align-items: center; } .bx-cmd-campos > .bx-cmd-rot { margin-top: 0; } }
        .bx-cmd-chips { display: flex; gap: 5px; flex-wrap: wrap; min-width: 0; }
        @media (max-width: 559px) { .bx-cmd-rola { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; } .bx-cmd-rola::-webkit-scrollbar { display: none; } }
        .bx-cmd-dupla { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
        @media (min-width: 560px) { .bx-cmd-dupla { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .bx-cmd-anunciar { width: 100%; min-height: 46px; border: none; border-radius: 12px; background: var(--ac-grad); color: var(--bx-brand-ink); font: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
        .bx-cmd-anunciar:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
        .bx-cmd-sino { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2); color: var(--bx-text); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .bx-cmd-sino-on { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), .12); color: var(--ac-1); }
        .bx-cmd-ghost { min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--bx-border-2); background: transparent; color: var(--bx-text-2); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: background .15s ease; }
        .bx-cmd-ghost:hover { background: var(--bx-surface-2); }
        .bx-cmd-switch { position: relative; width: 48px; height: 28px; border-radius: 999px; border: none; cursor: pointer; flex-shrink: 0; transition: background .15s ease; }
        .bx-cmd-switch span { position: absolute; top: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .15s ease; }
        .bx-cmd-campo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .bx-cmd-campo input { font: inherit; font-size: 16px; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2); color: var(--bx-text); box-sizing: border-box; width: 100%; outline: none; }
        .bx-cmd-campo input:focus { border-color: var(--ac-1); }
        .bx-cmd-salvargrad { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; border-radius: 12px; border: 1px solid; font: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; transition: background .15s ease; }
        .bx-cmd-linha { border-top: 1px solid var(--bx-border); padding-top: 12px; }
        .bx-cmd-links { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .bx-cmd-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--bx-border); font-size: 13.5px; font-weight: 700; color: var(--bx-text-2); text-decoration: none; transition: background .15s ease; }
        .bx-cmd-link:hover { background: var(--bx-surface-2); }
        .bx-cmd-remover { min-height: 44px; padding: 0 12px; border: none; background: none; color: #f87171; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; border-radius: 10px; }
        .bx-cmd-remover:hover { background: rgba(239,68,68,.08); }
        .bx-cmd-barra { display: flex; align-items: center; justify-content: space-between; gap: 10px 12px; flex-wrap: wrap; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid rgba(var(--ac-1-rgb), .3); background: rgba(var(--ac-1-rgb), .06); flex-shrink: 0; }
        @media (min-width: 860px) { .bx-cmd-barra { padding: 12px 26px; } }
        .bx-cmd-salvar { min-height: 44px; padding: 0 18px; border-radius: 12px; border: none; background: var(--ac-1); color: var(--bx-brand-ink); font: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
        .bx-cmd-rodape-cel { display: none; }
        @media (max-width: 859px) {
          .bx-cmd-fundo { align-items: flex-end; padding: 0; }
          .bx-cmd { max-width: none; max-height: 94dvh; border-radius: 22px 22px 0 0; border-bottom: none; animation: bxCmdSobe .25s cubic-bezier(.22,.61,.36,1) both; }
          .bx-cmd-rodape-cel { display: block; padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--bx-border); flex-shrink: 0; }
          .bx-cmd-anunciar-desk { display: none; }
          .bx-cmd-navbtn { max-width: 44px; padding: 0; }
          .bx-cmd-navbtn .bx-cmd-navnome, .bx-cmd-nav > span .bx-cmd-navnome { display: none; }
        }
        @keyframes bxCmdEntra { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bxCmdSobe { from { transform: translateY(24px) } to { transform: none } }
        @keyframes bxCmdHolo { from { background-position: 0 0 } to { background-position: 100% 0 } }
        @media (prefers-reduced-motion: reduce) { .bx-cmd-fundo, .bx-cmd, .bx-cmd-holo { animation: none; } .bx-cmd-anunciar:hover { transform: none; } }
      `}</style>
    </div>
  )
}

function EnergiaDot({ tipo }: { tipo: string }) {
  const c = TYPE_COLOR[tipo]
  return <span title={tipoTcgPt(tipo)} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: c?.bg || 'var(--bx-surface-2)', border: `1.5px solid ${c?.text || 'var(--bx-text-3)'}`, flexShrink: 0 }} />
}
