import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /para-lojistas (1200x630). Mesma estrutura da
 * /cartas-graduadas, mas no acento da LOJA (azul -> roxo): e o acento que a
 * propria pagina renderiza (.pl-root sobrescreve --ac-1/--ac-2). O logo segue
 * nas cores da marca.
 *
 * ★ NUNCA quebra: fonte, logo e cartas vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 *
 * Sem contagem de lojas, sem nota e sem preco de plano: a contagem vem do
 * banco e muda, e a imagem fica semanas em cache nas redes.
 */

export const alt = 'Bynx para lojistas: a sua loja Pokémon TCG online, com vitrine, checkout e frete calculado'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
// Acento da loja, os mesmos valores do .pl-root da pagina e do minha-loja/layout.
const AZUL = '#60a5fa'
const ROXO = '#a855f7'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

function Check({ cor }: { cor: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ marginRight: 8 }}>
      <path d="M16.5 6.5L8 15l-4.5-4.5" stroke={cor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default async function Image() {
  // Hero da pagina: 4 cartas flutuando (HERO_FLOAT) + 3 na vitrine (STORE_MINI).
  const [f700, f900, logo, h1, h2, h3, h4, m1, m2, m3] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(CARTA('ex8/107')),
    baixar(CARTA('base1/4')),
    baixar(CARTA('swsh7/215')),
    baixar(CARTA('ex6/108')),
    baixar(CARTA('ex6/104')),
    baixar(CARTA('ecard2/149')),
    baixar(CARTA('svp/85')),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const flutuando = [
    { img: png(h1), left: 720, top: 40, rot: -14 },
    { img: png(h2), left: 1010, top: 28, rot: 12 },
    { img: png(h3), left: 700, top: 372, rot: 10 },
    { img: png(h4), left: 1030, top: 380, rot: -10 },
  ]
  const vitrine = [png(m1), png(m2), png(m3)]
  const FW = 150, FH = 209

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 80% 30%, rgba(168,85,247,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 70% 100%, rgba(96,165,250,0.26), rgba(8,10,15,0) 50%)' }} />

        {flutuando.map((c, i) => (
          <div key={i} style={{ position: 'absolute', left: c.left, top: c.top, width: FW, height: FH, display: 'flex', borderRadius: 11, overflow: 'hidden', transform: `rotate(${c.rot}deg)`, opacity: 0.85, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 24px 50px rgba(0,0,0,0.7)', background: '#0b0d12' }}>
            {c.img && <img src={c.img} width={FW} height={FH} />}
          </div>
        ))}

        {/* Card da loja, como no hero da pagina */}
        <div
          style={{
            position: 'absolute', left: 742, top: 150, width: 400, display: 'flex', flexDirection: 'column', padding: 20,
            borderRadius: 22, background: 'rgba(13,15,20,0.96)', border: '1px solid rgba(96,165,250,0.5)',
            boxShadow: `0 40px 80px rgba(0,0,0,0.75), 0 0 70px rgba(168,85,247,0.35)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', width: 52, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e3a8a, #7c3aed)', color: '#fff', fontSize: 24, fontWeight: 900, marginRight: 14 }}>L</div>
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <div style={{ display: 'flex', fontSize: 23, fontWeight: 900, color: '#fff' }}>Sua loja</div>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Vitrine online na Bynx</div>
            </div>
            <div style={{ display: 'flex', fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: ROXO, padding: '5px 11px', borderRadius: 99, background: 'rgba(168,85,247,0.16)', border: '1px solid rgba(168,85,247,0.4)' }}>Premium</div>
          </div>
          <div style={{ display: 'flex', marginBottom: 16 }}>
            {vitrine.map((src, i) => (
              <div key={i} style={{ display: 'flex', width: 113, height: 158, marginRight: i < 2 ? 10 : 0, borderRadius: 9, overflow: 'hidden', background: '#0b0d12', border: '1px solid rgba(255,255,255,0.1)' }}>
                {src && <img src={src} width={113} height={158} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>
            <Check cor={AZUL} />Checkout com frete calculado
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
            <Check cor={AZUL} />Cartas e produtos na mesma vitrine
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Sua loja Pokémon</span>
            <span style={{ color: AZUL }}>completa,</span>
            <span style={{ color: AZUL }}>online.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Vitrine, checkout com frete e o cliente que a Bynx traz para você
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/para-lojistas
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
