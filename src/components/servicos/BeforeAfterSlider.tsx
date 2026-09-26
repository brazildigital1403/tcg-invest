'use client'

// Antes/depois arrastavel, sem lib. Um <input type="range"> transparente cobre
// a foto: toque, mouse e teclado saem de graca, e o leitor de tela anuncia o
// quanto de cada foto esta visivel. touch-action: pan-y deixa a rolagem
// vertical da pagina passar (o slider so pega o gesto horizontal).

import { useState } from 'react'
import Image from 'next/image'
import { IconArrowsHorizontal, IconImage } from '@/components/ui/Icons'

interface Props {
  antes: string | null
  depois: string | null
  alt: string
  priority?: boolean
}

export default function BeforeAfterSlider({ antes, depois, alt, priority = false }: Props) {
  const [pos, setPos] = useState(50)

  if (!antes || !depois) {
    return (
      <div className="sv-ba" aria-label="Foto de antes e depois em preparação">
        <div className="sv-ba-vazio">
          <span className="sv-ic sv-ic-mid"><IconImage size={18} /></span>
          Antes e depois de um atendimento real, fotografado na mesma luz.
        </div>
      </div>
    )
  }

  return (
    <div className="sv-ba" style={{ ['--pos' as string]: `${pos}%` }}>
      <div className="sv-ba-img">
        <Image src={depois} alt={`${alt}, depois`} fill sizes="(max-width: 600px) 100vw, 560px" priority={priority} />
      </div>
      <div className="sv-ba-img sv-ba-antes">
        <Image src={antes} alt={`${alt}, antes`} fill sizes="(max-width: 600px) 100vw, 560px" priority={priority} />
      </div>
      <span className="sv-ba-lbl sv-ba-lbl-a">Antes</span>
      <span className="sv-ba-lbl sv-ba-lbl-d">Depois</span>
      <span className="sv-ba-line" />
      <input
        className="sv-ba-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pos}
        onChange={e => setPos(Number(e.target.value))}
        aria-label="Arraste para comparar antes e depois"
        aria-valuetext={`${pos}% antes, ${100 - pos}% depois`}
      />
      <span className="sv-ba-knob"><IconArrowsHorizontal size={20} strokeWidth={2} /></span>
    </div>
  )
}
