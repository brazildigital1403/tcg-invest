'use client'

// Marketplace dentro do Club (28/11/2026, mockups v3 aprovados). O card e o MESMO do Marketplace
// (components/marketplace/CardsVenda), com o "Comprar" que leva ao anuncio ou ao produto, nunca direto ao
// checkout. Selo "Venda na Bynx" uma vez por bloco, so texto. Sem itens que passem na regra, nada aparece.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { track, type OrigemClubOferta } from '@/lib/analytics'
import { AnuncioCard, ProdutoCard } from '@/components/marketplace/CardsVenda'
import { carregarVitrine, type ItemVenda } from '@/lib/pcc/ofertas'

/** Itens compraveis do Marketplace (null enquanto carrega). Uma leitura por pagina (memo em lib/pcc/ofertas). */
export function useVitrine(): ItemVenda[] | null {
  const [itens, setItens] = useState<ItemVenda[] | null>(null)
  useEffect(() => {
    let vivo = true
    carregarVitrine().then(v => { if (vivo) setItens(v) })
    return () => { vivo = false }
  }, [])
  return itens
}

/** Quem esta logado: o card do Marketplace nao oferece "Comprar" no proprio anuncio. */
function useEu(): string | null {
  const [eu, setEu] = useState<string | null>(null)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setEu(data.session?.user.id ?? null)) }, [])
  return eu
}

const nada = () => {}

/** Um card do Marketplace, com o clique do Comprar medido por bloco. */
export function CardVenda({ item, bloco }: { item: ItemVenda; bloco: OrigemClubOferta }) {
  const eu = useEu()
  const medir = () => track({ name: 'club_oferta_clique', properties: { bloco, tipo: item.ehProduto ? 'produto' : 'anuncio', preco: item.price } })
  return item.ehProduto
    ? <ProdutoCard card={item} comprar44 onComprar={medir} />
    : <AnuncioCard card={item} userId={eu} userWhatsapp={null} onAction={nada} railMode comprar44 onComprar={medir} />
}

export function SeloVenda() {
  return <span className="cv-selo">Venda na Bynx</span>
}

/** Trilho horizontal de cards do Marketplace com titulo, frase e o selo. */
export function TrilhoVenda({ titulo, frase, itens, bloco, verMais = true, className = '' }: {
  titulo: string; frase?: string; itens: ItemVenda[]; bloco: OrigemClubOferta; verMais?: boolean; className?: string
}) {
  if (!itens.length) return null
  return (
    <section className={`cv ${className}`} aria-label={titulo}>
      <div className="cv-cab">
        <div className="cv-tx">
          <h2 className="cv-h">{titulo}</h2>
          {frase && <p className="cv-f">{frase}</p>}
        </div>
        <SeloVenda />
      </div>
      <div className="cv-trilho">
        {itens.map(i => <div key={i.id} className="cv-it"><CardVenda item={i} bloco={bloco} /></div>)}
        {verMais && <Link href="/marketplace" className="cv-mais">Ver o Marketplace</Link>}
      </div>
      <style>{CV_CSS}</style>
    </section>
  )
}

export const CV_CSS = `
.cv{display:flex;flex-direction:column;gap:12px;min-width:0}
.cv-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.cv-tx{display:flex;flex-direction:column;gap:4px;min-width:0}
.cv-h{margin:0;font-size:17px;font-weight:800;letter-spacing:-.01em;color:var(--bx-text)}
.cv-f{margin:0;font-size:13px;line-height:1.45;color:var(--bx-text-2)}
.cv-selo{flex:none;display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);font-size:11.5px;font-weight:700;color:var(--bx-text-2);white-space:nowrap}
.cv-trilho{display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:2px 16px 6px;scroll-snap-type:x proximity;scroll-padding-inline:16px;scrollbar-width:none;align-items:stretch}
.cv-trilho::-webkit-scrollbar{display:none}
.cv-it{flex:none;width:156px;scroll-snap-align:start;display:flex}
.cv-it>*{width:100%}
.cv-mais{flex:none;width:120px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;border-radius:14px;border:1px dashed var(--bx-border-2);color:var(--bx-text-2);font-size:13px;font-weight:700;text-decoration:none;min-height:44px}
.cv-mais:hover{color:var(--bx-text);border-color:var(--bx-text-3)}
@media (min-width:769px) and (max-width:1023px){ .cv-trilho{margin:0 -24px;padding-left:24px;padding-right:24px} }
@media (min-width:1024px){ .cv-trilho{margin:0;padding:2px 0 6px} .cv-it{width:200px} }
`
