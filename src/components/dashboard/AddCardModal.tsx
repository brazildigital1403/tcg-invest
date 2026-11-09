'use client'

/**
 * Modal "Adicionar carta" (quadros 02, 03, 03a a 03g e 03f do wireframe de
 * ticar cartas, 09/11/2026). Duas abas: Buscar (busca v9 + grade de tique) e
 * Por set (escolhe o set e abre /minha-colecao/por-set/[setId]).
 *
 * A selecao do lote, o padrao do lote e o plano vivem AQUI e sobrevivem a
 * nova busca e a rolagem infinita; a grade (GradeTique) so desenha e grava
 * pelas RPCs colecao_adicionar_lote / colecao_desfazer_lote.
 */

import { useState, useRef, useEffect, useMemo, useCallback, type UIEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconSearch, IconCollection, IconChevronRight, IconClose, IconUpload } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit } from '@/lib/checkCardLimit'
import { track, trackFirstCardAdded } from '@/lib/analytics'
import { registrarSinal } from '@/lib/sinais'
import CardRequestBox from './CardRequestBox'
import ImportarCartasModal from './ImportarCartasModal'
import ModalLimiteCartas from '@/components/ui/ModalLimiteCartas'
import { CAMPO_VALOR, getPrecoVariante } from '@/lib/calcPatrimonio'
import GradeTique, {
  ChipPadraoLote, FolhaAjusteCarta, ListaLote, PADRAO_INICIAL, calcularVagas, resolverItem,
  type AjusteCarta, type CartaTique, type ItemLote, type PadraoLote, type PilhaCarta, type PlanoTique, type ResultadoLote,
} from '@/components/colecao/GradeTique'

interface Props {
  userId: string | null
  /** Aba aberta ao montar (a sidebar chega com ?adicionar=por-set). */
  abaInicial?: 'busca' | 'set'
  onClose: () => void
  /** Recebe as linhas gravadas (com `__price` do catalogo) pra tela fazer
   *  append local em vez de recarregar. Sem argumento = chamador recarrega. */
  onAdded: (linhas?: unknown[]) => void
}

/** Linha da busca v9 (pc.*): colunas livres do catalogo. */
type BuscaRow = Record<string, unknown>

type Aba = 'busca' | 'set'

type SetLinha = {
  id: string
  name: string | null
  name_pt: string | null
  logo_url: string | null
  release_date: string | null
  total: number | null
  /** Cartas distintas que o usuario tem no set (so em "Seus sets"). */
  tenho?: number
}

const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const PAGE_SIZE = 60 // resultados por pagina (scroll infinito)

const num = (v: unknown): number => {
  const f = parseFloat(String(v))
  return isNaN(f) || f <= 0 ? 0 : f
}
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

function cardNumberLabel(card: BuscaRow): string {
  const m = str(card.name).match(/\((\d+)\/(\d+)\)/)
  if (m) return `${m[1]}/${m[2]}`
  const n = str(card.number)
  const tot = str(card.set_total)
  if (n && tot) {
    const padded = /^\d+$/.test(n) ? n.padStart(tot.length, '0') : n
    return `${padded}/${tot}`
  }
  return n
}

function setLabel(s?: string | null): string {
  if (!s) return ''
  return s.replace(/^Liga BR\s*[—-]\s*/i, 'Set ').replace(/^Liga BR\b/i, 'Set')
}

/** Linha da busca v9 (pc.*) -> carta da grade. Precos pelas colunas *_min. */
function paraCartaTique(c: BuscaRow, pilhas: PilhaCarta[]): CartaTique {
  return {
    card_id: str(c.id),
    nome: str(c.name) || 'Carta',
    numero: cardNumberLabel(c) || null,
    set_id: str(c.set_id) || null,
    set_name: setLabel(str(c.set_name_pt) || str(c.set_name)) || null,
    image_small: str(c.image_small) || str(c.image_large) || null,
    raridade: str(c.rarity) || null,
    valor: getPrecoVariante(c, 'normal')[CAMPO_VALOR],
    precos: {
      normal: num(c.preco_min) || null,
      foil: num(c.preco_foil_min) || null,
      reverse: num(c.preco_reverse_min) || null,
      promo: num(c.preco_promo_min) || null,
      pokeball: num(c.preco_pokeball_min) || null,
    },
    pilhas,
  }
}

function anoDe(d: string | null | undefined): string {
  return d ? String(d).slice(0, 4) : ''
}

/** Sigla curta do set para a UI. Id interno de ingestao (prefixo de fonte) nunca aparece. */
function codigoSet(id: string): string | null {
  const cod = id.toUpperCase()
  if (cod.length > 6 || cod.includes('-')) return null
  return cod
}

function limparTermoSet(q: string): string {
  // Sem virgula, parenteses e aspas: sao os separadores do filtro .or() do PostgREST.
  return q.replace(/[,()'"%]/g, ' ').trim()
}

export default function AddCardModal({ userId, abaInicial = 'busca', onClose, onAdded }: Props) {
  const router = useRouter()

  const [aba, setAba] = useState<Aba>(abaInicial)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [showImport, setShowImport] = useState(false)
  const [showLimite, setShowLimite] = useState(false)
  const [limiteCartas, setLimiteCartas] = useState(100)

  // ── Aba Buscar ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  // Termo que gerou o resultado na tela. Depois de salvar o campo volta vazio
  // mas o resultado fica (quadro 03e), e a rolagem infinita segue por ele.
  const [termoResultado, setTermoResultado] = useState('')
  const [searchResults, setSearchResults] = useState<BuscaRow[]>([])
  const [isSearching, setIsSearching] = useState(false)
  // Busca que FALHOU (rede caiu, RPC deu erro) e coisa diferente de busca que
  // voltou vazia. Sem separar as duas, todo tropeco de conexao virava um
  // pedido de "carta faltando" no admin — ver a nota no catch de handleSearch.
  const [buscaFalhou, setBuscaFalhou] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Lote: vive no modal para sobreviver a nova busca e a rolagem.
  const [selecao, setSelecao] = useState<Map<string, AjusteCarta>>(() => new Map())
  const [padrao, setPadrao] = useState<PadraoLote>(PADRAO_INICIAL)
  const [plano, setPlano] = useState<PlanoTique>({ limite: -1, totalAtual: 0 })
  // Linhas do usuario em user_cards por card_id, carregadas a cada pagina.
  const [pilhas, setPilhas] = useState<Map<string, PilhaCarta[]>>(() => new Map())
  // Toda carta ja vista (o lote pode guardar cartas que sairam do resultado).
  const conhecidas = useRef(new Map<string, CartaTique>())
  // Ultimo lote com recusadas: mostra "Ver planos" como rede de seguranca.
  const [recusadasUltimo, setRecusadasUltimo] = useState(0)
  // Folha de ajuste aberta pelo painel lateral do desktop.
  const [ajusteDesktop, setAjusteDesktop] = useState<string | null>(null)

  // ── Aba Por set ────────────────────────────────────────────────────────────
  const [setBusca, setSetBusca] = useState('')
  const [setResultados, setSetResultados] = useState<SetLinha[] | null>(null)
  const [buscandoSet, setBuscandoSet] = useState(false)
  const [meusSets, setMeusSets] = useState<SetLinha[] | null>(null)
  const [lancamentos, setLancamentos] = useState<SetLinha[] | null>(null)
  const setTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Fechar o modal no meio de um debounce nao pode disparar busca em componente morto.
  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (setTimeoutRef.current) clearTimeout(setTimeoutRef.current)
  }, [])
  const setsCarregados = useRef(false)

  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth <= 768) }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Plano: total de linhas hoje e limite (-1 = sem limite).
  useEffect(() => {
    if (!userId) return
    let vivo = true
    checkCardLimit(userId).then(({ total, limite }) => {
      if (!vivo) return
      setPlano({ limite: Number.isFinite(limite) ? limite : -1, totalAtual: total })
      if (Number.isFinite(limite)) setLimiteCartas(limite)
    }).catch(() => {})
    return () => { vivo = false }
  }, [userId])

  // ── Pilhas do usuario para os ids do resultado ─────────────────────────────
  const carregarPilhas = useCallback(async (ids: string[]) => {
    if (!userId || ids.length === 0) return
    const { data, error } = await supabase
      .from('user_cards')
      .select('id, pokemon_api_id, variante, idioma, quantity')
      .eq('user_id', userId)
      .eq('graduada', false)
      .in('pokemon_api_id', ids)
    if (error) return
    setPilhas(prev => {
      const m = new Map(prev)
      ids.forEach(id => m.set(id, []))
      type Linha = { id: string; pokemon_api_id: string; variante: string | null; idioma: string | null; quantity: number | null }
      ;((data || []) as Linha[]).forEach(r => {
        const arr = m.get(r.pokemon_api_id) || []
        arr.push({ id: r.id, variante: r.variante || 'normal', idioma: (r.idioma || 'pt').toLowerCase(), quantity: r.quantity || 1 })
        m.set(r.pokemon_api_id, arr)
      })
      return m
    })
  }, [userId])

  // ── Busca v9 ───────────────────────────────────────────────────────────────
  async function handleSearch(value: string) {
    setSearchTerm(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!value.trim()) { setSearchResults([]); setTermoResultado(''); setOffset(0); setHasMore(false); return }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        // v9 (04/11/2026): a fila de "carta faltando" provou 24 cartas que
        // existiam e a busca nao achava. Numero com letra ("celebi 106" ->
        // 106c), numero antes do nome ("076 crobat"), typo junto com numero
        // ("Snolarx 119", "mega darkai"), SET por nome em qualquer idioma
        // ("30 anos", "obsidiana em chamas charmander") e ruido de copiar e
        // colar ("Blastoise-EX (029"). Envelopa a v8: zero regressao medida.
        // v1 a v8 continuam no banco: reverter e trocar este nome.
        const { data, error } = await supabase.rpc('smart_search_cards_v9', {
          q: value,
          limit_n: PAGE_SIZE,
          offset_n: 0,
        })
        if (error) throw error
        const rows = (data || []) as BuscaRow[]
        setSearchResults(rows)
        setTermoResultado(value)
        setBuscaFalhou(false)
        setOffset(rows.length)
        setHasMore(rows.length === PAGE_SIZE)
        if (resultsRef.current) resultsRef.current.scrollTop = 0
        carregarPilhas(rows.map(c => str(c.id)))
      } catch {
        // Falha NAO e "nao existe". Enquanto esse catch zerava a lista sem
        // marcar nada, o CardRequestBox lia zero resultados e registrava um
        // pedido de carta faltando — e o admin acumulava "Charizard",
        // "Meowth", "Koraidon" como se nao estivessem no catalogo. Estavam:
        // 30 dos 95 termos pendentes tinham carta. Publico majoritariamente
        // mobile + rede instavel = pedido fantasma.
        setSearchResults([]); setTermoResultado(''); setOffset(0); setHasMore(false)
        setBuscaFalhou(true)
      }
      setIsSearching(false)
    }, 350)
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !termoResultado.trim()) return
    setLoadingMore(true)
    try {
      const { data, error } = await supabase.rpc('smart_search_cards_v9', {
        q: termoResultado,
        limit_n: PAGE_SIZE,
        offset_n: offset,
      })
      if (error) throw error
      const rows = (data || []) as BuscaRow[]
      setSearchResults(prev => {
        const seen = new Set(prev.map(c => c.id))
        const novos = rows.filter(c => !seen.has(c.id))
        return [...prev, ...novos]
      })
      setOffset(prev => prev + rows.length)
      setHasMore(rows.length === PAGE_SIZE)
      carregarPilhas(rows.map(c => str(c.id)))
    } catch { setHasMore(false) }
    setLoadingMore(false)
  }

  function handleResultsScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) loadMore()
  }

  const filtered = searchResults
    .filter(c => !typeFilter || ((c.types as string[] | null) || []).includes(typeFilter))
    .filter(c => !rarityFilter || c.rarity === rarityFilter)

  // Cartas da grade: resultado filtrado + pilhas do usuario.
  const cartasTique: CartaTique[] = useMemo(() => {
    const lista = filtered.map(c => paraCartaTique(c, pilhas.get(str(c.id)) || []))
    lista.forEach(c => conhecidas.current.set(c.card_id, c))
    return lista
  }, [filtered, pilhas])

  const cartaConhecida = useCallback((id: string): CartaTique | undefined => {
    const c = conhecidas.current.get(id)
    if (!c) return undefined
    const p = pilhas.get(id)
    return p ? { ...c, pilhas: p } : c
  }, [pilhas])

  // Linhas e vagas do painel lateral (desktop). A grade faz a mesma conta.
  const linhasLote = useMemo(() => Array.from(selecao, ([id, ajuste]) => {
    const carta = cartaConhecida(id)
    return { card_id: id, carta, item: resolverItem(id, ajuste, padrao, carta) }
  }), [selecao, padrao, cartaConhecida])

  const vagasPainel = useMemo(() => {
    const todas = Array.from(conhecidas.current.keys()).map(id => cartaConhecida(id)).filter((c): c is CartaTique => !!c)
    return calcularVagas(plano, selecao, todas, padrao)
  }, [plano, selecao, padrao, cartaConhecida])

  // ── Gravar / desfazer o lote ───────────────────────────────────────────────
  async function salvarLote(itens: ItemLote[]): Promise<ResultadoLote | null> {
    if (!userId) return null
    const { data, error } = await supabase.rpc('colecao_adicionar_lote', { p_itens: itens, p_origem: 'busca' })
    if (error || !data || data.ok === false) {
      if (error) console.error('[AddCardModal] colecao_adicionar_lote:', error)
      return null
    }
    const r: ResultadoLote = {
      entraram: data.entraram || [],
      somadas: data.somadas || [],
      recusadas: data.recusadas || [],
      ignorados: data.ignorados || [],
      limite: typeof data.limite === 'number' ? data.limite : -1,
      total_agora: typeof data.total_agora === 'number' ? data.total_agora : plano.totalAtual,
    }
    // Sinal "carta procurada" no COMMIT, nao no clique: tocar para espiar
    // nao pode virar "a mais procurada".
    const gravadas = [...r.entraram.map(e => e.card_id), ...r.somadas.map(s => s.card_id)]
    gravadas.forEach(id => queueMicrotask(() => registrarSinal('busca_colecao', id, 0)))
    if (gravadas.length) trackFirstCardAdded(userId)
    const porId = new Map(itens.map(i => [i.card_id, i]))
    gravadas.forEach(id => {
      const carta = cartaConhecida(id)
      const item = porId.get(id)
      track({
        name: 'card_added_to_collection',
        properties: {
          card_id: id,
          set_id: carta?.set_id || '',
          quantity: item?.quantity || 1,
          value_brl: carta?.valor || undefined,
          origem: 'busca',
        },
      })
    })
    return r
  }

  async function desfazerLote(r: ResultadoLote) {
    const { error } = await supabase.rpc('colecao_desfazer_lote', {
      p_ids: r.entraram.map(e => e.id),
      p_somadas: r.somadas.map(s => ({ id: s.id, quantity: s.quantity })),
    })
    if (error) throw error
    setPlano(p => ({ ...p, totalAtual: Math.max(0, p.totalAtual - r.entraram.length) }))
    setRecusadasUltimo(0)
    carregarPilhas([...r.entraram, ...r.somadas].map(x => x.card_id))
    onAdded()
  }

  function aoSalvo(r: ResultadoLote) {
    setPlano(p => ({ limite: r.limite !== -1 ? r.limite : p.limite, totalAtual: r.total_agora }))
    if (r.limite > 0) setLimiteCartas(r.limite)
    setRecusadasUltimo(r.recusadas.length)
    // Pilhas reais no lugar do otimismo da grade.
    carregarPilhas([...r.entraram, ...r.somadas].map(x => x.card_id))
    onAdded()
    // Campo volta vazio e com foco; o resultado fica na tela (quadro 03e).
    setSearchTerm('')
    buscaRef.current?.focus()
  }

  function removerDoLote(id: string) {
    setSelecao(prev => { const m = new Map(prev); m.delete(id); return m })
  }

  function aplicarAjusteDesktop(id: string, ajuste: AjusteCarta) {
    setSelecao(prev => { const m = new Map(prev); m.set(id, ajuste); return m })
  }

  // ── Aba Por set ────────────────────────────────────────────────────────────
  const carregarSets = useCallback(async () => {
    if (setsCarregados.current) return
    setsCarregados.current = true
    const [meus, lanc] = await Promise.all([
      userId ? supabase.rpc('colecao_meus_sets', { p_limite: 8 }) : Promise.resolve({ data: [] as unknown, error: null }),
      supabase.from('pokemon_sets').select('id, name, name_pt, logo_url, release_date, total')
        .order('release_date', { ascending: false, nullsFirst: false }).limit(6),
    ])
    type MeuSet = { set_id: string; name: string | null; name_pt: string | null; logo_url: string | null; release_date: string | null; total: number | null; tenho: number }
    const m: SetLinha[] = Array.isArray(meus.data)
      ? (meus.data as MeuSet[]).map(s => ({ id: s.set_id, name: s.name, name_pt: s.name_pt, logo_url: s.logo_url, release_date: s.release_date, total: s.total, tenho: s.tenho }))
      : []
    setMeusSets(m)
    setLancamentos((lanc.data || []) as SetLinha[])
  }, [userId])

  useEffect(() => { if (aba === 'set') carregarSets() }, [aba, carregarSets])

  function handleSetBusca(value: string) {
    setSetBusca(value)
    if (setTimeoutRef.current) clearTimeout(setTimeoutRef.current)
    const q = limparTermoSet(value)
    if (!q) { setSetResultados(null); setBuscandoSet(false); return }
    setTimeoutRef.current = setTimeout(async () => {
      setBuscandoSet(true)
      const { data } = await supabase.from('pokemon_sets')
        .select('id, name, name_pt, logo_url, release_date, total')
        .or(`name.ilike.%${q}%,name_pt.ilike.%${q}%,id.ilike.%${q}%`)
        .order('release_date', { ascending: false, nullsFirst: false })
        .limit(8)
      setSetResultados((data || []) as SetLinha[])
      setBuscandoSet(false)
    }, 300)
  }

  function abrirSet(id: string) {
    router.push('/minha-colecao/por-set/' + encodeURIComponent(id))
    onClose()
  }

  const tenhoPorSet = useMemo(() => new Map((meusSets || []).map(s => [s.id, s.tenho || 0])), [meusSets])

  // ── Render ─────────────────────────────────────────────────────────────────
  const subtitulo = aba === 'set'
    ? 'Escolha um set e marque o que você tem'
    : filtered.length > 0
      ? `${filtered.length}${hasMore ? '+' : ''} resultado${filtered.length !== 1 ? 's' : ''}${selecao.size > 0 ? ` · ${selecao.size} ${selecao.size === 1 ? 'marcada' : 'marcadas'}` : ''}`
      : 'Busque por nome ou número'

  const cartaAjusteDesktop = ajusteDesktop ? cartaConhecida(ajusteDesktop) : undefined

  const rodapeGrade = recusadasUltimo > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--bx-text-2)', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{recusadasUltimo} {recusadasUltimo === 1 ? 'carta não coube' : 'cartas não couberam'} no plano e {recusadasUltimo === 1 ? 'continua marcada' : 'continuam marcadas'}.</span>
      <button type="button" onClick={() => setShowLimite(true)} style={{ font: 'inherit', fontSize: 12, fontWeight: 700, minHeight: 44, padding: '0 8px', border: 'none', background: 'none', color: 'var(--ac-1)', cursor: 'pointer', textDecoration: 'underline' }}>Ver planos</button>
    </div>
  ) : undefined

  function LinhaSet({ s, meta, progresso }: { s: SetLinha; meta: string; progresso: number | null }) {
    const nome = s.name_pt || s.name || s.id
    return (
      <button
        type="button"
        onClick={() => abrirSet(s.id)}
        aria-label={`${nome}: abrir a tela do set para marcar`}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '6px 4px 6px 0', border: 'none', borderBottom: '1px solid var(--bx-border)', background: 'none', color: 'var(--bx-text)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
      >
        <span style={{ width: 56, height: 36, flex: 'none', borderRadius: 8, background: 'var(--bx-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {s.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={s.logo_url} alt="" style={{ maxWidth: '88%', maxHeight: '80%', objectFit: 'contain' }} />
            : codigoSet(s.id)
              ? <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bx-text-3)' }}>{codigoSet(s.id)}</span>
              : <IconCollection size={18} color="var(--bx-text-3)" />}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
          <span style={{ fontSize: 12, color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
          {progresso !== null && (
            <span aria-hidden="true" style={{ display: 'block', height: 4, borderRadius: 999, background: 'var(--bx-surface-3)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, progresso))}%`, borderRadius: 999, background: progresso >= 100 ? 'var(--bx-green)' : 'var(--ac-grad)', transition: 'width 0.2s ease' }} />
            </span>
          )}
        </span>
        <IconChevronRight size={18} color="var(--bx-text-3)" />
      </button>
    )
  }

  function metaDoSet(s: SetLinha): { meta: string; progresso: number | null } {
    const tenho = s.tenho ?? tenhoPorSet.get(s.id) ?? 0
    const partes: string[] = []
    const cod = codigoSet(s.id)
    if (cod) partes.push(cod)
    const ano = anoDe(s.release_date)
    if (ano) partes.push(ano)
    if (tenho > 0 && s.total) {
      const faltam = Math.max(0, s.total - tenho)
      partes.push(`${tenho} de ${s.total}`)
      partes.push(faltam === 0 ? 'completo' : `faltam ${faltam}`)
      return { meta: partes.join(' · '), progresso: Math.round((tenho / s.total) * 100) }
    }
    if (tenho > 0) { partes.push(`${tenho} ${tenho === 1 ? 'carta' : 'cartas'}`); return { meta: partes.join(' · '), progresso: null } }
    if (s.total) partes.push(`${s.total} cartas`)
    partes.push('nenhuma ainda')
    return { meta: partes.join(' · '), progresso: null }
  }

  const tituloSecao: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 2px' }

  const cartaoPorSet = (
    <button
      type="button"
      onClick={() => setAba('set')}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.07)', color: 'var(--bx-text)', cursor: 'pointer', textAlign: 'left', font: 'inherit', fontSize: 13, lineHeight: 1.4 }}
    >
      <IconCollection size={20} color="var(--ac-1)" />
      <span style={{ flex: 1 }}>Tem muitas cartas do mesmo set? Em <b>Por set</b> você abre a lista inteira e marca todas de uma vez.</span>
      <IconChevronRight size={18} color="var(--bx-text-3)" />
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }}>
      <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 1000, maxHeight: isMobile ? '100dvh' : '90vh', height: isMobile ? '100dvh' : '90vh', background: 'var(--bx-bg-elev)', border: isMobile ? 'none' : '1px solid var(--bx-border-2)', borderRadius: isMobile ? 0 : 24, boxShadow: '0 32px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif", color: 'var(--bx-text)' }}>

        {/* HEADER */}
        <div style={{ padding: isMobile ? '12px 16px 10px' : '16px 28px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {!isMobile && (
              <div style={{ width: 40, height: 40, borderRadius: 12, flex: 'none', background: 'linear-gradient(135deg, rgba(var(--ac-1-rgb),0.2), rgba(239,68,68,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconSearch size={20} color="var(--ac-1)" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--bx-text)', whiteSpace: 'nowrap' }}>Adicionar carta</p>
              <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitulo}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <button type="button" onClick={() => setShowImport(true)} aria-label="Importar lista" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: 'var(--bx-text)', minHeight: 40, padding: isMobile ? '0 10px' : '0 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }}>
              <IconUpload size={14} />
              {isMobile ? 'Importar' : 'Importar lista'}
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconClose size={14} />
            </button>
          </div>
        </div>

        {/* SELETOR Buscar | Por set */}
        <div style={{ padding: isMobile ? '0 16px 12px' : '0 28px 14px', borderBottom: aba === 'set' ? '1px solid var(--bx-border)' : 'none', flexShrink: 0 }}>
          <div role="tablist" aria-label="Como adicionar" style={{ display: 'flex', padding: 3, borderRadius: 12, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', maxWidth: isMobile ? '100%' : 360 }}>
            {([
              { key: 'busca', label: 'Buscar', icone: <IconSearch size={14} color="currentColor" /> },
              { key: 'set', label: 'Por set', icone: <IconCollection size={14} color="currentColor" />, novo: true },
            ] as { key: Aba; label: string; icone: React.ReactNode; novo?: boolean }[]).map(t => {
              const on = aba === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setAba(t.key)}
                  style={{ flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, border: 'none', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: on ? 'var(--bx-surface-3)' : 'none', color: on ? 'var(--bx-text)' : 'var(--bx-text-2)', boxShadow: on ? 'inset 0 0 0 1px var(--bx-border-2)' : 'none', transition: 'background 0.15s ease, color 0.15s ease' }}
                >
                  {t.icone}
                  {t.label}
                  {t.novo && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 5px', borderRadius: 6, background: 'rgba(var(--ac-1-rgb), 0.15)', color: 'var(--ac-1)' }}>NOVO</span>}
                </button>
              )
            })}
          </div>
        </div>

        {aba === 'busca' && (
          <>
            {/* BUSCA + FILTROS + PADRAO DO LOTE */}
            <div style={{ padding: isMobile ? '0 16px 12px' : '0 28px 14px', borderBottom: '1px solid var(--bx-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : 260 }}>
                  <IconSearch size={16} color={TEXT_MUTED} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    ref={buscaRef}
                    autoFocus={!isMobile}
                    value={searchTerm}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Ex: Charizard · 051/217 · PAF 109"
                    style={{ width: '100%', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12, minHeight: 44, padding: searchTerm ? '10px 46px 10px 42px' : '10px 16px 10px 42px', color: 'var(--bx-text)', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s ease' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(var(--ac-1-rgb),0.5)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--bx-border)' }}
                  />
                  {isSearching && (
                    <span style={{ position: 'absolute', right: searchTerm ? 46 : 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--ac-1)' }}>Buscando...</span>
                  )}
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => { handleSearch(''); buscaRef.current?.focus() }}
                      aria-label="Limpar busca"
                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'none', border: 'none', color: TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      <IconClose size={14} />
                    </button>
                  )}
                </div>

                {[
                  { value: typeFilter, onChange: setTypeFilter, opts: ['', 'Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'], labels: ['Tipo', 'Fogo', 'Água', 'Planta', 'Elétrico', 'Psíquico', 'Lutador', 'Trevas', 'Metal', 'Dragão', 'Incolor'] },
                  { value: rarityFilter, onChange: setRarityFilter, opts: ['', 'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra', 'Rare Secret'], labels: ['Raridade', 'Comum', 'Incomum', 'Rara', 'Rara Holo', 'Ultra Rara', 'Secreta'] },
                ].map((f, i) => (
                  <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)} aria-label={f.labels[0]}
                    style={{ fontSize: 16, minHeight: 44, fontFamily: 'inherit', flex: isMobile ? 1 : 'none', minWidth: 0, background: f.value ? 'rgba(var(--ac-1-rgb),0.1)' : 'var(--bx-surface)', border: `1px solid ${f.value ? 'rgba(var(--ac-1-rgb),0.4)' : 'var(--bx-border)'}`, borderRadius: 10, padding: isMobile ? '6px 6px' : '6px 10px', color: f.value ? 'var(--ac-1)' : TEXT_MUTED, cursor: 'pointer' }}>
                    {f.opts.map((o, j) => <option key={o} value={o} style={{ background: 'var(--bx-bg-elev)', color: 'var(--bx-text)' }}>{f.labels[j]}</option>)}
                  </select>
                ))}

                <ChipPadraoLote padrao={padrao} onPadraoChange={setPadrao} selecao={selecao} style={{ marginLeft: isMobile ? 0 : 'auto', flex: 'none', padding: isMobile ? '0 10px' : undefined }} />
              </div>
            </div>

            {/* CONTEUDO */}
            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', minHeight: 0 }}>

              {/* Resultado: grade de tique com rolagem infinita; a barra do lote e sticky aqui dentro */}
              <div ref={resultsRef} onScroll={handleResultsScroll} style={{ flex: 1, minWidth: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '12px 16px 0' : '16px 20px 0' }}>

                {!isSearching && searchResults.length === 0 && !searchTerm.trim() && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 4, gap: 10, color: TEXT_MUTED }}>
                      <IconCollection size={36} color="var(--bx-text-3)" style={{ opacity: 0.5 }} />
                      <p style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: 'var(--bx-text)' }}>Busque por nome, número, set, ano ou vários itens</p>
                      <p style={{ fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center', lineHeight: 1.8 }}>
                        <strong style={{ color: 'var(--ac-1)' }}>Charizard</strong> · <strong style={{ color: 'var(--ac-1)' }}>051/217</strong> · <strong style={{ color: 'var(--ac-1)' }}>PAF 109</strong><br />
                        <strong style={{ color: 'var(--ac-1)' }}>Pikachu Ascended Heroes</strong> · <strong style={{ color: 'var(--ac-1)' }}>Pikachu 2019</strong>
                      </p>
                    </div>
                    {cartaoPorSet}
                    {selecao.size > 0 && (
                      <p style={{ fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center' }}>
                        {selecao.size} {selecao.size === 1 ? 'carta marcada' : 'cartas marcadas'} em buscas anteriores seguem no lote. Busque outra carta ou abra o lote pela barra.
                      </p>
                    )}
                  </div>
                )}

                {isSearching && (
                  <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(6,1fr)', gap: isMobile ? 8 : 12 }}>
                    {[...Array(isMobile ? 6 : 12)].map((_, i) => (
                      <div key={i} style={{ background: 'var(--bx-surface)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ paddingBottom: '140%', background: 'var(--bx-surface-2)' }} />
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ height: 10, background: 'var(--bx-surface-3)', borderRadius: 4, marginBottom: 6 }} />
                          <div style={{ height: 8, background: 'var(--bx-surface-2)', borderRadius: 4, width: '60%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* A grade fica MONTADA enquanto houver resultado ou lote, mesmo durante
                    a busca (so some da tela): desmontar perdia o cache das cartas de
                    buscas anteriores, o otimismo e o toast com Desfazer (teste de 09/11). */}
                {(cartasTique.length > 0 || selecao.size > 0) && (
                  <div style={{ display: isSearching ? 'none' : undefined }}>
                    {!isMobile && cartasTique.length > 0 && (
                      <p style={{ fontSize: 11.5, color: 'var(--bx-text-3)', margin: '0 0 10px' }}>Clique marca. O ícone na carta abre a folha de ajuste. {PAGE_SIZE} resultados por página, rolagem infinita.</p>
                    )}
                    <GradeTique
                      cartas={cartasTique}
                      selecao={selecao}
                      onSelecaoChange={setSelecao}
                      padrao={padrao}
                      onPadraoChange={setPadrao}
                      plano={plano}
                      modo="busca"
                      ocultarVerAsN={!isMobile}
                      colunas={{ mobile: 3, desktop: 6 }}
                      onSalvar={salvarLote}
                      onDesfazer={desfazerLote}
                      onSalvo={aoSalvo}
                      rodape={rodapeGrade}
                    />
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && cartasTique.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--bx-text-3)', textAlign: 'center', padding: '24px 0 8px' }}>Nenhuma carta deste resultado passa pelos filtros de tipo e raridade.</p>
                )}

                {!isSearching && loadingMore && (
                  <div style={{ textAlign: 'center', padding: 16, color: TEXT_MUTED, fontSize: 12 }}>Carregando mais...</div>
                )}
                {!isSearching && !hasMore && !loadingMore && cartasTique.length > 0 && (
                  <div style={{ textAlign: 'center', padding: 12, color: 'var(--bx-text-3)', fontSize: 11 }}>Fim dos resultados</div>
                )}

                {/* BOX DE REPORTE: sempre no fim da coluna de resultados. `searchResults`,
                    NAO a lista filtrada: a pergunta e "essa carta existe no catalogo?". */}
                <div style={{ paddingBottom: 16 }}>
                  <CardRequestBox
                    userId={userId}
                    termo={searchTerm}
                    resultados={searchResults}
                    isSearching={isSearching}
                    buscaFalhou={buscaFalhou}
                    cartaSelecionada={null}
                  />
                </div>
              </div>

              {/* PAINEL DO LOTE (desktop, quadro 03f) */}
              {!isMobile && (
                <aside aria-label="Seu lote" style={{ width: 300, flex: 'none', borderLeft: '1px solid var(--bx-border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ ...tituloSecao, margin: 0 }}>Lote: {selecao.size} {selecao.size === 1 ? 'selecionada' : 'selecionadas'}</div>
                  <ListaLote linhas={linhasLote} padrao={padrao} onAjustar={id => setAjusteDesktop(id)} onRemover={removerDoLote} />
                  <p style={{ fontSize: 11.5, color: 'var(--bx-text-3)', lineHeight: 1.45, margin: 0 }}>As marcadas ficam aqui ao rolar ou trocar a busca. O ícone ajusta; o X tira do lote.</p>

                  <div style={{ background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...tituloSecao, margin: '0 0 2px' }}>Padrão do lote</div>
                      <div style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>Vale para toda carta sem ajuste próprio.</div>
                    </div>
                    <ChipPadraoLote padrao={padrao} onPadraoChange={setPadrao} selecao={selecao} />
                  </div>

                  {!vagasPainel.semLimite && (
                    <div style={{ background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ ...tituloSecao, margin: 0 }}>Vagas do plano</div>
                      <div style={{ fontSize: 13, color: vagasPainel.travado ? 'var(--bx-red)' : vagasPainel.alerta === 'perto' ? 'var(--bx-amber)' : 'var(--bx-text)' }}>
                        {vagasPainel.usadasDepois} de {vagasPainel.limite} vagas depois de salvar. O &quot;+&quot; nas que você já tem não gasta vaga.
                      </div>
                      <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: 'var(--bx-surface-3)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Math.round((vagasPainel.usadasDepois / Math.max(1, vagasPainel.limite)) * 100))}%`, background: vagasPainel.travado ? 'var(--bx-red)' : 'var(--ac-grad)', borderRadius: 999, transition: 'width 0.2s ease' }} />
                      </div>
                      {vagasPainel.alerta !== 'ok' && (
                        <Link href="/planos" prefetch={false} style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-1)', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Ver planos</Link>
                      )}
                    </div>
                  )}

                  {selecao.size > 0 && (
                    <button type="button" onClick={() => setSelecao(new Map())} style={{ font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 44, border: 'none', background: 'none', color: 'var(--ac-1)', cursor: 'pointer', alignSelf: 'flex-start', padding: 0 }}>Limpar seleção</button>
                  )}
                </aside>
              )}
            </div>
          </>
        )}

        {aba === 'set' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))' : '16px 28px 24px' }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ position: 'relative', maxWidth: isMobile ? '100%' : 440 }}>
                  <IconSearch size={16} color={TEXT_MUTED} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    value={setBusca}
                    onChange={e => handleSetBusca(e.target.value)}
                    placeholder="Nome ou código do set (ex.: Rivais, SV10, 151)"
                    aria-label="Nome ou código do set"
                    style={{ width: '100%', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12, minHeight: 44, padding: '10px 16px 10px 42px', color: 'var(--bx-text)', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s ease' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(var(--ac-1-rgb),0.5)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--bx-border)' }}
                  />
                  {buscandoSet && <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--ac-1)' }}>Buscando...</span>}
                </div>

                {setResultados !== null ? (
                  <>
                    <div style={tituloSecao}>Resultado</div>
                    {setResultados.length === 0 && !buscandoSet && (
                      <p style={{ fontSize: 13, color: 'var(--bx-text-3)', padding: '12px 0' }}>Nenhum set com esse nome ou código. Tente o nome em português, em inglês ou a sigla.</p>
                    )}
                    {setResultados.map(s => { const m = metaDoSet(s); return <LinhaSet key={s.id} s={s} meta={m.meta} progresso={m.progresso} /> })}
                  </>
                ) : (
                  <>
                    <div style={tituloSecao}>Seus sets</div>
                    {meusSets === null && <p style={{ fontSize: 13, color: 'var(--bx-text-3)', padding: '12px 0' }}>Carregando...</p>}
                    {meusSets !== null && meusSets.length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--bx-text-3)', padding: '12px 0', lineHeight: 1.5 }}>Você ainda não tem carta de nenhum set. Escolha um lançamento abaixo ou busque pelo nome.</p>
                    )}
                    {(meusSets || []).map(s => { const m = metaDoSet(s); return <LinhaSet key={s.id} s={s} meta={m.meta} progresso={m.progresso} /> })}

                    <div style={tituloSecao}>Lançamentos</div>
                    {lancamentos === null && <p style={{ fontSize: 13, color: 'var(--bx-text-3)', padding: '12px 0' }}>Carregando...</p>}
                    {(lancamentos || []).map(s => { const m = metaDoSet(s); return <LinhaSet key={s.id} s={s} meta={m.meta} progresso={m.progresso} /> })}
                  </>
                )}

                {isMobile && (
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.07)', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45 }}>
                    <IconCollection size={20} color="var(--ac-1)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span><b>Tocar no set abre a tela inteira para marcar.</b> A grade do set ocupa a tela toda, com as cartas que você já tem em verde. Toque nas que faltam e salve de uma vez. A seta ou &quot;Concluir&quot; trazem você de volta para a coleção.</span>
                  </div>
                )}

                <Link href="/set" prefetch={false} onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--ac-1)', textDecoration: 'none' }}>
                  Ver todos os sets na Pokédex
                  <IconChevronRight size={16} color="var(--ac-1)" />
                </Link>
              </div>

              {!isMobile && (
                <aside style={{ width: 300, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ ...tituloSecao, margin: 0 }}>O que acontece ao clicar</div>
                  <div style={{ padding: '14px', borderRadius: 12, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.07)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <IconCollection size={22} color="var(--ac-1)" />
                    <b style={{ fontSize: 14 }}>Abre a tela inteira para marcar</b>
                    <span style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.45 }}>O modal fecha e a tela do set abre com a grade inteira. As cartas que você já tem aparecem em verde; clique nas que faltam e salve de uma vez.</span>
                  </div>
                  {plano.limite > 0 && (
                    <div style={{ background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ ...tituloSecao, margin: 0 }}>Vagas do plano</div>
                      <div style={{ fontSize: 13 }}>{plano.totalAtual} de {plano.limite} vagas usadas. Na tela do set o contador acompanha a seleção e trava ao chegar em {plano.limite}.</div>
                      <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: 'var(--bx-surface-3)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Math.round((plano.totalAtual / plano.limite) * 100))}%`, background: 'var(--ac-grad)', borderRadius: 999 }} />
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.45, margin: 0 }}>Carta avulsa? Volte para a aba Buscar. Nada mudou lá.</p>
                </aside>
              )}
            </div>
          </div>
        )}
      </div>

      {ajusteDesktop && cartaAjusteDesktop && (
        <FolhaAjusteCarta
          carta={cartaAjusteDesktop}
          ajuste={selecao.get(cartaAjusteDesktop.card_id) || {}}
          padrao={padrao}
          onFechar={() => setAjusteDesktop(null)}
          onAplicar={a => { aplicarAjusteDesktop(cartaAjusteDesktop.card_id, a); setAjusteDesktop(null) }}
          onUsarComoPadrao={(p, q) => { setPadrao(p); aplicarAjusteDesktop(cartaAjusteDesktop.card_id, q > 1 ? { quantity: q } : {}); setAjusteDesktop(null) }}
        />
      )}

      {showLimite && (
        <ModalLimiteCartas
          limite={limiteCartas}
          onClose={() => setShowLimite(false)}
          onUpgrade={() => { window.location.href = '/minha-conta' }}
        />
      )}
      {showImport && (
        <ImportarCartasModal
          userId={userId}
          onClose={() => setShowImport(false)}
          onAdded={onAdded}
        />
      )}
    </div>
  )
}
