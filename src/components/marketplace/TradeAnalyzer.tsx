'use client'

/**
 * TradeAnalyzer — "Essa troca tá equilibrada?"
 *
 * Reaproveitável: usado standalone em /comparador e embutido no ChatDock
 * (pré-carregado com a carta do anúncio em negociação). Calculadora pura —
 * não salva nada, não abre negociação. Preço vem do Mercado Brasileiro que
 * a Bynx já calcula por carta, pela fonte única (src/lib/calcPatrimonio.ts):
 * variante escolhida -> queda pro normal -> USD convertido.
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { registrarSinal } from '@/lib/sinais'
import { CAMPO_VALOR, getPrecoVariante, getVarianteEfetiva } from '@/lib/calcPatrimonio'

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface TradeCard {
  /** Identidade da INSTANCIA na troca, nao da carta. Duas copias da mesma
   *  carta sao duas linhas independentes -- antes as duas dividiam `id` e
   *  remover uma removia as duas. */
  uid: string
  id: string
  name: string
  set_name?: string | null
  image_small?: string | null
  preco: number
  fonte: 'BRL' | 'USD'
  /** Variante que gerou este preco. */
  variante: string
  /** Variantes com preco nesta carta -- alimenta o seletor por linha. */
  variantes: VariantePreco[]
  /** true = a fonte nao tem preco nenhum pra esta carta, em nenhuma variante. */
  semPreco: boolean
}

export interface VariantePreco { variante: string; preco: number }

/** Rotulo humano da variante. Nao inventar nome novo: estes sao os que a casa usa. */
const ROTULO_VARIANTE: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', reverse: 'Reverse', promo: 'Promo', pokeball: 'Pokeball',
}
const rotulo = (v: string) => ROTULO_VARIANTE[v] || v

let seqUid = 0
const novoUid = () => `t${Date.now().toString(36)}${(seqUid++).toString(36)}`

/**
 * Construtor unico de TradeCard pra quem ja tem o preco pronto e NAO tem a
 * linha completa da carta -- hero, feed e ChatDock caem aqui.
 *
 * ★ `variantes: []` de proposito: sem a linha do catalogo nao da pra saber
 * quais versoes existem, e chutar um leque de variantes seria inventar. Sem
 * leque, a linha simplesmente nao mostra seletor. Melhor nao oferecer a
 * escolha do que oferecer uma escolha errada.
 */
export function montarTradeCard(base: {
  id: string; name: string; set_name?: string | null; image_small?: string | null
  preco: number; fonte?: 'BRL' | 'USD'; variante?: string; variantes?: VariantePreco[]
}): TradeCard {
  return {
    uid: novoUid(),
    id: base.id,
    name: base.name,
    set_name: base.set_name ?? null,
    image_small: base.image_small ?? null,
    preco: base.preco,
    fonte: base.fonte ?? 'BRL',
    variante: base.variante ?? 'normal',
    variantes: base.variantes ?? [],
    semPreco: !(Number(base.preco) > 0),
  }
}

interface Props {
  /** Pré-carrega o lado "você oferece" com 1 carta — usado pelo ChatDock e pelos destaques do /comparador. */
  initialCardA?: TradeCard | null
  /** Pré-carrega o lado "você recebe" com 1 carta — usado pelas sugestões pareadas do /comparador. */
  initialCardB?: TradeCard | null
  /** Pré-carrega "você oferece" com várias cartas — usado pelo replay do feed (Fase 2). Tem prioridade sobre initialCardA. */
  initialLadoA?: TradeCard[]
  /** Pré-carrega "você recebe" com várias cartas — usado pelo replay do feed (Fase 2). Tem prioridade sobre initialCardB. */
  initialLadoB?: TradeCard[]
  /** Presente = renderiza como modal overlay (ChatDock). Ausente = inline (página /comparador). */
  onClose?: () => void
}

// ─── Estilos (mesmo padrão do AnunciarModal/ChatDock) ───────────────────────

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const FONT = "'DM Sans', system-ui, sans-serif"

// minWidth:0 evita o bug classico de grid/flex: sem isso, o item nao encolhe
// abaixo do min-content e o preco (nowrap) empurra a coluna pra fora da tela
// no mobile (fundo com overflow-x:hidden escondia sem avisar).
const col: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260, minWidth: 0,
}
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontSize: 12.5, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.1)',
  border: '1px dashed rgba(245,158,11,0.4)', borderRadius: 10, padding: '11px 12px', cursor: 'pointer',
}
const cardRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto auto', alignItems: 'center', gap: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '8px 10px',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function cleanNome(raw: string) {
  return (raw || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

/**
 * Preco de um lado da troca, pela fonte unica (src/lib/calcPatrimonio.ts).
 *
 * Antes esta funcao reimplementava a cascata e divergia em dois pontos que
 * mudavam o resultado da troca:
 *   - encadeava min || foil_min || reverse_min || promo_min IGNORANDO a
 *     variante da carta, entao uma normal sem preco herdava o valor da foil;
 *   - ignorava `valor_graduada`, entao carta graduada entrava pelo preco da crua.
 * Agora usa getVarianteEfetiva/getPrecoVariante/CAMPO_VALOR como o resto do app.
 */
/**
 * ★ 31/08: o degrau de `valor_graduada` que existia aqui era CODIGO MORTO e
 * foi removido. A unica fonte de carta desta tela e `smart_search_cards_v5`,
 * que devolve `pokemon_cards_all` -- e essa view nao tem `graduada` nem
 * `valor_graduada` (conferido no information_schema: zero colunas). Os campos
 * so existem em `user_cards`. O `if` nunca era verdadeiro, e o comentario
 * acima dele afirmava que graduada estava tratada. Comentario que promete o
 * que o codigo nao faz e pior que ausencia de comentario.
 *
 * Carta graduada segue avaliada pelo preco da crua, e agora isso esta DITO na
 * tela em vez de escondido num degrau inalcancavel.
 */
const VARIANTES_CONHECIDAS = ['normal', 'foil', 'reverse', 'promo', 'pokeball']

/** Todas as variantes que TEM preco proprio nesta carta, na ordem canonica. */
function variantesComPreco(card: any): VariantePreco[] {
  const out: VariantePreco[] = []
  for (const v of VARIANTES_CONHECIDAS) {
    // fallbackNormal:false -- aqui a pergunta e "ESTA variante tem preco?",
    // e a queda pro normal responderia sim pra todas.
    const preco = getPrecoVariante(card, v, { fallbackNormal: false })[CAMPO_VALOR] || 0
    if (preco > 0) out.push({ variante: v, preco })
  }
  return out
}

async function precificar(card: any, usdRate: number): Promise<{
  preco: number; fonte: 'BRL' | 'USD'; variante: string; variantes: VariantePreco[]; semPreco: boolean
}> {
  const variantes = variantesComPreco(card)
  const variante = getVarianteEfetiva(card, card?.variante)
  const brl = getPrecoVariante(card, variante)[CAMPO_VALOR] || 0
  if (brl > 0) return { preco: brl, fonte: 'BRL', variante, variantes, semPreco: false }

  const usd = Number(card.price_usd_holofoil) || Number(card.price_usd_normal) || 0
  if (usd > 0) return { preco: usd * usdRate, fonte: 'USD', variante: 'normal', variantes, semPreco: false }

  // ★ Sem preco em lugar nenhum. Marcado, NAO zerado em silencio: somar zero
  // era o que produzia "Troca equilibrada, diferenca de 0%" sobre duas cartas
  // cujo valor a pagina desconhece. 17,9% do catalogo cai aqui.
  return { preco: 0, fonte: 'BRL', variante: 'normal', variantes, semPreco: true }
}

// ─── Busca de carta (mesma RPC do AddCardModal, smart_search_cards_v5) ──────

const PAGE_SIZE = 12

function BuscaCarta({ onPick, onCancel }: { onPick: (c: TradeCard) => void; onCancel: () => void }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [usdRate, setUsdRate] = useState(5.19)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/exchange-rate').then(r => r.json()).then(d => { if (d?.usd) setUsdRate(d.usd) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (termo.trim().length < 2) { setResultados([]); setHasMore(false); return }
    setBuscando(true)
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc('smart_search_cards_v5', { q: termo, limit_n: PAGE_SIZE, offset_n: 0 })
      const rows = error ? [] : (data || [])
      setResultados(rows)
      setOffset(rows.length)
      setHasMore(rows.length === PAGE_SIZE)
      setBuscando(false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [termo])

  async function carregarMais() {
    if (carregandoMais || !hasMore) return
    setCarregandoMais(true)
    const { data, error } = await supabase.rpc('smart_search_cards_v5', { q: termo, limit_n: PAGE_SIZE, offset_n: offset })
    const rows: any[] = error ? [] : (data || [])
    setResultados(prev => {
      const vistos = new Set(prev.map((c: any) => c.id))
      return [...prev, ...rows.filter((c: any) => !vistos.has(c.id))]
    })
    setOffset(prev => prev + rows.length)
    setHasMore(rows.length === PAGE_SIZE)
    setCarregandoMais(false)
  }

  async function escolher(card: any) {
    const { preco, fonte, variante, variantes, semPreco } = await precificar(card, usdRate)
    onPick({
      uid: novoUid(), id: card.id, name: cleanNome(card.name_pt || card.name),
      set_name: card.set_name_pt || card.set_name, image_small: card.image_small,
      preco, fonte, variante, variantes, semPreco,
    })
    // Sinal "carta procurada" -- aqui e nao no useEffect da busca: instrumentar
    // a digitacao poria escrita por tecla. `escolher` e escolha deliberada e
    // captura intencao de TROCA, que e o proprio contexto do /comparador.
    // queueMicrotask pra nunca competir com o que o usuario esta esperando.
    queueMicrotask(() => registrarSinal('busca_troca', card.id, 0))
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: resultados.length ? 8 : 0 }}>
        <input
          autoFocus value={termo} onChange={e => setTermo(e.target.value)}
          placeholder="Nome da carta..." maxLength={60}
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '9px 12px', color: '#f0f0f0', fontSize: 13, fontFamily: FONT, outline: 'none' }}
        />
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', padding: '0 4px' }}>Cancelar</button>
      </div>
      {buscando && <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', margin: '4px 2px' }}>Buscando…</p>}
      {resultados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}
          onScroll={e => {
            const el = e.currentTarget
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) carregarMais()
          }}>
          {resultados.map(r => (
            <div key={r.id} onClick={() => escolher(r)}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 28, height: 39, borderRadius: 4, overflow: 'hidden', background: '#1a1d24', flexShrink: 0 }}>
                {r.image_small && <img src={r.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNome(r.name_pt || r.name)}</p>
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.set_name_pt || r.set_name}</p>
              </div>
              {/* ★ Preco na propria linha. Sem isto a escolha e as cegas: a
                  busca ordena por lancamento, entao as cartas mais novas --
                  justamente as que ainda nao tem preco -- vem primeiro. */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                {(() => {
                  const vs = variantesComPreco(r)
                  if (vs.length === 0) {
                    return <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>sem preço</span>
                  }
                  const menor = vs.reduce((a, b) => (b.preco < a.preco ? b : a))
                  return (
                    <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {fmt(menor.preco)}
                      {vs.length > 1 && <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}> · {vs.length} versões</span>}
                    </span>
                  )
                })()}
                {r.number && (
                  <span style={{ fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                    {r.number}{r.set_total ? `/${r.set_total}` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
          {carregandoMais && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '4px 0 0' }}>Carregando mais…</p>}
          {!carregandoMais && hasMore && (
            <button onClick={carregarMais} style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '6px 0', fontFamily: FONT }}>
              Carregar mais resultados
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Coluna (um lado da troca) ───────────────────────────────────────────────

function Coluna({ label, cartas, onAdd, onRemove, onTrocarVariante, buscaAberta, onAbrirBusca, onFecharBusca }: {
  label: string
  cartas: TradeCard[]
  onAdd: (c: TradeCard) => void
  onRemove: (uid: string) => void
  onTrocarVariante: (uid: string, variante: string) => void
  buscaAberta: boolean
  onAbrirBusca: () => void
  onFecharBusca: () => void
}) {
  const total = cartas.reduce((s, c) => s + c.preco, 0)
  const semPreco = cartas.filter(c => c.semPreco).length
  return (
    <div style={col}>
      <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{label}</span>
      {cartas.map(c => (
        <div key={c.uid} style={cardRow}>
          <div style={{ width: 34, height: 47, borderRadius: 5, overflow: 'hidden', background: 'linear-gradient(160deg,#2a2f3a,#1a1d24)', flexShrink: 0 }}>
            {c.image_small && <img src={c.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.set_name}</p>
            {/* ★ Seletor de versao. A busca vem de pokemon_cards_all, que NAO
                tem coluna de variante -- entao a tela sempre caia na normal e
                precificava uma foil pelo preco da comum. A razao foil/normal
                tem mediana 1,83x e p95 47,6x: era erro de ate dezenas de
                vezes, calado. Quem sabe qual carta tem na mao e o usuario. */}
            {c.variantes.length > 1 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {c.variantes.map(v => {
                  const ativa = v.variante === c.variante
                  return (
                    <button key={v.variante} onClick={() => onTrocarVariante(c.uid, v.variante)}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontFamily: FONT,
                        background: ativa ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${ativa ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: ativa ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}>
                      {rotulo(v.variante)}
                    </button>
                  )
                })}
              </div>
            )}
            {c.semPreco && (
              <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>Sem preço no Mercado Brasileiro</p>
            )}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: c.semPreco ? 'rgba(255,255,255,0.35)' : c.fonte === 'USD' ? '#60a5fa' : '#f0f0f0' }}>
            {c.semPreco ? '—' : fmt(c.preco)}
          </span>
          <button onClick={() => onRemove(c.uid)} aria-label="Remover" style={{ width: 20, height: 20, borderRadius: '50%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      ))}

      {buscaAberta
        ? <BuscaCarta onPick={c => { onAdd(c); onFecharBusca() }} onCancel={onFecharBusca} />
        : (
          <button onClick={onAbrirBusca} style={addBtn}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Adicionar carta
          </button>
        )}

      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Total</span>
          {semPreco > 0 && (
            <p style={{ fontSize: 10.5, color: '#f59e0b', margin: '2px 0 0' }}>
              {semPreco === 1 ? '1 carta sem preço, fora da conta' : `${semPreco} cartas sem preço, fora da conta`}
            </p>
          )}
        </div>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

/** Aplica a variante escolhida numa linha, recalculando o preco dela. */
function trocarVariante(lista: TradeCard[], uid: string, variante: string): TradeCard[] {
  return lista.map(c => {
    if (c.uid !== uid) return c
    const v = c.variantes.find(x => x.variante === variante)
    return v ? { ...c, variante, preco: v.preco, fonte: 'BRL' as const, semPreco: false } : c
  })
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function TradeAnalyzer({ initialCardA, initialCardB, initialLadoA, initialLadoB, onClose }: Props) {
  const [ladoA, setLadoA] = useState<TradeCard[]>(initialLadoA?.length ? initialLadoA : initialCardA ? [initialCardA] : [])
  const [ladoB, setLadoB] = useState<TradeCard[]>(initialLadoB?.length ? initialLadoB : initialCardB ? [initialCardB] : [])
  const [buscaAberta, setBuscaAberta] = useState<'A' | 'B' | null>(null)

  // Fase 2: opt-in de publicar no feed "comparado agora pela comunidade".
  const [temPerfilPublico, setTemPerfilPublico] = useState(false)
  const [mostrarComoUsuario, setMostrarComoUsuario] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [publicado, setPublicado] = useState(false)
  const [tokenAuth, setTokenAuth] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.access_token || !session.user) return
      setTokenAuth(session.access_token)
      const { data: perfil } = await supabase.from('public_users').select('perfil_publico').eq('id', session.user.id).maybeSingle()
      setTemPerfilPublico(!!perfil?.perfil_publico)
    })
  }, [])

  const totalA = ladoA.reduce((s, c) => s + c.preco, 0)
  const totalB = ladoB.reduce((s, c) => s + c.preco, 0)
  const media = (totalA + totalB) / 2
  const diff = totalB - totalA
  const pct = media > 0 ? (diff / media) * 100 : 0
  const temAmbos = ladoA.length > 0 && ladoB.length > 0

  const semPrecoA = ladoA.filter(c => c.semPreco).length
  const semPrecoB = ladoB.filter(c => c.semPreco).length
  const semPrecoTotal = semPrecoA + semPrecoB

  // ★ A ressalva vale nos TRES ramos. Antes ela so aparecia no desequilibrado
  // -- sumia justamente do "Troca equilibrada", que e onde uma variante lida
  // errado faz o maior estrago.
  const RESSALVA = 'Preço pelo Mercado Brasileiro. Condição, graduação e a versão exata da carta física podem mudar o valor real.'

  let verdict: { tom: 'ok' | 'warn' | 'bad'; titulo: string; texto: string } | null = null
  if (temAmbos) {
    // ★ Arredondar ANTES de decidir. Antes o corte era no numero cheio e a
    // exibicao no arredondado, entao 9,6% saia como "Diferenca de 10% --
    // dentro da faixa justa" -- o texto contradizia o proprio limiar.
    const abs = Math.round(Math.abs(pct))

    if (semPrecoTotal > 0) {
      // ★ O caso que produzia a mentira: sem preco somava ZERO calado, e dois
      // lados zerados davam pct=0, que caia em "Troca equilibrada, 0%". A
      // pagina afirmava justica sobre valor que ela nao conhece. Agora nao ha
      // veredito quando falta preco -- falta de dado nao vira nota de aprovacao.
      verdict = {
        tom: 'warn',
        titulo: semPrecoTotal === 1 ? 'Falta o preço de 1 carta' : `Falta o preço de ${semPrecoTotal} cartas`,
        texto: `Sem isso não dá pra dizer se a troca está equilibrada. ${totalA > 0 || totalB > 0 ? 'Os totais acima somam só o que tem preço.' : ''}`.trim(),
      }
    } else if (abs < 10) {
      verdict = { tom: 'ok', titulo: 'Troca equilibrada', texto: `Diferença de ${abs}% entre os dois lados. ${RESSALVA}` }
    } else {
      const tom = abs < 30 ? 'warn' : 'bad'
      verdict = {
        tom,
        titulo: diff > 0
          ? `Você está levando ${fmt(diff)} a mais`
          : `Você está perdendo ${fmt(Math.abs(diff))} nessa troca`,
        // ★ A base do percentual agora esta DITA. `pct` divide pela media dos
        // dois lados, entao 100 por 50 imprime 66% e nao 50% -- numero que
        // parecia inflado sem que a tela explicasse de onde vinha.
        texto: `${abs}% de diferença sobre a média dos dois lados${tom === 'bad' ? ' — vale reconsiderar os termos' : ''}. ${RESSALVA}`,
      }
    }
  }

  const barA = media > 0 ? (totalA / (totalA + totalB || 1)) * 100 : 50
  const verdictBg = verdict?.tom === 'ok' ? 'rgba(34,197,94,0.12)' : verdict?.tom === 'bad' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)'
  const verdictBorder = verdict?.tom === 'ok' ? 'rgba(34,197,94,0.35)' : verdict?.tom === 'bad' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'
  const verdictColor = verdict?.tom === 'ok' ? '#22c55e' : verdict?.tom === 'bad' ? '#ef4444' : '#f59e0b'
  const veredictoDb = verdict?.tom === 'ok' ? 'equilibrada' : verdict?.tom === 'bad' ? 'muito_desequilibrada' : 'desequilibrada'

  async function publicar() {
    if (publicando || publicado || !verdict) return
    setPublicando(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (tokenAuth) headers.Authorization = `Bearer ${tokenAuth}`
      const res = await fetch('/api/marketplace/trade-comparisons', {
        method: 'POST', headers,
        body: JSON.stringify({ ladoA, ladoB, totalA, totalB, pct, veredito: veredictoDb, mostrarUsuario: mostrarComoUsuario }),
      })
      if (res.ok) setPublicado(true)
    } catch { /* silencioso -- publicar e opcional */ }
    setPublicando(false)
  }

  const conteudo = (
    <div style={{ fontFamily: FONT, color: '#f0f0f0' }}>
      {/* <=480px: empilha os 2 lados. Lado a lado, a coluna sobra ~135px --
          menos que o suficiente pra thumb+nome+numero da busca (o motivo
          da busca ter ganho o numero como diferencial, ver commit 79b3360).
          Empilhado, cada lado usa a largura cheia do card e a busca respira. */}
      <style>{`
        .bx-trade-cols { display: grid; grid-template-columns: minmax(0,1fr) 44px minmax(0,1fr); gap: 14px; align-items: start; }
        .bx-trade-swap { padding-top: 60px; }
        @media (max-width: 480px) {
          .bx-trade-cols { grid-template-columns: 1fr; gap: 10px; }
          .bx-trade-swap { padding-top: 0; transform: rotate(90deg); justify-self: center; }
        }
      `}</style>
      <div className="bx-trade-cols">
        <Coluna label="Você oferece" cartas={ladoA}
          onAdd={c => setLadoA(p => [...p, c])} onRemove={uid => setLadoA(p => p.filter(c => c.uid !== uid))}
          onTrocarVariante={(uid, v) => setLadoA(p => trocarVariante(p, uid, v))}
          buscaAberta={buscaAberta === 'A'} onAbrirBusca={() => setBuscaAberta('A')} onFecharBusca={() => setBuscaAberta(null)} />

        <div className="bx-trade-swap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>

        <Coluna label="Você recebe" cartas={ladoB}
          onAdd={c => setLadoB(p => [...p, c])} onRemove={uid => setLadoB(p => p.filter(c => c.uid !== uid))}
          onTrocarVariante={(uid, v) => setLadoB(p => trocarVariante(p, uid, v))}
          buscaAberta={buscaAberta === 'B'} onAbrirBusca={() => setBuscaAberta('B')} onFecharBusca={() => setBuscaAberta(null)} />
      </div>

      {temAmbos && (
        <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', display: 'flex', marginTop: 16, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${barA}%`, background: BRAND }} />
          <div style={{ width: `${100 - barA}%`, background: 'rgba(255,255,255,0.15)' }} />
        </div>
      )}

      {verdict && (
        <div style={{ marginTop: 16, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, background: verdictBg, border: `1px solid ${verdictBorder}` }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: verdictBg, color: verdictColor }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01M12 3l9 16H3l9-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 2px' }}>{verdict.titulo}</p>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{verdict.texto}</p>
          </div>
        </div>
      )}

      {verdict && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
          {publicado ? (
            <p style={{ fontSize: 12.5, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Publicada no feed da comunidade.
            </p>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: publicando ? 'default' : 'pointer' }}>
                <span
                  onClick={() => !publicando && publicar()}
                  style={{ width: 34, height: 19, borderRadius: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0, opacity: publicando ? 0.6 : 1 }}>
                  <span style={{ width: 13, height: 13, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', position: 'absolute', top: 2, left: 2 }} />
                </span>
                <span>
                  <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{publicando ? 'Publicando…' : 'Publicar essa troca (anônima) no feed da comunidade'}</p>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Sem seu nome, só as cartas e o resultado.</span>
                </span>
              </label>
              {temPerfilPublico && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 44, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={mostrarComoUsuario} onChange={e => setMostrarComoUsuario(e.target.checked)} style={{ margin: 0 }} />
                  mostrar como @usuário em vez de anônimo
                </label>
              )}
            </>
          )}
        </div>
      )}

      {!temAmbos && (
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
          Adicione pelo menos uma carta em cada lado pra ver o veredito.
        </p>
      )}
    </div>
  )

  if (!onClose) return conteudo

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '86vh', overflowY: 'auto', padding: 22, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: FONT, color: '#f0f0f0' }}>Analisar troca</p>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {conteudo}
      </div>
    </div>
  )
}
