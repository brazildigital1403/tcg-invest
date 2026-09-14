import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /privacidade (1200x630). Pagina legal: sobria,
 * tipografia + o IconShield do Icons.tsx (mesmo path, ampliado) e tres temas
 * reais da Politica. Acento do APP (a pagina usa #f59e0b no rotulo e no aviso).
 *
 * ★ Sem data de atualizacao e sem numero de secao: mudam a cada revisao.
 * ★ NUNCA quebra: fonte e logo falham para "sem fonte"/"sem logo".
 */

export const alt = 'Política de Privacidade da Bynx: como seus dados pessoais são tratados conforme a LGPD'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

const TEMAS = ['Dados que coletamos', 'Seus direitos', 'Segurança']

export default async function Image() {
  const [f700, f900, logo] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
  ])
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const l = ok(logo)
  const logoSrc = l ? `data:image/png;base64,${Buffer.from(l).toString('base64')}` : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 40%, rgba(245,158,11,0.22), rgba(8,10,15,0) 46%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 100%, rgba(239,68,68,0.14), rgba(8,10,15,0) 42%)' }} />

        {/* Escudo: path do IconShield (viewBox 20x20) */}
        <div style={{ position: 'absolute', left: 770, top: 60, width: 340, height: 340, display: 'flex' }}>
          <svg width={340} height={340} viewBox="0 0 20 20" fill="none">
            <path d="M10 2l6.5 2.5v5C16.5 13.5 13.5 17 10 18 6.5 17 3.5 13.5 3.5 9.5v-5L10 2z" fill="rgba(245,158,11,0.07)" stroke={AMBAR} strokeWidth={0.7} strokeLinejoin="round" />
            <path d="M7 10l2 2 4-4" stroke={AMBAR} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div style={{ position: 'absolute', left: 752, top: 428, width: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {TEMAS.map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.8)', padding: '8px 18px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 4, background: AMBAR, marginRight: 10 }} />
              {t}
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: AMBAR, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>Documento legal</div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 88, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Política de</span>
            <span style={{ color: AMBAR }}>Privacidade</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Como a Bynx coleta, usa e protege seus dados pessoais, conforme a LGPD
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/privacidade
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
