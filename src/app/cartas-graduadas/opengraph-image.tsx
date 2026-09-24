import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GRADUADORA_MAP, notaCurta, tierNome } from '@/lib/graduadoras'

/**
 * Imagem de compartilhamento da /cartas-graduadas (1200x630), aprovada pelo Du
 * no mockup v2. Gerada pelo Next a partir deste arquivo: muda junto com a
 * pagina, sem exportar imagem a mao.
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora (Google Fonts, catalogo de
 * cartas, arte oficial). Se alguma falhar, a imagem sai sem ela -- a fonte cai
 * na padrao, a carta some do slab -- em vez de derrubar a rota ou o build.
 *
 * Limites do gerador (satori): so flexbox, sem grid, sem variavel CSS, sem
 * texto em gradiente confiavel. Por isso a palavra de destaque e ambar solido.
 */

export const alt = 'Cartas Pokémon graduadas na Bynx: slabs PSA 10, BGS Black Label e Capy 9.5'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const ARTE_CHARIZARD = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png'
const OURO = '#e8c878'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

type SlabOg = { g: string; n: number; bl?: boolean; img: string | null; rot: number; left: number; top: number; z: number }

function Slab({ s }: { s: SlabOg }) {
  const g = GRADUADORA_MAP[s.g]
  const bl = !!s.bl
  const top = bl || s.n >= 10
  const cor = bl ? '#0a0a0a' : g.cor
  const brilho = bl ? 'rgba(232,200,120,0.55)' : cor
  return (
    <div
      style={{
        position: 'absolute', left: s.left, top: s.top, zIndex: s.z,
        width: 208, display: 'flex', flexDirection: 'column', padding: 11, borderRadius: 18,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))',
        border: `1px solid ${bl ? 'rgba(232,200,120,0.6)' : 'rgba(255,255,255,0.28)'}`,
        boxShadow: top ? `0 30px 60px rgba(0,0,0,0.65), 0 0 50px ${brilho}` : '0 30px 60px rgba(0,0,0,0.65)',
        transform: `rotate(${s.rot}deg)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cor, borderRadius: 10, padding: '8px 12px', marginBottom: 9, color: bl ? OURO : '#fff' }}>
        <div style={{ display: 'flex', fontSize: 19, fontWeight: 900, letterSpacing: 1 }}>{g.curto}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{notaCurta(s.n, bl)}</div>
          <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>{tierNome(s.g, s.n, bl)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', background: '#0b0d12', borderRadius: 10, padding: 8, width: 186, height: 262 }}>
        {s.img && <img src={s.img} width={170} height={237} style={{ borderRadius: 7 }} />}
      </div>
    </div>
  )
}

export default async function Image() {
  const [f700, f900, logo, arte, c1, c2, c3] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(ARTE_CHARIZARD),
    baixar(CARTA('swsh7/215')),
    baixar(CARTA('sv3pt5/199')),
    baixar(CARTA('swsh4/188')),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const arteSrc = png(arte)
  const slabs: SlabOg[] = [
    { g: 'bgs', n: 10, bl: true, img: png(c1), rot: -10, left: 676, top: 150, z: 1 },
    { g: 'psa', n: 10, img: png(c2), rot: 0, left: 836, top: 118, z: 3 },
    { g: 'capy', n: 9.5, img: png(c3), rot: 10, left: 986, top: 160, z: 2 },
  ]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 45%, rgba(245,158,11,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />
        {arteSrc && <img src={arteSrc} width={540} height={540} style={{ position: 'absolute', right: -30, top: -40, opacity: 0.5 }} />}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Cartas Pokémon</span>
            <span style={{ color: '#f59e0b' }}>graduadas</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Notas, subnotas, Black Label e as {Object.keys(GRADUADORA_MAP).length} graduadoras
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/cartas-graduadas
          </div>
        </div>

        {slabs.map(s => <Slab key={s.g + s.n} s={s} />)}
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
