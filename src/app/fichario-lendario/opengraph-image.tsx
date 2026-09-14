import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PAGINAS_LENDARIAS, imgDaCarta } from '@/lib/paginas-lendarias'

/**
 * Imagem de compartilhamento da /fichario-lendario (1200x630). Linguagem da
 * /cartas-graduadas; a direita, a pagina gratis (Moonbreon) com a grade dos 9
 * bolsos e a Umbreon VMAX encaixada no centro -- o momento que vende o produto.
 *
 * Substitui a og antiga (moonbreon.webp), que dava 404: o arquivo real se chama
 * moonbreon-lp.webp.
 *
 * ★ NUNCA quebra: fonte, logo, arte e carta vem de fora ou do disco. Se alguma
 * falhar, a imagem sai sem ela em vez de derrubar a rota ou o build.
 *
 * ★ O satori NAO le webp (quebra a imagem inteira, nao so o <img>). Por isso a
 * arte vem de `<id>-og.jpg`, copia em jpeg do `<id>-lp.webp` exportada a mao.
 * Trocou a pagina gratis? Exportar o jpg dela, senao a folha sai sem a arte.
 */

export const alt = 'Fichário Lendário da Bynx: a arte da carta continua pelos 9 bolsos do fichário'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const AMBAR = '#f59e0b'

// A pagina gratis e a amostra do produto (a mesma que o hero abre primeiro).
const PAGINA = PAGINAS_LENDARIAS.find(p => p.gratis) ?? PAGINAS_LENDARIAS[0]
const HEROI = PAGINA.cartas.find(c => c.heroi) ?? PAGINA.cartas[0]

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo, arte, carta] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    readFile(join(process.cwd(), 'public', 'paginas-lendarias', `${PAGINA.id}-og.jpg`)),
    baixar(imgDaCarta(HEROI)),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const arteSrc = ok(arte) ? dataUri(ok(arte) as Buffer, 'image/jpeg') : null
  const cartaSrc = png(carta)

  // Folha 760x1018 reduzida pela metade; bolso central = celula do meio.
  const FW = 390, FH = 522
  const CEL_W = FW / 3, CEL_H = FH / 3
  const CW = 118, CH = 165
  const linha = 'rgba(255,255,255,0.7)'

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 45%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        <div
          style={{
            position: 'absolute', left: 738, top: 54, width: FW, height: FH, display: 'flex',
            borderRadius: 16, overflow: 'hidden', background: '#0b0d12', transform: 'rotate(3deg)',
            border: '1px solid rgba(245,158,11,0.45)', boxShadow: '0 40px 80px rgba(0,0,0,0.75), 0 0 70px rgba(245,158,11,0.25)',
          }}
        >
          {arteSrc && <img src={arteSrc} width={FW} height={FH} style={{ position: 'absolute', left: 0, top: 0 }} />}
          {/* Grade dos 9 bolsos */}
          <div style={{ position: 'absolute', left: CEL_W, top: 0, width: 2, height: FH, background: linha, display: 'flex' }} />
          <div style={{ position: 'absolute', left: CEL_W * 2, top: 0, width: 2, height: FH, background: linha, display: 'flex' }} />
          <div style={{ position: 'absolute', left: 0, top: CEL_H, width: FW, height: 2, background: linha, display: 'flex' }} />
          <div style={{ position: 'absolute', left: 0, top: CEL_H * 2, width: FW, height: 2, background: linha, display: 'flex' }} />
          {/* Carta encaixada no bolso do meio */}
          <div
            style={{
              position: 'absolute', left: CEL_W + (CEL_W - CW) / 2 + 1, top: CEL_H + (CEL_H - CH) / 2 + 1, width: CW, height: CH,
              display: 'flex', borderRadius: 7, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: '0 0 26px rgba(245,158,11,0.6)', background: '#0b0d12',
            }}
          >
            {cartaSrc && <img src={cartaSrc} width={CW} height={CH} />}
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>A arte da carta</span>
            <span style={{ color: AMBAR }}>não precisa</span>
            <span>acabar na borda.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            A ilustração continua pelos 9 bolsos
          </div>
          <div style={{ display: 'flex', marginTop: 30 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)', marginRight: 12 }}>
              bynx.gg/fichario-lendario
            </div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: AMBAR, padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.10)' }}>
              Primeira página grátis
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
