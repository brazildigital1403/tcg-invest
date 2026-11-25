'use client'

import { CSSProperties, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { itensDoVendedor, assinarCarrinho, type TipoItem } from '@/lib/carrinho'
import { fmtBRL } from '@/lib/comissao'
import { IconCarrinho } from '@/components/ui/Icons'

/**
 * Barra da sacola DESTE vendedor (25/11/2026).
 *
 * ★ POR QUE EXISTE. Com o "+" nas cartas, a pessoa junta itens sem sair da
 * tela -- e precisa ver o que ja juntou e ter o caminho do carrinho sempre a
 * mao, em vez de ir e voltar a cada carta. Aparece no primeiro item e mostra
 * so a sacola deste vendedor: e ela que fecha junta, num envio so (a sacola e
 * por vendedor, ver lib/carrinho). Decisao do Du.
 *
 * O total e dos ITENS. Frete so no carrinho, com o CEP, como sempre.
 *
 * O preco vem do servidor (resumo do carrinho), nunca do localStorage -- la
 * so ha ids. A contagem local aparece na hora; o total chega em seguida.
 *
 * `embutida`: dentro da folha, sem posicao fixa e sem mexer no body.
 */
export default function BarraSacola({
  vendedorId,
  nomeVendedor,
  embutida = false,
}: {
  vendedorId: string
  nomeVendedor?: string | null
  embutida?: boolean
}) {
  // Snapshot em STRING (tipo:id:qtd|...): array novo a cada leitura entraria
  // em loop no useSyncExternalStore, que compara por referencia.
  const snap = useCallback(
    () => itensDoVendedor(vendedorId).map(i => `${i.tipo}:${i.id}:${i.qtd}`).join('|'),
    [vendedorId],
  )
  const chave = useSyncExternalStore(assinarCarrinho, snap, () => '')
  const [res, setRes] = useState<{ chave: string; unidades: number; totalCents: number | null } | null>(null)

  useEffect(() => {
    if (!chave) return
    let vivo = true
    const entradas = chave.split('|').map(s => {
      const [t, id, q] = s.split(':')
      return { id, tipo: t as TipoItem, qtd: Number(q) || 1 }
    })
    // Espera o dedo parar: quem toca em tres "+" seguidos dispara um pedido,
    // nao tres.
    const t = setTimeout(() => {
      fetch('/api/carrinho?acao=resumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Sem CEP, a rota nao cota frete: nenhuma chamada ao Melhor Envio aqui.
        body: JSON.stringify({ vendedor_id: vendedorId, itens: entradas, metodo: 'cartao' }),
      })
        .then(async r => {
          const j = await r.json()
          if (!r.ok) throw new Error('falha')
          return j as { itens?: Array<{ disponivel: boolean; preco_cents: number; qtd: number }> }
        })
        .then(j => {
          if (!vivo) return
          const ok = (j.itens || []).filter(i => i.disponivel)
          setRes({
            chave,
            unidades: ok.reduce((a, i) => a + i.qtd, 0),
            totalCents: ok.reduce((a, i) => a + i.preco_cents * i.qtd, 0),
          })
        })
        .catch(() => {
          // Sem o servidor, mostra a contagem local e esconde o total: um
          // valor errado aqui seria pior que nenhum.
          if (vivo) setRes({ chave, unidades: entradas.reduce((a, e) => a + e.qtd, 0), totalCents: null })
        })
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [chave, vendedorId])

  // Marca o body enquanto a barra fixa esta na tela: o CSS sobe o botao do
  // chat e da folga no fim da pagina, para a barra nao cobrir o rodape.
  const visivel = !!chave
  useEffect(() => {
    if (embutida) return
    document.body.classList.toggle('bx-com-sacola', visivel)
    return () => { document.body.classList.remove('bx-com-sacola') }
  }, [visivel, embutida])

  if (!chave) return null

  const atual = res && res.chave === chave ? res : null
  const unidades = atual ? atual.unidades : chave.split('|').reduce((a, s) => a + (Number(s.split(':')[2]) || 1), 0)
  const total = atual && atual.totalCents != null ? fmtBRL(atual.totalCents) : null
  const resumo = `${unidades} ${unidades === 1 ? 'item' : 'itens'}${total ? ` · ${total}` : ''}`

  const corpo = (
    <div className="bx-gutter" style={S.miolo}>
      <div style={S.texto}>
        <span style={S.quem}>{nomeVendedor && !embutida ? `${nomeVendedor} · um envio só` : 'um envio só'}</span>
        <span style={S.resumo} aria-live="polite">{resumo}</span>
      </div>
      <Link href="/carrinho" className="bx-ctx-comprador bx-compra-cta" style={S.cta}>
        <IconCarrinho size={16} />
        Ver carrinho
      </Link>
    </div>
  )

  if (embutida) return <div style={S.embutida}>{corpo}</div>

  return (
    <div className="bx-barra-sacola" role="region" aria-label="Sua sacola deste vendedor" style={S.fixa}>
      {corpo}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  fixa: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
    background: 'var(--bx-bg-elev)', borderTop: '1px solid var(--bx-border-2)',
    boxShadow: '0 -12px 30px rgba(0,0,0,0.5)',
    padding: '10px 0 calc(12px + env(safe-area-inset-bottom, 0px))',
  },
  embutida: {
    background: 'var(--bx-bg-elev)', borderTop: '1px solid var(--bx-border-2)',
    padding: '10px 0 calc(12px + env(safe-area-inset-bottom, 0px))',
  },
  // Mesma largura do conteudo das paginas (1200) e o gutter da casa
  // (`.bx-gutter`, 16/24): a barra alinha com a coluna de compra em vez de
  // grudar nas bordas da tela.
  miolo: {
    maxWidth: 1200, margin: '0 auto', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  texto: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  quem: { fontSize: 11.5, color: 'var(--bx-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  resumo: { fontSize: 14.5, fontWeight: 800, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums' },
  cta: {
    minHeight: 44, padding: '0 16px', borderRadius: 11, flex: 'none',
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    fontWeight: 800, fontSize: 13.5, textDecoration: 'none', whiteSpace: 'nowrap',
  },
}
