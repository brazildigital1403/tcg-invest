import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /scan-ia (1200x630). Linguagem da
 * /cartas-graduadas; a direita, a moldura da camera com as 3 cartas que o
 * mockup do hero da pagina reconhece (Charizard ex, Umbreon ex, Mew ex).
 *
 * ★ NUNCA quebra: fonte, logo e cartas vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 *
 * Sem preco, sem "% de confianca" e sem limite de cartas por foto: nenhum
 * desses numeros tem constante no codigo, e a imagem fica semanas em cache.
 */

export const alt = 'Scan IA da Bynx: aponte a câmera e a IA reconhece as suas cartas Pokémon TCG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const AMBAR = '#f59e0b'
const VERDE = '#22c55e'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Cantoneira da moldura da camera: dois tracos em L.
function Canto({ left, top, rot }: { left: number; top: number; rot: number }) {
  return (
    <div style={{ position: 'absolute', left, top, width: 56, height: 56, display: 'flex', transform: `rotate(${rot}deg)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 56, height: 6, borderRadius: 3, background: AMBAR, display: 'flex' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 6, height: 56, borderRadius: 3, background: AMBAR, display: 'flex' }} />
    </div>
  )
}

// Check em div (L girado): o <svg> sumia na carta inclinada pra direita.
function Check() {
  return (
    <div style={{ display: 'flex', width: 7, height: 13, marginRight: 9, marginBottom: 3, borderRight: '3px solid #0a0a0a', borderBottom: '3px solid #0a0a0a', transform: 'rotate(45deg)' }} />
  )
}

export default async function Image() {
  const [f700, f900, logo, c1, c2, c3] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    // O hero da pagina aponta sv8/199 como "Charizard ex Surging Sparks", mas
    // essa imagem e o Spheal. Aqui vai a SIR de Surging Sparks que a Pokedex usa.
    baixar(CARTA('sv8/238')),
    baixar(CARTA('sv8pt5/161')),
    baixar(CARTA('sv4pt5/232')),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  // Moldura: x 668..1168, y 95..535. Cartas lado a lado dentro dela.
  const MX = 682, MY = 95, MW = 490, MH = 440
  const cartas = [
    { img: png(c1), left: MX + 30, top: MY + 110, rot: -6 },
    { img: png(c2), left: MX + 172, top: MY + 86, rot: 0 },
    { img: png(c3), left: MX + 314, top: MY + 110, rot: 6 },
  ]
  const CW = 150, CH = 209

  return (
    new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 76% 48%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

          {/* Area da camera */}
          <div style={{ position: 'absolute', left: MX, top: MY, width: MW, height: MH, display: 'flex', borderRadius: 26, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }} />

          {cartas.map((c, i) => (
            <div key={i} style={{ position: 'absolute', left: c.left, top: c.top, width: CW, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `rotate(${c.rot}deg)` }}>
              <div style={{ display: 'flex', width: CW, height: CH, borderRadius: 10, overflow: 'hidden', border: `2px solid ${VERDE}`, boxShadow: '0 24px 50px rgba(0,0,0,0.7)', background: '#0b0d12' }}>
                {c.img && <img src={c.img} width={CW} height={CH} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: -16, padding: '5px 13px 5px 10px', borderRadius: 99, background: VERDE, color: '#0a0a0a', fontSize: 15, fontWeight: 900 }}>
                <Check />
                Reconhecida
              </div>
            </div>
          ))}

          {/* Linha de varredura */}
          <div style={{ position: 'absolute', left: MX + 24, top: MY + 200, width: MW - 48, height: 4, display: 'flex', borderRadius: 2, background: AMBAR, boxShadow: '0 0 24px rgba(245,158,11,0.9), 0 0 60px rgba(245,158,11,0.6)' }} />

          <Canto left={MX - 4} top={MY - 4} rot={0} />
          <Canto left={MX + MW - 52} top={MY - 4} rot={90} />
          <Canto left={MX + MW - 52} top={MY + MH - 52} rot={180} />
          <Canto left={MX - 4} top={MY + MH - 52} rot={270} />

          <div style={{ position: 'absolute', left: MX + 150, top: MY + 22, display: 'flex', alignItems: 'center', padding: '7px 16px', borderRadius: 99, background: 'rgba(8,10,15,0.85)', border: '1px solid rgba(245,158,11,0.45)', color: '#fff', fontSize: 17, fontWeight: 700 }}>
            <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 99, background: VERDE, marginRight: 9 }} />
            3 cartas em 1 foto
          </div>

          <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 64, fontWeight: 900, lineHeight: 1, letterSpacing: -2.5, color: '#fff' }}>
              <span>Aponte.</span>
              <span>A IA reconhece.</span>
              <span style={{ color: AMBAR }}>A coleção atualiza.</span>
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
              Várias cartas por foto, em PT, EN e JP, com preço em reais
            </div>
            <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
              bynx.gg/scan-ia
            </div>
          </div>
        </div>
      ),
      { ...size, fonts: fontes },
    )
  )
}
