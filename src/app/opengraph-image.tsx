import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da home (1200x630). Mesma linguagem da
 * /cartas-graduadas: fundo escuro, brilho ambar/vermelho, titulo com um trecho
 * em ambar e as cartas que o proprio hero da home mostra.
 *
 * ★ NUNCA quebra: fonte, logo e cartas vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 *
 * Sem preco na imagem de proposito: preco muda todo dia e a imagem fica em
 * cache no WhatsApp/Instagram por semanas.
 */

export const alt = 'Bynx: quanto vale a sua coleção Pokémon, carta por carta, em reais'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

type CartaOg = { img: string | null; w: number; rot: number; left: number; top: number; brilho?: boolean }

function Carta({ c }: { c: CartaOg }) {
  const h = Math.round(c.w * 1.395)
  return (
    <div
      style={{
        position: 'absolute', left: c.left, top: c.top, width: c.w, height: h, display: 'flex',
        borderRadius: 14, overflow: 'hidden', transform: `rotate(${c.rot}deg)`,
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: c.brilho ? '0 30px 60px rgba(0,0,0,0.7), 0 0 60px rgba(245,158,11,0.55)' : '0 30px 60px rgba(0,0,0,0.7)',
        background: '#0b0d12',
      }}
    >
      {c.img && <img src={c.img} width={c.w} height={h} />}
    </div>
  )
}

export default async function Image() {
  const [f700, f900, logo, c1, c2, c3, c4] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(CARTA('ex8/107')),
    baixar(CARTA('swsh7/215')),
    baixar(CARTA('base1/4')),
    baixar(CARTA('ex6/108')),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  // Ordem do DOM decide quem fica por cima: as de tras primeiro, o Charizard por ultimo.
  const cartas: CartaOg[] = [
    { img: png(c1), w: 190, rot: -16, left: 738, top: 190 },
    { img: png(c4), w: 190, rot: 15, left: 1010, top: 195 },
    { img: png(c2), w: 208, rot: 7, left: 925, top: 135 },
    { img: png(c3), w: 236, rot: -4, left: 812, top: 110, brilho: true },
  ]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 76% 45%, rgba(245,158,11,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {cartas.map((c, i) => <Carta key={i} c={c} />)}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Quanto vale</span>
            <span>a sua coleção</span>
            <span style={{ color: '#f59e0b' }}>Pokémon?</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Carta por carta, em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
