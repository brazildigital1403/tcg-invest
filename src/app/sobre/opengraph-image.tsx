import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /sobre (1200x630). Linguagem da
 * /cartas-graduadas. A pagina e so texto (sem arte), entao a direita vai o que
 * ela lista em "O que oferecemos", em 4 blocos com os icones outline da casa,
 * sobre a arte oficial do Pikachu apagada ao fundo.
 *
 * ★ NUNCA quebra: fonte, logo e arte vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 */

export const alt = 'Quem somos: a Bynx é a plataforma brasileira de Pokémon TCG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const ARTE_PIKACHU = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Tracos outline dos icones da home (mesmo desenho, stroke em ambar).
const ICONES: Record<string, string[]> = {
  colecao: ['M4 4h16v16H4z', 'M8 9h8', 'M8 13h5'],
  preco: ['M4 19V5', 'M4 19h16', 'M8 15l3-4 3 2 4-6'],
  scan: ['M4 8V6a2 2 0 0 1 2-2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M20 16v2a2 2 0 0 1-2 2h-2', 'M8 20H6a2 2 0 0 1-2-2v-2', 'M8.5 9.5h7v5h-7z'],
  mercado: ['M6 7h12l-1 13H7z', 'M9 7a3 3 0 0 1 6 0'],
}

function Icone({ nome }: { nome: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      {ICONES[nome].map(d => <path key={d} d={d} stroke={AMBAR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  )
}

const PILARES = [
  { icone: 'colecao', t: 'Coleção', d: 'Carta por carta' },
  { icone: 'preco', t: 'Preço em reais', d: 'Mercado Brasileiro' },
  { icone: 'scan', t: 'ScanIA', d: 'Pela foto da carta' },
  { icone: 'mercado', t: 'Marketplace', d: 'Compra e venda' },
]

export default async function Image() {
  const [f700, f900, logo, arte] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(ARTE_PIKACHU),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const arteSrc = png(arte)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 45%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />
        {arteSrc && <img src={arteSrc} width={520} height={520} style={{ position: 'absolute', right: -40, top: -30, opacity: 0.35 }} />}

        <div style={{ position: 'absolute', left: 672, top: 0, height: 630, width: 496, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {[0, 1].map(l => (
            <div key={l} style={{ display: 'flex', marginBottom: l === 0 ? 16 : 0 }}>
              {PILARES.slice(l * 2, l * 2 + 2).map((p, i) => (
                <div key={p.t} style={{ display: 'flex', flexDirection: 'column', width: 240, height: 186, marginRight: i === 0 ? 16 : 0, padding: 22, borderRadius: 20, background: 'rgba(13,15,20,0.88)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 60px rgba(0,0,0,0.55)' }}>
                  <div style={{ display: 'flex', width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', marginBottom: 18 }}>
                    <Icone nome={p.icone} />
                  </div>
                  <div style={{ display: 'flex', fontSize: 23, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{p.t}</div>
                  <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{p.d}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>A plataforma</span>
            <span>brasileira de</span>
            <span style={{ color: AMBAR }}>Pokémon TCG</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Para quem coleciona, investe e vende cartas no Brasil
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/sobre
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
