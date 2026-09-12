'use client'

import { useState } from 'react'
import Image from 'next/image'
import { IconCamera } from '@/components/ui/Icons'

/**
 * Galeria de fotos do vendedor dentro de um CARD (marketplace e vitrine de
 * loja). Clique avanca a foto; os pontos dizem em qual esta.
 *
 * ★ `next/image` E NAO `<img>` (12/09/2026). A versao anterior servia a foto
 * CRUA do bucket. Medido na Caixa para Toploader, que tem 6 fotos:
 *
 *     crua do bucket .................. 1.982.193 bytes  (1,98 MB)
 *     pelo otimizador, w=256 q=75 .........  29.246 bytes  (29 KB)
 *
 * 68x. Com 6 fotos, um unico card baixava ~12 MB -- e e exatamente a mesma
 * armadilha que derrubou a pagina da loja de 11 MB pra 349 KB em 03/09. Era
 * por isso que a vitrine NAO podia simplesmente reusar este componente: o
 * `<img>` cru desfaria aquela correcao. Agora ela pode.
 *
 * ★ `aspecto` E PROP, com o default de CARTA. A caixa era `paddingBottom:
 * 139%` cravado, que e proporcao de carta -- produto de loja e ~quadrado e
 * ficaria com faixa preta em cima e embaixo. Default preservado pra nao mexer
 * nos tres usos do marketplace.
 *
 * ★ `sizes` tambem e prop: o otimizador precisa saber a largura REAL na tela,
 * e ela e diferente no card do marketplace e no da vitrine. Errar isso faz o
 * browser baixar o dobro pra pintar metade.
 */
export default function MarketplaceFotosGaleria({
  fotos,
  cardName,
  aspecto = '139%',
  sizes = '(max-width: 880px) 45vw, 300px',
}: {
  fotos: string[]
  cardName: string
  /** `padding-bottom` da caixa. '139%' = carta (default), '100%' = quadrado. */
  aspecto?: string
  sizes?: string
}) {
  const [i, setI] = useState(0)
  const lista = (fotos || []).filter(Boolean)
  if (lista.length === 0) return null
  const idx = ((i % lista.length) + lista.length) % lista.length
  const multi = lista.length > 1

  return (
    <div
      onClick={multi ? (e) => { e.stopPropagation(); setI(idx + 1) } : undefined}
      style={{ position: 'relative', width: '100%', paddingBottom: aspecto, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', cursor: multi ? 'pointer' : 'default' }}
    >
      {/* `fill` em vez de width/height: a caixa e que manda, e ela vem do
          `aspecto`. `unoptimized` NUNCA -- e o otimizador que faz os 68x. */}
      <Image
        src={lista[idx]}
        alt={cardName}
        fill
        sizes={sizes}
        style={{ objectFit: 'cover' }}
      />

      {multi && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, zIndex: 2 }}>
          {lista.map((_, k) => (
            <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: k === idx ? 'var(--ac-1, #f59e0b)' : 'rgba(255,255,255,0.5)', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
          ))}
        </div>
      )}

      <span style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.2)', padding: '3px 7px', borderRadius: 7, backdropFilter: 'blur(4px)' }}>
        <IconCamera size={12} style={{ display: 'inline-block', verticalAlign: -2, marginRight: 3 }} />
        {multi ? `${idx + 1}/${lista.length}` : 'Foto real'}
      </span>
    </div>
  )
}
