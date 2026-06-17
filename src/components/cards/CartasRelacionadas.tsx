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
    <section
      style={{ width: '100%', maxWidth: 1000, alignSelf: 'center', padding: '8px 16px 56px' }}
    >
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
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: '#0f1115' }}>{title}</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
          gap: 14,
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
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <div style={{ aspectRatio: '63 / 88', background: '#f3f4f6' }}>
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
              <div style={{ padding: '8px 8px 10px' }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#111827',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
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
