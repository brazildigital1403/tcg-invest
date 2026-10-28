import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /criadores (1200x630), a que aparece quando o
 * link do convite e colado no WhatsApp. Repete o hero da pagina: lockup
 * "Creator Bynx" e o trio do Base Set com o Charizard no slab PSA 10.
 *
 * ★ NUNCA quebra: logo e cartas vem de fora. Se alguma falhar, a imagem sai
 * sem ela em vez de derrubar o build.
 *
 * Sem "restam N convites": o WhatsApp guarda a previa por semanas, e o
 * numero que muda fica so na pagina.
 */

export const alt = 'Creator Bynx: 1 ano de Bynx Pro para criadores de Pokémon TCG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (n: number) => `https://images.pokemontcg.io/base1/${n}_hires.png`

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo, pika, mew, zard] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(CARTA(58)),
    baixar(CARTA(10)),
    baixar(CARTA(4)),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const pikaSrc = png(pika)
  const mewSrc = png(mew)
  const zardSrc = png(zard)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 80% 48%, rgba(245,158,11,0.30), rgba(8,10,15,0) 52%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 96% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {/* Trio do Base Set: Pikachu e Mewtwo nas laterais, Charizard no slab */}
        <div style={{ position: 'absolute', left: 700, top: 150, display: 'flex', transform: 'rotate(-9deg)' }}>
          {pikaSrc && <img src={pikaSrc} width={190} height={265} style={{ borderRadius: 10, boxShadow: '0 30px 60px rgba(0,0,0,0.65)' }} />}
        </div>
        <div style={{ position: 'absolute', left: 1000, top: 120, display: 'flex', transform: 'rotate(9deg)' }}>
          {mewSrc && <img src={mewSrc} width={190} height={265} style={{ borderRadius: 10, boxShadow: '0 30px 60px rgba(0,0,0,0.65)' }} />}
        </div>
        <div
          style={{
            position: 'absolute', left: 805, top: 70, width: 250, display: 'flex', flexDirection: 'column', padding: 12,
            borderRadius: 16, background: 'rgba(30,33,40,0.96)', border: '2px solid rgba(255,255,255,0.22)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 70px rgba(239,68,68,0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: '#dc2626', marginBottom: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 18, fontWeight: 900, color: '#fff' }}>PSA</div>
              <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Charizard</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>10</div>
              <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>GEM MINT</div>
            </div>
          </div>
          <div style={{ display: 'flex', width: 226, height: 315, borderRadius: 8, overflow: 'hidden', background: '#0b0d12' }}>
            {zardSrc && <img src={zardSrc} width={226} height={315} />}
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={180} height={68} style={{ marginBottom: 26 }} />}
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#f59e0b', marginBottom: 10 }}>
            Convite para criadores
          </div>
          <div style={{ display: 'flex', fontSize: 104, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4, color: '#fff' }}>
            <span>Creator&nbsp;</span>
            <span style={{ backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444)', backgroundClip: 'text', color: 'transparent' }}>Bynx</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 38, fontWeight: 900, lineHeight: 1.12, letterSpacing: -1, color: '#fff', marginTop: 22 }}>
            <span>1 ano de Bynx Pro grátis</span>
            <span style={{ color: 'rgba(255,255,255,0.72)' }}>para a sua coleção.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 30 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(245,158,11,0.55)', background: 'rgba(245,158,11,0.10)', marginRight: 12 }}>
              Sem cartão
            </div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
              100 convites até 06/11
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
