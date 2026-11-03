'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import SeloTempo from '@/components/leilao/SeloTempo'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import BotaoAvisoLeilao from '@/components/leilao/vitrine/BotaoAvisoLeilao'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlHome, urlLote, urlRodada } from '@/lib/leilao-urls'

type Resumo =
  | { estado: 'abertos'; serverNow: string; lotes: LotePublico[]; totalAbertos: number }
  | { estado: 'ao_vivo' | 'agendada'; rodada: { numero: number } }
  | { estado: 'nada' }

/**
 * O que olhar depois que o lote termina. Le o mesmo resumo da home, entao nao
 * cria consulta nem cache novos. Falha nao mostra nada: sem dado, a tela nao
 * afirma que nao ha outro leilao.
 */
export default function OutrosLotes({ loteAtualId }: { loteAtualId: string }) {
  const [resumo, setResumo] = useState<Resumo | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/leiloes/resumo-home')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (vivo && j?.estado) setResumo(j) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  if (!resumo) return null

  const lotes = resumo.estado === 'abertos' ? resumo.lotes.filter(l => l.id !== loteAtualId).slice(0, 4) : []
  const semLotes = lotes.length === 0

  return (
    <section aria-labelledby="ol-titulo" className="ol">
      <style>{`
        .ol { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
        .ol-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .ol-topo h2 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; color: var(--bx-text); }
        .ol-todos { font-size: 13px; font-weight: 700; color: var(--ac-1); text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
        .ol-grade { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ol-lote { display: block; min-width: 0; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; }
        .ol-lote:hover { transform: translateY(-2px); }
        .ol-preco {
          background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-radius: 8px; padding: 4px 8px;
          font-size: 12px; font-weight: 800; color: var(--bx-text); font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .ol-cta {
          display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; width: 100%;
          border-radius: 10px; background: var(--ac-grad); color: var(--bx-brand-ink); font-size: 14px; font-weight: 800; text-decoration: none;
        }
        @media (prefers-reduced-motion: reduce) { .ol-lote, .ol-lote:hover { transition: none; transform: none; } }
      `}</style>
      <div className="ol-topo">
        <h2 id="ol-titulo">{semLotes ? 'Próximo leilão' : 'Outros leilões abertos'}</h2>
        {!semLotes && <Link href={urlHome()} prefetch={false} className="ol-todos">Ver todos</Link>}
      </div>
      {resumo.estado === 'abertos' && !semLotes && (
        <div className="ol-grade">
          {lotes.map(l => (
            <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="ol-lote">
              <CardItem
                card={cardDoLote(l)}
                mode="readonly"
                hidePriceTable
                ocultarSemPreco
                badge={<span className="ol-preco">{formatarBRL(l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents)}</span>}
                footerSlot={<SeloTempo lote={l} renderizadoEm={resumo.serverNow} />}
              />
            </Link>
          ))}
        </div>
      )}
      {(resumo.estado === 'ao_vivo' || resumo.estado === 'agendada') && (
        <Link href={urlRodada(resumo.rodada.numero)} prefetch={false} className="ol-cta">
          {resumo.estado === 'ao_vivo' ? 'Entrar na rodada ao vivo' : 'Ver a próxima rodada'}
        </Link>
      )}
      {(resumo.estado === 'nada' || (resumo.estado === 'abertos' && semLotes)) && <BotaoAvisoLeilao className="ol-cta" />}
    </section>
  )
}
