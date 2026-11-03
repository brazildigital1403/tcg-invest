'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

/** Abas em chips, com o chip ativo sempre rolado para a area visivel. */
export default function AbasChips({
  itens,
  ativa,
  rotulo,
}: {
  itens: ReadonlyArray<{ chave: string; rotulo: string; href: string; n?: number }>
  ativa: string
  rotulo: string
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = ref.current
    const atual = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !atual) return
    nav.scrollLeft = atual.offsetLeft - (nav.clientWidth - atual.offsetWidth) / 2
  }, [ativa])

  return (
    <nav ref={ref} aria-label={rotulo} className="lk-abas">
      {itens.map(a => (
        <Link key={a.chave} href={a.href} prefetch={false} className="lk-aba" aria-current={a.chave === ativa ? 'page' : undefined}>
          {a.rotulo}
          {a.n != null && <b>{a.n}</b>}
        </Link>
      ))}
    </nav>
  )
}
