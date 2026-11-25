'use client'

import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import BotaoMais from '@/components/lojas/BotaoMais'
import BarraSacola from '@/components/lojas/BarraSacola'
import { fmtBRL } from '@/lib/comissao'
import { IconClose, IconSearch, IconChevronDown, IconPokeball, IconArrowRight } from '@/components/ui/Icons'
import type { ItemFolha } from '@/app/api/vendedor/[id]/itens/route'

/**
 * A folha "todas as cartas do vendedor", dentro do anuncio (25/11/2026).
 *
 * ★ POR QUE EXISTE. Quem queria juntar cartas de um vendedor pulava entre
 * quatro telas: "Ver as 94 cartas" so rolava ate uma grade de 6, cada carta
 * abria outro anuncio, e "Ver todas" ia ao PERFIL da pessoa (nao a loja), onde
 * o botao principal fechava uma carta por vez, com frete proprio. Agora as
 * cartas e os produtos do vendedor abrem aqui, por cima do anuncio, com busca
 * e um "+" em cada linha. Wireframe aprovado pelo Du em 25/11.
 *
 * Celular: folha de baixo para cima. Desktop (>= 881, o mesmo corte da coluna
 * de compra): painel de 440 px a direita, como o chat.
 *
 * ★ LINHA COM SET E NUMERO, nao so o nome: a PokeMae tem duas "Hisuian Zorua"
 * -- uma comum de R$ 0,80 e uma Illustration Rare de R$ 25,00. Pelo nome do
 * anuncio sao iguais.
 *
 * Abre por evento (`abrirFolhaVendedor`), porque o anuncio e server-side e tem
 * dois gatilhos (a faixa do frete e o "Ver todas" da grade) para UMA folha.
 */

const EVENTO = 'bx:abrir-folha-vendedor'

export function abrirFolhaVendedor() {
  window.dispatchEvent(new CustomEvent(EVENTO))
}

/** Gatilho para usar dentro de pagina server-side. */
export function BotaoAbrirFolha({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <button type="button" onClick={abrirFolhaVendedor} className={className} style={{ fontFamily: 'inherit', cursor: 'pointer', width: '100%', ...style }}>
      {children}
    </button>
  )
}

type Tipo = 'carta' | 'produto'

export default function FolhaVendedor({
  vendedorId,
  nomeVendedor,
  podeComprar,
  excetoId,
  pagina,
}: {
  vendedorId: string
  nomeVendedor: string
  /** Sem recebimento pela Bynx: lista sem "+" e sem barra; a linha abre o item. */
  podeComprar: boolean
  /** O anuncio que esta aberto: nao repete na lista. */
  excetoId?: string | null
  /** Pagina do vendedor no rodape da lista: a loja, ou o perfil de quem nao tem. */
  pagina?: { href: string; rotulo: string } | null
}) {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [qBusca, setQBusca] = useState('')
  const [tipo, setTipo] = useState<Tipo>('carta')
  const [asc, setAsc] = useState(true)
  const [itens, setItens] = useState<ItemFolha[]>([])
  const [total, setTotal] = useState<{ cartas: number; produtos: number } | null>(null)
  const [semBusca, setSemBusca] = useState<{ cartas: number; produtos: number } | null>(null)
  const [rotuloProdutos, setRotuloProdutos] = useState('Produtos')
  const [lojaId, setLojaId] = useState<string | null>(null)
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  const pedido = useRef(0)
  const painel = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const fim = useRef<HTMLDivElement>(null)
  const voltarFoco = useRef<HTMLElement | null>(null)

  // ── abrir / fechar ─────────────────────────────────────────────────────
  useEffect(() => {
    const abrir = () => {
      voltarFoco.current = document.activeElement as HTMLElement | null
      setAberto(true)
    }
    window.addEventListener(EVENTO, abrir)
    return () => window.removeEventListener(EVENTO, abrir)
  }, [])

  const fechar = useCallback(() => {
    setAberto(false)
    voltarFoco.current?.focus?.()
  }, [])

  useEffect(() => {
    if (!aberto) return
    // Trava a rolagem da pagina por baixo e devolve no fechar.
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', tecla)
    // Foco no painel, nao na busca: no celular focar a busca abriria o
    // teclado por cima da lista na mesma hora.
    painel.current?.focus()
    return () => {
      document.body.style.overflow = antes
      window.removeEventListener('keydown', tecla)
    }
  }, [aberto, fechar])

  // ── busca com espera ───────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setQBusca(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // ── carregar ───────────────────────────────────────────────────────────
  const carregar = useCallback(async (offset: number) => {
    const meu = ++pedido.current
    setCarregando(true)
    setErro(false)
    try {
      const sp = new URLSearchParams({ tipo, ordem: asc ? 'asc' : 'desc', offset: String(offset) })
      if (qBusca) sp.set('q', qBusca)
      if (excetoId) sp.set('exceto', excetoId)
      const r = await fetch(`/api/vendedor/${vendedorId}/itens?${sp}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'falha')
      // Resposta de uma busca/filtro anterior: descarta, senao a lista mistura.
      if (meu !== pedido.current) return
      setItens(atual => (offset === 0 ? j.itens : [...atual, ...j.itens]))
      setTotal(j.total)
      // O cabecalho e o rotulo do filtro vem da carga SEM busca: com busca, a
      // rota so ve os produtos que casaram -- e com zero casados nao sabe se
      // sao selados, e o "4 selados" virava "4 produtos" e "Produtos 0".
      if (!qBusca) {
        setSemBusca(j.total)
        setRotuloProdutos(j.rotuloProdutos || 'Produtos')
      }
      setLojaId(j.lojaId ?? null)
      setTemMais(!!j.temMais)
    } catch {
      if (meu === pedido.current) setErro(true)
    } finally {
      if (meu === pedido.current) setCarregando(false)
    }
  }, [vendedorId, tipo, asc, qBusca, excetoId])

  // Recomeca do zero quando abre ou quando muda busca, filtro ou ordem.
  useEffect(() => {
    if (!aberto) return
    lista.current?.scrollTo({ top: 0 })
    void carregar(0)
  }, [aberto, carregar])

  // Rolagem infinita: o sentinela no fim da lista pede a proxima pagina.
  useEffect(() => {
    if (!aberto || !temMais || carregando || erro) return
    const alvo = fim.current
    if (!alvo) return
    const obs = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) void carregar(itens.length)
    }, { root: lista.current, rootMargin: '200px' })
    obs.observe(alvo)
    return () => obs.disconnect()
  }, [aberto, temMais, carregando, erro, itens.length, carregar])

  if (!aberto) return null

  const base = semBusca ?? total
  const nProdutos = base?.produtos ?? 0
  const rotuloP = rotuloProdutos === 'Selados' ? 'selados' : 'produtos'
  const sub = base
    ? `${base.cartas} ${base.cartas === 1 ? 'carta' : 'cartas'}${nProdutos ? ` e ${nProdutos} ${nProdutos === 1 ? rotuloP.replace(/s$/, '') : rotuloP}` : ''}${podeComprar ? ' · tudo no mesmo envio' : ''}`
    : ' '

  return (
    <>
      <div className="bx-folha-vela" onClick={fechar} aria-hidden="true" />
      <div
        ref={painel}
        className="bx-folha"
        role="dialog"
        aria-modal="true"
        aria-label={`Itens à venda de ${nomeVendedor}`}
        tabIndex={-1}
      >
        <div className="bx-folha-alca" aria-hidden="true" />
        <div style={S.topo}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.titulo}>{nomeVendedor}</p>
            <p style={S.sub}>{sub}</p>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="bx-folha-x" style={S.x}>
            <IconClose size={16} color="currentColor" />
          </button>
        </div>

        <label style={S.busca}>
          <IconSearch size={16} color="var(--bx-text-3)" />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar pelo nome"
            aria-label="Buscar pelo nome"
            // 16px: abaixo disso o Safari do iPhone da zoom ao focar e nao volta.
            style={S.input}
          />
        </label>

        <div style={S.filtros}>
          <button type="button" onClick={() => setTipo('carta')} aria-pressed={tipo === 'carta'} style={{ ...S.pill, ...(tipo === 'carta' ? S.pillOn : {}) }}>
            Cartas {total?.cartas ?? ''}
          </button>
          {/* So aparece se o vendedor tem produto: chip vazio e convite falso. */}
          {(semBusca?.produtos ?? 0) > 0 && (
            <button type="button" onClick={() => setTipo('produto')} aria-pressed={tipo === 'produto'} style={{ ...S.pill, ...(tipo === 'produto' ? S.pillOn : {}) }}>
              {rotuloProdutos} {total?.produtos ?? ''}
            </button>
          )}
          <button type="button" onClick={() => setAsc(a => !a)} style={S.ordem} aria-label={asc ? 'Ordenado pelo menor preço. Trocar para o maior.' : 'Ordenado pelo maior preço. Trocar para o menor.'}>
            {asc ? 'Menor preço' : 'Maior preço'}
            <IconChevronDown size={14} color="currentColor" style={{ transform: asc ? 'none' : 'rotate(180deg)' }} />
          </button>
        </div>

        <div ref={lista} style={S.lista}>
          {itens.map(it => (
            <div key={it.id} style={S.linha}>
              <Link href={it.href} style={S.linkLinha} onClick={() => setAberto(false)}>
                <span style={{ ...S.thumb, ...(it.tipo === 'produto' ? S.thumbProduto : {}) }}>
                  {it.imagem
                    ? <Image src={it.imagem} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
                    : <IconPokeball size={14} color="var(--bx-text-faint)" />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={S.nome}>{it.nome}</span>
                  {/* `title`: em 375 a linha corta no fim (raridade, condicao);
                      o set e o numero, que separam cartas de mesmo nome, vem
                      primeiro de proposito. */}
                  {it.detalhe && <span style={S.detalhe} title={it.detalhe}>{it.detalhe}</span>}
                </span>
                <span style={S.preco}>{fmtBRL(it.precoCents)}</span>
              </Link>
              {podeComprar && (
                <BotaoMais id={it.id} tipo={it.tipo} vendedorId={vendedorId} lojaId={it.tipo === 'produto' ? lojaId : null} nome={it.nome} forma="linha" />
              )}
            </div>
          ))}

          {carregando && <p style={S.aviso}>Carregando…</p>}
          {erro && (
            <p style={S.aviso}>
              Não deu para carregar as cartas.{' '}
              <button type="button" onClick={() => void carregar(itens.length)} style={S.tentar}>Tentar de novo</button>
            </p>
          )}
          {!carregando && !erro && itens.length === 0 && (
            <p style={S.aviso}>{qBusca ? `Nenhum resultado para “${qBusca}”.` : 'Nada à venda aqui agora.'}</p>
          )}
          {temMais && <div ref={fim} style={{ height: 1 }} />}
          {!temMais && !carregando && itens.length > 0 && pagina && (
            <Link href={pagina.href} style={S.pagina}>
              {pagina.rotulo} <IconArrowRight size={14} color="currentColor" />
            </Link>
          )}
        </div>

        {podeComprar && <BarraSacola vendedorId={vendedorId} embutida />}
      </div>
    </>
  )
}

const S: Record<string, CSSProperties> = {
  topo: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 14px 10px' },
  titulo: { margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.25, color: 'var(--bx-text)' },
  sub: { margin: '2px 0 0', fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.4 },
  x: {
    width: 44, height: 44, flex: 'none', borderRadius: 10, border: '1px solid var(--bx-border-2)',
    background: 'transparent', color: 'var(--bx-text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  busca: {
    margin: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '0 12px',
    background: 'var(--bx-surface)',
  },
  input: {
    flex: 1, minWidth: 0, minHeight: 44, border: 'none', outline: 'none', background: 'transparent',
    color: 'var(--bx-text)', fontSize: 16, fontFamily: 'inherit',
  },
  filtros: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px 10px' },
  pill: {
    minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--bx-border-2)',
    background: 'transparent', color: 'var(--bx-text-2)', fontSize: 12.5, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
  },
  // `border` inteiro, nao `borderColor`: misturar o atalho com a propriedade
  // solta faz o React avisar e pode deixar a borda errada ao trocar de filtro.
  pillOn: { background: 'var(--bx-surface-3)', color: 'var(--bx-text)', border: '1px solid rgba(255,255,255,0.3)' },
  ordem: {
    marginLeft: 'auto', minHeight: 36, padding: '0 4px', border: 'none', background: 'transparent',
    color: 'var(--bx-text-2)', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  lista: {
    flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
    borderTop: '1px solid var(--bx-border)',
  },
  linha: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 14px',
    borderBottom: '1px solid var(--bx-border)',
  },
  linkLinha: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
    textDecoration: 'none', color: 'inherit',
  },
  thumb: {
    position: 'relative', width: 32, height: 45, flex: 'none', borderRadius: 5, overflow: 'hidden',
    border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbProduto: { width: 40, height: 40 },
  nome: {
    display: 'block', fontSize: 13, fontWeight: 700, lineHeight: 1.25, color: 'var(--bx-text)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  detalhe: {
    display: 'block', fontSize: 11, color: 'var(--bx-text-3)', marginTop: 1,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  preco: { flex: 'none', fontSize: 13, fontWeight: 800, color: 'var(--bx-amber)', fontVariantNumeric: 'tabular-nums' },
  aviso: { margin: 0, padding: '16px 14px', fontSize: 13, color: 'var(--bx-text-3)', textAlign: 'center' },
  tentar: {
    border: 'none', background: 'transparent', color: 'var(--bx-text)', fontWeight: 700, fontSize: 13,
    textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
  },
  pagina: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48,
    fontSize: 13, fontWeight: 700, color: 'var(--bx-text-2)', textDecoration: 'none',
  },
}
