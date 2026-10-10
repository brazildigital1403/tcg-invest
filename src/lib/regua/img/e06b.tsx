import { Abs, C, type Desenho, eObj, eStr, fundoFixo, imagemCartaImg, svgUri } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e06b-gancho (600x320). Ref.: mockups/E06B-resumo-colecao-semana-comum/assets/hero.html (v3).
 * Fundo fixo: a cena com a grade e o brilho verde (img-gancho-fundo.jpg). Por
 * cima: "a sua carta Nº 1", o nome, a etiqueta "30 dias +R$" com a faixa de
 * raspadinha (nenhum digito por baixo), a linha verde que entra na carta e a
 * carta inclinada. Versao plana: a carta gira so em Z (o mockup tem
 * perspectiva) e o holo vira um reflexo diagonal.
 *
 * Sem janela (o gancho e so a carta mais valiosa, sem subida medida): sem a
 * etiqueta, e a linha fica ambar (nunca afirma subida que nao houve).
 */

export type ImgE06B = {
  nome: string
  imagem: string
  /** "a sua carta Nº 1" quando e a mais valiosa; senao "na sua coleção". */
  kicker: string
  /** "30 dias" | "3 meses"; null = sem subida medida (so a carta). */
  janela: string | null
}

const exemplo: ImgE06B = {
  nome: 'Lugia-GX',
  imagem: 'https://images.pokemontcg.io/sm8/207.png',
  kicker: 'a sua carta Nº 1',
  janela: '30 dias',
}

function valido(d: unknown): d is ImgE06B {
  return eObj(d) && eStr(d.nome) && eStr(d.imagem) && d.imagem.length > 0 && eStr(d.kicker) && (d.janela === null || eStr(d.janela))
}

const W = 196
const H = Math.round(W * 1.395)
const CX = 378
const CY = 18
const INI: [number, number] = [40, 292]
const ENTRADA: [number, number] = [CX + 30, 176]

async function desenhar(d: ImgE06B) {
  const cor = d.janela ? C.verde : C.ambar
  const linha = `M${INI[0]},${INI[1]} C120,290 170,286 214,276 S292,252 326,230 S374,192 ${ENTRADA[0]},${ENTRADA[1]}`
  const area = `${linha} L${ENTRADA[0]},320 L${INI[0]},320 Z`
  const marcos = [[130, 288], [214, 276], [290, 246]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#0d0f14" stroke="${cor}" stroke-width="3"/>`).join('')
  const grafico = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <defs>
      <linearGradient id="vd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".26"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient>
      <filter id="brilho" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path d="${area}" fill="url(#vd)"/>
    <path d="${linha}" fill="none" stroke="${cor}" stroke-opacity=".5" stroke-width="10" stroke-linecap="round" filter="url(#brilho)"/>
    <path d="${linha}" fill="none" stroke="${cor}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${INI[0]}" cy="${INI[1]}" r="7.5" fill="#0d0f14" stroke="rgba(255,255,255,.62)" stroke-width="3.5"/>
    ${marcos}
  </svg>`
  const ponta = `M${CX - 6},${ENTRADA[1] + 40} Q${CX + 12},${ENTRADA[1] + 12} ${ENTRADA[0]},${ENTRADA[1]}`
  const topo = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <defs><filter id="b2" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <path d="${ponta}" fill="none" stroke="${cor}" stroke-opacity=".55" stroke-width="10" stroke-linecap="round" filter="url(#b2)"/>
    <path d="${ponta}" fill="none" stroke="${cor}" stroke-width="7" stroke-linecap="round"/>
  </svg>`
  // faixa de raspadinha: hachura + brilho, nenhum digito por baixo
  const rasp = `<svg xmlns="http://www.w3.org/2000/svg" width="124" height="40" viewBox="0 0 124 40">
    <defs>
      <pattern id="h" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#6c6d71"/><rect width="6" height="12" fill="#7f8084"/></pattern>
      <linearGradient id="br" x1="0" y1="0" x2="1" y2="0.3"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".44" stop-color="#fff" stop-opacity=".34"/><stop offset=".58" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="r"><rect width="124" height="40" rx="10"/></clipPath>
    </defs>
    <g clip-path="url(#r)"><rect width="124" height="40" fill="url(#h)"/><rect width="124" height="40" fill="url(#br)"/></g>
    <rect x=".5" y=".5" width="123" height="39" rx="9.5" fill="none" stroke="rgba(255,255,255,.18)"/>
  </svg>`

  const [fundo, carta] = await Promise.all([
    fundoFixo('e06b/img-gancho-fundo.jpg'),
    imagemCartaImg(d.imagem, { largura: W, altura: H }),
  ])
  const ini = d.janela ? `há ${d.janela}` : 'há 1 ano'
  const brilho = d.janela ? 'rgba(34,197,94,0.28)' : 'rgba(245,158,11,0.30)'
  const faisca = d.janela
    ? 'radial-gradient(circle at center, rgba(240,240,240,0.9) 0%, rgba(34,197,94,0.75) 18%, rgba(34,197,94,0.22) 46%, rgba(34,197,94,0) 70%)'
    : 'radial-gradient(circle at center, rgba(240,240,240,0.9) 0%, rgba(245,158,11,0.75) 18%, rgba(245,158,11,0.22) 46%, rgba(245,158,11,0) 70%)'

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(grafico)} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Abs x={28} y={16} style={{ flexDirection: 'column' }}>
        <T style={{ fontSize: 24, lineHeight: '30px', fontWeight: 700, color: C.sec }}>{d.kicker}</T>
        <T max={340} style={{ fontSize: caber(d.nome, 46, 330, 30), lineHeight: '54px', fontWeight: 900, letterSpacing: -1.5, color: C.texto }}>{d.nome}</T>
        {d.janela ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, padding: '8px 10px 8px 16px', borderRadius: 12, background: C.elevado, border: '1px solid rgba(34,197,94,0.45)', boxShadow: '0 10px 26px rgba(0,0,0,0.55), 0 0 26px rgba(34,197,94,0.16)' }}>
            <T style={{ fontSize: 24, lineHeight: '30px', fontWeight: 700, color: C.sec, marginRight: 12 }}>{d.janela}</T>
            <T style={{ fontSize: 32, lineHeight: '40px', fontWeight: 900, letterSpacing: -0.64, color: C.verde, marginRight: 12 }}>+R$</T>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={svgUri(rasp)} width={124} height={40} />
          </div>
        ) : null}
      </Abs>
      <T style={{ position: 'absolute', left: INI[0] - 12, top: INI[1] - 50, fontSize: 24, lineHeight: '28px', fontWeight: 700, color: C.sec }}>{ini}</T>

      {/* sombra no chao */}
      <Abs x={CX + 6} y={CY + H - 6} w={W + 10} h={26} style={{ borderRadius: 999, backgroundImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 70%)' }} />
      <Carta
        src={carta}
        w={W}
        h={H}
        raio={9}
        sombra={`0 26px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.14), 0 0 60px ${brilho}`}
        brilho="linear-gradient(120deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.26) 34%, rgba(255,255,255,0) 46%)"
        style={{ left: CX, top: CY, transform: 'rotate(5deg)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(topo)} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={ENTRADA[0] - 24} y={ENTRADA[1] - 24} w={48} h={48} style={{ borderRadius: 24, backgroundImage: faisca }} />
    </>
  )
}

export const e06bGancho: Desenho<ImgE06B> = { largura: 600, altura: 320, fundo: C.elevado, exemplo, valido, desenhar }
