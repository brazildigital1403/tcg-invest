import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da casa do Poké Creators Club (1200x630). Sem data
 * nem contagem: o WhatsApp guarda a previa por semanas. Nunca quebra: se a fonte
 * ou o logo falhar, a imagem sai sem eles.
 */

export const alt = 'Poké Creators Club: o que o grupo faz junto, em um lugar só'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'amigo-secreto', 'poke-creators-club.png')),
  ])
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoBuf = ok(logo)
  const logoSrc = logoBuf ? `data:image/png;base64,${Buffer.from(logoBuf).toString('base64')}` : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined }}>
        {logoSrc && <img src={logoSrc} alt="" width={340} height={169} style={{ objectFit: 'contain' }} />}
        <div style={{ display: 'flex', marginTop: 32, fontSize: 72, fontWeight: 900, letterSpacing: -2.5, color: '#f0f0f0' }}>A casa do Club</div>
        <div style={{ display: 'flex', marginTop: 16, fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>O que o grupo faz junto, em um lugar só.</div>
        <div style={{ display: 'flex', marginTop: 44, fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>bynx.gg/pokecreatorsclub</div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
