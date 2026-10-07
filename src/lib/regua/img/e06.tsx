import { E06 } from '@/lib/regua/templates/E06'
import { Abs, C, type Desenho, brlImg, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg, svgUri } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e06-grafico (600x320). Ref.: mockups/E06-resumo-colecao/assets/hero.html.
 * Fundo fixo: cena com a grade esmaecida (img-grafico-fundo.jpg). Por cima:
 * valor de hoje, legenda, o grafico dos 7 dias (mesma curva do mockup) e a
 * carta-heroi onde a linha entra. Versao plana: a carta gira so em Z (o
 * mockup tem perspectiva) e o holo vira um reflexo diagonal.
 */

export type ImgE06 = {
  /** "06/11" (hoje) e "30/10" (primeiro dia do periodo). */
  dia: string
  inicio: string
  /** 8 valores: o do inicio e o de cada um dos 7 dias. O ultimo e o de hoje. */
  valores: number[]
  /** Indice (1..7) do dia em que a carta-heroi comecou a puxar. */
  corte: number
  /** Valor de hoje sem a carta-heroi. */
  semEle: number
  heroi: { nome: string; imagem: string }
}

const ex = E06.exemplo
const exemplo: ImgE06 = {
  dia: ex.periodo.fim,
  inicio: ex.periodo.inicio,
  // Serie da Marina no mockup aprovado (dias 1-3 Revavroom e Scizor, dia 4 Omanyte, 5-7 Giratina V).
  valores: [ex.valorInicio, 1473.45, 1441.35, 1383.4, 1444.4, 1624.4, 1844.4, ex.valorHoje],
  corte: 4,
  semEle: ex.valorHoje - (ex.movimentos.find((m) => m.slug === ex.heroi.slug)?.variacao ?? 0),
  heroi: { nome: ex.heroi.nome, imagem: 'https://images.pokemontcg.io/swsh11/186.png' },
}

function valido(d: unknown): d is ImgE06 {
  return eObj(d) && eStr(d.dia) && eStr(d.inicio) && eLista(d.valores, 8, 8) && d.valores.every(eNum) &&
    eNum(d.corte) && d.corte >= 1 && d.corte <= 7 && eNum(d.semEle) && eObj(d.heroi) && eStr(d.heroi.nome) && eStr(d.heroi.imagem)
}

const f1 = (n: number) => n.toFixed(1)

/** Mesma curva do mockup (Catmull-Rom suave, t = 0,16). */
function caminho(p: [number, number][]): string {
  let d = `M${p[0][0]},${f1(p[0][1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const t = 0.16
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t]
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t]
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${p2[0]},${f1(p2[1])}`
  }
  return d
}

async function desenhar(d: ImgE06) {
  const v = d.valores
  const semAbaixo = d.semEle < v[0]
  const corSem = semAbaixo ? C.vermelho : C.sec
  const min = Math.min(...v, d.semEle)
  const max = Math.max(...v)
  const faixa = max - min || 1
  const X = (i: number) => 40 + i * 45
  const Y = (val: number) => 286 - ((val - min) / faixa) * 106
  const P = v.map((val, i) => [X(i), Y(val)] as [number, number])
  const base = Y(v[0])
  const ys = Y(d.semEle)
  const fim = P[7]
  const W = 196
  const H = Math.round(W * 1.395)
  const cx = fim[0] + 18
  const cy = 16
  const entrada: [number, number] = [cx + 26, Math.max(fim[1] - 22, 120)]
  const linha = caminho(P)
  const linhaFim = `M${fim[0]},${f1(fim[1])} Q${fim[0] + 14},${f1(fim[1] - 4)} ${entrada[0]},${f1(entrada[1])}`
  const area = `${linha} L${fim[0]},${base} L${P[0][0]},${base} Z`
  const pontos = P.slice(1, 7).filter((_, i) => i !== d.corte - 1)
    .map(([x, y]) => `<circle cx="${x}" cy="${f1(y)}" r="5" fill="#0d0f14" stroke="#f59e0b" stroke-width="3"/>`).join('')
  const f = P[d.corte]

  const grafico = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <defs>
      <linearGradient id="verde" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity=".30"/><stop offset="1" stop-color="#22c55e" stop-opacity=".04"/></linearGradient>
      <linearGradient id="verm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity=".06"/><stop offset="1" stop-color="#ef4444" stop-opacity=".34"/></linearGradient>
      <linearGradient id="someX" gradientUnits="userSpaceOnUse" x1="${fim[0] - 70}" y1="0" x2="${fim[0]}" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
      <mask id="some"><rect x="0" y="0" width="600" height="320" fill="url(#someX)"/></mask>
      <clipPath id="acima"><rect x="0" y="0" width="600" height="${base}"/></clipPath>
      <clipPath id="abaixo"><rect x="0" y="${base}" width="600" height="${320 - base}"/></clipPath>
      <filter id="brilho" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <line x1="${P[0][0] + 14}" y1="${base}" x2="${fim[0]}" y2="${base}" stroke="rgba(255,255,255,.18)" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>
    <g mask="url(#some)">
      <path d="${area}" fill="url(#verde)" clip-path="url(#acima)"/>
      <path d="${area}" fill="url(#verm)" clip-path="url(#abaixo)"/>
    </g>
    <line x1="${f[0]}" y1="${ys}" x2="${fim[0]}" y2="${ys}" stroke="${corSem}" stroke-width="4" stroke-dasharray="9 8" stroke-linecap="round"/>
    <circle cx="${fim[0]}" cy="${ys}" r="6.5" fill="#0d0f14" stroke="${corSem}" stroke-width="3.5"/>
    <path d="${linha}" fill="none" stroke="#f59e0b" stroke-opacity=".55" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" filter="url(#brilho)"/>
    <path d="${linha}" fill="none" stroke="#f59e0b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${P[0][0]}" cy="${P[0][1]}" r="7.5" fill="#0d0f14" stroke="rgba(255,255,255,.62)" stroke-width="3.5"/>
    ${pontos}
    <circle cx="${f[0]}" cy="${f1(f[1])}" r="7" fill="#f59e0b" stroke="#0d0f14" stroke-width="3"/>
  </svg>`
  // o trecho final passa por cima da borda da carta
  const topo = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <defs><filter id="b2" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <path d="${linhaFim}" fill="none" stroke="#f59e0b" stroke-opacity=".6" stroke-width="10" stroke-linecap="round" filter="url(#b2)"/>
    <path d="${linhaFim}" fill="none" stroke="#f59e0b" stroke-width="7" stroke-linecap="round"/>
  </svg>`

  const [fundo, carta] = await Promise.all([
    fundoFixo('e06/img-grafico-fundo.jpg'),
    imagemCartaImg(d.heroi.imagem, { largura: W, altura: H }),
  ])
  const total = brlImg(v[7])
  const com = `com o ${d.heroi.nome}`
  const sem = brlImg(d.semEle)

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(grafico)} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Abs x={28} y={16} style={{ flexDirection: 'column' }}>
        <T style={{ fontSize: 24, lineHeight: '30px', fontWeight: 700, color: C.sec }}>{`sua coleção hoje, ${d.dia}`}</T>
        <T style={{ fontSize: caber(total, 48, 330, 34, 0.56), lineHeight: '52px', fontWeight: 900, letterSpacing: -1.44, color: C.texto }}>{total}</T>
      </Abs>
      <Abs x={28} y={110} h={30} style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', width: 28, height: 6, borderRadius: 3, background: C.ambar, marginRight: 10 }} />
        <T max={300} style={{ fontSize: caber(com, 24, 300, 16), lineHeight: '30px', fontWeight: 700, color: C.sec }}>{com}</T>
      </Abs>
      <Abs x={28} y={140} h={30} style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', width: 10, height: 5, background: corSem, marginRight: 8 }} />
        <div style={{ display: 'flex', width: 10, height: 5, background: corSem, marginRight: 10 }} />
        <T style={{ fontSize: 24, lineHeight: '30px', fontWeight: 700, color: C.sec }}>
          sem ele:
          <span style={{ fontWeight: 900, color: semAbaixo ? C.vermelho : C.texto, marginLeft: 7 }}>{sem}</span>
        </T>
      </Abs>
      <T style={{ position: 'absolute', left: P[0][0] - 14, top: P[0][1] - 42, fontSize: 24, lineHeight: '28px', fontWeight: 700, color: C.sec }}>{d.inicio}</T>

      {/* sombra no chao */}
      <Abs x={cx + 6} y={cy + H - 6} w={W + 10} h={26} style={{ borderRadius: 999, backgroundImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 70%)' }} />
      <Carta
        src={carta}
        w={W}
        h={H}
        raio={9}
        sombra="0 26px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.14), 0 0 56px rgba(245,158,11,0.30)"
        brilho="linear-gradient(120deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.26) 34%, rgba(255,255,255,0) 46%)"
        style={{ left: cx, top: cy, transform: 'rotate(5deg)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(topo)} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={entrada[0] - 28} y={entrada[1] - 28} w={56} h={56} style={{ borderRadius: 28, backgroundImage: 'radial-gradient(circle at center, rgba(240,240,240,0.95) 0%, rgba(245,158,11,0.85) 18%, rgba(239,68,68,0.30) 46%, rgba(239,68,68,0) 70%)' }} />
    </>
  )
}

export const e06Grafico: Desenho<ImgE06> = { largura: 600, altura: 320, fundo: C.elevado, exemplo, valido, desenhar }
