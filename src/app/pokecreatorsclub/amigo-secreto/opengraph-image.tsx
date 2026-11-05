import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento do Amigo Secreto (1200x630): e o que aparece
 * quando o organizador cola o link no grupo de WhatsApp. Logo do Poké
 * Creators Club, o titulo e as regras fixas (teto, anonimato). Sem data nem
 * contagem: o WhatsApp guarda a previa por semanas.
 *
 * Nunca quebra: se a fonte ou o logo falhar, a imagem sai sem eles.
 */

export const alt = 'Amigo Secreto do Poké Creators Club: troca de presentes entre criadores de Pokémon TCG'
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
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 82% 45%, rgba(245,158,11,0.28), rgba(8,10,15,0) 50%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.26), rgba(8,10,15,0) 45%)' }} />

        {/* Cartao virado: o objeto da sala */}
        <div style={{ position: 'absolute', left: 860, top: 110, width: 250, height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-8deg)', borderRadius: 22, border: '2px solid rgba(255,255,255,0.14)', background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 8px, rgba(255,255,255,0) 8px 20px), #0d0f14', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
          <div style={{ position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, display: 'flex', borderRadius: 14, border: '2px solid rgba(255,255,255,0.08)', background: '#0d0f14' }} />
          <div style={{ position: 'absolute', left: 28, top: 28, right: 28, bottom: 28, display: 'flex', borderRadius: 10, border: '2px dashed rgba(255,255,255,0.10)' }} />
          <div style={{ display: 'flex', fontSize: 96, fontWeight: 900, color: 'rgba(255,255,255,0.22)' }}>?</div>
        </div>

        <div style={{ position: 'absolute', left: 72, top: 70, width: 740, display: 'flex', flexDirection: 'column' }}>
          {logoSrc && <img src={logoSrc} alt="" width={300} height={149} style={{ objectFit: 'contain' }} />}
          <div style={{ display: 'flex', marginTop: 28, fontSize: 68, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2.5, color: '#f0f0f0' }}>Amigo Secreto</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, lineHeight: 1.25, color: 'rgba(255,255,255,0.72)', marginTop: 16 }}>Troca de presentes entre criadores de Pokémon TCG.</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
            {['Presente até R$ 100', 'Sorteio anônimo', 'Mural de recados'].map(t => (
              <div key={t} style={{ display: 'flex', padding: '12px 20px', borderRadius: 999, border: '2px solid rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: 22, fontWeight: 700 }}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 72, bottom: 44, display: 'flex', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>bynx.gg/pokecreatorsclub/amigo-secreto</div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
