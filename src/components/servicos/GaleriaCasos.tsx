'use client'

// Grade 2x2 de casos reais. O toque abre uma folha com o slider e o registro
// do atendimento (problema, o que foi feito, prazo, data). Mostra 4 e o resto
// atras de "Ver mais", pra grade nao virar um paredao no celular.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import BeforeAfterSlider from './BeforeAfterSlider'
import { IconClose } from '@/components/ui/Icons'
import type { Caso } from '@/lib/servicos'

export default function GaleriaCasos({ casos }: { casos: Caso[] }) {
  const [aberto, setAberto] = useState<Caso | null>(null)
  const [todos, setTodos] = useState(false)

  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(null) }
    document.addEventListener('keydown', esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes }
  }, [aberto])

  const visiveis = todos ? casos : casos.slice(0, 4)

  return (
    <>
      <div className="sv-casos">
        {visiveis.map(c => (
          <button key={c.slug} type="button" className="sv-caso" onClick={() => setAberto(c)} aria-label={`${c.carta}: ${c.defeito}. Ver antes e depois`}>
            <Image src={c.depois} alt="" fill sizes="(max-width: 600px) 50vw, 280px" />
            <span className="sv-caso-tag">{c.defeito}</span>
          </button>
        ))}
      </div>
      {casos.length > 4 && !todos && (
        <button type="button" className="sv-ghost" style={{ marginTop: 10 }} onClick={() => setTodos(true)}>
          Ver mais {casos.length - 4} casos
        </button>
      )}

      {aberto && (
        <div className="sv-sheet" role="dialog" aria-modal="true" aria-label={aberto.carta} onClick={() => setAberto(null)}>
          <div className="sv-panel" onClick={e => e.stopPropagation()}>
            <button type="button" className="sv-x" onClick={() => setAberto(null)} aria-label="Fechar"><IconClose size={16} /></button>
            <BeforeAfterSlider antes={aberto.antes} depois={aberto.depois} alt={aberto.carta} />
            <h3 className="sv-h3">{aberto.carta}</h3>
            <dl className="sv-dl">
              <div><dt>Problema</dt><dd>{aberto.defeito}</dd></div>
              <div><dt>O que foi feito</dt><dd>{aberto.feito}</dd></div>
              <div><dt>Prazo</dt><dd>{aberto.prazo}</dd></div>
            </dl>
            <p className="sv-small" style={{ margin: 0 }}>Foto do atendimento, sem edição · {aberto.data}</p>
          </div>
        </div>
      )}
    </>
  )
}
