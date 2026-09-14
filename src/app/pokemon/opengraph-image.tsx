import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento do /pokemon (1200x630), indice de todos os
 * Pokemon no TCG. Mesma familia visual da /cartas-graduadas.
 *
 * Composicao: o mesmo Pokemon atravessando as eras -- tres cartas do Pikachu
 * subindo numa linha do tempo (1999, 2020, 2024), com a arte oficial atras.
 * E a promessa do H1: cada Pokemon, todas as cartas dele.
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, a carta
 * some da linha do tempo em vez de derrubar a rota ou o build.
 * ★ Sem "1025" na imagem: o title cravou, mas a imagem nao repete numero que
 * muda com geracao nova.
 */

export const alt = 'Todos os Pokémon no TCG na Bynx: as cartas de cada Pokémon através das eras'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const ARTE_PIKACHU = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Base Set (1999), Vivid Voltage (2020), Surging Sparks (2024).
const ERAS = [
  { id: 'base1/58', ano: '1999', left: 640, top: 250 },
  { id: 'swsh4/188', ano: '2020', left: 820, top: 180 },
  { id: 'sv8/238', ano: '2024', left: 1000, top: 110 },
]
const W = 168
const H = 234

export default async function Image() {
  const [f700, f900, logo, arte, ...cartas] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(ARTE_PIKACHU),
    ...ERAS.map(e => baixar(CARTA(e.id))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)
  const arteSrc = png(arte)
  const LINHA_Y = 548

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 80% 40%, rgba(245,158,11,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 60% 100%, rgba(239,68,68,0.24), rgba(8,10,15,0) 45%)' }} />
        {arteSrc && <img src={arteSrc} width={520} height={520} style={{ position: 'absolute', right: -60, top: -80, opacity: 0.32 }} />}

        {/* Linha do tempo */}
        <div style={{ position: 'absolute', left: 640, top: LINHA_Y, width: 560, height: 3, display: 'flex', background: 'linear-gradient(90deg, rgba(245,158,11,0.15), #f59e0b, #ef4444)' }} />

        {ERAS.map((e, i) => {
          const img = png(cartas[i])
          const cx = e.left + W / 2
          return (
            <div key={e.id} style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex' }}>
              {/* haste da carta ate a linha */}
              <div style={{ position: 'absolute', left: cx - 1, top: e.top + H, width: 2, height: LINHA_Y - e.top - H, display: 'flex', background: 'rgba(245,158,11,0.45)' }} />
              <div style={{ position: 'absolute', left: cx - 9, top: LINHA_Y - 8, width: 18, height: 18, borderRadius: 99, display: 'flex', background: i === 2 ? AMBAR : '#080a0f', border: `3px solid ${AMBAR}` }} />
              <div style={{ position: 'absolute', left: cx - 50, top: LINHA_Y + 18, width: 100, display: 'flex', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: i === 2 ? AMBAR : 'rgba(255,255,255,0.8)' }}>{e.ano}</div>
              <div
                style={{
                  position: 'absolute', left: e.left, top: e.top, width: W, height: H, display: 'flex', borderRadius: 10,
                  boxShadow: i === 2 ? '0 24px 50px rgba(0,0,0,0.6), 0 0 60px rgba(245,158,11,0.5)' : '0 24px 50px rgba(0,0,0,0.6)',
                }}
              >
                {img && <img src={img} width={W} height={H} style={{ borderRadius: 10 }} />}
              </div>
            </div>
          )
        })}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Todos os</span>
            <span>Pokémon</span>
            <span style={{ color: AMBAR }}>no TCG</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            De Kanto a Paldea, as cartas de cada um e a mais valiosa
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/pokemon
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
