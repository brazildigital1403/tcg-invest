'use client'

import { CSSProperties, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { itensDoVendedor, estaNoCarrinho, adicionar, assinarCarrinho, registrarEntrada, type TipoItem } from '@/lib/carrinho'
import { track } from '@/lib/analytics'
import { fmtBRL } from '@/lib/comissao'
import { IconTruck, IconCarrinho, IconPokeball } from '@/components/ui/Icons'

/**
 * Aviso do checkout direto: "voce ja tem item deste vendedor no carrinho".
 *
 * ★ POR QUE EXISTE (25/11/2026). O checkout de UM item (`/checkout/[id]`) nao
 * sabia da sacola. Quem ja tinha separado uma carta da GhosTCG no carrinho e
 * clicava em comprar outra da mesma loja fechava as duas em compras e fretes
 * separados -- e o frete e quase todo custo fixo de postagem (1 carta de
 * Fortaleza para SP: R$ 17,43; 10 na mesma remessa: R$ 17,49). Aqui a pessoa
 * ainda nao pagou nada, entao e a ultima hora boa para oferecer juntar.
 *
 * So aparece DEPOIS que o servidor responde: a sacola mora no localStorage e
 * pode ter carta que ja foi vendida. Mostrar o aviso pela contagem local e
 * tira-lo um segundo depois seria pior que nao mostrar. Se a rota falhar, cai
 * para a contagem local, sem foto -- o carrinho revalida tudo de qualquer jeito.
 *
 * Nunca oferece juntar vendedores diferentes: cada vendedor recebe na propria
 * conta, entao a sacola e por vendedor (ver `src/lib/carrinho.ts`).
 */

interface Outro {
  id: string
  tipo: TipoItem
  nome: string
  imagem: string | null
  preco_cents: number
  qtd: number
}

interface Resposta {
  chave: string
  itens: Outro[]
  /** true = a rota falhou e a lista e so a contagem local, sem nome nem foto */
  semDetalhe: boolean
}

export default function AvisoMesmoVendedor({
  itemId,
  tipo,
  vendedorId,
  lojaId,
  qtd,
  nomeVendedor,
  ehPessoa,
}: {
  itemId: string
  tipo: TipoItem
  /** `users.id` de quem vende -- o mesmo agrupador da sacola. */
  vendedorId: string
  /** Obrigatoria para produto (o carrinho descarta produto sem loja). */
  lojaId: string | null
  /** Unidades escolhidas no checkout. Carta e sempre 1. */
  qtd: number
  nomeVendedor: string
  ehPessoa: boolean
}) {
  const router = useRouter()
  const [fechado, setFechado] = useState(false)
  const [res, setRes] = useState<Resposta | null>(null)

  // Snapshot em STRING (tipo:id:qtd|...), nao array: o `useSyncExternalStore`
  // compara por referencia, e um array novo a cada leitura entraria em loop.
  const snap = useCallback(
    () => itensDoVendedor(vendedorId)
      .filter(i => i.id !== itemId)
      .map(i => `${i.tipo}:${i.id}:${i.qtd}`)
      .join('|'),
    [vendedorId, itemId],
  )
  const chave = useSyncExternalStore(assinarCarrinho, snap, () => '')

  useEffect(() => {
    if (!chave) return
    let vivo = true
    const entradas = chave.split('|').map(s => {
      const [t, id, q] = s.split(':')
      return { id, tipo: t as TipoItem, qtd: Number(q) || 1 }
    })
    fetch('/api/carrinho?acao=resumo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `cartao` explicito: com o Pix fora, a rota recusa `pix` com 409.
      // Sem CEP a rota nao cota frete -- nenhuma chamada ao Melhor Envio aqui.
      body: JSON.stringify({ vendedor_id: vendedorId, itens: entradas, metodo: 'cartao' }),
    })
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || 'falha')
        return j as { itens?: Array<Outro & { disponivel: boolean }> }
      })
      .then(j => {
        if (!vivo) return
        const itens = (j.itens || [])
          .filter(i => i.disponivel)
          .map(i => ({ id: i.id, tipo: i.tipo, nome: i.nome, imagem: i.imagem, preco_cents: i.preco_cents, qtd: i.qtd }))
        setRes({ chave, itens, semDetalhe: false })
      })
      .catch(() => {
        if (!vivo) return
        setRes({
          chave,
          itens: entradas.map(e => ({ ...e, nome: '', imagem: null, preco_cents: 0 })),
          semDetalhe: true,
        })
      })
    return () => { vivo = false }
  }, [chave, vendedorId])

  // `visto` uma vez por sacola exibida (a chave muda quando a sacola muda).
  // Mesma condicao do render abaixo: so conta o aviso que apareceu de fato.
  const nVisivel = !chave || fechado || !res || res.chave !== chave ? 0 : res.itens.length
  const vistoEm = useRef('')
  useEffect(() => {
    if (nVisivel === 0 || vistoEm.current === chave) return
    vistoEm.current = chave
    track({ name: 'aviso_mesmo_vendedor', properties: { acao: 'visto', itens_na_sacola: nVisivel } })
  }, [nVisivel, chave])

  if (!chave || fechado) return null
  // Resposta de outra sacola (ou nenhuma ainda): espera, sem piscar.
  if (!res || res.chave !== chave) return null
  const lista = res.itens
  if (lista.length === 0) return null

  const n = lista.length
  const soCarta = lista.every(i => i.tipo === 'carta')
  const soProduto = lista.every(i => i.tipo === 'produto')
  const oQue = soCarta
    ? (n === 1 ? 'carta' : 'cartas')
    : soProduto
      ? (n === 1 ? 'produto' : 'produtos')
      : (n === 1 ? 'item' : 'itens')
  const deQuem = nomeVendedor ? `${ehPessoa ? 'de' : 'da'} ${nomeVendedor}` : 'deste vendedor'
  const visiveis = res.semDetalhe ? [] : lista.slice(0, 2)
  const resto = res.semDetalhe ? 0 : n - visiveis.length

  function juntar() {
    track({ name: 'aviso_mesmo_vendedor', properties: { acao: 'juntar', itens_na_sacola: n } })
    if (!estaNoCarrinho(itemId)) {
      // Produto sem loja o carrinho descarta na leitura -- melhor so levar a
      // pessoa ao carrinho do que gravar um item que some.
      if (tipo === 'produto' && !lojaId) { router.push('/carrinho'); return }
      adicionar({ id: itemId, tipo, vendedorId, lojaId: lojaId ?? null, qtd: tipo === 'produto' ? qtd : 1 })
      registrarEntrada('aviso_checkout', tipo, vendedorId)
    }
    router.push(`/carrinho?novo=${encodeURIComponent(itemId)}`)
  }

  return (
    // Duas camadas: a de fora e o container da query (`.bx-junto-caixa`), a de
    // dentro e a grade -- um elemento nao consulta a propria largura.
    <div className="bx-ctx-comprador bx-junto-caixa" style={S.caixa} role="region" aria-label="Itens deste vendedor no carrinho">
    <div className="bx-junto">
      <div className="bx-junto-texto" style={{ minWidth: 0 }}>
        <p style={S.titulo}>
          <IconTruck size={16} color="var(--ac-1)" style={S.tituloIcone} />
          <span>Você já tem {n} {oQue} {deQuem} no carrinho</span>
        </p>
        <p style={S.sub}>Juntando tudo, vai no mesmo envio e você paga um frete só.</p>
      </div>

      {/* Sempre presente, mesmo vazio: e a area `lista` da grade do desktop. */}
      <div className="bx-junto-lista" style={S.lista}>
        {visiveis.map(o => (
          <div key={o.id} style={S.outra}>
            <span style={S.thumb}>
              {o.imagem
                ? <Image src={o.imagem} alt={o.nome} width={30} height={42} style={{ width: '100%', height: '100%', objectFit: 'cover' }} sizes="32px" />
                : <IconPokeball size={14} color="var(--bx-text-faint)" />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={S.outraNome}>{o.nome}</span>
              <span style={S.outraPreco}>
                {fmtBRL(o.preco_cents * o.qtd)}
                {o.qtd > 1 && <span style={S.outraUn}> · {o.qtd} unidades</span>}
              </span>
            </span>
          </div>
        ))}
        {resto > 0 && <span style={S.resto}>e mais {resto} {resto === 1 ? 'item' : 'itens'}</span>}
      </div>

      <div className="bx-junto-acoes">
        <button type="button" onClick={juntar} className="bx-compra-cta" style={S.cta}>
          <IconCarrinho size={17} />
          Juntar e ir para o carrinho
        </button>
        <button type="button" onClick={() => {
          track({ name: 'aviso_mesmo_vendedor', properties: { acao: 'seguir_sozinho', itens_na_sacola: n } })
          setFechado(true)
        }} className="bx-junto-so" style={S.so}>
          Continuar só com {tipo === 'carta' ? 'esta carta' : 'este produto'}
        </button>
      </div>
    </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  caixa: {
    margin: '4px 0 0', padding: '13px 13px 10px', borderRadius: 14,
    border: '1px solid rgba(var(--ac-1-rgb), 0.45)',
    background: 'linear-gradient(180deg, rgba(var(--ac-1-rgb), 0.10), rgba(var(--ac-2-rgb), 0.04))',
  },
  titulo: { display: 'flex', alignItems: 'flex-start', gap: 8, margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: 'var(--bx-text)' },
  tituloIcone: { flexShrink: 0, marginTop: 2 },
  sub: { margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--bx-text-2)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  outra: {
    display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
    borderRadius: 10, padding: '6px 9px',
  },
  thumb: {
    width: 30, height: 42, flexShrink: 0, borderRadius: 5, overflow: 'hidden',
    border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  outraNome: {
    display: 'block', fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--bx-text)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  outraPreco: { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--bx-text)', marginTop: 1, fontVariantNumeric: 'tabular-nums' },
  outraUn: { fontWeight: 600, color: 'var(--bx-text-3)' },
  resto: { fontSize: 12, color: 'var(--bx-text-3)', paddingLeft: 2 },
  cta: {
    minHeight: 46, padding: '0 18px', borderRadius: 12, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  so: {
    minHeight: 44, padding: '0 8px', border: 'none', background: 'transparent',
    color: 'var(--bx-text-2)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
    textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--bx-border-2)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
}
