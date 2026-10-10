import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { IconArrowRight } from '@/components/ui/Icons'

/**
 * Carrossel de cartas da pagina publica da carta (Fase 2b do #490, 09/10/2026).
 *
 * Substitui a grade de 16 miniaturas sem preco (1.412 px no celular, medido
 * pelo agente de UX): 4 a 6 cartas COM preco, no CardItem padrao da casa, com
 * a terceira "espiando" na borda para convidar a rolar. Server component: os
 * links saem no HTML. Nada aqui e interativo alem de navegar.
 */
export type CartaCarrossel = {
  id: string
  slug: string | null
  name: string
  number: string | null
  image_small: string | null
  set_name: string | null
  set_total?: number | null
  rarity?: string | null
  idioma?: string | null
  preco_min?: number | null
  preco_medio?: number | null
  preco_max?: number | null
}

export default function CarrosselCartas({
  idTitulo,
  titulo,
  cartas,
  verTodas,
}: {
  idTitulo: string
  titulo: string
  cartas: CartaCarrossel[]
  verTodas?: { href: string; label: string }
}) {
  if (!cartas.length) return null
  return (
    <section aria-labelledby={idTitulo} style={{ margin: '4px 0 22px' }}>
      <h2
        id={idTitulo}
        style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: '0 0 10px' }}
      >
        {titulo}
      </h2>
      <div
        className="bx-carrossel"
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch', padding: '2px 2px 8px', margin: '0 -2px',
        }}
      >
        {cartas.map(c => (
          <Link
            key={c.id}
            href={`/carta/${c.slug || c.id}`}
            style={{ flex: '0 0 150px', minWidth: 0, scrollSnapAlign: 'start', textDecoration: 'none', color: 'inherit' }}
          >
            <CardItem
              mode="readonly"
              hidePriceTable
              ocultarIdioma={!c.idioma}
              card={{
                id: c.id,
                name: c.name,
                number: c.number || undefined,
                set_name: c.set_name || undefined,
                set_total: c.set_total || undefined,
                image_small: c.image_small || undefined,
                rarity: c.rarity || undefined,
                idioma: c.idioma || undefined,
                price: { preco_min: c.preco_min, preco_medio: c.preco_medio, preco_max: c.preco_max },
              }}
            />
          </Link>
        ))}
      </div>
      {verTodas && (
        <Link
          href={verTodas.href}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, color: 'var(--ac-1)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
        >
          {verTodas.label}
          <IconArrowRight size={16} color="currentColor" />
        </Link>
      )}
    </section>
  )
}
