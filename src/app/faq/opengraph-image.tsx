import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /faq (1200x630). Mesma familia visual da
 * /cartas-graduadas.
 *
 * Composicao: sanfona de perguntas reais da pagina, a primeira aberta, com o
 * Psyduck (o Pokemon da duvida) espiando atras.
 *
 * ★ NUNCA quebra: fonte, logo e arte vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 * ★ PERGUNTAS espelha o array `faqs` da page.tsx (nao exportado). Se a
 * pergunta mudar la, mudar aqui -- ou exportar e importar.
 */

export const alt = 'Perguntas frequentes da Bynx: coleção, scan por foto, preços em reais e marketplace'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const ARTE_PSYDUCK = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/54.png'
const AMBAR = '#f59e0b'

const PERGUNTAS = [
  'De onde vêm os preços das cartas?',
  'É grátis? Tem plano pago?',
  'Como funciona o scanner por foto?',
  'Como funciona o Marketplace?',
  'Posso exportar minha coleção?',
]

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo, arte] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(ARTE_PSYDUCK),
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
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 80% 45%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />
        {/* Psyduck espiando por tras da primeira pergunta (as linhas sao opacas) */}
        {arteSrc && <img src={arteSrc} width={250} height={250} style={{ position: 'absolute', right: 34, top: 2, opacity: 0.95 }} />}

        <div style={{ position: 'absolute', left: 650, top: 168, width: 500, display: 'flex', flexDirection: 'column' }}>
          {PERGUNTAS.map((q, i) => {
            const aberta = i === 0
            return (
              <div
                key={q}
                style={{
                  display: 'flex', flexDirection: 'column', marginBottom: 12, padding: aberta ? '20px 22px' : '15px 22px', borderRadius: 16,
                  background: aberta ? 'linear-gradient(160deg, #2a2112, #12141a)' : '#12141a',
                  border: aberta ? '1px solid rgba(245,158,11,0.55)' : '1px solid rgba(255,255,255,0.10)',
                  boxShadow: aberta ? '0 0 45px rgba(245,158,11,0.28)' : '0 14px 30px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: aberta ? '#fff' : 'rgba(255,255,255,0.82)' }}>{q}</div>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                    {aberta
                      ? <path d="M4 10h12" stroke={AMBAR} strokeWidth="2.2" strokeLinecap="round" />
                      : <path d="M10 4v12M4 10h12" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />}
                  </svg>
                </div>
                {aberta && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
                    <div style={{ display: 'flex', width: 420, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.20)', marginBottom: 10 }} />
                    <div style={{ display: 'flex', width: 380, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.20)', marginBottom: 10 }} />
                    <div style={{ display: 'flex', width: 250, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.20)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Perguntas</span>
            <span style={{ color: AMBAR }}>frequentes</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3, flexDirection: 'column' }}>
            <span>Tudo o que você precisa saber</span>
            <span>sobre a Bynx</span>
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/faq
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
