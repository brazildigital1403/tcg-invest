'use client'

import { useEffect, useState } from 'react'

export type Produto = { titulo: string; preco: string; imagem: string; url: string }

const REL = 'sponsored nofollow noopener noreferrer'

function shuffle(arr: Produto[]): Produto[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Grade fixa de 3 colunas (sem scroll lateral). O servidor passa TODOS os ativos;
// aqui embaralhamos e mostramos ate `max` por carregamento. O primeiro paint usa a
// ordem original p/ nao quebrar a hidratacao; logo apos montar, embaralha (cada F5 =
// novo sorteio). Linka direto no url de cada produto.
export default function MlGaleriaGrid({ produtos, max = 6 }: { produtos: Produto[]; max?: number }) {
  const [shown, setShown] = useState<Produto[]>(() => produtos.slice(0, max))

  useEffect(() => {
    setShown(shuffle(produtos).slice(0, max))
  }, [produtos, max])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {shown.map((prod, idx) => (
        <a
          key={prod.url + ':' + idx}
          href={prod.url}
          target="_blank"
          rel={REL}
          style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <img src={prod.imagem} alt={prod.titulo} loading="lazy" style={{ width: '100%', height: 120, objectFit: 'contain', background: '#fff', padding: 10 }} />
          <span style={{ padding: '8px 10px 11px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            <span style={{ fontSize: 11.5, lineHeight: 1.32, color: '#2d2d3a', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 30 }}>{prod.titulo}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#00a650', marginTop: 'auto' }}>{prod.preco}</span>
            <span style={{ fontSize: 10, color: '#3483fa', fontWeight: 700 }}>Ver no ML &rarr;</span>
          </span>
        </a>
      ))}
    </div>
  )
}
