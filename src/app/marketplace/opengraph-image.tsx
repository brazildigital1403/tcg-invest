import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento do /marketplace (1200x630). Mesma familia visual
 * da /cartas-graduadas.
 *
 * Composicao: tres anuncios da vitrine em cascata -- carta, selo "abaixo do
 * mercado" e o botao "Tenho interesse", que sao os rotulos reais do card.
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, o anuncio
 * sai sem a carta em vez de derrubar a rota ou o build.
 * ★ Sem preco e sem nome de vendedor: o anuncio da imagem nao existe, e preco
 * cravado envelhece. O valor fica como barra neutra.
 */

export const alt = 'Mercado da Bynx: cartas Pokémon à venda de colecionador para colecionador'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Ordem do DOM decide quem fica por cima: o do meio vem por ultimo.
const ANUNCIOS = [
  { id: 'sv4pt5/232', left: 628, top: 118, rot: -8, selo: false },
  { id: 'sv8pt5/149', left: 968, top: 118, rot: 8, selo: false },
  { id: 'sv8pt5/161', left: 798, top: 70, rot: 0, selo: true },
]

function Anuncio({ img, selo }: { img: string | null; selo: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 220, padding: 11, borderRadius: 18, background: '#0d0f14', border: selo ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.14)', boxShadow: selo ? '0 30px 60px rgba(0,0,0,0.7), 0 0 55px rgba(245,158,11,0.45)' : '0 30px 60px rgba(0,0,0,0.7)' }}>
      <div style={{ position: 'relative', display: 'flex', width: 198, height: 276 }}>
        {img && <img src={img} width={198} height={276} style={{ borderRadius: 10 }} />}
        {selo && (
          <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', fontSize: 14, fontWeight: 900, color: '#000', padding: '5px 10px', borderRadius: 99, background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            abaixo do mercado
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 11 }}>
        <div style={{ display: 'flex', width: 26, height: 26, borderRadius: 99, background: 'rgba(255,255,255,0.14)', marginRight: 8 }} />
        <div style={{ display: 'flex', width: 90, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.18)' }} />
      </div>
      <div style={{ display: 'flex', width: 120, height: 16, borderRadius: 99, marginTop: 10, background: selo ? 'rgba(245,158,11,0.55)' : 'rgba(255,255,255,0.22)' }} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, padding: '10px 0', borderRadius: 11, fontSize: 17, fontWeight: 900, color: selo ? '#000' : '#fff', background: selo ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.08)' }}>
        Tenho interesse
      </div>
    </div>
  )
}

export default async function Image() {
  const [f700, f900, logo, ...cartas] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...ANUNCIOS.map(a => baixar(CARTA(a.id))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 76% 45%, rgba(245,158,11,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.30), rgba(8,10,15,0) 45%)' }} />

        {ANUNCIOS.map((a, i) => (
          <div key={a.id} style={{ position: 'absolute', left: a.left, top: a.top, display: 'flex', transform: `rotate(${a.rot}deg)` }}>
            <Anuncio img={png(cartas[i])} selo={a.selo} />
          </div>
        ))}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Compre e</span>
            <span>venda cartas</span>
            <span style={{ color: AMBAR }}>Pokémon</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            De colecionador para colecionador, comparado ao preço de mercado
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/marketplace
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
