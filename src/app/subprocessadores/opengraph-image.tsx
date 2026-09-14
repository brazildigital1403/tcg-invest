import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /subprocessadores (1200x630). Pagina legal e
 * noindex: sobria, tipografia + a tabela da pagina em esqueleto, com os 3
 * grupos reais e SEM nome de fornecedor (a imagem circula fora da pagina e a
 * lista muda; nome e contagem ficam so no documento).
 * Acento do APP (a pagina usa #f59e0b no rotulo "Documento legal").
 */

export const alt = 'Subprocessadores da Bynx: fornecedores que tratam dados pessoais a serviço da plataforma'
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

// Titulos dos 3 <Grupo> da pagina. Linhas sao esqueleto, nao dado.
const GRUPOS: { titulo: string; linhas: number[] }[] = [
  { titulo: 'Infraestrutura', linhas: [150, 120] },
  { titulo: 'Operação do serviço', linhas: [130, 160] },
  { titulo: 'Medição e diagnóstico', linhas: [170, 110] },
]

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
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 82% 45%, rgba(245,158,11,0.18), rgba(8,10,15,0) 50%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 100%, rgba(239,68,68,0.14), rgba(8,10,15,0) 42%)' }} />

        {/* Tabela em esqueleto */}
        <div style={{ position: 'absolute', left: 736, top: 92, width: 410, display: 'flex', flexDirection: 'column', padding: '26px 28px 12px', borderRadius: 22, background: 'linear-gradient(165deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025))', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
          {GRUPOS.map(g => (
            <div key={g.titulo} style={{ display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 19, fontWeight: 900, color: '#fff', paddingBottom: 9, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 4, background: AMBAR, marginRight: 10 }} />
                {g.titulo}
              </div>
              {g.linhas.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', marginBottom: 7, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', width: w, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.3)', marginBottom: 6 }} />
                    <div style={{ display: 'flex', width: w + 60, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                  <div style={{ display: 'flex', width: 58, height: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)' }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 650, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: AMBAR, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>Documento legal</div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 70, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span style={{ color: AMBAR }}>Subprocessadores</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3, maxWidth: 600 }}>
            Fornecedores que tratam dados pessoais a serviço da Bynx
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/subprocessadores
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
