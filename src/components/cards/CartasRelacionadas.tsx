import Link from 'next/link'

type MiniCard = {
  id: string
  name: string
  number: string | null
  image_small: string | null
  set_name: string | null
}

export default function CartasRelacionadas({
  sameSet,
  samePokemon,
  setName,
  pokemonName,
}: {
  sameSet: MiniCard[]
  samePokemon: MiniCard[]
  setName?: string | null
  pokemonName?: string | null
}) {
  const hasSet = Array.isArray(sameSet) && sameSet.length > 0
  const hasPoke = Array.isArray(samePokemon) && samePokemon.length > 0
  if (!hasSet && !hasPoke) return null

  return (
    <section style={{ width: '100%', padding: '4px 0 0' }}>
      {hasSet && (
        <RelBlock
          title={setName ? `Mais cartas de ${setName}` : 'Mais cartas deste set'}
          cards={sameSet}
        />
      )}
      {hasPoke && (
        <RelBlock
          title={pokemonName ? `Outras cartas de ${pokemonName}` : 'Outras cartas do mesmo Pokemon'}
          cards={samePokemon}
        />
      )}
    </section>
  )
}

function RelBlock({ title, cards }: { title: string; cards: MiniCard[] }) {
  return (
    <div style={{ marginTop: 30, paddingTop: 26, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 16px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
          gap: 12,
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/carta/${c.id}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ aspectRatio: '63 / 88', background: 'rgba(255,255,255,0.02)' }}>
                {c.image_small && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_small}
                    alt={c.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                )}
              </div>
              <div style={{ padding: '7px 8px 9px' }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.set_name}
                  {c.number ? ` \u00b7 #${c.number}` : ''}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
