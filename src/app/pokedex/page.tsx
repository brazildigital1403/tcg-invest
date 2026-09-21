'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { checkCardLimit, LIMITE_FREE, ENFORCEMENT_ATIVO, limiteCartasDoErro } from '@/lib/checkCardLimit'
import { trackFirstCardAdded, track } from '@/lib/analytics'
import { useAppModal } from '@/components/ui/useAppModal'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import CardItem, { montarUltimaVenda } from '@/components/ui/CardItem'
import CardDetailModal from './CardDetailModal'
import ModalUpgradePokedex from '@/components/ui/ModalUpgradePokedex'
import ModalLimiteCartas from '@/components/ui/ModalLimiteCartas'
import { IconCard, IconCheck, IconPlus, IconBell } from '@/components/ui/Icons'
import FichaPokemon from '@/components/pokedex/FichaPokemon'
import { useRouter } from 'next/navigation'
import { criarMeta } from '@/lib/metas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

// A paleta mora em lib/pokedexTextos (a ficha e o modal importam de la, sem
// ciclo com esta pagina). Reexportada aqui por compatibilidade.
import { TYPE_COLOR, tipoTcgPt } from '@/lib/pokedexTextos'
export { TYPE_COLOR }

const GEN_RANGES: [string, number, number][] = [
  ['I',    1,   151],
  ['II',   152, 251],
  ['III',  252, 386],
  ['IV',   387, 493],
  ['V',    494, 649],
  ['VI',   650, 721],
  ['VII',  722, 809],
  ['VIII', 810, 905],
  ['IX',   906, 1025],
]

function getGen(n: number) {
  return GEN_RANGES.find(([, min, max]) => n >= min && n <= max)?.[0] || '?'
}

// Sprite do Pokémon via PokeAPI
function getPokemonSprite(name: string, dexId: number): string {
  if (dexId <= 0) return ''
  // Gen I-VIII: pokemondb (alta qualidade) com no-referrer
  // Gen IX DLC: PokeAPI official-artwork (cobre #1001-#1025)
  if (dexId >= 1001) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`
  }
  const urlName = name
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\u2640/g, '-f')
    .replace(/\u2642/g, '-m')
    .replace(/[éèêë]/g, 'e')
    .replace(/[.:]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  return `https://img.pokemondb.net/sprites/home/normal/${urlName}.png`
}

const fmt = (v: any) => v && Number(v) > 0
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
  : null

// Formata número grande com separador de milhar pt-BR
const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Pokedex() {
  const { showAlert, showPrompt } = useAppModal()
  const router = useRouter()

  // Vista: 'grid' = lista de Pokémon | 'cards' = cartas do Pokémon selecionado
  const [view, setView]             = useState<'grid' | 'cards'>('grid')
  const [selectedPokemon, setSelectedPokemon] = useState<any | null>(null)

  // Grid de Pokémon únicos
  const [pokemons, setPokemons]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  // Cartas do Pokémon selecionado
  const [cards, setCards]           = useState<any[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0)
  const [selectedVariante, setSelectedVariante] = useState<string>('normal')

  // Filtros do grid
  const [typeFilter, setTypeFilter] = useState('')
  const [genFilter, setGenFilter]   = useState('')

  // Paginação client-side da grade de Pokémon -- os 1.025 renderizavam de
  // uma vez (1.025 <button> + 1.025 requisições de sprite simultâneas,
  // medido na auditoria 02/08/2026). Mostra em lotes; o sentinel no fim da
  // grade (IntersectionObserver) revela o próximo lote ao rolar perto dele.
  const [visibleCount, setVisibleCount] = useState(120)

  // Busca dentro da vista 2 (cartas de um Pokémon) -- Charizard sozinho tem
  // 329 cartas sem nenhum jeito de filtrar, só scroll manual (achado #8).
  const [cardSearch, setCardSearch] = useState('')

  // Vista 2 redesenhada (21/09/2026, mockup "Pokedex: nova experiencia"):
  // posse, idioma e ordem na barra; "Ja tenho" e sino direto na grade, sem
  // abrir modal por modal.
  const [abaCartas, setAbaCartas] = useState<'todas' | 'tenho' | 'faltam'>('todas')
  const [idiomaCartas, setIdiomaCartas] = useState('')
  const [ordemCartas, setOrdemCartas] = useState<'recentes' | 'caras' | 'baratas' | 'numero'>('recentes')
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set())
  // card_id -> preco maximo do aviso (null = qualquer preco). Estar no Map = aviso ligado.
  const [avisos, setAvisos] = useState<Map<string, number | null>>(new Map())
  const [toast, setToast] = useState<{ texto: string; desfazer?: () => void } | null>(null)
  const [criandoMeta, setCriandoMeta] = useState(false)

  // Pokémons capturados (nomes-base derivados de pokemon_cards.base_pokemon_names).
  // Era um Set populado por cleanPokemonName(card_name) — abandonado por ser
  // frágil (não cobria 'Mega', sufixos com (número), Tag Team, etc).
  // Agora é populado via JOIN com pokemon_cards, que tem o array oficial
  // já normalizado pela API do Pokémon TCG.
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set())

  // IDs exatos de cartas que o user tem (vista 2 — destaca a carta específica
  // que ele já cadastrou na coleção, não todas as cartas do mesmo Pokémon).
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set())

  const [isPro, setIsPro]           = useState(false)
  const [pokedexCompleta, setPokedexCompleta] = useState(false)
  // Plano no momento do uso ('free' | 'trial' | 'plus' | 'pro' | 'pro_anual'),
  // so para instrumentar a liberacao da Pokedex no Gratis (21/09/2026).
  const [planoAtual, setPlanoAtual] = useState('anonimo')
  const [upgradePokemon, setUpgradePokemon] = useState<string | null>(null)
  const [showLimite, setShowLimite] = useState(false)
  const [limiteCartas, setLimiteCartas] = useState(100)
  const [userId, setUserId]         = useState<string | null>(null)

  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState({ usd: 6.0, eur: 6.5 })

  // ── Inicialização ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/exchange-rate').then(r => r.json()).then(d => setExchangeRate({ usd: d.usd || 6.0, eur: d.eur || 6.5 })).catch(() => {})

    async function init() {
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        setUserId(authData.user.id)
        const { isPro: pro, isTrial, caps, plano } = await getUserPlan(authData.user.id)
        setIsPro(pro || isTrial)
        setPokedexCompleta(caps.catalogoCompleto)
        setPlanoAtual(plano)
        await loadOwnedPokemons(authData.user.id)
        const { data: wl } = await supabase.from('watchlist').select('card_id, target_price').eq('user_id', authData.user.id)
        setAvisos(new Map(((wl as { card_id: string; target_price: number | null }[]) || []).map(w => [w.card_id, w.target_price != null ? Number(w.target_price) : null])))
      }
      await loadPokemons()
    }
    init()
  }, [])

  // ── Carrega nomes-base + IDs exatos das cartas que o user tem ─────────────
  // Faz JOIN entre user_cards.pokemon_api_id ↔ pokemon_cards.id
  //
  // Popula 2 Sets:
  //   ownedNames     → nomes-base ('Charizard', 'Pidgeot') — usado na vista 1
  //   ownedCardIds   → IDs exatos ('me2-125', 'sv4-3')      — usado na vista 2
  //
  // Por que JOIN em vez de regex no client: o banco já tem base_pokemon_names
  // normalizado pela API oficial. Cobre Mega, Tag Team, formas regionais,
  // sufixos com número — sem regex frágil.

  async function loadOwnedPokemons(uid: string) {
    const { data, error } = await supabase.rpc('get_owned_pokemon_names')

    if (error) {
      console.error('[pokedex] erro ao carregar capturados:', error.message)
      return
    }

    const namesSet = new Set<string>()
    const idsSet   = new Set<string>()
    for (const row of (data as any[]) || []) {
      if (row.pokemon_api_id) idsSet.add(row.pokemon_api_id)
      const names: string[] = row.base_pokemon_names || []
      for (const name of names) namesSet.add(name)
    }
    setOwnedNames(namesSet)
    setOwnedCardIds(idsSet)
  }

  // ── Carrega lista única de Pokémon ──────────────────────────────────────────

  async function loadPokemons() {
    setLoading(true)
    try {
      // Busca nomes únicos via API Route (GROUP BY no banco)
      const res = await fetch('/api/pokedex')
      const json = await res.json()
      // Banco já retorna nomes base agrupados — não precisa de limpeza
      const unique: any[] = (json.pokemons || []).map((p: any) => ({
        name: p.name,
        types: p.types,
        card_count: p.card_count,
      }))

      // Busca dex numbers do PokeAPI
      const withDex = await enrichWithDexNumbers(unique)

      // Ordena por número da Pokédex (sem número vai para o fim)
      withDex.sort((a, b) => (a.dexId || 9999) - (b.dexId || 9999))
      setPokemons(withDex)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Busca dex numbers do PokeAPI para cada Pokémon
  async function enrichWithDexNumbers(pokemons: any[]) {
    // Busca a lista do Supabase que já tem dex_id correto
    const cache: Record<string, number> = {}
    try {
      const res = await fetch('/api/pokedex/species')
      const data = await res.json()
      ;(data.species || []).forEach((s: any) => {
        cache[s.name_en.toLowerCase()] = s.dex_id
      })
    } catch {
      // Fallback: PokeAPI
      try {
        const res = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1025')
        const data = await res.json()
        ;(data.results || []).forEach((p: any, i: number) => {
          cache[p.name.toLowerCase()] = i + 1
        })
      } catch {}
    }

    return pokemons.map(p => {
      const nameLower = p.name.toLowerCase()
      // Tenta match direto, depois variações
      const dexId = cache[nameLower]
        || cache[nameLower.replace(/['']/g, '')]           // Farfetch'd → farfetchd
        || cache[nameLower.replace(/[éèê]/g, 'e')]         // Flabébé → flabebe
        || cache[nameLower.replace(/\s+/g, '-')]           // Mr. Mime → mr.-mime
        || cache[nameLower.replace(/[.\s]+/g, '-').replace(/--+/g, '-')]  // Mr. Mime → mr-mime
        || cache[nameLower.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')] // Type: Null → type-null
        || 0
      return {
        ...p,
        dexId,
        generation: dexId > 0 ? getGen(dexId) : '?',
        sprite: dexId > 0 ? getPokemonSprite(p.name, dexId) : p.image,
      }
    })
  }

  // ── Seleciona Pokémon → carrega cartas ─────────────────────────────────────

  // Qual variante abrir por padrao. Testa pela mesma regra que a tela exibe
  // (menor preco) -- testar pela media abriria uma variante que aparece sem
  // valor, ou pularia uma que tem. A Normal vem primeiro porque e ela que o
  // CardItem mostra na grade: abrir na Holo fazia a carta de R$ 14,98 na
  // grade aparecer como R$ 139,89 no modal (21/09/2026).
  function pickBestVariante(card: any): string {
    if (Number(card.preco_min) > 0) return 'normal'
    if (Number(card.preco_foil_min) > 0) return 'foil'
    if (Number(card.preco_reverse_min) > 0) return 'reverse'
    if (Number(card.preco_promo_min) > 0) return 'promo'
    return 'normal'
  }

  async function handleSelectPokemon(pokemon: any) {
    const liberado = !(ENFORCEMENT_ATIVO && !pokedexCompleta)
    track({ name: 'pokedex_pokemon_opened', properties: { pokemon: pokemon?.name || '?', plano: planoAtual, liberado } })
    if (!liberado) {
      setUpgradePokemon(pokemon?.name || 'Pokémon')
      return
    }
    setSelectedPokemon(pokemon)
    setView('cards')
    setCardSearch(''); setAbaCartas('todas'); setIdiomaCartas('')
    setLoadingCards(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    const data = await fetch('/api/pokedex/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pokemon: pokemon.name }),
    }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])

    setCards((data || []).map(c => ({ ...c, price: c, ultima_venda: montarUltimaVenda(c) })))
    setLoadingCards(false)
  }

  // ── Adicionar à coleção ─────────────────────────────────────────────────────

  // Menor preco entre as variantes (regra de divulgacao da casa: o menor preco).
  function valorDaCarta(c: any): number {
    const v = [c.preco_min, c.preco_foil_min, c.preco_reverse_min, c.preco_promo_min].map(Number).filter(n => n > 0)
    return v.length ? Math.min(...v) : 0
  }

  function abrirCarta(card: any, idx: number) {
    setSelectedCard(card); setSelectedCardIndex(idx); setSelectedVariante(pickBestVariante(card))
  }

  function mostrarToast(t: { texto: string; desfazer?: () => void }) {
    setToast(t)
    window.setTimeout(() => setToast(atual => (atual === t ? null : atual)), 6000)
  }

  // Grava a carta na colecao. Ja existe (mesma carta, nao graduada)? Soma uma
  // copia em vez de bater no indice unico -- antes o segundo "Adicionar" dava
  // "Carta ja esta na sua colecao!" e nao fazia nada. Idioma e condicao vem do
  // modal; o "Ja tenho" da grade grava so a variante (idioma fica o padrao do
  // banco, igual ao AddCardModal sem escolha).
  async function handleAddCard(card: any) {
    if (!userId) { showAlert('Faça login para adicionar cartas.', 'warning'); return }
    if (ocupadas.has(card.id)) return
    const variante = card._variante || selectedVariante || 'normal'
    const condicao: string | undefined = card._condicao
    setOcupadas(prev => new Set(prev).add(card.id))
    const liberar = () => setOcupadas(prev => { const n = new Set(prev); n.delete(card.id); return n })

    const { data: existente } = await supabase
      .from('user_cards')
      .select('id, quantity, condicoes')
      .eq('user_id', userId).eq('pokemon_api_id', card.id).eq('graduada', false)
      .limit(1).maybeSingle()

    if (existente) {
      const qtdAntes = existente.quantity || 1
      const condAntes = (existente.condicoes as Record<string, number> | null) || null
      const condDepois = condicao ? { ...(condAntes || {}), [condicao]: ((condAntes || {})[condicao] || 0) + 1 } : condAntes
      const { error } = await supabase.from('user_cards').update({ quantity: qtdAntes + 1, condicoes: condDepois }).eq('id', existente.id)
      liberar()
      if (error) { showAlert('Não conseguimos adicionar a carta. Tente de novo.', 'error'); return }
      track({ name: 'card_added_to_collection', properties: { card_id: card.id, set_id: card.set_id || '', quantity: 1, origem: 'pokedex', plano: planoAtual } })
      mostrarToast({
        texto: `Mais uma ${card.name} na sua coleção. Agora são ${qtdAntes + 1} cópias.`,
        desfazer: async () => {
          setToast(null)
          await supabase.from('user_cards').update({ quantity: qtdAntes, condicoes: condAntes }).eq('id', existente.id)
        },
      })
      return
    }

    if (!isPro) {
      const { bloqueado, limite: limiteDoPlano } = await checkCardLimit(userId)
      if (Number.isFinite(limiteDoPlano)) setLimiteCartas(limiteDoPlano)
      if (bloqueado) { liberar(); setShowLimite(true); return }
    }
    const linha: Record<string, unknown> = {
      user_id: userId, pokemon_api_id: card.id,
      card_name: card.name, card_id: card.id,
      card_image: card.image_small, set_name: card.set_name,
      rarity: card.rarity, variante, quantity: 1,
    }
    if (card._idioma) linha.idioma = card._idioma
    if (condicao) linha.condicoes = { [condicao]: 1 }
    const { data, error } = await supabase.from('user_cards').insert(linha).select('id').single()
    liberar()
    if (error) {
      const lim = limiteCartasDoErro(error)
      if (lim !== null) {
        track({ name: 'limite_cartas_atingido', properties: { origem: 'pokedex', limite: lim, plano: planoAtual } })
        setLimiteCartas(lim); setShowLimite(true); return
      }
      showAlert('Não conseguimos adicionar a carta. Tente de novo.', 'error'); return
    }
    // Nomes-base da carta (1 ou varios, no caso de Tag Team) marcam o Pokemon
    // como capturado na grade; o id marca a carta exata.
    setOwnedNames(prev => {
      const next = new Set(prev)
      for (const n of (card.base_pokemon_names || []) as string[]) next.add(n)
      return next
    })
    setOwnedCardIds(prev => new Set(prev).add(card.id))
    trackFirstCardAdded(userId)
    track({ name: 'card_added_to_collection', properties: {
      card_id: card.id, set_id: card.set_id || '', quantity: 1, origem: 'pokedex', plano: planoAtual,
    } })
    const novoId = (data as { id: string } | null)?.id
    mostrarToast({
      texto: `${card.name} entrou na sua coleção.`,
      desfazer: novoId ? async () => {
        setToast(null)
        await supabase.from('user_cards').delete().eq('id', novoId)
        setOwnedCardIds(prev => { const n = new Set(prev); n.delete(card.id); return n })
      } : undefined,
    })
  }

  // "Ja tenho" direto da grade: a variante com preco (normal primeiro) e o
  // idioma que o catalogo da para a carta, sem abrir o modal. Sem o idioma,
  // o banco gravava 'pt' ate em carta japonesa (teste logado de 21/09).
  function jaTenhoRapido(card: any) {
    handleAddCard({ ...card, _variante: pickBestVariante(card), _idioma: card.idioma || undefined })
  }

  // Sino: mesmo fluxo das Metas (watchlist com preco maximo opcional).
  async function definirAviso(card: any) {
    if (!userId) { showAlert('Faça login para receber avisos de preço.', 'warning'); return }
    const atual = avisos.get(card.id)
    const v = await showPrompt({
      message: `Até quanto você pagaria por ${card.name}?`,
      placeholder: 'Ex.: 50',
      defaultValue: atual != null ? String(atual).replace('.', ',') : '',
      hint: 'Em reais. Você recebe aviso quando aparecer à venda até esse valor. Deixe em branco para receber de qualquer preço.',
      inputMode: 'decimal',
      permitirVazio: true,
    })
    if (v === null) return
    const limpo = v.trim().replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const teto = limpo ? Number(limpo) : null
    if (teto !== null && (!Number.isFinite(teto) || teto <= 0)) { showAlert('Digite um valor em reais, como 50 ou 49,90.', 'warning'); return }
    const { error } = await supabase.from('watchlist').upsert(
      { user_id: userId, card_id: card.id, target_price: teto, target_type: teto === null ? null : 'max' },
      { onConflict: 'user_id,card_id' },
    )
    if (error) { showAlert('Não conseguimos salvar o aviso. Tente de novo.', 'error'); return }
    setAvisos(prev => new Map(prev).set(card.id, teto))
    mostrarToast({
      texto: teto === null ? `Pronto. Você recebe aviso quando ${card.name} aparecer à venda, em qualquer preço.` : `Pronto. Você recebe aviso de ${card.name} por até ${fmt(teto)}.`,
      desfazer: atual === undefined ? async () => {
        setToast(null)
        await supabase.from('watchlist').delete().eq('user_id', userId).eq('card_id', card.id)
        setAvisos(prev => { const n = new Map(prev); n.delete(card.id); return n })
      } : undefined,
    })
  }

  async function transformarEmMeta() {
    if (!selectedPokemon || criandoMeta) return
    setCriandoMeta(true)
    try {
      const id = await criarMeta('pokemon', selectedPokemon.name, null)
      track({ name: 'meta_criada', properties: { tipo: 'pokemon', alvo: selectedPokemon.name, idioma: null, plano: planoAtual, origem: 'pokedex' } })
      router.push(`/metas/${id}`)
    } catch {
      setCriandoMeta(false)
      showAlert('Não conseguimos montar a meta agora. Tente de novo.', 'error')
    }
  }

  // ── Filtros ──────────────────────────────────────────────────────────────────

  const filteredPokemons = pokemons.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !typeFilter || (p.types || []).includes(typeFilter)
    const matchGen    = !genFilter || p.generation === genFilter
    return matchSearch && matchType && matchGen
  })

  // ── Stat de capturados (reativa aos filtros) ───────────────────────────────
  // Usa a mesma lógica do badge "tenho" do grid: ownedNames.has(p.name).
  // useMemo evita recalcular a cada render quando filtros não mudaram.

  const capturados = useMemo(
    () => filteredPokemons.filter(p => ownedNames.has(p.name)).length,
    [filteredPokemons, ownedNames]
  )
  const totalNoFiltro    = filteredPokemons.length
  const temFiltroAtivo   = !!(search || typeFilter || genFilter)
  const completou        = totalNoFiltro > 0 && capturados === totalNoFiltro
  const stagiou          = userId !== null  // só mostra a stat se logou

  // Filtro mudou → volta pro primeiro lote (senão "Squirtle" com 3 resultados
  // ficava escondido atrás de um visibleCount de 960 do scroll anterior).
  useEffect(() => { setVisibleCount(120) }, [search, typeFilter, genFilter])

  const pokemonsVisiveis = filteredPokemons.slice(0, visibleCount)
  const temMaisPokemons  = visibleCount < filteredPokemons.length

  // Sentinel no fim da grade -- ao entrar no viewport, revela mais um lote.
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(v => v + 120)
    }, { rootMargin: '600px' })
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  // Cartas do Pokémon selecionado, filtradas pela busca da vista 2.
  const contTenho = useMemo(() => cards.filter(c => ownedCardIds.has(c.id)).length, [cards, ownedCardIds])
  const idiomasDasCartas = useMemo(() => [...new Set(cards.map(c => c.idioma).filter(Boolean) as string[])].sort(), [cards])
  // A lista que a grade mostra E a que o modal percorre -- o "1 de 132" vinha
  // de o modal andar na lista inteira enquanto a grade estava filtrada (e de o
  // "Ver detalhes" abrir sem gravar o indice).
  const cardsVisiveis = useMemo(() => {
    const alvo = cardSearch.trim().toLowerCase()
    const lista = cards.filter(c => {
      if (abaCartas === 'tenho' && !ownedCardIds.has(c.id)) return false
      if (abaCartas === 'faltam' && ownedCardIds.has(c.id)) return false
      if (idiomaCartas && c.idioma !== idiomaCartas) return false
      if (!alvo) return true
      return (c.set_name || '').toLowerCase().includes(alvo) || (c.set_name_pt || '').toLowerCase().includes(alvo) || String(c.number || '').includes(alvo)
    })
    if (ordemCartas === 'caras') lista.sort((a, b) => valorDaCarta(b) - valorDaCarta(a))
    else if (ordemCartas === 'baratas') lista.sort((a, b) => (valorDaCarta(a) || Infinity) - (valorDaCarta(b) || Infinity))
    else if (ordemCartas === 'numero') lista.sort((a, b) => String(a.set_name || '').localeCompare(String(b.set_name || '')) || (parseInt(a.number) || 0) - (parseInt(b.number) || 0))
    return lista
  }, [cards, cardSearch, abaCartas, idiomaCartas, ordemCartas, ownedCardIds])

  // Teclado: setas esquerda/direita navegam entre cartas no modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!selectedCard) return
      const idx = selectedCardIndex
      if (e.key === 'ArrowRight' && idx < cardsVisiveis.length - 1) {
        const next = cardsVisiveis[idx + 1]
        setSelectedCard(next); setSelectedCardIndex(idx + 1); setSelectedVariante(pickBestVariante(next))
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        const prev = cardsVisiveis[idx - 1]
        setSelectedCard(prev); setSelectedCardIndex(idx - 1); setSelectedVariante(pickBestVariante(prev))
      }
      if (e.key === 'Escape') setSelectedCard(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedCard, selectedCardIndex, cardsVisiveis])


  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={{ padding: '24px 0' }}>

        {/* ── Vista 2: Cartas do Pokémon ─────────────────────────────── */}
        {view === 'cards' && selectedPokemon && (
          <div>
            {/* Voltar + anterior/proximo */}
            {(() => {
              const currentIdx = filteredPokemons.findIndex(p => p.name === selectedPokemon.name)
              const prevP = currentIdx > 0 ? filteredPokemons[currentIdx - 1] : null
              const nextP = currentIdx < filteredPokemons.length - 1 ? filteredPokemons[currentIdx + 1] : null
              const navBtn = (ativo: boolean): React.CSSProperties => ({ background: ativo ? 'var(--bx-surface-2)' : 'var(--bx-surface)', border: '1px solid var(--bx-border-2)', color: ativo ? 'var(--bx-text)' : 'var(--bx-text-faint)', padding: '0 12px', minHeight: 44, borderRadius: 10, cursor: ativo ? 'pointer' : 'default', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', boxSizing: 'border-box', minWidth: 0, maxWidth: 150 })
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, justifyContent: 'space-between' }}>
                  <button onClick={() => { setView('grid'); setSelectedPokemon(null); setCardSearch('') }} style={{ ...navBtn(true), maxWidth: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Pokédex
                  </button>
                  <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                    <button onClick={() => prevP && handleSelectPokemon(prevP)} disabled={!prevP} aria-label={prevP ? `Anterior: ${prevP.name}` : 'Sem anterior'} style={navBtn(!!prevP)}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="pkdx-nav-nome">{prevP ? prevP.name : ''}</span>
                    </button>
                    <button onClick={() => nextP && handleSelectPokemon(nextP)} disabled={!nextP} aria-label={nextP ? `Próximo: ${nextP.name}` : 'Sem próximo'} style={navBtn(!!nextP)}>
                      <span className="pkdx-nav-nome">{nextP ? nextP.name : ''}</span>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              )
            })()}

            <FichaPokemon
              pokemon={selectedPokemon}
              pokemons={pokemons}
              cartas={cards}
              ownedCardIds={ownedCardIds}
              logado={!!userId}
              onAbrirPokemon={handleSelectPokemon}
              onCriarMeta={transformarEmMeta}
              criandoMeta={criandoMeta}
            />

            {/* Barra: Todas/Tenho/Faltam, idioma, busca, ordem */}
            {!loadingCards && cards.length > 0 && (
              <div className="pkdx-barra">
                {userId && (
                  <div className="pkdx-seg" role="group" aria-label="Filtrar por posse">
                    {([['todas', 'Todas', cards.length], ['tenho', 'Tenho', contTenho], ['faltam', 'Faltam', cards.length - contTenho]] as const).map(([k, r, n]) => (
                      <button key={k} type="button" onClick={() => setAbaCartas(k)} aria-pressed={abaCartas === k} className={abaCartas === k ? 'pkdx-seg-on' : undefined}>
                        {r} <span>{n}</span>
                      </button>
                    ))}
                  </div>
                )}
                {idiomasDasCartas.length > 1 && (
                  <div className="pkdx-chips" role="group" aria-label="Idioma">
                    <button type="button" onClick={() => setIdiomaCartas('')} aria-pressed={!idiomaCartas} className={!idiomaCartas ? 'pkdx-chip-on' : undefined}>Todos</button>
                    {idiomasDasCartas.map(i => (
                      <button key={i} type="button" onClick={() => setIdiomaCartas(i)} aria-pressed={idiomaCartas === i} className={idiomaCartas === i ? 'pkdx-chip-on' : undefined}>{i.toUpperCase()}</button>
                    ))}
                  </div>
                )}
                <div className="pkdx-barra-linha">
                  {cards.length > 8 && (
                    <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--bx-text-3)' }}>
                        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M15 15l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <input
                        value={cardSearch} onChange={e => setCardSearch(e.target.value)}
                        placeholder="Buscar por coleção ou número"
                        aria-label="Buscar por coleção ou número"
                        style={{ width: '100%', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '11px 12px 11px 34px', minHeight: 44, color: 'var(--bx-text)', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                  )}
                  <select value={ordemCartas} onChange={e => setOrdemCartas(e.target.value as typeof ordemCartas)} aria-label="Ordenar"
                    style={{ flex: '0 0 auto', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '0 12px', minHeight: 44, color: 'var(--bx-text)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <option value="recentes">Mais recentes</option>
                    <option value="caras">Mais valiosas</option>
                    <option value="baratas">Mais baratas</option>
                    <option value="numero">Por coleção e número</option>
                  </select>
                </div>
              </div>
            )}

            {/* Grid de cartas */}
            {loadingCards ? (
              <div className="pkdx-skeleton-grid pkdx-skeleton-cards">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="pkdx-skeleton-card" />)}
              </div>
            ) : cards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--bx-text-faint)' }}>
                <IconCard size={34} color="var(--bx-text-faint)" style={{ marginBottom: 10 }} />
                <p>Nenhuma carta encontrada para {selectedPokemon.name}</p>
              </div>
            ) : cardsVisiveis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--bx-text-3)' }}>
                <p style={{ margin: 0 }}>
                  {cardSearch ? `Nenhuma carta bate com "${cardSearch}".` : abaCartas === 'tenho' ? `Você ainda não tem cartas de ${selectedPokemon.name}. Toque em "Já tenho" nas que estão com você.` : abaCartas === 'faltam' ? `Você tem todas as cartas de ${selectedPokemon.name}.` : 'Nenhuma carta neste filtro.'}
                </p>
              </div>
            ) : (
              <div className="pkdx-cards-grid">
                {cardsVisiveis.map((card, idx) => {
                  const owned = ownedCardIds.has(card.id)
                  const ocupada = ocupadas.has(card.id)
                  const teto = avisos.get(card.id)
                  const temAviso = avisos.has(card.id)
                  return (
                    <div key={card.id} className={userId && !owned ? 'pkdx-falta' : undefined} style={{ position: 'relative', minWidth: 0 }}>
                      <CardItem
                        card={card}
                        mode="select"
                        exchangeRate={exchangeRate}
                        hidePriceTable={isMobile}
                        ocultarIdioma={!!userId && !owned}
                        onSelect={() => abrirCarta(card, idx)}
                        footerSlot={userId ? (
                          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                            {owned ? (
                              <button type="button" onClick={() => jaTenhoRapido(card)} disabled={ocupada} aria-label={`Adicionar mais uma cópia de ${card.name}`}
                                className="pkdx-btn pkdx-btn-tenho">
                                {ocupada ? '…' : <><IconCheck size={13} color="var(--bx-green)" />Na coleção</>}
                              </button>
                            ) : (
                              <button type="button" onClick={() => jaTenhoRapido(card)} disabled={ocupada} aria-label={`Já tenho ${card.name}`}
                                className="pkdx-btn pkdx-btn-add">
                                {ocupada ? '…' : <><IconPlus size={13} color="var(--ac-1)" />Já tenho</>}
                              </button>
                            )}
                            <button type="button" onClick={() => definirAviso(card)}
                              aria-label={temAviso ? (teto != null ? `Aviso até ${fmt(teto)}. Toque para mudar.` : 'Aviso ligado em qualquer preço. Toque para mudar.') : `Avisar quando ${card.name} aparecer à venda`}
                              title={temAviso ? (teto != null ? `Aviso até ${fmt(teto)}` : 'Aviso ligado') : 'Avisar preço'}
                              className={`pkdx-sino${temAviso ? ' pkdx-sino-on' : ''}`}>
                              <IconBell size={16} color={temAviso ? 'var(--ac-1)' : 'var(--bx-text-2)'} />
                            </button>
                          </div>
                        ) : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Vista 1: Grid de Pokémon ───────────────────────────────── */}
        {view === 'grid' && (
          <div>
            {/* Header — padrao do app, ver src/components/ui/PageHeader.tsx.
                O stat hero (capturados) vai no slot `acao`, a direita do titulo. */}
            <PageHeader
              trilha={[INICIO, { name: 'Pokédex', href: '/pokedex' }]}
              titulo="Pokédex"
              descricao="Os 1.025 Pokémon e todas as cartas de cada um."
              stat={loading ? 'Carregando...' : `${fmtNum(filteredPokemons.length)} Pokémon com cartas TCG`}
              acao={stagiou && !loading && pokemons.length > 0 && (
                <div style={{
                  textAlign: 'right',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{
                      fontSize: 28, fontWeight: 800,
                      letterSpacing: '-0.02em', lineHeight: 1,
                      color: completou ? 'var(--bx-green)' : 'var(--ac-1)',
                    }}>
                      {fmtNum(capturados)}
                    </span>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: 'var(--bx-text-3)',
                    }}>
                      / {fmtNum(totalNoFiltro)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 10, fontWeight: 700,
                    color: completou ? 'var(--bx-green)' : 'var(--bx-text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    margin: 0,
                  }}>
                    {completou
                      ? (temFiltroAtivo ? '✦ Completo!' : '✦ Pokédex completa!')
                      : capturados === 1
                        ? 'Capturado'
                        : 'Capturados'}
                    {temFiltroAtivo && !completou && (
                      <span style={{ color: 'var(--bx-text-faint)', fontWeight: 500, marginLeft: 6 }}>
                        no filtro
                      </span>
                    )}
                  </p>
                </div>
              )}
            />

            {/* Filtros */}
            <div className="pkdx-filtros">
              {/* Busca */}
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--bx-text-3)' }}>
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M15 15l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar Pokémon..."
                  style={{ width: '100%', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '11px 12px 11px 34px', minHeight: 44, color: 'var(--bx-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {/* Geração */}
              <select value={genFilter} onChange={e => setGenFilter(e.target.value)}
                style={{ background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '11px 12px', minHeight: 44, color: genFilter ? 'var(--bx-text)' : 'var(--bx-text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                <option value="">Geração</option>
                {['I','II','III','IV','V','VI','VII','VIII','IX'].map(g => <option key={g} value={g}>Gen {g}</option>)}
              </select>

              {/* Tipo */}
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={{ background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '11px 12px', minHeight: 44, color: typeFilter ? 'var(--bx-text)' : 'var(--bx-text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                <option value="">Tipo</option>
                {['Fire','Water','Grass','Lightning','Psychic','Fighting','Darkness','Metal','Dragon','Colorless','Fairy'].map(t => (
                  <option key={t} value={t}>{tipoTcgPt(t)}</option>
                ))}
              </select>

              {/* Limpa filtros */}
              {(search || typeFilter || genFilter) && (
                <button onClick={() => { setSearch(''); setTypeFilter(''); setGenFilter('') }}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--bx-red)', padding: '11px 14px', minHeight: 44, borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                  Limpar
                </button>
              )}
            </div>

            {/* Grid de Pokémon */}
            {loading ? (
              <div className="pkdx-skeleton-grid">
                {Array.from({ length: 24 }).map((_, i) => <div key={i} className="pkdx-skeleton-mon" />)}
              </div>
            ) : (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {pokemonsVisiveis.map(pokemon => {
                  const owned = ownedNames.has(pokemon.name)
                  const typeColor = TYPE_COLOR[pokemon.types?.[0]] || { bg: 'var(--bx-surface)', text: 'var(--bx-text-3)' }
                  return (
                    <button
                      key={pokemon.name}
                      onClick={() => handleSelectPokemon(pokemon)}
                      style={{
                        background: owned ? 'rgba(var(--ac-1-rgb), 0.06)' : 'var(--bx-surface)',
                        border: owned ? '1px solid rgba(var(--ac-1-rgb), 0.25)' : '1px solid var(--bx-border)',
                        borderRadius: 14, padding: '12px 8px 10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        transition: 'all 0.15s', fontFamily: 'inherit', position: 'relative',
                      }}
                    >
                      {/* Badge "tenho" */}
                      {owned && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: 'var(--ac-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="9" height="9" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="var(--bx-brand-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}

                      {/* Sprite */}
                      <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pokemon.sprite ? (
                          <img
                            src={pokemon.sprite}
                            alt={pokemon.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              const img = e.target as HTMLImageElement
                              const src = img.src
                              if (src.includes('pokemondb') && pokemon.dexId > 0) {
                                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.dexId}.png`
                              } else if (src.includes('official-artwork') && pokemon.dexId > 0) {
                                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${pokemon.dexId}.png`
                              } else if (src.includes('/home/') && pokemon.dexId > 0) {
                                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.dexId}.png`
                              } else {
                                img.style.display = 'none'
                              }
                            }}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bx-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bx-text-3)' }}><IconCard size={20} /></div>
                        )}
                      </div>

                      {/* Número */}
                      {pokemon.dexId > 0 && (
                        <p style={{ fontSize: 9, color: 'var(--bx-text-3)', fontWeight: 600, letterSpacing: '0.05em' }}>
                          #{String(pokemon.dexId).padStart(4, '0')}
                        </p>
                      )}

                      {/* Nome */}
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text)', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>
                        {pokemon.name}
                      </p>

                      {/* Tipo */}
                      {pokemon.types?.[0] && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: typeColor.bg, color: typeColor.text }}>
                          {tipoTcgPt(pokemon.types[0])}
                        </span>
                      )}

                      {/* Gen badge + contagem */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {pokemon.generation && pokemon.generation !== '?' && (
                          <span style={{ fontSize: 8, color: 'var(--bx-text-faint)', fontWeight: 600 }}>
                            Gen {pokemon.generation}
                          </span>
                        )}
                        {pokemon.card_count > 0 && (
                          <span style={{ fontSize: 8, color: 'var(--bx-text-faint)' }}>
                            · {pokemon.card_count}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Sentinel de paginação — 1.025 Pokémon de uma vez sobrecarregava
                  o DOM (achado #1). Revela mais um lote de 120 ao chegar perto
                  do fim, em vez de tudo de uma vez. */}
              {temMaisPokemons && (
                <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                  <div style={{ width: 24, height: 24, border: '3px solid var(--bx-border-2)', borderTop: '3px solid var(--ac-1)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: var(--bx-bg-elev); color: var(--bx-text); }

        /* Filtros (busca/geracao/tipo/limpar) -- em 375px o flex-wrap padrao
           quebrava de forma assimetrica (Busca+Geracao numa linha, Tipo
           sozinho na outra, achado #9). Empilha tudo em coluna abaixo de
           480px pra ficar previsivel. */
        .pkdx-filtros { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        @media (max-width: 480px) {
          .pkdx-filtros { flex-direction: column; }
          .pkdx-filtros > * { width: 100%; box-sizing: border-box; }
        }

        /* Skeleton de carregamento -- antes era so um spinner generico numa
           tela que carrega 1.025 itens + sprites externos (achado #10).
           prefers-reduced-motion mata o pulso, fica so o placeholder estatico. */
        @keyframes pkdx-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
        .pkdx-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
        .pkdx-skeleton-mon {
          height: 148px; border-radius: 14px;
          background: var(--bx-surface); border: 1px solid var(--bx-border);
          animation: pkdx-pulse 1.6s ease-in-out infinite;
        }
        .pkdx-skeleton-cards.pkdx-skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .pkdx-skeleton-card {
          height: 260px; border-radius: 16px;
          background: var(--bx-surface); border: 1px solid var(--bx-border);
          animation: pkdx-pulse 1.6s ease-in-out infinite;
        }
        @media (min-width: 769px) {
          .pkdx-skeleton-cards.pkdx-skeleton-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pkdx-skeleton-mon, .pkdx-skeleton-card { animation: none; opacity: 0.7; }
        }

        /* Grade de cartas do Pokemon aberto.
           No desktop segue o auto-fill de 200px. No mobile o auto-fill nao
           conseguia encaixar duas colunas (2x200 + gap = 416px num conteudo de
           358px em tela de 390) e caia pra 1 coluna, deixando a carta ocupando
           a largura inteira. Aqui fixa em 2 colunas — o detalhe abre no clique,
           entao a miniatura nao precisa ser grande.
           minmax(0,1fr) e proposital: sem ele o conteudo impoe largura minima
           e a grade vaza pra fora da tela. */
        .pkdx-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        @media (max-width: 768px) {
          .pkdx-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
        }

        /* Vista 2: barra de filtros e acoes rapidas na grade (21/09/2026). */
        .pkdx-nav-nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 480px) { .pkdx-nav-nome { display: none; } }
        .pkdx-barra { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .pkdx-barra-linha { display: flex; gap: 8px; flex-wrap: wrap; }
        .pkdx-seg { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bx-surface); border: 1px solid var(--bx-border); width: fit-content; max-width: 100%; }
        .pkdx-seg button { font: inherit; font-size: 13.5px; font-weight: 700; min-height: 40px; padding: 0 14px; border: none; border-radius: 9px; background: none; color: var(--bx-text-2); cursor: pointer; transition: background .15s ease, color .15s ease; }
        .pkdx-seg button span { font-weight: 600; color: var(--bx-text-3); margin-left: 2px; }
        .pkdx-seg .pkdx-seg-on { background: var(--bx-surface-3); color: var(--bx-text); }
        .pkdx-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
        .pkdx-chips::-webkit-scrollbar { display: none; }
        .pkdx-chips button { flex: 0 0 auto; font: inherit; font-size: 12.5px; font-weight: 700; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--bx-border); background: transparent; color: var(--bx-text-2); cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .pkdx-chips .pkdx-chip-on { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.12); color: var(--ac-1); }
        .pkdx-btn { flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px; font: inherit; font-size: 13px; font-weight: 700; min-height: 44px; padding: 0 6px; border-radius: 10px; cursor: pointer; white-space: nowrap; transition: background .15s ease, border-color .15s ease; }
        .pkdx-btn:disabled { opacity: .6; cursor: default; }
        .pkdx-btn-add { border: 1px solid rgba(var(--ac-1-rgb), 0.35); background: rgba(var(--ac-1-rgb), 0.1); color: var(--ac-1); }
        .pkdx-btn-add:hover:not(:disabled) { background: rgba(var(--ac-1-rgb), 0.18); }
        .pkdx-btn-tenho { border: 1px solid var(--bx-border); background: var(--bx-surface); color: var(--bx-green); }
        .pkdx-sino { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; border: 1px solid var(--bx-border); background: var(--bx-surface); transition: background .15s ease, border-color .15s ease; }
        .pkdx-sino-on { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.12); }
        .pkdx-falta img { filter: grayscale(1); opacity: 0.5; transition: filter 0.2s ease, opacity 0.2s ease; }
        @media (hover: hover) { .pkdx-falta:hover img { filter: grayscale(0.3); opacity: 0.85; } }
        .pkdx-toast { position: fixed; left: 50%; transform: translateX(-50%); z-index: 10000; width: min(520px, calc(100vw - 32px)); display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 16px; border-radius: 14px; background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); box-shadow: var(--bx-shadow); font-size: 13.5px; line-height: 1.45; color: var(--bx-text); bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 769px) { .pkdx-toast { bottom: 24px; } }
        .pkdx-toast-btn { font: inherit; font-size: 13px; font-weight: 800; min-height: 44px; padding: 0 12px; border: none; border-radius: 10px; background: var(--bx-surface-3); color: var(--bx-text); cursor: pointer; }
      `}</style>

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          cardIndex={selectedCardIndex}
          cards={cardsVisiveis}
          selectedVariante={selectedVariante}
          setSelectedVariante={setSelectedVariante}
          onClose={() => setSelectedCard(null)}
          onNavigate={(card, idx) => { setSelectedCard(card); setSelectedCardIndex(idx); setSelectedVariante(pickBestVariante(card)) }}
          onAdd={(card) => { handleAddCard(card) }}
          adicionando={ocupadas.has(selectedCard.id)}
          tenho={ownedCardIds.has(selectedCard.id)}
          avisoAtivo={avisos.has(selectedCard.id)}
          onSino={userId ? definirAviso : undefined}
          exchangeRate={exchangeRate}
          isMobile={isMobile}
        />
      )}

      {toast && (
        <div role="status" className="pkdx-toast">
          <IconCheck size={16} color="var(--bx-green)" />
          <span style={{ flex: 1 }}>{toast.texto}</span>
          {toast.desfazer && <button onClick={toast.desfazer} className="pkdx-toast-btn">Desfazer</button>}
        </div>
      )}

      {upgradePokemon && (
        <ModalUpgradePokedex
          pokemonName={upgradePokemon}
          onClose={() => setUpgradePokemon(null)}
          onUpgrade={() => { window.location.href = '/minha-conta' }}
        />
      )}
      {showLimite && (
        <ModalLimiteCartas
          limite={limiteCartas}
          onClose={() => setShowLimite(false)}
          onUpgrade={() => { window.location.href = '/minha-conta' }}
        />
      )}

    </AppLayout>
  )
}
