import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { notFound } from 'next/navigation'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

/**
 * Imagem de compartilhamento de cada /pokemon/[name] (1200x630). Mesmo molde
 * do set/[id]/opengraph-image.tsx: nome e numero da Pokedex a esquerda; a arte
 * oficial do Pokemon ao fundo e a carta mais valiosa dele na frente. Sem preco
 * e sem contagem na imagem: ela fica dias em cache (aqui e no WhatsApp), o
 * og:title ja leva o numero atualizado.
 *
 * ★ CACHE: rota dinamica SEM ISR + Cache-Control s-maxage de 7 dias, igual ao
 * set. O ISR sozinho re-renderizava a cada request na Vercel (revert abfd3cb);
 * o header explicito foi provado no preview e em producao (95895b7).
 * NUNCA remover o header -- e ele que impede o render por request.
 *
 * ★ FALHA NUNCA VAI PARA O CACHE: erro de banco, fonte ou arte que existe mas
 * nao baixou lanca -- a request da 500 e o CDN nao guarda.
 *
 * ★ Formato: o satori so le PNG e JPEG, e WebP derruba a imagem inteira. Arte
 * em outro formato e descartada.
 *
 * Custo medido em 14/09: uma chamada a get_pokemon_hub, a mesma da page
 * (~2.170 blocos no pior caso, Pikachu). A lista de cartas (get_pokemon_hub_cards)
 * fica de fora de proposito.
 */

export const alt = 'Cartas do Pokémon no Pokémon TCG, na Bynx'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// 7 dias no CDN; depois disso serve a velha por mais 1 dia enquanto renova.
const CACHE_CONTROL_OG = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'

const ARTE_OFICIAL = (dex: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`
const AMBAR = '#f59e0b'

type HubOg = {
  name: string
  national_dex: number | null
  first_year: string | null
  last_year: string | null
  top_card_image: string | null
}

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`[og pokemon] ${r.status} ${url}`)
  return r.arrayBuffer()
}

/** data URI so para PNG/JPEG, pelos bytes (nao pela extensao nem pelo header). */
function dataUriSeSuportado(buf: ArrayBuffer | Buffer): string | null {
  const b = Buffer.from(buf as ArrayBuffer)
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  if (!png && !jpg) return null
  return `data:image/${png ? 'png' : 'jpeg'};base64,${b.toString('base64')}`
}

function tamanhoTitulo(nome: string): number {
  if (nome.length <= 10) return 96
  if (nome.length <= 16) return 80
  return 64
}

export default async function Image({ params }: { params: Promise<{ name: string }> }) {
  const { name: slug } = await params

  // Mesmo cliente da page (anon): herda o statement_timeout do papel, que e o
  // que protege o banco numa rajada de robo.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('[og pokemon] sem env do Supabase')
  const sb = createClient(url, anon)

  const { data, error } = await sb.rpc('get_pokemon_hub', { p_slug: slug })
  if (error) throw new Error(`[og pokemon] get_pokemon_hub: ${error.message}`)
  const hub = (data && data[0]) as HubOg | undefined
  if (!hub) notFound()

  const [f700, f900, logoBynx, arte, carta] = await Promise.all([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    hub.national_dex ? baixar(ARTE_OFICIAL(hub.national_dex)) : Promise.resolve(null),
    hub.top_card_image ? baixar(hub.top_card_image) : Promise.resolve(null),
  ])

  const logoBynxSrc = dataUriSeSuportado(logoBynx)
  const arteSrc = arte ? dataUriSeSuportado(arte) : null
  const cartaSrc = carta ? dataUriSeSuportado(carta) : null

  const eyebrow = hub.national_dex
    ? `POKÉMON TCG · Nº ${String(hub.national_dex).padStart(3, '0')}`
    : 'POKÉMON TCG'
  const anos = hub.first_year && hub.last_year && hub.first_year !== hub.last_year
    ? `Cartas de ${hub.first_year} a ${hub.last_year}`
    : null

  const CW = 250
  const CH = Math.round(CW * 1.395)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: 'DM Sans', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 50%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {arteSrc && (
          <img
            src={arteSrc}
            width={cartaSrc ? 540 : 580}
            height={cartaSrc ? 540 : 580}
            style={{ position: 'absolute', right: cartaSrc ? -40 : 20, top: cartaSrc ? -30 : 25, opacity: cartaSrc ? 0.5 : 1 }}
          />
        )}

        {cartaSrc && (
          <div
            style={{
              position: 'absolute', left: 820, top: 118, width: CW, height: CH, display: 'flex',
              borderRadius: 14, overflow: 'hidden', transform: 'rotate(5deg)',
              border: '1px solid rgba(255,255,255,0.22)', background: '#0b0d12',
              boxShadow: '0 30px 60px rgba(0,0,0,0.7), 0 0 60px rgba(245,158,11,0.5)',
            }}
          >
            <img src={cartaSrc} width={CW} height={CH} />
          </div>
        )}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoBynxSrc && <img src={logoBynxSrc} width={170} height={64} style={{ marginBottom: 34 }} />}
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 3, color: AMBAR, marginBottom: 14 }}>
            {eyebrow}
          </div>
          <div style={{ display: 'flex', fontSize: tamanhoTitulo(hub.name), fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: '#fff' }}>
            {hub.name}
          </div>
          {anos && (
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 22 }}>
              {anos}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: AMBAR, marginTop: 10 }}>
            Todas as cartas, com preço em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            {`bynx.gg/pokemon/${slug}`}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: { 'Cache-Control': CACHE_CONTROL_OG },
      fonts: [
        { name: 'DM Sans', data: f700, weight: 700, style: 'normal' },
        { name: 'DM Sans', data: f900, weight: 900, style: 'normal' },
      ],
    },
  )
}
